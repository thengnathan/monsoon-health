-- Migration 008: site specialty config + patient profile
ALTER TABLE sites
    ADD COLUMN IF NOT EXISTS specialties JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS patient_profile_config JSONB NOT NULL DEFAULT '{"specialties":[],"enabled_options":[]}';
