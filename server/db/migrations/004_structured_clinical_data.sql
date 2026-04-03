-- Migration 004: Structured clinical data schemas
-- Replaces raw text extraction with clean JSONB for both protocols and patients

-- ── Protocol: structured extraction on trial_protocols ───────────────────────
-- Stores the full clean Claude extraction for each uploaded protocol PDF
ALTER TABLE trial_protocols
    ADD COLUMN IF NOT EXISTS structured_data JSONB;

-- Schema stored in structured_data:
-- {
--   "title": string,
--   "sponsor": string,
--   "protocol_number": string,
--   "phase": string,
--   "indication": string,
--   "specialty": string,
--   "primary_endpoint": string,
--   "secondary_endpoints": [string],
--   "study_duration": string,
--   "estimated_enrollment": number,
--   "inclusion_criteria": [string],
--   "exclusion_criteria": [string],
--   "visit_schedule": string,
--   "key_screening_criteria": [string]
-- }


-- ── Patient documents: structured extraction per document ─────────────────────
-- Stores the clean per-document Claude extraction
ALTER TABLE patient_documents
    ADD COLUMN IF NOT EXISTS structured_data JSONB;

-- Schema stored in structured_data:
-- {
--   "first_name": string,
--   "last_name": string,
--   "dob": "YYYY-MM-DD",
--   "mrn": string,
--   "sex": string,
--   "age": number,
--   "diagnoses": [{ "name": string, "status": string, "onset_date": string }],
--   "medical_history": [{ "condition": string, "date": string, "notes": string }],
--   "surgical_history": [{ "procedure": string, "date": string, "notes": string }],
--   "medications": [{ "name": string, "dose": string, "frequency": string, "start_date": string }],
--   "allergies": [string],
--   "family_history": [string],
--   "labs": [{ "name": string, "value": number|string, "unit": string, "date": "YYYY-MM-DD", "flag": "high"|"low"|"critical"|null }],
--   "vitals": [{ "name": string, "value": number|string, "unit": string, "date": "YYYY-MM-DD" }],
--   "imaging": [{ "type": string, "value": number, "unit": string, "date": "YYYY-MM-DD", "findings": string }],
--   "smoking_status": string,
--   "alcohol_use": string,
--   "clinical_notes": string
-- }


-- ── Unified patient clinical profile ─────────────────────────────────────────
-- One row per patient — merged and deduplicated from ALL uploaded documents.
-- Latest values shown at top; full timeline preserved for trending.

CREATE TABLE IF NOT EXISTS patient_clinical_data (
    id                  TEXT        PRIMARY KEY,
    site_id             TEXT        NOT NULL REFERENCES sites(id),
    patient_id          TEXT        NOT NULL REFERENCES patients(id),

    -- Merged lists (deduplicated across all documents)
    diagnoses           JSONB       NOT NULL DEFAULT '[]',
    medical_history     JSONB       NOT NULL DEFAULT '[]',
    surgical_history    JSONB       NOT NULL DEFAULT '[]',
    medications         JSONB       NOT NULL DEFAULT '[]',
    allergies           JSONB       NOT NULL DEFAULT '[]',
    family_history      JSONB       NOT NULL DEFAULT '[]',

    -- Latest values (most recent across all documents)
    -- { "ALT": { "value": 82, "unit": "IU/L", "date": "2024-11-01", "flag": "high" } }
    labs_latest         JSONB       NOT NULL DEFAULT '{}',
    -- { "BMI": { "value": 31.2, "unit": "kg/m²", "date": "2024-11-01" } }
    vitals_latest       JSONB       NOT NULL DEFAULT '{}',
    -- { "FibroScan": { "value": 9.8, "unit": "kPa", "date": "2024-10-15", "findings": "..." } }
    imaging_latest      JSONB       NOT NULL DEFAULT '{}',

    -- Full timeline (all values from all documents, ordered by date)
    -- [{ "name": "ALT", "value": 82, "unit": "IU/L", "date": "2024-11-01", "flag": "high", "document_id": "..." }]
    labs_timeline       JSONB       NOT NULL DEFAULT '[]',
    -- [{ "name": "BMI", "value": 31.2, "unit": "kg/m²", "date": "2024-11-01", "document_id": "..." }]
    vitals_timeline     JSONB       NOT NULL DEFAULT '[]',
    -- [{ "type": "FibroScan", "value": 9.8, "unit": "kPa", "date": "2024-10-15", "findings": "...", "document_id": "..." }]
    imaging_timeline    JSONB       NOT NULL DEFAULT '[]',

    -- Lifestyle (latest wins)
    smoking_status      TEXT,
    alcohol_use         TEXT,

    -- Tracks which document was most recently merged in
    last_document_id    TEXT        REFERENCES patient_documents(id),

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(patient_id)
);

CREATE INDEX IF NOT EXISTS idx_pcd_patient  ON patient_clinical_data(patient_id);
CREATE INDEX IF NOT EXISTS idx_pcd_site     ON patient_clinical_data(site_id);
