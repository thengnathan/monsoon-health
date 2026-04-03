-- Migration 005: Freeform signal rules
-- Allow signal rules to exist without a signal_type_id (AI-extracted criteria)
-- Add criteria_text, min_value, max_value, source columns

-- 1. Make signal_type_id nullable
ALTER TABLE trial_signal_rules ALTER COLUMN signal_type_id DROP NOT NULL;

-- 2. Add new columns
ALTER TABLE trial_signal_rules ADD COLUMN IF NOT EXISTS signal_label TEXT;
ALTER TABLE trial_signal_rules ADD COLUMN IF NOT EXISTS criteria_text TEXT;
ALTER TABLE trial_signal_rules ADD COLUMN IF NOT EXISTS min_value NUMERIC;
ALTER TABLE trial_signal_rules ADD COLUMN IF NOT EXISTS max_value NUMERIC;
ALTER TABLE trial_signal_rules ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

-- 3. Expand operator CHECK to include BETWEEN and TEXT_MATCH
ALTER TABLE trial_signal_rules DROP CONSTRAINT IF EXISTS trial_signal_rules_operator_check;
ALTER TABLE trial_signal_rules ADD CONSTRAINT trial_signal_rules_operator_check
    CHECK (operator IN ('GTE', 'LTE', 'EQ', 'IN', 'BETWEEN', 'TEXT_MATCH'));

-- 4. Backfill signal_label from signal_types for existing rules
UPDATE trial_signal_rules tsr
SET signal_label = st.label
FROM signal_types st
WHERE tsr.signal_type_id = st.id AND tsr.signal_label IS NULL;
