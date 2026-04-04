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
- Find the Schedule of Assessments or Visit Schedule table — read it carefully
- Day 1 / first dose / randomization = day_offset 0; screening visits = negative offsets
- window_before/window_after in days (e.g. "Week 4 ±3 days" → day_offset:28, window_before:3, window_after:3)
- Skip unscheduled / as-needed / early termination visits (no fixed day)
- Set is_screening and is_randomization flags correctly

Rules for inclusion_criteria and exclusion_criteria:
- Extract ALL criteria for ALL cohorts and study parts
- Each string is ONE atomic criterion
- If sub-criteria are grouped under a parent (e.g. "Lab tests: a. Albumin ≥ 3.5 g/dL, b. eGFR ≥ 45"), split into separate entries prepending the parent context
- Preserve original thresholds, units, and qualifiers verbatim
- One measurable condition = one array element

Rules for extracted_signal_rules (up to 6 rules):
- Pick the most clinically important criteria that could disqualify or qualify patients
- Include disease-specific imaging and biomarker criteria (e.g. FibroScan/LSM kPa, ELF score) — not just standard labs
- Include key disease-specific binary/categorical requirements as TEXT_MATCH (e.g. biopsy-proven diagnosis with required fibrosis stage) — use value_text to capture the exact requirement
- EXCLUDE relative thresholds (× ULN, × baseline) — these are unmeasurable without a local lab reference
- BETWEEN operator: use value_min + value_max; TEXT_MATCH: use value_text`;

export async function extractProtocol(pdfBuffer: Buffer): Promise<StructuredProtocol> {
    console.log('[Extraction] Starting native PDF extraction...');
    try {
        const result = await claudeExtractFromPDF<StructuredProtocol>(
            pdfBuffer,
            PROTOCOL_PROMPT,
            PROTOCOL_SYSTEM,
        );
        console.log(`[Extraction] Complete — ${result.inclusion_criteria?.length ?? 0} inclusion, ${result.exclusion_criteria?.length ?? 0} exclusion, ${result.extracted_visits?.length ?? 0} visits, ${result.extracted_signal_rules?.length ?? 0} signal rules`);
        return {
            ...result,
            inclusion_criteria: result.inclusion_criteria ?? [],
            exclusion_criteria: result.exclusion_criteria ?? [],
        };
    } catch (err) {
        console.error('[Extraction] Protocol extraction failed:', err);
        return { inclusion_criteria: [], exclusion_criteria: [] };
    }
}

// ── Patient document extraction ───────────────────────────────────────────────

const PATIENT_SYSTEM = `You are a clinical data extraction assistant. Extract ALL clinically relevant information from patient documents. Always capture dates when present. Return ONLY valid JSON, no markdown, no explanation.`;

const PATIENT_PROMPT = (text: string) => `Extract all clinical information from this patient document.

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
}

DOCUMENT TEXT:
${text}`;

export async function extractPatientDocument(text: string): Promise<StructuredPatientDocument> {
    const cleaned = cleanPdfText(text);
    try {
        console.log('[Extraction] Extracting patient document structured data...');
        const result = await claudeExtract<StructuredPatientDocument>(
            PATIENT_PROMPT(cleaned),
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
