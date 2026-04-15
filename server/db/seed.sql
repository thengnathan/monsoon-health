-- Seed Data for Clinical Trial Screening Tracker
-- Run this once in the Supabase SQL Editor after schema creation

-- Site
INSERT INTO sites (id, name, timezone) VALUES
  ('site-001', 'My Research Site', 'America/Los_Angeles')
ON CONFLICT (id) DO NOTHING;

-- Admin user placeholder (Clerk auto-provisions real users on first login)
INSERT INTO users (id, site_id, name, email, password_hash, role) VALUES
  ('user-001', 'site-001', 'Admin User', 'admin@site.org', 'clerk-managed', 'MANAGER')
ON CONFLICT (id) DO NOTHING;

-- Signal Types
INSERT INTO signal_types (id, site_id, name, label, value_type, unit, specialty) VALUES
  -- Labs
  ('sig-001', 'site-001', 'ALT',              'ALT',                 'NUMBER', 'U/L',       'HEPATOLOGY'),
  ('sig-002', 'site-001', 'AST',              'AST',                 'NUMBER', 'U/L',       'HEPATOLOGY'),
  ('sig-003', 'site-001', 'TOTAL_BILIRUBIN',  'Total Bilirubin',     'NUMBER', 'mg/dL',     'HEPATOLOGY'),
  ('sig-004', 'site-001', 'ALBUMIN',          'Albumin',             'NUMBER', 'g/dL',      'HEPATOLOGY'),
  ('sig-005', 'site-001', 'INR',              'INR / PT',            'NUMBER', NULL,        'HEPATOLOGY'),
  ('sig-006', 'site-001', 'PLATELETS',        'Platelet Count',      'NUMBER', '×10³/μL',   'HEPATOLOGY'),
  ('sig-007', 'site-001', 'CREATININE',       'Creatinine',          'NUMBER', 'mg/dL',     'HEPATOLOGY'),
  ('sig-008', 'site-001', 'AFP',              'AFP',                 'NUMBER', 'ng/mL',     'HEPATOLOGY'),
  ('sig-009', 'site-001', 'HBA1C',            'HbA1c',               'NUMBER', '%',         'HEPATOLOGY'),
  ('sig-010', 'site-001', 'HCV_RNA',          'HCV RNA',             'NUMBER', 'IU/mL',     'HEPATOLOGY'),
  ('sig-011', 'site-001', 'HBV_DNA',          'HBV DNA',             'NUMBER', 'IU/mL',     'HEPATOLOGY'),
  ('sig-012', 'site-001', 'HBSAG',            'HBsAg Status',        'ENUM',   NULL,        'HEPATOLOGY'),
  -- Fibrosis / Imaging
  ('sig-013', 'site-001', 'FIBROSCAN_KPA',    'FibroScan (kPa)',     'NUMBER', 'kPa',       'HEPATOLOGY'),
  ('sig-014', 'site-001', 'ELF_SCORE',        'ELF Score',           'NUMBER', NULL,        'HEPATOLOGY'),
  ('sig-015', 'site-001', 'BIOPSY_STAGE',     'Liver Biopsy Stage',  'ENUM',   NULL,        'HEPATOLOGY'),
  -- Scoring
  ('sig-016', 'site-001', 'MELD_SCORE',       'MELD Score',          'NUMBER', NULL,        'HEPATOLOGY'),
  ('sig-017', 'site-001', 'CHILD_PUGH_SCORE', 'Child-Pugh Score',    'NUMBER', NULL,        'HEPATOLOGY'),
  ('sig-018', 'site-001', 'CHILD_PUGH_CLASS', 'Child-Pugh Class',    'ENUM',   NULL,        'HEPATOLOGY'),
  ('sig-019', 'site-001', 'NAS_SCORE',        'NAS Score',           'NUMBER', NULL,        'HEPATOLOGY'),
  -- General
  ('sig-020', 'site-001', 'BMI',              'BMI',                 'NUMBER', 'kg/m²',     NULL)
ON CONFLICT (id) DO NOTHING;

-- Screen Fail Reasons
INSERT INTO screen_fail_reasons (id, site_id, specialty, code, label, explanation_template) VALUES
  ('sfr-001', 'site-001', 'Hepatology', 'FIBROSCAN_BELOW', 'FibroScan Below Threshold',
   'FibroScan result was below the minimum threshold required for this study.'),
  ('sfr-002', 'site-001', 'Hepatology', 'BIOPSY_INELIGIBLE', 'Biopsy Stage Not Eligible',
   'Liver biopsy staging does not meet the requirement for this study.'),
  ('sfr-003', 'site-001', 'Hepatology', 'LAB_OUT_OF_RANGE', 'Lab Values Out of Range',
   'One or more laboratory values fell outside the acceptable range.'),
  ('sfr-004', 'site-001', 'Hepatology', 'COMORBIDITY_EXCLUSION', 'Excluded Due to Comorbidity',
   'A pre-existing medical condition makes participation inadvisable.'),
  ('sfr-005', 'site-001', 'Hepatology', 'MEDICATION_CONFLICT', 'Current Medication Conflict',
   'A current medication conflicts with the study protocol.'),
  ('sfr-006', 'site-001', NULL, 'PATIENT_DECLINED', 'Patient Declined Participation',
   'The patient decided not to participate.'),
  ('sfr-007', 'site-001', NULL, 'SCHEDULING_CONFLICT', 'Unable to Meet Visit Schedule',
   'The patient cannot commit to the required visit schedule.'),
  ('sfr-008', 'site-001', NULL, 'OTHER', 'Other Reason',
   'See notes for details.')
ON CONFLICT (id) DO NOTHING;
