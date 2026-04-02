-- Intake Submissions: patient-facing intake form submissions

CREATE TABLE IF NOT EXISTS intake_submissions (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  form_data JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'CONVERTED', 'ARCHIVED')) DEFAULT 'PENDING',
  patient_id TEXT REFERENCES patients(id),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intake_site_status ON intake_submissions(site_id, status);
CREATE INDEX IF NOT EXISTS idx_intake_submitted ON intake_submissions(site_id, submitted_at DESC);
