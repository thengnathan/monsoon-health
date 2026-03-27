import { claudeChat, claudeExtract } from './claude';

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

/**
 * Locate the eligibility criteria section within a large protocol document.
 * Searches for standard section headers and returns a focused window of text
 * starting just before the first criteria header found.
 */
/**
 * Locate the Schedule of Assessments section within a large protocol document.
 * Searches for common section headers and returns a generous window of text
 * starting just before the first match — large enough to capture full SoA tables.
 */
function findVisitScheduleSection(text: string, windowSize = 20000): string {
    const headers = [
        /\bschedule\s+of\s+assessments?\b/i,
        /\bstudy\s+assessments?\s+(?:schedule|table)\b/i,
        /\bassessment\s+schedule\b/i,
        /\bstudy\s+procedures?\s+(?:and\s+)?(?:schedule|assessments?)\b/i,
        /\bvisit\s+schedule\s+(?:and\s+)?(?:assessments?|procedures?)\b/i,
        /\bschedule\s+of\s+(?:study\s+)?(?:events?|activities|procedures?)\b/i,
        /\bstudy\s+schedule\b/i,
    ];

    let earliest = text.length;
    for (const pat of headers) {
        const idx = text.search(pat);
        if (idx !== -1 && idx < earliest) earliest = idx;
    }

    // Nothing found — try the last 20k chars (appendices are often at the end)
    if (earliest === text.length) {
        return text.slice(Math.max(0, text.length - windowSize));
    }

    const start = Math.max(0, earliest - 200);
    // Take up to 2x window to capture multi-page SoA tables and appendix content
    return text.slice(start, start + windowSize * 2);
}

function findCriteriaSection(text: string, windowSize = 8000): string {
    const headers = [
        /\beligibility\s+criteria\b/i,
        /\binclusion\s+criteria\b/i,
        /\bkey\s+inclusion\b/i,
        /\bentry\s+criteria\b/i,
    ];

    let earliest = text.length;
    for (const pat of headers) {
        const idx = text.search(pat);
        if (idx !== -1 && idx < earliest) earliest = idx;
    }

    // Nothing found — fall back to beginning of document
    if (earliest === text.length) return text.slice(0, windowSize);

    // Start slightly before the header to capture any preamble, then take windowSize chars
    const start = Math.max(0, earliest - 300);
    return text.slice(start, start + windowSize);
}

const ELIGIBILITY_EXTRACTION_SYSTEM = `You are a clinical trial eligibility criteria specialist. Your only job is to extract and cleanly present the inclusion and exclusion criteria from a clinical trial protocol. Output nothing else.`;

const ELIGIBILITY_EXTRACTION_PROMPT = (text: string) => `From the clinical trial protocol below, extract ONLY the inclusion and exclusion eligibility criteria. Output nothing else — no titles, no metadata, no commentary, no explanations.

Rules:
1. Extract every inclusion criterion and every exclusion criterion — do not omit any.
2. Write each criterion as a complete, professionally written clinical sentence. Fix fragmented or broken text from PDF extraction.
3. Preserve all numeric thresholds, units, and lab values exactly as written (e.g. ≥ 15 kPa, ≤ 9.5%, HbA1c > 7%).
4. Split combined criteria into separate numbered items where clinically appropriate.
5. Remove duplicates.
6. Do not summarize, interpret, or add any information not present in the protocol.
7. Strip all section headers, page numbers, version stamps, company names, and administrative text.
8. Preserve sub-criteria structure: if a criterion has lettered sub-parts (a., b., c.), indent them under their parent criterion using "   a." format — do not flatten them into separate top-level items.
9. Keep "Note:" lines attached to their parent criterion, indented on the next line.
10. For multi-part criteria joined by OR/AND (e.g. "must meet 3a OR 3b"), preserve them as a single numbered item with their sub-parts intact.
11. Preserve waiver text exactly as written (e.g. "unless approved by Medical Monitor", "at investigator discretion").
12. If a criterion references a table or appendix, keep that reference inline (e.g. "as defined in Table 3") even if the table content cannot be extracted.
13. If the protocol has multiple study parts (Main Study, Extension, Sub-study, Part A/B), combine all inclusion criteria together and all exclusion criteria together — do not create separate sub-sections per study part.

CRITICAL: Never place exclusion criteria under the Inclusion Criteria section and vice versa. These are two completely separate lists.

Output format — follow this exactly, using these exact section markers:

##INCLUSION##
1. [criterion]
   a. [sub-criterion]
   b. [sub-criterion]
2. [criterion]
   Note: [note text]

##EXCLUSION##
1. [criterion]
2. [criterion]

If the protocol has multiple study parts (Main Study, Extension, etc.), list all inclusion criteria together under ##INCLUSION## and all exclusion criteria together under ##EXCLUSION## — do not create separate sub-sections.

If no eligibility criteria are found, return:

##INCLUSION##
Not specified in provided protocol text.

##EXCLUSION##
Not specified in provided protocol text.

PROTOCOL TEXT:
${text}`;

/**
 * Convert structured plain-text criteria (numbered lists) to clean HTML.
 * Handles both well-structured text (from LLM) and messy raw PDF text.
 */
export function criteriaToHtml(raw: string): string {
    if (!raw.trim()) return '';

    // If already contains HTML tags, return as-is
    if (/<(?:ol|ul|li|p|div|strong|em|br)\b/i.test(raw)) return raw;

    // ── Normalize into lines ──────────────────────────────────────────────────
    const text = raw
        // Insert newlines before numbered items that appear mid-paragraph
        .replace(/([.!?:])\s+(\d{1,2}[.)]\s)/g, '$1\n$2')
        // Insert newlines before lettered sub-items mid-paragraph
        .replace(/([.!?])\s+([a-z][.)]\s)/g, '$1\n   $2')
        // Normalize smart quotes
        .replace(/[""]/g, '"').replace(/['']/g, "'");

    const lines = text.split('\n').map(l => l.trimEnd()).filter(l => l.trimStart().length > 0);

    // ── Parse lines into a tree ───────────────────────────────────────────────
    type Node = { text: string; children: string[]; notes: string[] };
    const roots: Node[] = [];

    const SKIP = /^(main study|inclusion criteria|exclusion criteria|part [a-z]\b|study phase|subjects (must|who|in the)|eligibility criteria|to be eligible)/i;
    const PAGE_REF = /^(page \d|protocol:|amendment \d|confidential|akero|efruxifermin clinical trial)/i;

    let currentRoot: Node | null = null;

    for (const raw of lines) {
        const line = raw.trimStart();
        if (!line || SKIP.test(line) || PAGE_REF.test(line)) continue;

        const leadSpaces = raw.length - line.length;
        const topMatch = line.match(/^(\d{1,2}[.)]\s*)([\s\S]*)/);
        const subMatch = line.match(/^([a-z]{1,3}[.)]\s*)([\s\S]*)/i);
        const noteMatch = /^note:/i.test(line);
        const romanMatch = line.match(/^(i{1,3}v?|vi{0,3}|ix|x{1,3})[.)]\s*/i);

        if (topMatch) {
            currentRoot = { text: topMatch[2].trim(), children: [], notes: [] };
            roots.push(currentRoot);
        } else if ((subMatch && !romanMatch) || (leadSpaces >= 2 && currentRoot)) {
            const content = subMatch ? `${subMatch[1]}${subMatch[2].trim()}` : line;
            if (currentRoot) currentRoot.children.push(content);
            else roots.push({ text: content, children: [], notes: [] });
        } else if (noteMatch && currentRoot) {
            currentRoot.notes.push(line);
        } else if (romanMatch && currentRoot && currentRoot.children.length > 0) {
            // roman numeral → append to last child
            const lastChild = currentRoot.children[currentRoot.children.length - 1];
            currentRoot.children[currentRoot.children.length - 1] = lastChild + ' ' + line;
        } else if (currentRoot) {
            // Continuation of previous criterion
            currentRoot.text += ' ' + line;
        } else {
            currentRoot = { text: line, children: [], notes: [] };
            roots.push(currentRoot);
        }
    }

    if (roots.length === 0) return `<p>${escHtml(raw)}</p>`;

    // ── Render to HTML ────────────────────────────────────────────────────────
    const html: string[] = ['<ol>'];

    for (const node of roots) {
        let liContent = boldThresholds(escHtml(node.text));

        if (node.notes.length > 0) {
            liContent += node.notes
                .map(n => `<div style="margin-top:4px;font-size:0.85em;color:var(--text-tertiary);font-style:italic">${escHtml(n)}</div>`)
                .join('');
        }

        if (node.children.length > 0) {
            liContent += '<ul>' + node.children.map(c => `<li>${boldThresholds(escHtml(c))}</li>`).join('') + '</ul>';
        }

        html.push(`<li>${liContent}</li>`);
    }

    html.push('</ol>');
    return html.join('');
}

function escHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function boldThresholds(html: string): string {
    // Bold numeric clinical thresholds and values already HTML-escaped
    return html.replace(
        /((?:[≥≤≠]|&lt;=?|&gt;=?|&ge;|&le;)\s*\d+\.?\d*(?:\s*(?:mg\/dL|g\/dL|kPa|%|×\s*ULN|IU\/mL|mL\/min|μL|mmol\/L|IU\/day|IU\/L|ng\/mL|μmol\/L))?)/g,
        '<strong>$1</strong>'
    );
}

/**
 * Dedicated eligibility criteria extraction pass.
 * Runs on the full protocol text and returns clean, professionally written
 * inclusion and exclusion criteria as HTML.
 */
export async function extractEligibilityCriteria(text: string): Promise<{ inclusion: string; exclusion: string }> {
    try {
        let output = await claudeChat(
            ELIGIBILITY_EXTRACTION_PROMPT(text),
            ELIGIBILITY_EXTRACTION_SYSTEM
        );

        // Strip chain-of-thought thinking blocks (not needed for Claude, kept as safety)
        output = output.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

        // Parse using unique section markers ##INCLUSION## and ##EXCLUSION##
        const inclMatch = output.match(/##INCLUSION##\s*([\s\S]*?)(?=##EXCLUSION##|$)/);
        const exclMatch = output.match(/##EXCLUSION##\s*([\s\S]*?)$/);

        const inclusionText = inclMatch?.[1]?.trim() || 'Not specified in provided protocol text.';
        const exclusionText = exclMatch?.[1]?.trim() || 'Not specified in provided protocol text.';

        return {
            inclusion: criteriaToHtml(inclusionText),
            exclusion: criteriaToHtml(exclusionText),
        };
    } catch (err) {
        console.error('[AI Ingestion] Eligibility extraction failed:', err);
        return {
            inclusion: criteriaToHtml(text),
            exclusion: '',
        };
    }
}

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

export interface ExtractedAssessment {
    category: string;       // e.g. "Laboratory", "Vital Signs", "General"
    name: string;           // e.g. "CBC with Differential"
    conditional?: boolean;  // true if marked with footnote instead of X
    note?: string;          // footnote text or condition
}

export interface ExtractedVisit {
    name: string;
    day_offset: number;
    window_before: number | null;
    window_after: number | null;
    assessments: ExtractedAssessment[];
}

const VISIT_SCHEDULE_SYSTEM = `You are a clinical trial protocol analyst specializing in Schedule of Assessments tables. Extract structured visit and assessment data from protocol documents. Return ONLY valid JSON, no markdown, no explanation.`;

const VISIT_SCHEDULE_PROMPT = (text: string) => `From the clinical trial protocol below, extract the Schedule of Assessments table. Return a JSON array of visit objects following the schema and rules below.

OUTPUT SCHEMA:
[
  {
    "name": string,
    "day_offset": number,
    "window_before": number | null,
    "window_after": number | null,
    "assessments": [
      {
        "category": string,
        "name": string,
        "conditional": boolean,
        "note": string | null
      }
    ]
  }
]

EXTRACTION RULES:

1. VISITS: Extract every visit column from the table. Each visit has:
   - A name (Screening, Baseline, Week 4, End of Treatment, Early Termination, Follow-Up, etc.)
   - A day_offset: days from Day 1/enrollment (Screening is negative e.g. -28 or -14; Day 1 = 0; Week 4 = 28; Month 3 = 90)
   - window_before / window_after: check both column headers and table footnotes for window definitions. If no window is specified, set to null.

2. ASSESSMENTS: For each visit, list only assessments explicitly marked in that visit's column (typically marked with X, x, ✓, or a footnote letter).
   - Use short assessment names only — no descriptions (e.g. "CBC" not "Complete Blood Count with Differential").
   - Group related assessments under a parent category: "Laboratory", "Vital Signs", "Efficacy", "Safety", "General".
   - If an assessment has no parent grouping, set category to "General".
   - Keep notes brief (10 words max). Omit notes entirely if not critical.

3. CONDITIONAL ASSESSMENTS: If an assessment is marked with a footnote letter instead of X, set "conditional" to true and include the footnote text in "note".

4. FOOTNOTES: Read all footnotes beneath the table. Apply footnote logic to each assessment entry — footnotes often restrict assessments to specific visits, define windows, or add conditions.

5. UNSCHEDULED / EARLY TERMINATION: If the table includes an Unscheduled Visit or Early Termination column, extract those as visits with their assessments.

6. If the Schedule of Assessments table is referenced as being in an appendix and the full table is not present in the text, extract whatever visit names and timing you can find in the study design, synopsis, or overview sections of the protocol.
7. If no visit information can be found anywhere in the document, return [].

PROTOCOL TEXT:
${text}`;

/**
 * Extract the Schedule of Assessments from a protocol document.
 * Returns a structured list of visits with their required assessments.
 */
/** Attempt to recover a partial JSON array from a truncated Claude response. */
function recoverPartialVisitArray(raw: string): ExtractedVisit[] {
    // Extract whatever is inside the outermost [ ... ] even if truncated
    const start = raw.indexOf('[');
    if (start === -1) return [];
    const fragment = raw.slice(start);

    // Try progressively closing the fragment to get valid JSON
    // Count how many open braces / brackets need closing
    let open = 0;
    let lastCompleteEnd = -1;
    for (let i = 0; i < fragment.length; i++) {
        if (fragment[i] === '{') open++;
        if (fragment[i] === '}') {
            open--;
            if (open === 0) lastCompleteEnd = i;
        }
    }

    if (lastCompleteEnd === -1) return [];
    try {
        return JSON.parse('[' + fragment.slice(1, lastCompleteEnd + 1) + ']') as ExtractedVisit[];
    } catch {
        return [];
    }
}

export async function extractVisitSchedule(text: string): Promise<ExtractedVisit[]> {
    try {
        console.log('[AI Ingestion] Extracting visit schedule...');
        // Pass full text — Claude's 200k context handles it.
        // The SoA table is often in appendices not captured by findVisitScheduleSection,
        // and visit timing info may also appear in study design / synopsis sections.
        const raw = await claudeChat(
            VISIT_SCHEDULE_PROMPT(text),
            VISIT_SCHEDULE_SYSTEM,
            'claude-sonnet-4-6'
        );

        // Try clean parse first, then fall back to partial recovery
        let visits: ExtractedVisit[] = [];
        const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
        const candidate = fenceMatch?.[1]?.trim() ?? raw.trim();
        try {
            const parsed = JSON.parse(candidate);
            visits = Array.isArray(parsed) ? parsed : [];
        } catch {
            console.warn('[AI Ingestion] Visit schedule JSON truncated — attempting partial recovery');
            visits = recoverPartialVisitArray(raw);
        }

        console.log(`[AI Ingestion] Visit schedule: ${visits.length} visits extracted`);
        return visits;
    } catch (err) {
        console.error('[AI Ingestion] Visit schedule extraction failed:', err);
        return [];
    }
}

export interface ExtractedSignalRule {
    label: string;           // Human-readable: "FibroScan", "Platelet Count", "Age"
    name: string;            // Snake_case code: "fibroscan_kpa", "platelet_count", "age"
    data_type: 'number' | 'boolean' | 'text';
    unit: string | null;     // "kPa", "×10³/μL", "IU/L", "years", null
    operator: 'GTE' | 'LTE' | 'EQ' | 'RANGE' | 'HAS_HISTORY' | 'NOT_HAS_HISTORY';
    threshold_number: number | null;
    threshold_number_max: number | null;  // for RANGE operator (min already in threshold_number)
    threshold_text: string | null;
}

const SIGNAL_RULE_SYSTEM = `You are a clinical trial screening specialist. Extract only the key measurable eligibility criteria that can be used as a patient screening tool. Return ONLY valid JSON, no markdown, no explanation.`;

const SIGNAL_RULE_PROMPT = (inclusionText: string, specialty?: string) => `From the eligibility criteria below, extract the key measurable data points used to screen patients for this trial.
${specialty ? `\nTRIAL SPECIALTY: ${specialty} — prioritise signals that are central to this therapeutic area.\n` : ''}
Return a maximum of 6 rules — the most clinically important screening filters only. Prioritise in this order:
1. Key imaging / diagnostic values central to the disease (e.g. FibroScan/liver stiffness for hepatology, EF for cardiology)
2. Age thresholds
3. Disease-defining diagnosis or history (e.g. NASH/MAFLD, T2DM, cirrhosis, prior liver biopsy)
4. 1–2 critical labs only that are disease-defining (e.g. Platelets, HbA1c, eGFR — NOT routine panels like CBC or CMP)
5. BMI if explicitly required by the protocol

DO NOT pull any rules from the exclusion criteria.

DO NOT INCLUDE:
- Administrative criteria (ability to consent, willingness to comply, contraception requirements)
- Lab values that are not disease-defining or are routine safety checks
- Criteria that cannot be mapped to a discrete measurable data point

UNIT STANDARDISATION — always use these exact units:
- Platelets: ×10³/μL
- ALT / AST / ALP: IU/L
- Bilirubin: mg/dL
- Creatinine: mg/dL
- eGFR: mL/min/1.73m²
- HbA1c: %
- FibroScan / liver stiffness: kPa
- BMI: kg/m²
- Age: years
- Haemoglobin: g/dL

EXAMPLES:
Good rules:
  { "label": "FibroScan", "name": "fibroscan_kpa", "data_type": "number", "unit": "kPa", "operator": "GTE", "threshold_number": 8, ... }
  { "label": "Age", "name": "age", "data_type": "number", "unit": "years", "operator": "RANGE", "threshold_number": 18, "threshold_number_max": 75, ... }
  { "label": "NASH Diagnosis", "name": "nash_diagnosis", "data_type": "boolean", "unit": null, "operator": "HAS_HISTORY", "threshold_text": "NASH or MAFLD", ... }
  { "label": "Prior HCC", "name": "prior_hcc", "data_type": "boolean", "unit": null, "operator": "NOT_HAS_HISTORY", "threshold_text": "hepatocellular carcinoma", ... }

Bad rules (do not include):
  { "label": "Informed Consent", ... }  ← administrative
  { "label": "White Blood Cell Count", ... }  ← routine lab, not disease-defining
  { "label": "Adequate Renal Function", ... }  ← too vague, not a discrete data point

Return a JSON array:
[
  {
    "label": string (human-readable name, e.g. "FibroScan", "Platelet Count", "Age", "HbA1c"),
    "name": string (snake_case code, e.g. "fibroscan_kpa", "platelet_count", "age", "hba1c"),
    "data_type": "number" | "boolean" | "text",
    "unit": string | null,
    "operator": "GTE" | "LTE" | "EQ" | "RANGE" | "HAS_HISTORY" | "NOT_HAS_HISTORY",
    "threshold_number": number | null,
    "threshold_number_max": number | null (only for RANGE),
    "threshold_text": string | null (for HAS_HISTORY / NOT_HAS_HISTORY)
  }
]

If no measurable criteria are found, return [].

INCLUSION CRITERIA:
${inclusionText}`;

/**
 * Extract key measurable signal rules from already-extracted eligibility criteria.
 * Accepts inclusion + exclusion text and optional specialty for better prioritisation.
 */
export async function extractSignalRulesFromCriteria(inclusionText: string, specialty?: string): Promise<ExtractedSignalRule[]> {
    if (!inclusionText.trim()) return [];
    try {
        console.log('[AI Ingestion] Extracting signal rules from inclusion criteria...');
        const result = await claudeExtract<ExtractedSignalRule[]>(
            SIGNAL_RULE_PROMPT(inclusionText, specialty),
            SIGNAL_RULE_SYSTEM
        );
        const rules = Array.isArray(result) ? result : [];
        console.log(`[AI Ingestion] Signal rules: ${rules.length} extracted`);
        return rules;
    } catch (err) {
        console.error('[AI Ingestion] Signal rule extraction failed:', err);
        return [];
    }
}

export async function extractPatientDocumentData(text: string): Promise<ExtractedPatientData> {
    const cleaned = cleanPdfText(text);
    try {
        return await claudeExtract<ExtractedPatientData>(
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
        // Step 1: Extract structured metadata (title, sponsor, phase, criteria array, etc.)
        const extracted = await claudeExtract<ExtractedProtocolData>(
            PROTOCOL_EXTRACTION_PROMPT(cleaned),
            PROTOCOL_EXTRACTION_SYSTEM
        );

        // Step 2: Dedicated eligibility extraction pass on the full protocol text.
        // This produces professionally written, deduplicated, properly numbered criteria.
        console.log('[AI Ingestion] Running dedicated eligibility extraction...');
        const eligibility = await extractEligibilityCriteria(cleaned);

        extracted.raw_inclusion_text = eligibility.inclusion;
        extracted.raw_exclusion_text = eligibility.exclusion;

        return extracted;
    } catch (err) {
        console.error('[AI Ingestion] Protocol extraction failed:', err);
        return { inclusion_criteria: [], exclusion_criteria: [] };
    }
}
