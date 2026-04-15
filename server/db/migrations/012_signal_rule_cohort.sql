-- Migration 012: add cohort column to trial_signal_rules
ALTER TABLE trial_signal_rules
    ADD COLUMN IF NOT EXISTS cohort VARCHAR(128) DEFAULT NULL;
