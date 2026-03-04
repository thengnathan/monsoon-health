-- Clinical Trial Screening State Tracker — Database Schema
-- SQLite-compatible, designed for Postgres migration

-- 1) Sites
CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2) Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL DEFAULT 'clerk-managed',
  role TEXT NOT NULL CHECK (role IN ('CRC', 'MANAGER', 'READONLY')) DEFAULT 'CRC',
  clerk_id TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  notification_prefs TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(site_id, email)
);
CREATE INDEX IF NOT EXISTS idx_users_site ON users(site_id);
CREATE INDEX IF NOT EXISTS idx_users_clerk ON users(clerk_id);

-- 3) Referral Sources
CREATE TABLE IF NOT EXISTS referral_sources (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('PCP', 'SPECIALIST', 'OTHER')) DEFAULT 'OTHER',
  contact_info TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(site_id, name)
);
CREATE INDEX IF NOT EXISTS idx_referral_sources_site ON referral_sources(site_id);

-- 4) Patients
CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  dob TEXT NOT NULL,
  internal_identifier TEXT,
  referral_source_id TEXT REFERENCES referral_sources(id),
  referral_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_patients_site ON patients(site_id);
CREATE INDEX IF NOT EXISTS idx_patients_search ON patients(site_id, last_name, dob);
CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_internal_id ON patients(site_id, internal_identifier) WHERE internal_identifier IS NOT NULL;

-- 5) Trials
CREATE TABLE IF NOT EXISTS trials (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  name TEXT NOT NULL,
  protocol_number TEXT,
  specialty TEXT,
  recruiting_status TEXT NOT NULL CHECK (recruiting_status IN ('ACTIVE', 'PAUSED', 'CLOSED')) DEFAULT 'ACTIVE',
  description TEXT,
  inclusion_criteria TEXT,
  exclusion_criteria TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_trials_site ON trials(site_id);
CREATE INDEX IF NOT EXISTS idx_trials_status ON trials(site_id, recruiting_status);

-- 5b) Trial Protocols (uploaded PDF files)
CREATE TABLE IF NOT EXISTS trial_protocols (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  trial_id TEXT NOT NULL REFERENCES trials(id),
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_data BLOB NOT NULL,
  version TEXT,
  uploaded_by_user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(trial_id, version)
);
CREATE INDEX IF NOT EXISTS idx_protocol_trial ON trial_protocols(trial_id);

-- 6) Signal Types
CREATE TABLE IF NOT EXISTS signal_types (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  value_type TEXT NOT NULL CHECK (value_type IN ('NUMBER', 'STRING', 'ENUM')),
  unit TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(site_id, name)
);

-- 7) Patient Signals (time-series)
CREATE TABLE IF NOT EXISTS patient_signals (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  patient_id TEXT NOT NULL REFERENCES patients(id),
  signal_type_id TEXT NOT NULL REFERENCES signal_types(id),
  value_number REAL,
  value_text TEXT,
  value_enum TEXT,
  collected_at TEXT NOT NULL,
  source TEXT,
  entered_by_user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_signals_patient ON patient_signals(site_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_signals_timeline ON patient_signals(patient_id, signal_type_id, collected_at DESC);

-- 8) Trial Signal Rules (threshold config)
CREATE TABLE IF NOT EXISTS trial_signal_rules (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  trial_id TEXT NOT NULL REFERENCES trials(id),
  signal_type_id TEXT NOT NULL REFERENCES signal_types(id),
  operator TEXT NOT NULL CHECK (operator IN ('GTE', 'LTE', 'EQ', 'IN')),
  threshold_number REAL,
  threshold_text TEXT,
  threshold_list TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rules_trial ON trial_signal_rules(trial_id);
CREATE INDEX IF NOT EXISTS idx_rules_trial_signal ON trial_signal_rules(trial_id, signal_type_id);

-- 9) Screen Fail Reasons
CREATE TABLE IF NOT EXISTS screen_fail_reasons (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  specialty TEXT,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  explanation_template TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(site_id, code)
);

-- 10) Screening Cases (CORE)
CREATE TABLE IF NOT EXISTS screening_cases (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  patient_id TEXT NOT NULL REFERENCES patients(id),
  trial_id TEXT NOT NULL REFERENCES trials(id),
  assigned_user_id TEXT REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN (
    'NEW', 'IN_REVIEW', 'PENDING_INFO', 'LIKELY_ELIGIBLE',
    'SCREEN_FAILED', 'FUTURE_CANDIDATE', 'DECLINED',
    'LOST_TO_FOLLOWUP', 'ENROLLED'
  )) DEFAULT 'NEW',
  fail_reason_id TEXT REFERENCES screen_fail_reasons(id),
  fail_reason_text TEXT,
  what_would_change_text TEXT,
  revisit_date TEXT,
  next_action_date TEXT,
  last_touched_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cases_site_status ON screening_cases(site_id, status);
CREATE INDEX IF NOT EXISTS idx_cases_trial_status ON screening_cases(trial_id, status);
CREATE INDEX IF NOT EXISTS idx_cases_patient ON screening_cases(patient_id);
CREATE INDEX IF NOT EXISTS idx_cases_assigned ON screening_cases(assigned_user_id, status);
CREATE INDEX IF NOT EXISTS idx_cases_revisit ON screening_cases(site_id, revisit_date);

-- 11) Pending Items
CREATE TABLE IF NOT EXISTS pending_items (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  screening_case_id TEXT NOT NULL REFERENCES screening_cases(id),
  type TEXT NOT NULL CHECK (type IN ('LAB', 'IMAGING', 'RECORDS', 'PROCEDURE', 'CONSULT')),
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'COMPLETED', 'CANCELLED')) DEFAULT 'OPEN',
  due_date TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pending_case ON pending_items(screening_case_id);
CREATE INDEX IF NOT EXISTS idx_pending_status ON pending_items(site_id, status);
CREATE INDEX IF NOT EXISTS idx_pending_due ON pending_items(site_id, due_date);

-- 12) Visit Templates (per-trial visit schedule blueprint)
CREATE TABLE IF NOT EXISTS visit_templates (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  trial_id TEXT NOT NULL REFERENCES trials(id),
  visit_name TEXT NOT NULL,
  day_offset INTEGER NOT NULL,
  window_before INTEGER DEFAULT 0,
  window_after INTEGER DEFAULT 0,
  reminder_days_before INTEGER DEFAULT 3,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_visit_templates_trial ON visit_templates(trial_id);

-- 13) Patient Visits (actual scheduled/completed visits per enrolled patient)
CREATE TABLE IF NOT EXISTS patient_visits (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  screening_case_id TEXT NOT NULL REFERENCES screening_cases(id),
  visit_template_id TEXT NOT NULL REFERENCES visit_templates(id),
  scheduled_date TEXT NOT NULL,
  actual_date TEXT,
  status TEXT NOT NULL CHECK (status IN ('SCHEDULED', 'COMPLETED', 'MISSED', 'CANCELLED')) DEFAULT 'SCHEDULED',
  reminder_sent INTEGER DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_patient_visits_case ON patient_visits(screening_case_id);
CREATE INDEX IF NOT EXISTS idx_patient_visits_scheduled ON patient_visits(site_id, scheduled_date);

-- 14) Notification Events
CREATE TABLE IF NOT EXISTS notification_events (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  type TEXT NOT NULL CHECK (type IN ('REVISIT_DUE', 'THRESHOLD_CROSSED', 'PENDING_ITEM_COMPLETED', 'VISIT_REMINDER')),
  patient_id TEXT REFERENCES patients(id),
  screening_case_id TEXT REFERENCES screening_cases(id),
  payload TEXT DEFAULT '{}',
  dedup_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT,
  UNIQUE(site_id, dedup_key)
);
CREATE INDEX IF NOT EXISTS idx_notifications_unprocessed ON notification_events(site_id, processed_at);

-- 15) Email Logs
CREATE TABLE IF NOT EXISTS email_logs (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  event_id TEXT NOT NULL REFERENCES notification_events(id),
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_preview TEXT,
  sent_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('QUEUED', 'SENT', 'FAILED')) DEFAULT 'QUEUED',
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_email_user ON email_logs(user_id, sent_at);

-- 16) Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE')),
  diff TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(site_id, entity_type, entity_id);

-- 17) Patient Documents (uploaded files: Fibroscan reports, labs, etc.)
CREATE TABLE IF NOT EXISTS patient_documents (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  patient_id TEXT NOT NULL REFERENCES patients(id),
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_data BLOB NOT NULL,
  document_type TEXT CHECK (document_type IN ('FIBROSCAN', 'LAB_REPORT', 'IMAGING', 'REFERRAL', 'CONSENT', 'OTHER')) DEFAULT 'OTHER',
  notes TEXT,
  uploaded_by_user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_patient_docs_patient ON patient_documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_docs_site ON patient_documents(site_id);
