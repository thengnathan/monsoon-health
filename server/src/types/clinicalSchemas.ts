// ─────────────────────────────────────────────────────────────────────────────
// Canonical clinical data schemas
// These are the shapes Claude extracts into and the platform renders from.
// ─────────────────────────────────────────────────────────────────────────────

// ── Protocol ─────────────────────────────────────────────────────────────────

export interface ExtractedSignalRule {
    criteria_text: string;               // human-readable (e.g. "Age 18–75 years")
    signal_label: string;                // short label (e.g. "Age")
    operator: 'GTE' | 'LTE' | 'EQ' | 'BETWEEN' | 'TEXT_MATCH';
    threshold_number?: number;           // single threshold (for GTE/LTE/EQ)
    min_value?: number;                  // range lower bound (for BETWEEN)
    max_value?: number;                  // range upper bound (for BETWEEN)
    unit?: string;
}

export interface ExtractedVisit {
    visit_name: string;                  // e.g. "Screening", "Baseline", "Week 4"
    day_offset: number;                  // days from baseline (Day 1 = 0; screening is negative)
    window_before?: number;              // allowed days before target (e.g. 3 for ±3)
    window_after?: number;               // allowed days after target
    notes?: string;
}

export interface StructuredProtocol {
    title?: string;
    sponsor?: string;
    protocol_number?: string;
    phase?: string;                      // "Phase 2", "Phase 3", etc.
    indication?: string;                 // disease/condition being studied
    specialty?: string;                  // "Hepatology", "Oncology", etc.
    primary_endpoint?: string;
    secondary_endpoints?: string[];
    study_duration?: string;             // e.g. "52 weeks", "12 months"
    estimated_enrollment?: number;

    // Plain text lists — one string per criterion, verbatim from protocol
    inclusion_criteria: string[];
    exclusion_criteria: string[];

    // Plain text summary of the visit schedule (kept for display)
    visit_schedule?: string;

    // Structured visit objects for auto-creating visit_templates
    extracted_visits?: ExtractedVisit[];

    // Structured signal rules extracted from eligibility criteria
    extracted_signal_rules?: ExtractedSignalRule[];

    // @deprecated — use extracted_signal_rules instead (kept for backward compat with old data)
    key_screening_criteria?: string[];
}

// ── Patient document (per-document extraction) ────────────────────────────────

export interface LabValue {
    name: string;
    value: number | string;
    unit: string;
    date?: string;                       // YYYY-MM-DD
    flag?: 'high' | 'low' | 'critical' | null;
}

export interface VitalValue {
    name: string;
    value: number | string;
    unit: string;
    date?: string;                       // YYYY-MM-DD
}

export interface ImagingResult {
    type: string;                        // "FibroScan", "MRI Abdomen", etc.
    value?: number;                      // numeric result where applicable (e.g. kPa)
    unit?: string;
    date?: string;                       // YYYY-MM-DD
    findings?: string;
}

export interface Diagnosis {
    name: string;
    status?: 'active' | 'resolved' | 'chronic';
    onset_date?: string;
}

export interface HistoryItem {
    condition: string;
    date?: string;
    notes?: string;
}

export interface SurgicalItem {
    procedure: string;
    date?: string;
    notes?: string;
}

export interface Medication {
    name: string;
    dose?: string;
    frequency?: string;
    start_date?: string;
}

export interface StructuredPatientDocument {
    // Demographics
    first_name?: string;
    last_name?: string;
    dob?: string;                        // YYYY-MM-DD
    mrn?: string;
    sex?: string;
    age?: number;

    // Clinical history
    diagnoses?: Diagnosis[];
    medical_history?: HistoryItem[];
    surgical_history?: SurgicalItem[];
    medications?: Medication[];
    allergies?: string[];
    family_history?: string[];

    // Measurements — always include date if present in document
    labs?: LabValue[];
    vitals?: VitalValue[];
    imaging?: ImagingResult[];

    // Lifestyle
    smoking_status?: string;
    alcohol_use?: string;

    // Free text
    clinical_notes?: string;
}

// ── Unified patient clinical profile (merged across all documents) ────────────

export interface TimelineLab extends LabValue {
    document_id: string;
}

export interface TimelineVital extends VitalValue {
    document_id: string;
}

export interface TimelineImaging extends ImagingResult {
    document_id: string;
}

export interface PatientClinicalData {
    id: string;
    site_id: string;
    patient_id: string;

    // Merged lists
    diagnoses: Diagnosis[];
    medical_history: HistoryItem[];
    surgical_history: SurgicalItem[];
    medications: Medication[];
    allergies: string[];
    family_history: string[];

    // Latest values — keyed by measurement name
    labs_latest: Record<string, LabValue>;
    vitals_latest: Record<string, VitalValue>;
    imaging_latest: Record<string, ImagingResult>;

    // Full timeline — all values from all documents
    labs_timeline: TimelineLab[];
    vitals_timeline: TimelineVital[];
    imaging_timeline: TimelineImaging[];

    // Lifestyle (latest wins)
    smoking_status?: string;
    alcohol_use?: string;

    last_document_id?: string;
    created_at: string;
    updated_at: string;
}
