import { ollamaExtract } from './ollama';

/**
 * Clean raw PDF text extracted from clinical trial protocols:
 * - Remove embedded line/page numbers (e.g. lines that are just "13", "14")
 * - Re-join lines split by those numbers into full sentences
 * - Preserve real criterion breaks (numbered items, lettered sub-items, blank lines)
 */
export function cleanPdfText(raw: string): string {
    const lines = raw.replace(/\r\n/g, '\n').split('\n');
    const result: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip standalone numbers (line/page numbers 1-999)
        if (/^\d{1,3}$/.test(line)) continue;

        // Skip blank lines between what looks like continuation text
        // (handled by joining logic below)
        if (line === '') {
            result.push('');
            continue;
        }

        const prev = result[result.length - 1];

        // If previous line exists and doesn't end with sentence-ending punctuation,
        // and current line starts with lowercase (continuation), join them
        const isContinuation =
            prev &&
            prev !== '' &&
            !/[.!?:]\s*$/.test(prev) &&
            /^[a-z(]/.test(line);

        if (isContinuation) {
            result[result.length - 1] = prev + ' ' + line;
        } else {
            result.push(line);
        }
    }

    return result
        // Collapse 3+ blank lines to 1
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export interface ExtractedPatientData {
    first_name?: string;
    last_name?: string;
    dob?: string;
    internal_identifier?: string;
    // Clinical data — everything we can find
    diagnoses?: string[];
    medical_history?: string[];
    medications?: string[];
    allergies?: string[];
    procedures?: string[];
    labs?: Record<string, { value: number | string; unit?: string; date?: string }>;
    vitals?: Record<string, { value: number | string; unit?: string; date?: string }>;
    imaging?: { type: string; result: string; date?: string }[];
    fibroscan_kpa?: number;
    alt?: number;
    ast?: number;
    platelets?: number;
    bmi?: number;
    age?: number;
    sex?: string;
    smoking_status?: string;
    alcohol_use?: string;
    family_history?: string[];
    notes?: string;
}

export interface ExtractedCriterion {
    text: string;
    type: 'inclusion' | 'exclusion';
    field?: string;         // e.g. "age", "diagnosis", "lab_value"
    operator?: string;      // e.g. "GTE", "LTE", "EQ", "HAS_HISTORY"
    value?: string | number;
    unit?: string;
}

export interface ExtractedProtocolData {
    title?: string;
    sponsor?: string;
    protocol_number?: string;
    phase?: string;
    indication?: string;
    specialty?: string;
    inclusion_criteria: ExtractedCriterion[];
    exclusion_criteria: ExtractedCriterion[];
    primary_endpoint?: string;
    visit_schedule_summary?: string;
    raw_inclusion_text?: string;
    raw_exclusion_text?: string;
}

const PATIENT_EXTRACTION_SYSTEM = `You are a clinical data extraction assistant. Extract ALL clinically relevant information from patient documents. Be comprehensive — extract everything present even if it seems unrelated to current conditions. Return ONLY valid JSON, no markdown, no explanation.`;

const PATIENT_EXTRACTION_PROMPT = (text: string) => `Extract all clinical information from this patient document and return a JSON object with these fields (omit fields not found):

{
  "first_name": string,
  "last_name": string,
  "dob": "YYYY-MM-DD",
  "internal_identifier": string (MRN or patient ID),
  "sex": string,
  "age": number,
  "diagnoses": [string] (all current diagnoses),
  "medical_history": [string] (all past conditions, diseases, cancers, surgeries),
  "medications": [string],
  "allergies": [string],
  "procedures": [string],
  "labs": { "LAB_NAME": { "value": number|string, "unit": string, "date": "YYYY-MM-DD" } },
  "vitals": { "VITAL_NAME": { "value": number|string, "unit": string } },
  "imaging": [{ "type": string, "result": string, "date": "YYYY-MM-DD" }],
  "fibroscan_kpa": number,
  "alt": number,
  "ast": number,
  "platelets": number,
  "bmi": number,
  "smoking_status": string,
  "alcohol_use": string,
  "family_history": [string],
  "notes": string (anything else clinically relevant)
}

DOCUMENT TEXT:
${text.slice(0, 6000)}`;

const PROTOCOL_EXTRACTION_SYSTEM = `You are a clinical trial protocol analyst. Extract structured eligibility criteria and trial metadata from protocol documents. Return ONLY valid JSON, no markdown, no explanation.

Rules for criteria extraction:
- Each criterion must be a complete, clinically meaningful statement
- Include sub-criteria (a, b, c) as part of their parent criterion text or as separate entries
- Notes and clarifications that belong to a criterion should be included in that criterion's text
- EXCLUDE: section headers, study phase labels (e.g. "Main Study", "Part A"), administrative text, page references
- EXCLUDE: any line that is not a clinical eligibility requirement
- Each criterion text should be a full readable sentence or clause — never a fragment`;

const PROTOCOL_EXTRACTION_PROMPT = (text: string) => `Extract all information from this clinical trial protocol and return a JSON object:

{
  "title": string,
  "sponsor": string,
  "protocol_number": string,
  "phase": string (e.g. "Phase 2", "Phase 3"),
  "indication": string (disease/condition being studied),
  "specialty": string (e.g. "Hepatology", "Oncology"),
  "primary_endpoint": string,
  "visit_schedule_summary": string,
  "inclusion_criteria": [
    {
      "text": string (full criterion text),
      "type": "inclusion",
      "field": string (e.g. "age", "diagnosis", "fibroscan_kpa", "alt", "bmi", "medical_history"),
      "operator": string (GTE/LTE/EQ/HAS_HISTORY/NOT_HAS_HISTORY/RANGE),
      "value": string|number,
      "unit": string
    }
  ],
  "exclusion_criteria": [
    {
      "text": string,
      "type": "exclusion",
      "field": string,
      "operator": string,
      "value": string|number,
      "unit": string
    }
  ],
  "raw_inclusion_text": string (verbatim inclusion criteria section),
  "raw_exclusion_text": string (verbatim exclusion criteria section)
}

PROTOCOL TEXT:
${text.slice(0, 8000)}`;

export async function extractPatientDocumentData(text: string): Promise<ExtractedPatientData> {
    const cleaned = cleanPdfText(text);
    try {
        return await ollamaExtract<ExtractedPatientData>(
            PATIENT_EXTRACTION_PROMPT(cleaned),
            PATIENT_EXTRACTION_SYSTEM
        );
    } catch (err) {
        console.error('[AI Ingestion] Patient extraction failed:', err);
        return {};
    }
}

export async function extractProtocolData(text: string): Promise<ExtractedProtocolData> {
    const cleaned = cleanPdfText(text);
    try {
        return await ollamaExtract<ExtractedProtocolData>(
            PROTOCOL_EXTRACTION_PROMPT(cleaned),
            PROTOCOL_EXTRACTION_SYSTEM
        );
    } catch (err) {
        console.error('[AI Ingestion] Protocol extraction failed:', err);
        return { inclusion_criteria: [], exclusion_criteria: [] };
    }
}
