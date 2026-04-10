-- Migration 002: Enable Row-Level Security on all tables
--
-- The server exclusively uses SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.
-- Enabling RLS with no additional policies means the anon/authenticated roles
-- have zero access — all reads/writes must go through the server API.
--
-- Run this once in the Supabase SQL editor or via psql.

ALTER TABLE sites               ENABLE ROW LEVEL SECURITY;
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_sources    ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE trials              ENABLE ROW LEVEL SECURITY;
ALTER TABLE trial_protocols     ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_types        ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_signals     ENABLE ROW LEVEL SECURITY;
ALTER TABLE trial_signal_rules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE screen_fail_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE screening_cases     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_templates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_visits      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs          ENABLE ROW LEVEL SECURITY;11
ALTER TABLE patient_documents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes               ENABLE ROW LEVEL SECURITY;

-- From migration 001_ai_fields.sql
ALTER TABLE patient_protocol_signals ENABLE ROW LEVEL SECURITY;

-- From src/db/migrations/001_document_chunks.sql
ALTER TABLE document_chunks     ENABLE ROW LEVEL SECURITY;
