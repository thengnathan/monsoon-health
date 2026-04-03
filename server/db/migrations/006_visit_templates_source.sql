-- Migration 006: Add source column to visit_templates
-- Allows distinguishing AI-extracted visits from manually created ones

ALTER TABLE visit_templates
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

-- Existing rows are manual
UPDATE visit_templates SET source = 'manual' WHERE source IS NULL OR source = '';

-- Index for filtered deletes on protocol re-extract
CREATE INDEX IF NOT EXISTS idx_visit_templates_trial_source
  ON visit_templates (trial_id, source);
