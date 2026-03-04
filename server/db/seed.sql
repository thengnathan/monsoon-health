-- Seed Data for Clinical Trial Screening Tracker
-- Clean slate: only system essentials (site, admin user, config)

-- Site
INSERT INTO sites (id, name, timezone) VALUES
  ('site-001', 'My Research Site', 'America/Los_Angeles');

-- Users (passwords are bcrypt hash of 'password123')
-- Hash will be set by seed script
INSERT INTO users (id, site_id, name, email, password_hash, role) VALUES
  ('user-001', 'site-001', 'Admin User', 'admin@site.org', '$HASH$', 'MANAGER');

-- Signal Types (common clinical signals — configurable per site)
INSERT INTO signal_types (id, site_id, name, label, value_type, unit) VALUES
  ('sig-001', 'site-001', 'FIBROSCAN_KPA', 'FibroScan (kPa)', 'NUMBER', 'kPa'),
  ('sig-002', 'site-001', 'BIOPSY_STAGE', 'Fibrosis Stage (Biopsy)', 'ENUM', NULL),
  ('sig-003', 'site-001', 'PLATELETS', 'Platelet Count', 'NUMBER', '×10³/μL'),
  ('sig-004', 'site-001', 'ALT', 'ALT', 'NUMBER', 'U/L'),
  ('sig-005', 'site-001', 'AST', 'AST', 'NUMBER', 'U/L'),
  ('sig-006', 'site-001', 'MELD_SCORE', 'MELD Score', 'NUMBER', NULL),
  ('sig-007', 'site-001', 'HBSAG', 'HBsAg Status', 'ENUM', NULL),
  ('sig-008', 'site-001', 'HBV_DNA', 'HBV DNA', 'NUMBER', 'IU/mL'),
  ('sig-009', 'site-001', 'BMI', 'BMI', 'NUMBER', 'kg/m²'),
  ('sig-010', 'site-001', 'NAS_SCORE', 'NAS Score', 'NUMBER', NULL);

-- Screen Fail Reasons (common reasons — configurable per site)
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
   'See notes for details.');
