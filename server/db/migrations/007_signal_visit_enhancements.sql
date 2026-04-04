-- Migration 007: Enhanced signal rules and visit template fields

-- Signal rules: add field identifier and clinical rationale
ALTER TABLE trial_signal_rules
  ADD COLUMN IF NOT EXISTS field TEXT,
  ADD COLUMN IF NOT EXISTS clinical_rationale TEXT,
  ADD COLUMN IF NOT EXISTS value_text TEXT;

-- Visit templates: add label and scheduling flags
ALTER TABLE visit_templates
  ADD COLUMN IF NOT EXISTS visit_label TEXT,
  ADD COLUMN IF NOT EXISTS is_screening BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_randomization BOOLEAN NOT NULL DEFAULT false;
