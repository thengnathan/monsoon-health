import { claudeChat, claudeExtract } from './claude';
import type { StructuredProtocol, StructuredPatientDocument } from '../types/clinicalSchemas';

// ── Text cleaning ─────────────────────────────────────────────────────────────

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

// ── Protocol extraction ───────────────────────────────────────────────────────

const PROTOCOL_SYSTEM = `You are a clinical trial protocol analyst. Extract structured information from protocol documents. Return ONLY valid JSON, no markdown, no explanation.`;

const PROTOCOL_PROMPT = (text: string) => `Extract information from this clinical trial protocol and return a JSON object.

For inclusion_criteria and exclusion_criteria: extract each criterion as a complete, clean sentence exactly as written in the protocol. One string per criterion. Do not summarize, combine, or interpret — faithfully reproduce each criterion.

For visit_schedule: write a concise plain-text summary of the study visit schedule (e.g. "Screening (Day -28 to -1), Baseline (Day 1), Week 4, Week 12, Week 24 (EOT), Follow-up (Week 28)"). If no visit schedule is found, return null.

For extracted_visits: extract each study visit as a structured object. Day 1 / Baseline = day_offset 0. Screening visits get negative day_offsets (e.g. a screening window of Day -28 to -1 → day_offset: -14, window_before: 14, window_after: 13). For ±-windowed visits (e.g. "Week 4, ±3 days"), use day_offset: 28, window_before: 3, window_after: 3. If no window is specified, use 0 for both. Include all visits in chronological order.

For extracted_signal_rules: extract 6–10 of the most important measurable screening criteria as structured signal rule objects. These are the criteria a coordinator checks first when evaluating a patient.

Rules for extracted_signal_rules:
- "criteria_text": the human-readable criterion exactly as it appears (e.g. "FibroScan ≥ 8 kPa", "Age 18–75 years", "Biopsy-proven NASH fibrosis stage 1–4")
- "signal_label": a short label for the measurement (e.g. "Age", "FibroScan", "HbA1c", "Platelet Count")
- "operator": one of "GTE" (≥), "LTE" (≤), "EQ" (=), "BETWEEN" (range), or "TEXT_MATCH" (qualitative/non-numeric)
- For ranges like "Age 18–75": use operator "BETWEEN" with "min_value" and "max_value"
- For single thresholds like "HbA1c ≤ 9.5%": use operator "LTE" with "threshold_number": 9.5
- For qualitative criteria like "Biopsy-proven NASH": use operator "TEXT_MATCH" (no numeric fields)
- "unit": the measurement unit if applicable (e.g. "years", "kPa", "%", "×10⁹/μL")
- EXCLUDE any criterion whose threshold is relative rather than absolute — i.e. expressed as a multiple of ULN (Upper Limit of Normal), baseline, or any other reference value (e.g. "ALT ≤ 5 × ULN", "AST ≤ 3 × ULN", "creatinine ≤ 1.5 × ULN"). These cannot be evaluated against patient data without knowing the lab's reference range. Only include criteria with fixed, absolute numeric thresholds or qualitative criteria.

Return this exact JSON shape (omit fields not found in the document):
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
  "inclusion_criteria": [string],
  "exclusion_criteria": [string],
  "visit_schedule": string | null,
  "extracted_signal_rules": [
    {
      "criteria_text": string,
      "signal_label": string,
      "operator": "GTE" | "LTE" | "EQ" | "BETWEEN" | "TEXT_MATCH",
      "threshold_number": number | null,
      "min_value": number | null,
      "max_value": number | null,
      "unit": string | null
    }
  ],
  "extracted_visits": [
    {
      "visit_name": string,
      "day_offset": number,
      "window_before": number,
      "window_after": number,
      "notes": string | null
    }
  ]
}

PROTOCOL TEXT:
${text}`;

export async function extractProtocol(text: string): Promise<StructuredProtocol> {
    const cleaned = cleanPdfText(text);
    try {
        console.log('[Extraction] Extracting protocol structured data...');
        const result = await claudeExtract<StructuredProtocol>(
            PROTOCOL_PROMPT(cleaned),
            PROTOCOL_SYSTEM,
        );
        console.log(`[Extraction] Protocol extraction complete — ${result.inclusion_criteria?.length ?? 0} inclusion, ${result.exclusion_criteria?.length ?? 0} exclusion criteria`);
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
