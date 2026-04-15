-- Migration 009: Add specialty field to patients
-- Allows each patient to be categorized under a clinical specialty
-- (HEPATOLOGY, ONCOLOGY, HEMATOLOGY, or NULL if unset)

ALTER TABLE patients
    ADD COLUMN IF NOT EXISTS specialty VARCHAR(32) DEFAULT NULL;
