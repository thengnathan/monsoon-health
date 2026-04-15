-- Migration 011: provision full hepatology signal set for all existing sites
-- Uses INSERT ... SELECT so it runs safely for every site without duplicating.

DO $$
DECLARE
    signals RECORD;
    site_row RECORD;
BEGIN
    FOR site_row IN SELECT id FROM sites LOOP

        -- Labs
        INSERT INTO signal_types (id, site_id, name, label, value_type, unit, specialty)
        SELECT gen_random_uuid(), site_row.id, s.name, s.label, s.value_type, s.unit, s.specialty
        FROM (VALUES
            ('ALT',              'ALT',                    'NUMBER', 'U/L',       'HEPATOLOGY'),
            ('AST',              'AST',                    'NUMBER', 'U/L',       'HEPATOLOGY'),
            ('TOTAL_BILIRUBIN',  'Total Bilirubin',        'NUMBER', 'mg/dL',     'HEPATOLOGY'),
            ('ALBUMIN',          'Albumin',                'NUMBER', 'g/dL',      'HEPATOLOGY'),
            ('INR',              'INR / PT',               'NUMBER', NULL,        'HEPATOLOGY'),
            ('PLATELETS',        'Platelet Count',         'NUMBER', '×10³/μL',   'HEPATOLOGY'),
            ('CREATININE',       'Creatinine',             'NUMBER', 'mg/dL',     'HEPATOLOGY'),
            ('AFP',              'AFP',                    'NUMBER', 'ng/mL',     'HEPATOLOGY'),
            ('HBA1C',            'HbA1c',                  'NUMBER', '%',         'HEPATOLOGY'),
            ('HCV_RNA',          'HCV RNA',                'NUMBER', 'IU/mL',     'HEPATOLOGY'),
            ('HBV_DNA',          'HBV DNA',                'NUMBER', 'IU/mL',     'HEPATOLOGY'),
            ('HBSAG',            'HBsAg Status',           'ENUM',   NULL,        'HEPATOLOGY'),
            -- Fibrosis / Imaging
            ('FIBROSCAN_KPA',    'FibroScan (kPa)',         'NUMBER', 'kPa',       'HEPATOLOGY'),
            ('ELF_SCORE',        'ELF Score',              'NUMBER', NULL,        'HEPATOLOGY'),
            ('BIOPSY_STAGE',     'Liver Biopsy Stage',     'ENUM',   NULL,        'HEPATOLOGY'),
            -- Scoring
            ('MELD_SCORE',       'MELD Score',             'NUMBER', NULL,        'HEPATOLOGY'),
            ('CHILD_PUGH_SCORE', 'Child-Pugh Score',       'NUMBER', NULL,        'HEPATOLOGY'),
            ('CHILD_PUGH_CLASS', 'Child-Pugh Class',       'ENUM',   NULL,        'HEPATOLOGY'),
            ('NAS_SCORE',        'NAS Score',              'NUMBER', NULL,        'HEPATOLOGY'),
            -- Vitals / General
            ('BMI',              'BMI',                    'NUMBER', 'kg/m²',     NULL)
        ) AS s(name, label, value_type, unit, specialty)
        WHERE NOT EXISTS (
            SELECT 1 FROM signal_types st
            WHERE st.site_id = site_row.id AND st.name = s.name
        );

    END LOOP;
END $$;
