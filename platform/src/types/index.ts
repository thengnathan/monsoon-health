// ── DB row types ──────────────────────────────────────────
export interface DbUser {
    id: string;
    site_id: string;
    clerk_id: string;
    name: string;
    email: string;
    role: string;
    is_active: boolean;
    notification_prefs: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface Patient {
    id: string;
    site_id: string;
    first_name: string;
    last_name: string;
    dob: string | null;
    internal_identifier: string | null;
    referral_source_id: string | null;
    referral_source_name?: string | null;
    referral_date: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface PatientSignalRow {
    id: string;
    signal_label: string;
    value_number: number | null;
    value_enum: string | null;
    value_text: string | null;
    unit: string | null;
    collected_at: string;
    source: string | null;
}

export interface ScreeningCaseRef {
    id: string;
    trial_name: string;
    protocol_number: string | null;
    status: string;
    assigned_user_name: string | null;
    revisit_date: string | null;
}

export interface PatientDocumentRef {
    id: string;
    filename: string;
    document_type: string;
    created_at: string;
}

export interface PatientDetail extends Patient {
    screening_cases: ScreeningCaseRef[];
    signals: PatientSignalRow[];
    documents?: PatientDocumentRef[];
}

export interface Trial {
    id: string;
    site_id: string;
    name: string;
    sponsor: string | null;
    protocol_number: string | null;
    specialty: string | null;
    description: string | null;
    recruiting_status: string;
    inclusion_criteria: string | null;
    exclusion_criteria: string | null;
    case_counts: Record<string, number>;
    created_at: string;
    updated_at: string;
}

export interface VisitTemplate {
    id: string;
    site_id: string;
    trial_id: string;
    visit_name: string;
    visit_label: string | null;
    day_offset: number;
    window_before: number;
    window_after: number;
    reminder_days_before: number;
    notes: string | null;
    sort_order: number;
    is_screening: boolean;
    is_randomization: boolean;
    source: string;
}

export interface SignalRule {
    id: string;
    signal_type_id: string | null;
    signal_label: string;
    field: string | null;
    operator: string;
    threshold_number: number | null;
    threshold_text: string | null;
    threshold_list: string | null;
    unit: string | null;
    criteria_text: string | null;
    min_value: number | null;
    max_value: number | null;
    source: string;
}

export interface TrialProtocolRef {
    id: string;
    filename: string;
    file_size: number;
    version: string | null;
    created_at: string;
    structured_data?: {
        visit_schedule?: string;
        key_screening_criteria?: string[];
        inclusion_criteria?: string[];
        exclusion_criteria?: string[];
        title?: string;
        sponsor?: string;
        phase?: string;
        indication?: string;
        primary_endpoint?: string;
        secondary_endpoints?: string[];
        study_duration?: string;
    } | null;
}

// ── Clinical data types ────────────────────────────────────
export interface LabValue {
    name: string;
    value: number | string;
    unit: string;
    date?: string;
    flag?: 'high' | 'low' | 'critical' | null;
    document_id?: string;
}

export interface VitalValue {
    name: string;
    value: number | string;
    unit: string;
    date?: string;
    document_id?: string;
}

export interface ImagingResult {
    type: string;
    value?: number;
    unit?: string;
    date?: string;
    findings?: string;
    document_id?: string;
}

export interface ClinicalDiagnosis {
    name: string;
    status?: 'active' | 'resolved' | 'chronic';
    onset_date?: string;
}

export interface MedicationEntry {
    name: string;
    dose?: string;
    frequency?: string;
    start_date?: string;
}

export interface PatientClinicalData {
    id: string;
    patient_id: string;
    site_id: string;
    diagnoses: ClinicalDiagnosis[];
    medical_history: { condition: string; date?: string; notes?: string }[];
    surgical_history: { procedure: string; date?: string; notes?: string }[];
    medications: MedicationEntry[];
    allergies: string[];
    family_history: string[];
    labs_latest: Record<string, LabValue>;
    vitals_latest: Record<string, VitalValue>;
    imaging_latest: Record<string, ImagingResult>;
    labs_timeline: LabValue[];
    vitals_timeline: VitalValue[];
    imaging_timeline: ImagingResult[];
    smoking_status?: string | null;
    alcohol_use?: string | null;
    last_document_id?: string | null;
    updated_at: string;
}

export interface TrialCaseRef {
    id: string;
    first_name: string;
    last_name: string;
    status: string;
    assigned_user_name: string | null;
    updated_at: string;
}

export interface TrialDetail extends Trial {
    visit_templates: VisitTemplate[];
    signal_rules: SignalRule[];
    screening_cases: TrialCaseRef[];
    protocol: TrialProtocolRef | null;
}

export interface ScreeningCase {
    id: string;
    site_id: string;
    patient_id: string;
    trial_id: string;
    status: string;
    assigned_user_id: string | null;
    assigned_user_name: string | null;
    fail_reason_id: string | null;
    fail_reason_label: string | null;
    fail_reason_text: string | null;
    what_would_change_text: string | null;
    revisit_date: string | null;
    next_action_date: string | null;
    notes: string | null;
    last_touched_at: string;
    created_at: string;
    updated_at: string;
}

export interface ScreeningCaseRow extends ScreeningCase {
    first_name: string;
    last_name: string;
    trial_name: string;
    protocol_number: string | null;
    pending_items_open: number;
}

export interface PendingItem {
    id: string;
    site_id: string;
    screening_case_id: string;
    type: string;
    name: string;
    status: string;
    due_date: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface ScreeningCaseDetail extends ScreeningCase {
    first_name: string;
    last_name: string;
    trial_name: string;
    protocol_number: string | null;
    assigned_user_name: string | null;
    specialty: string | null;
    patient_notes: string | null;
    pending_items: PendingItem[];
    signals: PatientSignalRow[];
    trial_signal_rules: SignalRule[];
}

export interface SignalType {
    id: string;
    site_id: string;
    label: string;
    code: string;
    data_type: string;
    unit: string | null;
    specialty: string | null;
}

export interface ScreenFailReason {
    id: string;
    site_id: string;
    specialty: string | null;
    code: string;
    label: string;
    explanation_template: string | null;
}

export interface ReferralSource {
    id: string;
    site_id: string;
    name: string;
    type: string;
    contact_info: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface Note {
    id: string;
    site_id: string;
    user_id: string;
    title: string;
    content: string;
    color: string;
    is_pinned: boolean;
    created_at: string;
    updated_at: string;
}

export interface PatientVisit {
    id: string;
    site_id: string;
    screening_case_id: string;
    visit_template_id: string;
    visit_name: string;
    day_offset: number;
    window_before: number;
    window_after: number;
    scheduled_date: string;
    actual_date: string | null;
    status: string;
    notes: string | null;
    reminder_sent: boolean;
    updated_at: string;
}

// ── API response types ─────────────────────────────────────
export interface TodayStats {
    total_active_cases: number;
    pending_items_open: number;
    total_patients: number;
    active_trials: number;
    cases_enrolled: number;
}

export interface TodayActiveCase {
    id: string;
    first_name: string;
    last_name: string;
    trial_name: string;
    status: string;
    assigned_user_name: string | null;
}

export interface TodayPendingItem {
    id: string;
    name: string;
    type: string;
    due_date: string | null;
    first_name: string;
    last_name: string;
    trial_name: string;
    screening_case_id: string;
}

export interface TodayRevisitCase {
    id: string;
    first_name: string;
    last_name: string;
    trial_name: string;
    revisit_date: string | null;
    fail_reason_label: string | null;
}

export interface NotificationEvent {
    id: string;
    site_id: string;
    type: string;
    payload: string | Record<string, unknown>;
    patient_id: string | null;
    screening_case_id: string | null;
    first_name: string | null;
    last_name: string | null;
    trial_name: string | null;
    created_at: string;
    processed_at: string | null;
}

export interface UpcomingVisit {
    id: string;
    first_name: string;
    last_name: string;
    visit_name: string;
    trial_name: string;
    scheduled_date: string;
    screening_case_id: string;
}

export interface TodayData {
    stats: TodayStats;
    active_cases: TodayActiveCase[];
    pending_items_due: TodayPendingItem[];
    recently_completed: PendingItem[];
    recent_alerts: NotificationEvent[];
    revisit_due: TodayRevisitCase[];
}

export interface ExtractionSummary {
    diagnoses_count: number;
    medications_count: number;
    labs_count: number;
    vitals_count: number;
    imaging_count: number;
    key_labs: { name: string; value: number | string; unit?: string; flag?: string | null }[];
}

export interface UploadResult {
    patient_created: boolean;
    patient: Patient;
    extracted: Record<string, unknown>;
    signals_created: string[];
    document_id: string;
    extraction_summary?: ExtractionSummary | null;
}

export interface ProtocolSignal {
    id: string;
    trial_id: string;
    trial_name: string;
    protocol_number: string | null;
    indication: string | null;
    specialty: string | null;
    overall_status: 'LIKELY_ELIGIBLE' | 'BORDERLINE' | 'LIKELY_INELIGIBLE';
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    summary: string;
    missing_data: string[];
    criteria_breakdown: {
        criterion: string;
        type: 'inclusion' | 'exclusion';
        status: 'PASS' | 'FAIL' | 'UNKNOWN';
        reason: string;
    }[];
    last_evaluated_at: string;
    auto_assigned: boolean;
}

export interface SignalRuleAlignment {
    rule_id: string;
    trial_id: string;
    trial_name: string;
    protocol_number: string | null;
    signal_name: string;
    signal_label: string;
    operator: string;
    threshold_number: number | null;
    threshold_text: string | null;
    threshold_list: string | null;
    min_value: number | null;
    max_value: number | null;
    unit: string | null;
    value_type: string;
    patient_value_number: number | null;
    patient_value_enum: string | null;
    patient_value_text: string | null;
    patient_signal_date: string | null;
    passes: boolean | null;
}

export interface EnrollResult {
    message: string;
    enrollment_date: string;
    visits_created: number;
    visits: PatientVisit[];
}

export interface AddSignalResult {
    signal: PatientSignalRow;
    alerts_generated: number;
}

export interface BatchImportResult {
    created: number;
    skipped: number;
    errors: { row: number; error: string }[];
    created_patients: { id: string; first_name: string; last_name: string }[];
    skipped_rows: { row: number; reason: string }[];
}

// ── Site / Settings types ──────────────────────────────────
export type SpecialtyKey = 'HEPATOLOGY' | 'ONCOLOGY' | 'HEMATOLOGY';

export interface SpecialtyOption {
    id: string;
    label: string;
    section: 'signals' | 'labs' | 'vitals' | 'imaging' | 'diagnoses' | 'medications' | 'lifestyle' | 'surgical_history' | 'family_history';
}

export interface SpecialtyTemplate {
    key: SpecialtyKey;
    label: string;
    description: string;
    color: string;
    options: SpecialtyOption[];
    signalTypeNames: string[];
    columnAliases: Record<string, string>;
}

export interface SitePatientProfileConfig {
    specialties: SpecialtyKey[];
    enabled_options: string[];
}

export interface SiteConfig {
    id: string;
    name: string;
    timezone: string;
    specialties: SpecialtyKey[];
    patient_profile_config: SitePatientProfileConfig;
}

export interface SiteSettingsResponse {
    site: SiteConfig;
    specialty_templates: Record<SpecialtyKey, SpecialtyTemplate>;
    all_specialty_keys: SpecialtyKey[];
}

// ── Component-specific types ───────────────────────────────
export type StatusKey =
    | 'NEW'
    | 'IN_REVIEW'
    | 'PENDING_INFO'
    | 'LIKELY_ELIGIBLE'
    | 'SCREEN_FAILED'
    | 'FUTURE_CANDIDATE'
    | 'DECLINED'
    | 'LOST_TO_FOLLOWUP'
    | 'ENROLLED';

export type ToastType = 'info' | 'success' | 'error' | 'warning';
