import { v4 as uuidv4 } from 'uuid';
import { ollamaExtract } from './ollama';
import type { ExtractedProtocolData } from './aiIngestion';

export interface CriterionResult {
    criterion: string;
    type: 'inclusion' | 'exclusion';
    status: 'PASS' | 'FAIL' | 'UNKNOWN';
    reason: string;
}

export interface MatchResult {
    overall_status: 'LIKELY_ELIGIBLE' | 'BORDERLINE' | 'LIKELY_INELIGIBLE';
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    criteria_results: CriterionResult[];
    summary: string;
    missing_data: string[];
}

const MATCHING_SYSTEM = `You are a clinical trial eligibility screener. Given a patient's clinical data and a protocol's eligibility criteria, determine if the patient meets each criterion. Be precise. If data is missing, mark as UNKNOWN. Return ONLY valid JSON.`;

function buildMatchingPrompt(patientData: Record<string, unknown>, criteria: ExtractedProtocolData): string {
    const allCriteria = [
        ...criteria.inclusion_criteria.map(c => ({ ...c, type: 'inclusion' as const })),
        ...criteria.exclusion_criteria.map(c => ({ ...c, type: 'exclusion' as const })),
    ];

    return `Evaluate this patient's eligibility for the clinical trial.

TRIAL: ${criteria.title || 'Unknown'} | Indication: ${criteria.indication || 'Unknown'}

PATIENT DATA:
${JSON.stringify(patientData, null, 2)}

ELIGIBILITY CRITERIA:
${allCriteria.map((c, i) => `${i + 1}. [${c.type.toUpperCase()}] ${c.text}`).join('\n')}

Return a JSON object:
{
  "overall_status": "LIKELY_ELIGIBLE" | "BORDERLINE" | "LIKELY_INELIGIBLE",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "summary": string (1-2 sentence summary for the coordinator),
  "missing_data": [string] (list of data points needed but not in patient record),
  "criteria_results": [
    {
      "criterion": string (the criterion text),
      "type": "inclusion" | "exclusion",
      "status": "PASS" | "FAIL" | "UNKNOWN",
      "reason": string (brief explanation)
    }
  ]
}

Rules:
- UNKNOWN means the patient record doesn't have enough data to evaluate
- For exclusion criteria: PASS means the patient does NOT have the exclusion (good), FAIL means they DO
- LIKELY_ELIGIBLE: passes all known inclusion criteria, no known exclusions, few unknowns
- BORDERLINE: passes most criteria but has unknowns or borderline values
- LIKELY_INELIGIBLE: fails one or more inclusion criteria OR meets an exclusion criterion`;
}

export async function matchPatientToProtocol(
    patientData: Record<string, unknown>,
    criteria: ExtractedProtocolData
): Promise<MatchResult> {
    try {
        return await ollamaExtract<MatchResult>(
            buildMatchingPrompt(patientData, criteria),
            MATCHING_SYSTEM
        );
    } catch (err) {
        console.error('[Matching] Failed to match patient:', err);
        return {
            overall_status: 'BORDERLINE',
            confidence: 'LOW',
            criteria_results: [],
            summary: 'Matching could not be completed automatically. Manual review required.',
            missing_data: [],
        };
    }
}

export async function runProtocolMatching(
    db: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> },
    siteId: string,
    trialId: string,
    userId: string
): Promise<{ matched: number; assigned: number }> {
    console.log(`[Matching] Starting protocol matching for trial ${trialId}`);

    // Get the trial with extracted criteria
    const trial = (await db.query(
        'SELECT * FROM trials WHERE id = $1 AND site_id = $2',
        [trialId, siteId]
    )).rows[0];

    if (!trial || !trial.extracted_criteria_json) {
        console.log('[Matching] No extracted criteria found, skipping');
        return { matched: 0, assigned: 0 };
    }

    let criteria: ExtractedProtocolData;
    try {
        criteria = JSON.parse(trial.extracted_criteria_json as string) as ExtractedProtocolData;
    } catch {
        console.log('[Matching] Failed to parse criteria JSON');
        return { matched: 0, assigned: 0 };
    }

    // Get all patients for the site
    const { rows: patients } = await db.query(
        'SELECT * FROM patients WHERE site_id = $1',
        [siteId]
    );

    let matched = 0;
    let assigned = 0;

    for (const patient of patients) {
        try {
            // Build patient data bundle: base info + signals + extracted document data
            const { rows: signals } = await db.query(
                `SELECT ps.value_number, ps.value_text, ps.value_enum, ps.collected_at,
                        st.name as signal_name, st.label, st.unit
                 FROM patient_signals ps
                 JOIN signal_types st ON ps.signal_type_id = st.id
                 WHERE ps.patient_id = $1 AND ps.site_id = $2
                 ORDER BY ps.collected_at DESC`,
                [patient.id, siteId]
            );

            const { rows: docs } = await db.query(
                `SELECT raw_extracted_data FROM patient_documents
                 WHERE patient_id = $1 AND raw_extracted_data IS NOT NULL
                 ORDER BY created_at DESC LIMIT 5`,
                [patient.id]
            );

            // Merge all extracted document data
            const mergedDocData: Record<string, unknown> = {};
            for (const doc of docs.reverse()) {
                try {
                    const parsed = JSON.parse(doc.raw_extracted_data as string) as Record<string, unknown>;
                    Object.assign(mergedDocData, parsed);
                } catch { /* skip unparseable */ }
            }

            // Build structured signals map
            const signalMap: Record<string, unknown> = {};
            for (const sig of signals) {
                const val = (sig.value_number ?? sig.value_text ?? sig.value_enum) as unknown;
                signalMap[sig.signal_name as string] = { value: val, unit: sig.unit, date: sig.collected_at };
            }

            const patientBundle = {
                id: patient.id,
                first_name: patient.first_name,
                last_name: patient.last_name,
                dob: patient.dob,
                ...mergedDocData,
                signals: signalMap,
            };

            const result = await matchPatientToProtocol(patientBundle, criteria);
            matched++;

            // Store signal results
            const signalId = uuidv4();
            await db.query(
                `INSERT INTO patient_protocol_signals
                 (id, site_id, patient_id, trial_id, overall_status, confidence, criteria_breakdown, summary, missing_data, last_evaluated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
                 ON CONFLICT (patient_id, trial_id)
                 DO UPDATE SET overall_status = $5, confidence = $6, criteria_breakdown = $7,
                               summary = $8, missing_data = $9, last_evaluated_at = NOW()`,
                [
                    signalId, siteId, patient.id, trialId,
                    result.overall_status,
                    result.confidence,
                    JSON.stringify(result.criteria_results),
                    result.summary,
                    JSON.stringify(result.missing_data),
                ]
            );

            // Auto-assign likely eligible or borderline patients to screening log
            if (result.overall_status === 'LIKELY_ELIGIBLE' || result.overall_status === 'BORDERLINE') {
                const existing = (await db.query(
                    'SELECT id FROM screening_cases WHERE patient_id = $1 AND trial_id = $2 AND site_id = $3',
                    [patient.id, trialId, siteId]
                )).rows[0];

                if (!existing) {
                    const caseId = uuidv4();
                    await db.query(
                        `INSERT INTO screening_cases
                         (id, site_id, patient_id, trial_id, assigned_user_id, status, last_touched_at)
                         VALUES ($1, $2, $3, $4, $5, 'NEW', NOW())`,
                        [caseId, siteId, patient.id, trialId, userId]
                    );

                    // Mark that this was auto-assigned
                    await db.query(
                        `UPDATE patient_protocol_signals SET auto_assigned = true, assigned_at = NOW()
                         WHERE patient_id = $1 AND trial_id = $2`,
                        [patient.id, trialId]
                    );

                    assigned++;
                    console.log(`[Matching] Auto-assigned patient ${patient.id} to trial ${trialId} (${result.overall_status})`);
                }
            }
        } catch (err) {
            console.error(`[Matching] Error processing patient ${patient.id}:`, err);
        }
    }

    console.log(`[Matching] Complete: ${matched} evaluated, ${assigned} auto-assigned`);
    return { matched, assigned };
}
