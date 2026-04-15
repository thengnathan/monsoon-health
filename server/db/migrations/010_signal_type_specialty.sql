-- Migration 010: add specialty column to signal_types
ALTER TABLE signal_types
    ADD COLUMN IF NOT EXISTS specialty VARCHAR(32) DEFAULT NULL;
