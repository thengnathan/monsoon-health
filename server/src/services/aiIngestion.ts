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
- Find the Schedule of Assessments or Visit Schedule table — read every column carefully
- Extract EVERY scheduled visit column as its own separate entry — do NOT collapse, group, or summarize similar visits
- If the table has 40 visit columns, return 40 visits. If it has 60, return 60. The count must match the table exactly.
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
- Mirror the exact numbered list from the Inclusion Criteria section
- Each top-level item has a number (1, 2, 3...) and full text
- Sub-items use their exact label from the protocol (a, b, c / i, ii, iii / bullet)
- Nest sub-items recursively up to 3 levels deep
- Preserve all thresholds, units, and qualifiers verbatim
- If there are no sub-items, return an empty array for subitems

Rules for exclusion_structured:
- Group criteria under their exact category headers as written in the protocol (e.g. "Liver Biopsy", "Laboratory and Imaging Findings", "Medical History Findings", "Other Medical Findings", "General Findings")
- If a category has a NOTE block, capture the full NOTE text in the note field, otherwise null
- Each criterion has a number and full text with nested subitems same as inclusion
- If exclusion criteria have no category headers, set category to null for all items

Rules for extracted_signal_rules (up to 6 rules):
- Pick the most clinically important criteria that could disqualify or qualify patients
- Include disease-specific imaging and biomarker criteria (e.g. FibroScan/LSM kPa, ELF score) — not just standard labs
- Include key disease-specific binary/categorical requirements as TEXT_MATCH (e.g. biopsy-proven diagnosis with required fibrosis stage) — use value_text to capture the exact requirement
- EXCLUDE relative thresholds (× ULN, × baseline) — these are unmeasurable without a local lab reference
- BETWEEN operator: use value_min + value_max; TEXT_MATCH: use value_text`;

// ── Call 2: Schedule of Assessments — per-visit assessment lists + footnotes ──

interface SoaResult {
    visit_assessments: Record<string, import('../types/clinicalSchemas').VisitAssessmentCategory[]>;
    soa_footnotes: import('../types/clinicalSchemas').SoaFootnote[];
}

const SOA_PROMPT = `Read the Schedule of Assessments (SoA) or Schedule of Activities table in this clinical trial protocol PDF.

Return this exact JSON:
{
  "visit_assessments": {
    "<visit_name>": [
      {
        "category": string,
        "items": [
          {
            "name": string,
            "footnote_keys": [string]
          }
        ]
      }
    ]
  },
  "soa_footnotes": [
    {
      "key": string,
      "text": string
    }
  ]
}

Rules for visit_assessments:
- The keys of visit_assessments must exactly match the visit column headers in the SoA table (e.g. "Screening", "Day 1", "Day 5", "Week 4")
- For each visit column, capture EVERY assessment row that is marked (X, ✓, or equivalent symbol)
- Group assessments under their exact category header rows from the SoA table (e.g. "Laboratory Tests", "Vital Signs", "Procedures", "Patient-Reported Outcomes")
- Capture the exact row label as written in the table for each assessment item name
- If an assessment row has footnote letters attached (superscript or parenthetical), capture them in footnote_keys as strings (e.g. ["a", "b"])
- If no footnotes, return empty array for footnote_keys
- If an assessment uses a special symbol for optional or predose timing, append " (optional)" or " (predose)" to the name string
- Do not skip any category or assessment row — completeness is critical for CRC use

Rules for soa_footnotes:
- Extract every footnote definition from below the SoA table
- key is the letter or symbol (e.g. "a", "b", "cc")
- text is the full verbatim footnote text
- Return empty array if no footnotes found`;

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

    // Call 2: SoA assessments — dedicated call with full token budget
    console.log('[Extraction] Call 2: Schedule of Assessments per visit...');
    try {
        const soaResult = await claudeExtractFromPDF<SoaResult>(
            pdfBuffer,
            SOA_PROMPT,
            PROTOCOL_SYSTEM,
        );
        console.log(`[Extraction] Call 2 complete — assessments for ${Object.keys(soaResult.visit_assessments ?? {}).length} visits, ${soaResult.soa_footnotes?.length ?? 0} footnotes`);

        // Merge assessments onto each visit by matching visit_name
        if (result.extracted_visits && soaResult.visit_assessments) {
            for (const visit of result.extracted_visits) {
                const assessments = soaResult.visit_assessments[visit.visit_name];
                if (assessments?.length) {
                    visit.assessments = assessments;
                }
            }
        }
        // Use Call 2's footnotes — it has full focus on the SoA table
        if (soaResult.soa_footnotes?.length) {
            result.soa_footnotes = soaResult.soa_footnotes;
        }
    } catch (err) {
        console.error('[Extraction] Call 2 (SoA assessments) failed — visits will have no assessments:', err);
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
