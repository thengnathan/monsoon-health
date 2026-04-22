import { claudeChat, claudeExtract, claudeExtractFromPDF } from './claude';
import type { StructuredProtocol, StructuredPatientDocument } from '../types/clinicalSchemas';

// ── Text cleaning (used for patient documents only) ───────────────────────────

export function cleanPdfText(raw: string): string {
    const lines = raw.replace(/\r\n/g, '\n').split('\n');
    const result: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (/^\d{1,3}$/.test(line)) continue;
        if (line === '') { result.push(''); continue; }

        const prev = result[result.length - 1];
        const isContinuation =
            prev && prev !== '' &&
            !/[.!?:]\s*$/.test(prev) &&
            /^[a-z(]/.test(line);

        if (isContinuation) result[result.length - 1] = prev + ' ' + line;
        else result.push(line);
    }

    return result.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ── Protocol extraction (native PDF — Claude reads the document directly) ─────

const PROTOCOL_SYSTEM = `You are a clinical trial protocol analyst with deep clinical research coordination experience. You extract structured information from protocol documents for use in a clinical trial operations platform.

Return ONLY valid JSON. No markdown. No explanation. No preamble.`;

// ── Call 1: Protocol metadata, visits (no assessments), criteria, signal rules ─

const PROTOCOL_PROMPT = `Extract all structured information from this clinical trial protocol PDF.

Return this exact JSON:
{
  "title": string,
  "sponsor": string,
  "protocol_number": string,
  "phase": string,
  "indication": string,
  "specialty": string,
  "primary_endpoint": string,
  "secondary_endpoints": [string],
  "study_duration": string,
  "estimated_enrollment": number | null,
  "extracted_visits": [
    {
      "visit_name": string,
      "visit_label": string | null,
      "day_offset": number,
      "window_before": number,
      "window_after": number,
      "is_screening": boolean,
      "is_randomization": boolean,
      "notes": string | null
    }
  ],
  "inclusion_criteria": [string],
  "exclusion_criteria": [string],
  "inclusion_structured": [
    {
      "category": string | null,
      "note": string | null,
      "criteria": [
        {
          "number": number,
          "text": string,
          "subitems": [
            {
              "label": string,
              "text": string,
              "subitems": [
                {
                  "label": string,
                  "text": string
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  "exclusion_structured": [
    {
      "category": string | null,
      "note": string | null,
      "criteria": [
        {
          "number": number,
          "text": string,
          "subitems": [
            {
              "label": string,
              "text": string,
              "subitems": [
                {
                  "label": string,
                  "text": string
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  "extracted_signal_rules": [
    {
      "cohort": string | null,
      "field": string,
      "label": string,
      "unit": string | null,
      "operator": "GTE" | "LTE" | "EQ" | "BETWEEN" | "TEXT_MATCH",
      "value": number | null,
      "value_min": number | null,
      "value_max": number | null,
      "value_text": string | null,
      "source_criterion": string
    }
  ]
}

Rules for extracted_visits:
- Find ALL Schedule of Assessments / Visit Schedule tables — many protocols have multiple (one per cohort, arm, or study part)
- If the protocol has multiple cohorts or arms (Cohort A/B/C/D, Part 1/2/3, Arm 1/2, etc.), extract visits from EVERY cohort's schedule, not just the first
- Prefix each visit name with the cohort/arm label when multiple schedules exist to avoid collisions (e.g. "Cohort A - Screening", "Cohort D - Week 1")
- Extract EVERY scheduled visit column as its own separate entry — do NOT collapse, group, or summarize similar visits
- If a single table has 40 visit columns, return 40 visits. The count must match the table exactly.
- Day-numbered visits (e.g. Day 5, Day 6, Day 7) are each separate visits — extract all of them individually
- Day 1 / first dose / randomization = day_offset 0; screening visits = negative offsets
- window_before/window_after in days (e.g. "Week 4 ±3 days" → day_offset:28, window_before:3, window_after:3)
- Skip only truly unscheduled / as-needed / early termination visits (no fixed day)
- Set is_screening and is_randomization flags correctly
- Do NOT include assessments in this call — assessments are extracted separately

Rules for inclusion_criteria and exclusion_criteria:
- Extract ALL criteria for ALL cohorts and study parts
- Each string is ONE atomic criterion
- If sub-criteria are grouped under a parent (e.g. "Lab tests: a. Albumin ≥ 3.5 g/dL, b. eGFR ≥ 45"), split into separate entries prepending the parent context
- Preserve original thresholds, units, and qualifiers verbatim
- One measurable condition = one array element

Rules for inclusion_structured:
- Use the SAME grouped format as exclusion_structured — group criteria by cohort, arm, or study part
- If the protocol has a main study plus additional cohorts (e.g. "Main Study" + "Cohort D"), create one group per cohort using the cohort label as the category (e.g. "Main Study", "Cohort D")
- If all inclusion criteria apply to all participants (no cohort split), use a single group with category: null
- Within each group, mirror the exact numbered list from that cohort's Inclusion Criteria section
- Each criterion has a number and full text with nested subitems (same structure as exclusion)
- Sub-items use their exact label from the protocol (a, b, c / i, ii, iii / bullet), nested recursively up to 3 levels
- Preserve all thresholds, units, and qualifiers verbatim
- If there are no sub-items, return an empty array for subitems
- If a group has a NOTE block, capture it in the note field, otherwise null

Rules for exclusion_structured:
- Group criteria under their exact category headers as written in the protocol (e.g. "Liver Biopsy", "Laboratory and Imaging Findings", "Medical History Findings", "Other Medical Findings", "General Findings")
- If a category has a NOTE block, capture the full NOTE text in the note field, otherwise null
- Each criterion has a number and full text with nested subitems same as inclusion
- If exclusion criteria have no category headers, set category to null for all items

Rules for extracted_signal_rules:
- Extract signal rules per cohort/arm/study part — if the protocol has a main study AND Cohort A/B/C/D, extract rules for EACH separately
- Set cohort to null for main study / global criteria that apply to all cohorts; set cohort to the exact cohort label (e.g. "Cohort D", "Part 2") for cohort-specific criteria
- If a criterion appears in both the main study and a cohort with different thresholds, emit separate rules for each
- Pick the most clinically important criteria that could disqualify or qualify patients (up to 6 per cohort)
- Include disease-specific imaging and biomarker criteria (e.g. FibroScan/LSM kPa, ELF score) — not just standard labs
- Include key disease-specific binary/categorical requirements as TEXT_MATCH (e.g. biopsy-proven diagnosis with required fibrosis stage) — use value_text to capture the exact requirement
- EXCLUDE relative thresholds (× ULN, × baseline) — these are unmeasurable without a local lab reference
- BETWEEN operator: use value_min + value_max; TEXT_MATCH: use value_text`;

// ── Call 2: Schedule of Assessments — per-visit assessment lists + footnotes ──

interface SoaResult {
    visit_assessments: Record<string, import('../types/clinicalSchemas').VisitAssessmentCategory[]>;
    soa_footnotes: import('../types/clinicalSchemas').SoaFootnote[];
}

// Row-first extraction shape — one entry per assessment row, with a list of
// visits where that row is marked. Transposed to visit_assessments in code.
interface SoaRowResult {
    assessment_rows: {
        assessment: string;
        category: string;
        visits_marked: string[];
        footnote_keys: string[];
    }[];
    soa_footnotes: import('../types/clinicalSchemas').SoaFootnote[];
}

const SOA_PROMPT = `You are extracting the Schedule of Assessments (SoA) from a clinical trial protocol PDF. This is a critical task — CRCs rely on this data to know exactly what must be done at every visit.

STEP 1 — SCAN FIRST: Read through the ENTIRE document and identify every SoA / Schedule of Activities table. Many protocols have multiple tables (one per cohort, arm, or study part). Note which pages each table spans.

STEP 2 — EXTRACT ROW BY ROW (critical): For each table, go row by row through every assessment row. For each row, record the exact row label, its category, and the list of visit columns where the cell is marked (X, ✓, •, a footnote letter, Y, "x", a filled circle, or any symbol indicating the assessment is required). An empty cell means the assessment does NOT occur at that visit.

WHY ROW-FIRST MATTERS: SoA tables often span multiple pages. Column headers (visit names) appear only on the first page of the table, but assessment rows continue onto subsequent pages. If you walked column-by-column you would lose track of rows on continuation pages. By walking row-by-row, each row stays intact regardless of which page it appears on — you only need to remember the column positions from the header page and apply them consistently to every continuation row. The canonical visit-name list is provided below; use it as the authoritative set of column anchors.

Return this exact JSON:
{
  "assessment_rows": [
    {
      "assessment": string,          // exact row label as written in the table
      "category": string,            // nearest preceding section header (e.g. "Laboratory Assessments")
      "visits_marked": [string],     // visit names from the provided list where this row is marked
      "footnote_keys": [string]      // superscript footnotes attached to the row label (e.g. ["a"], ["b","c"])
    }
  ],
  "soa_footnotes": [
    { "key": string, "text": string }
  ]
}

Rules for assessment_rows — completeness is critical:
- Include EVERY row in every SoA table — do not skip routine, obvious, or repetitive items
- Safety/administrative items ("Adverse Event Assessment", "Concomitant Medication Review", "Study Drug Administration/Dispensing", "Protocol Deviation Review", "Vital Signs", "Physical Examination") are marked in nearly every visit column. If a row has marks across 30 columns, visits_marked MUST contain 30 visit names — do NOT collapse or summarize
- Do not substitute a category summary (e.g. "Safety Assessments") for the individual row items — each row label in the table is its own entry
- Preserve the exact row label as it appears in the table
- When a table spans multiple pages, the row cells continue on later pages. Read those continuation cells and include the corresponding visit names in visits_marked for that row

Rules for category:
- Use the exact section header as written in the SoA (e.g. "Laboratory Assessments", "Vital Signs", "Efficacy Assessments", "Patient-Reported Outcomes", "Procedures", "Administrative")
- Assign each row to its nearest preceding section header
- If the table has no category headers, use "Assessments" for all rows

Rules for visits_marked:
- Use ONLY visit names from the provided canonical list — NEVER invent names
- If a SoA column has modifiers like "(Home)", "(Remote)", "(TV)", "(Phone)", "(Optional)", or visit numbers, match it to the base visit name in the provided list
- If a column in the table has no reasonable match in the provided list, skip it entirely — do NOT add an invented name
- When multiple SoA tables exist (multiple cohorts/arms/parts), only use visit names from the provided list for the cohort you are extracting

Rules for footnotes:
- footnote_keys on an assessment row captures superscript letters/numbers/symbols attached to the row label
- soa_footnotes lists every footnote definition below any SoA table — include full verbatim text
- Return empty array when no footnotes apply`;

// ── SoA helpers ───────────────────────────────────────────────────────────────

const SOA_MAX_TOKENS = 64000;

// Detect cohort groups from prefixed visit names (e.g. "Cohort D - Week 1").
// Returns a map of { cohortLabel → visitNames[] } when ≥2 distinct prefixes each
// appear on ≥2 visits. Returns null when everything is a single schedule.
function detectCohortGroups(visitNames: string[]): Map<string, string[]> | null {
    const prefixCounts = new Map<string, number>();
    for (const name of visitNames) {
        const m = name.match(/^(.+?)\s*[-–]\s*.+/);
        if (m) prefixCounts.set(m[1].trim(), (prefixCounts.get(m[1].trim()) ?? 0) + 1);
    }
    const cohorts = [...prefixCounts.entries()].filter(([, n]) => n >= 2).map(([p]) => p);
    if (cohorts.length < 2) return null;

    const groups = new Map<string, string[]>();
    for (const name of visitNames) {
        const matched = cohorts.find(c => name.startsWith(c + ' - ') || name.startsWith(c + ' – '));
        const key = matched ?? '__other__';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(name);
    }
    return groups;
}

// Build a focused SoA prompt that tells Claude the exact visit names to use
// and optionally restricts it to a specific cohort's table.
function buildSoaPrompt(visitNames: string[], cohortLabel?: string): string {
    const nameList = visitNames.map(n => `- "${n}"`).join('\n');
    const focus = cohortLabel
        ? `Focus ONLY on the SoA table for ${cohortLabel}. Ignore all other cohort/arm tables in this document.\n\n`
        : '';
    return `${focus}${SOA_PROMPT}

CANONICAL VISIT NAMES — use EXACTLY these strings in visits_marked:
${nameList}

Column-to-visit mapping:
- A SoA column "Week 5 (Home)", "Week 5 (TV)", "Week 5 (Phone)", "Week 5 (Remote)" or any variant maps to "Week 5"
- A SoA column "Screening (Visit 1)" or "Visit 1 - Screening" maps to "Screening"
- Strip modifiers like "(Home)", "(Remote)", "(Phone)", "(TV)", "(Optional)", visit numbers, and parenthetical notes — match on the core visit name
- If a column in the table has no match in the canonical list above, skip that column entirely`;
}

// Transpose row-first Claude output into the column-first SoaResult shape the
// rest of the pipeline expects. Unknown visit names (not in allowedVisitNames)
// are dropped so one bad label can't pollute a real visit's assessments.
function transposeRowsToVisits(
    rowResult: SoaRowResult,
    allowedVisitNames: string[],
): SoaResult {
    const allowed = new Set(allowedVisitNames);
    const visitAssessments: Record<string, import('../types/clinicalSchemas').VisitAssessmentCategory[]> = {};
    let droppedVisits = 0;

    for (const row of rowResult.assessment_rows ?? []) {
        if (!row.assessment || !row.visits_marked?.length) continue;
        const category = row.category?.trim() || 'Assessments';

        for (const visit of row.visits_marked) {
            if (!allowed.has(visit)) { droppedVisits++; continue; }
            if (!visitAssessments[visit]) visitAssessments[visit] = [];

            let catEntry = visitAssessments[visit].find(c => c.category === category);
            if (!catEntry) {
                catEntry = { category, items: [] };
                visitAssessments[visit].push(catEntry);
            }
            catEntry.items.push({ name: row.assessment, footnote_keys: row.footnote_keys ?? [] });
        }
    }

    const totalRows = rowResult.assessment_rows?.length ?? 0;
    const populatedVisits = Object.keys(visitAssessments).length;
    console.log(`[SoA Transpose] ${totalRows} assessment rows → ${populatedVisits} visits populated${droppedVisits ? ` (${droppedVisits} row-visit refs dropped as unknown)` : ''}`);

    return { visit_assessments: visitAssessments, soa_footnotes: rowResult.soa_footnotes ?? [] };
}

// Merge one SoA result into the accumulated result (assessments + first-seen footnotes)
function mergeSoaResult(acc: SoaResult, incoming: SoaResult): void {
    Object.assign(acc.visit_assessments, incoming.visit_assessments ?? {});
    if (!acc.soa_footnotes.length && incoming.soa_footnotes?.length) {
        acc.soa_footnotes = incoming.soa_footnotes;
    }
}

// Merge SoA assessments onto extracted visits using exact → normalised → partial matching
function applyAssessmentsToVisits(
    visits: import('../types/clinicalSchemas').ExtractedVisit[],
    visitAssessments: Record<string, import('../types/clinicalSchemas').VisitAssessmentCategory[]>,
): void {
    const norm = (s: string) =>
        s.toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
    const soaKeys = Object.keys(visitAssessments);
    const soaNorm = soaKeys.map(k => ({ key: k, n: norm(k) }));

    console.log(`[SoA Merge] Call 2 returned ${soaKeys.length} visit keys: ${soaKeys.map(k => `"${k}"`).join(', ')}`);

    let matched = 0;
    const unmatched: string[] = [];

    for (const visit of visits) {
        let assessments = visitAssessments[visit.visit_name];
        let matchType = 'exact';

        if (!assessments?.length) {
            matchType = 'normalised';
            const vn = norm(visit.visit_name);
            const hit = soaNorm.find(s => s.n === vn);
            if (hit) assessments = visitAssessments[hit.key];
        }
        if (!assessments?.length) {
            matchType = 'partial';
            const vn = norm(visit.visit_name);
            const hit = soaNorm.find(s => s.n.includes(vn) || vn.includes(s.n));
            if (hit) assessments = visitAssessments[hit.key];
        }

        if (assessments?.length) {
            visit.assessments = assessments;
            matched++;
            console.log(`[SoA Merge] ✓ "${visit.visit_name}" — ${assessments.reduce((n, c) => n + c.items.length, 0)} assessments (${matchType} match)`);
        } else {
            unmatched.push(visit.visit_name);
        }
    }

    if (unmatched.length) {
        console.warn(`[SoA Merge] ✗ No assessments found for ${unmatched.length} visit(s): ${unmatched.map(n => `"${n}"`).join(', ')}`);
    }
    console.log(`[SoA Merge] Done — ${matched}/${visits.length} visits populated`);
}

// ── Protocol extraction ───────────────────────────────────────────────────────

export async function extractProtocol(
    pdfBuffer: Buffer,
    onCall1Complete?: (partial: StructuredProtocol) => Promise<void>,
): Promise<StructuredProtocol> {
    console.log('[Extraction] Call 1: metadata, visits, criteria, signal rules...');
    let result: StructuredProtocol;
    try {
        result = await claudeExtractFromPDF<StructuredProtocol>(
            pdfBuffer,
            PROTOCOL_PROMPT,
            PROTOCOL_SYSTEM,
        );
        result = {
            ...result,
            inclusion_criteria: result.inclusion_criteria ?? [],
            exclusion_criteria: result.exclusion_criteria ?? [],
        };
        console.log(`[Extraction] Call 1 complete — ${result.inclusion_criteria.length} inclusion, ${result.exclusion_criteria.length} exclusion, ${result.extracted_visits?.length ?? 0} visits, ${result.extracted_signal_rules?.length ?? 0} signal rules`);
    } catch (err) {
        console.error('[Extraction] Call 1 failed:', err);
        return { inclusion_criteria: [], exclusion_criteria: [] };
    }

    // Persist Call 1 results immediately so the UI is responsive while Call 2 runs
    if (onCall1Complete) {
        try {
            await onCall1Complete(result);
        } catch (err) {
            console.error('[Extraction] onCall1Complete callback failed:', err);
        }
    }

    // Call 2: SoA assessments
    // - Injects Call 1 visit names so Claude uses the exact same keys (eliminates name mismatch)
    // - Splits into one call per cohort when multiple cohort schedules are detected
    //   (keeps each call's output within the token budget)
    // - Uses a higher token limit (64k) since full SoA JSON can be large
    const visitNames = result.extracted_visits?.map(v => v.visit_name) ?? [];
    const cohortGroups = detectCohortGroups(visitNames);

    const accumulated: SoaResult = { visit_assessments: {}, soa_footnotes: [] };

    if (cohortGroups && cohortGroups.size > 1) {
        const cohortEntries = [...cohortGroups.entries()];
        console.log(`[Extraction] Call 2: ${cohortEntries.length} cohort SoA calls in parallel (${cohortEntries.map(([c]) => c).join(', ')})`);
        const cohortResults = await Promise.allSettled(
            cohortEntries.map(([cohort, names]) => {
                const label = cohort === '__other__' ? undefined : cohort;
                console.log(`[Extraction] Call 2 — cohort "${label ?? 'main'}" starting (${names.length} visits)`);
                return claudeExtractFromPDF<SoaRowResult>(
                    pdfBuffer,
                    buildSoaPrompt(names, label),
                    PROTOCOL_SYSTEM,
                    SOA_MAX_TOKENS,
                ).then(rowResult => {
                    console.log(`[Extraction] Call 2 cohort "${label ?? 'main'}" complete — ${rowResult.assessment_rows?.length ?? 0} assessment rows`);
                    return transposeRowsToVisits(rowResult, names);
                });
            })
        );
        for (const r of cohortResults) {
            if (r.status === 'fulfilled') mergeSoaResult(accumulated, r.value);
            else console.error('[Extraction] Call 2 cohort failed:', r.reason);
        }
    } else {
        console.log(`[Extraction] Call 2: single SoA call (${visitNames.length} visits)`);
        try {
            const rowResult = await claudeExtractFromPDF<SoaRowResult>(
                pdfBuffer,
                buildSoaPrompt(visitNames),
                PROTOCOL_SYSTEM,
                SOA_MAX_TOKENS,
            );
            console.log(`[Extraction] Call 2 complete — ${rowResult.assessment_rows?.length ?? 0} assessment rows, ${rowResult.soa_footnotes?.length ?? 0} footnotes`);
            const soaResult = transposeRowsToVisits(rowResult, visitNames);
            mergeSoaResult(accumulated, soaResult);
        } catch (err) {
            console.error('[Extraction] Call 2 (SoA assessments) failed — visits will have no assessments:', err);
        }
    }

    if (result.extracted_visits && Object.keys(accumulated.visit_assessments).length > 0) {
        applyAssessmentsToVisits(result.extracted_visits, accumulated.visit_assessments);
    }
    if (accumulated.soa_footnotes.length) {
        result.soa_footnotes = accumulated.soa_footnotes;
    }

    return result;
}

// ── Patient document extraction ───────────────────────────────────────────────

const PATIENT_SYSTEM = `You are a clinical data extraction assistant. Extract ALL clinically relevant information from patient documents. Always capture dates when present. Return ONLY valid JSON, no markdown, no explanation.`;

const PATIENT_PROMPT = `Extract all clinical information from this patient document PDF.

Rules:
- Always include a date (YYYY-MM-DD) on every lab, vital, and imaging result if a date is present anywhere in the document
- If a date is not specified for a value, omit the date field rather than guessing
- Extract every lab value present — do not skip routine labs
- For imaging, capture the numeric result value where applicable (e.g. FibroScan kPa score)
- For diagnoses, determine status: "active" (current), "resolved" (past/historical), or "chronic" (ongoing)
- Omit any field entirely if not found in the document

Return this exact JSON shape:
{
  "first_name": string,
  "last_name": string,
  "dob": "YYYY-MM-DD",
  "mrn": string,
  "sex": string,
  "age": number,
  "diagnoses": [{ "name": string, "status": "active"|"resolved"|"chronic", "onset_date": string }],
  "medical_history": [{ "condition": string, "date": string, "notes": string }],
  "surgical_history": [{ "procedure": string, "date": string, "notes": string }],
  "medications": [{ "name": string, "dose": string, "frequency": string, "start_date": string }],
  "allergies": [string],
  "family_history": [string],
  "labs": [{ "name": string, "value": number|string, "unit": string, "date": "YYYY-MM-DD", "flag": "high"|"low"|"critical"|null }],
  "vitals": [{ "name": string, "value": number|string, "unit": string, "date": "YYYY-MM-DD" }],
  "imaging": [{ "type": string, "value": number, "unit": string, "date": "YYYY-MM-DD", "findings": string }],
  "smoking_status": string,
  "alcohol_use": string,
  "clinical_notes": string
}`;

export async function extractPatientDocument(pdfBuffer: Buffer): Promise<StructuredPatientDocument> {
    try {
        console.log('[Extraction] Extracting patient document via native PDF...');
        const result = await claudeExtractFromPDF<StructuredPatientDocument>(
            pdfBuffer,
            PATIENT_PROMPT,
            PATIENT_SYSTEM,
        );
        console.log('[Extraction] Patient extraction complete');
        return result;
    } catch (err) {
        console.error('[Extraction] Patient extraction failed:', err);
        return {};
    }
}

// ── HTML rendering (kept for display in UI) ───────────────────────────────────

export function criteriaToHtml(items: string[]): string {
    if (!items || items.length === 0) return '';
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const bold = (s: string) => s.replace(
        /((?:[≥≤≠]|>=?|<=?)\s*\d+\.?\d*(?:\s*(?:mg\/dL|g\/dL|kPa|%|IU\/mL|mL\/min|μL|mmol\/L|IU\/L|ng\/mL|years?))?)/g,
        '<strong>$1</strong>'
    );
    return '<ol>' + items.map(c => `<li>${bold(esc(c))}</li>`).join('') + '</ol>';
}
