export type SpecialtyKey = 'HEPATOLOGY' | 'ONCOLOGY' | 'HEMATOLOGY';

export interface SpecialtyOption {
    id: string;       // stable key used in patient_profile_config
    label: string;    // display name
    section: 'signals' | 'labs' | 'vitals' | 'imaging' | 'diagnoses' | 'medications' | 'lifestyle' | 'surgical_history' | 'family_history';
}

export interface SpecialtyTemplate {
    key: SpecialtyKey;
    label: string;
    description: string;
    color: string;
    options: SpecialtyOption[];
    // Signal types to seed for this specialty (name → matches signal_types.name)
    signalTypeNames: string[];
    // Hints for AI batch import column mapping
    columnAliases: Record<string, string>; // normalized alias → option id
}

export const SPECIALTY_TEMPLATES: Record<SpecialtyKey, SpecialtyTemplate> = {
    HEPATOLOGY: {
        key: 'HEPATOLOGY',
        label: 'Hepatology',
        description: 'Liver disease, fibrosis, cirrhosis, viral hepatitis',
        color: '#4a90c4',
        signalTypeNames: ['FIBROSCAN_KPA', 'BIOPSY_STAGE', 'PLATELETS', 'ALT', 'AST', 'MELD_SCORE', 'HBSAG', 'HBV_DNA', 'BMI', 'NAS_SCORE'],
        columnAliases: {
            lsm: 'fibroscan_kpa', fibroscan: 'fibroscan_kpa', liverstiffness: 'fibroscan_kpa',
            biopsystage: 'biopsy_stage', fibrosisfstage: 'biopsy_stage', metavir: 'biopsy_stage',
            platelet: 'platelets', plt: 'platelets', plateletcount: 'platelets',
            alt: 'alt', alanineaminotransferase: 'alt', sgpt: 'alt',
            ast: 'ast', aspartateaminotransferase: 'ast', sgot: 'ast',
            meld: 'meld_score', meldscore: 'meld_score',
            hbsag: 'hbsag', hbsantigen: 'hbsag',
            hbvdna: 'hbv_dna', hbvload: 'hbv_dna', hbvviralload: 'hbv_dna',
            bmi: 'bmi', bodymasindex: 'bmi',
            nas: 'nas_score', nasscore: 'nas_score',
        },
        options: [
            // Signals
            { id: 'fibroscan_kpa',  label: 'FibroScan (kPa)',        section: 'signals' },
            { id: 'biopsy_stage',   label: 'Fibrosis Stage (Biopsy)', section: 'signals' },
            { id: 'meld_score',     label: 'MELD Score',              section: 'signals' },
            { id: 'nas_score',      label: 'NAS Score',               section: 'signals' },
            { id: 'hbsag',          label: 'HBsAg Status',            section: 'signals' },
            { id: 'hbv_dna',        label: 'HBV DNA',                 section: 'signals' },
            // Labs
            { id: 'alt',            label: 'ALT',                     section: 'labs' },
            { id: 'ast',            label: 'AST',                     section: 'labs' },
            { id: 'platelets',      label: 'Platelet Count',          section: 'labs' },
            { id: 'bilirubin',      label: 'Bilirubin',               section: 'labs' },
            { id: 'albumin',        label: 'Albumin',                 section: 'labs' },
            { id: 'inr',            label: 'INR / PT',                section: 'labs' },
            { id: 'ggt',            label: 'GGT',                     section: 'labs' },
            { id: 'alp',            label: 'ALP',                     section: 'labs' },
            { id: 'hemoglobin_hep', label: 'Hemoglobin',              section: 'labs' },
            { id: 'creatinine',     label: 'Creatinine',              section: 'labs' },
            // Vitals
            { id: 'bmi_vital',      label: 'BMI',                     section: 'vitals' },
            { id: 'weight',         label: 'Weight',                  section: 'vitals' },
            { id: 'blood_pressure', label: 'Blood Pressure',          section: 'vitals' },
            // Imaging
            { id: 'fibroscan_lsm',  label: 'FibroScan / LSM',        section: 'imaging' },
            { id: 'liver_us',       label: 'Liver Ultrasound',        section: 'imaging' },
            { id: 'ct_abdomen',     label: 'CT Abdomen',              section: 'imaging' },
            { id: 'mri_liver',      label: 'MRI Liver',               section: 'imaging' },
            { id: 'cap_score',      label: 'FibroScan CAP Score',     section: 'imaging' },
            // Diagnoses
            { id: 'dx_nafld',       label: 'NAFLD / NASH',            section: 'diagnoses' },
            { id: 'dx_cirrhosis',   label: 'Cirrhosis',               section: 'diagnoses' },
            { id: 'dx_hbv',         label: 'Hepatitis B (HBV)',       section: 'diagnoses' },
            { id: 'dx_hcv',         label: 'Hepatitis C (HCV)',       section: 'diagnoses' },
            { id: 'dx_pbc',         label: 'PBC / PSC',               section: 'diagnoses' },
            { id: 'dx_aih',         label: 'Autoimmune Hepatitis',    section: 'diagnoses' },
            { id: 'dx_hcc',         label: 'Hepatocellular Carcinoma',section: 'diagnoses' },
            // Always-on
            { id: 'medications',    label: 'Medications',             section: 'medications' },
            { id: 'allergies',      label: 'Allergies',               section: 'medications' },
            { id: 'smoking_alcohol',label: 'Smoking / Alcohol',       section: 'lifestyle' },
            { id: 'surgical_hx',    label: 'Surgical History',        section: 'surgical_history' },
            { id: 'family_hx',      label: 'Family History',          section: 'family_history' },
        ],
    },

    ONCOLOGY: {
        key: 'ONCOLOGY',
        label: 'Oncology',
        description: 'Solid tumors, immunotherapy, targeted therapy',
        color: '#c4744a',
        signalTypeNames: ['ECOG_STATUS', 'CEA', 'CA_125', 'PSA', 'LDH_ONC', 'TUMOR_SIZE'],
        columnAliases: {
            ecog: 'ecog_status', performancestatus: 'ecog_status', ecogps: 'ecog_status',
            cea: 'cea', carcinoembryonicantigen: 'cea',
            ca125: 'ca_125', ca125u: 'ca_125',
            psa: 'psa', prostatespecificantigen: 'psa',
            ldh: 'ldh_onc', lactatedehydrogenase: 'ldh_onc',
            tumorsize: 'tumor_size', lesionsize: 'tumor_size', recist: 'tumor_size',
        },
        options: [
            // Signals
            { id: 'ecog_status',    label: 'ECOG Performance Status', section: 'signals' },
            { id: 'cea',            label: 'CEA',                     section: 'signals' },
            { id: 'ca_125',         label: 'CA-125',                  section: 'signals' },
            { id: 'psa',            label: 'PSA',                     section: 'signals' },
            { id: 'ldh_onc',        label: 'LDH',                     section: 'signals' },
            { id: 'tumor_size',     label: 'Tumor Size (RECIST)',      section: 'signals' },
            // Labs
            { id: 'cbc_onc',        label: 'CBC with Differential',   section: 'labs' },
            { id: 'cmp',            label: 'Comprehensive Metabolic Panel', section: 'labs' },
            { id: 'beta2mg',        label: 'Beta-2 Microglobulin',    section: 'labs' },
            { id: 'creatinine_onc', label: 'Creatinine / GFR',        section: 'labs' },
            { id: 'bili_onc',       label: 'Bilirubin',               section: 'labs' },
            { id: 'alt_onc',        label: 'ALT',                     section: 'labs' },
            // Vitals
            { id: 'weight_onc',     label: 'Weight / BSA',            section: 'vitals' },
            { id: 'bp_onc',         label: 'Blood Pressure',          section: 'vitals' },
            // Imaging
            { id: 'ct_staging',     label: 'CT (Staging)',            section: 'imaging' },
            { id: 'pet_scan',       label: 'PET Scan',                section: 'imaging' },
            { id: 'mri_onc',        label: 'MRI',                     section: 'imaging' },
            { id: 'bone_scan',      label: 'Bone Scan',               section: 'imaging' },
            // Diagnoses
            { id: 'dx_cancer_type', label: 'Cancer Type & Stage',     section: 'diagnoses' },
            { id: 'dx_metastatic',  label: 'Metastatic Sites',        section: 'diagnoses' },
            { id: 'dx_prior_tx',    label: 'Prior Lines of Treatment', section: 'diagnoses' },
            { id: 'dx_biomarkers',  label: 'Biomarkers / Mutations',  section: 'diagnoses' },
            // Always-on
            { id: 'medications_onc',label: 'Medications',             section: 'medications' },
            { id: 'allergies_onc',  label: 'Allergies',               section: 'medications' },
            { id: 'smoking_onc',    label: 'Smoking / Alcohol',       section: 'lifestyle' },
            { id: 'surgical_onc',   label: 'Surgical History',        section: 'surgical_history' },
        ],
    },

    HEMATOLOGY: {
        key: 'HEMATOLOGY',
        label: 'Hematology',
        description: 'Blood cancers, bone marrow disorders, coagulation',
        color: '#7a4ac4',
        signalTypeNames: ['HEMOGLOBIN', 'WBC', 'ANC', 'BLAST_PCT', 'HEMATOCRIT', 'LDH_HEM'],
        columnAliases: {
            hgb: 'hemoglobin', hemoglobin: 'hemoglobin', hb: 'hemoglobin',
            wbc: 'wbc', whitebloodcell: 'wbc', leukocytes: 'wbc',
            anc: 'anc', absoluteneutrophil: 'anc', neutrophilcount: 'anc',
            blast: 'blast_pct', blastpct: 'blast_pct', blastpercentage: 'blast_pct',
            hct: 'hematocrit', hematocrit: 'hematocrit',
            ldh: 'ldh_hem', lactatedehydrogenase: 'ldh_hem',
        },
        options: [
            // Signals
            { id: 'hemoglobin',     label: 'Hemoglobin',              section: 'signals' },
            { id: 'wbc',            label: 'WBC',                     section: 'signals' },
            { id: 'anc',            label: 'ANC',                     section: 'signals' },
            { id: 'blast_pct',      label: 'Blast %',                 section: 'signals' },
            { id: 'hematocrit',     label: 'Hematocrit',              section: 'signals' },
            { id: 'ldh_hem',        label: 'LDH',                     section: 'signals' },
            // Labs
            { id: 'cbc_diff',       label: 'CBC with Differential',   section: 'labs' },
            { id: 'platelets_hem',  label: 'Platelets',               section: 'labs' },
            { id: 'ferritin',       label: 'Ferritin',                section: 'labs' },
            { id: 'b12_folate',     label: 'B12 / Folate',            section: 'labs' },
            { id: 'coags',          label: 'Coagulation Studies',     section: 'labs' },
            { id: 'beta2mg_hem',    label: 'Beta-2 Microglobulin',    section: 'labs' },
            { id: 'uric_acid',      label: 'Uric Acid',               section: 'labs' },
            // Vitals
            { id: 'weight_hem',     label: 'Weight',                  section: 'vitals' },
            { id: 'spleen_size',    label: 'Spleen Size',             section: 'vitals' },
            // Imaging
            { id: 'bm_biopsy',      label: 'Bone Marrow Biopsy',     section: 'imaging' },
            { id: 'ct_lymph',       label: 'CT (Lymph Nodes)',        section: 'imaging' },
            { id: 'pet_hem',        label: 'PET Scan',                section: 'imaging' },
            // Diagnoses
            { id: 'dx_hem_type',    label: 'Diagnosis & Subtype',     section: 'diagnoses' },
            { id: 'dx_cytogenetics',label: 'Cytogenetics / Molecular',section: 'diagnoses' },
            { id: 'dx_prior_hem',   label: 'Prior Treatment Lines',   section: 'diagnoses' },
            { id: 'dx_transfusions',label: 'Transfusion History',     section: 'diagnoses' },
            // Always-on
            { id: 'medications_hem',label: 'Medications',             section: 'medications' },
            { id: 'allergies_hem',  label: 'Allergies',               section: 'medications' },
            { id: 'surgical_hem',   label: 'Surgical History',        section: 'surgical_history' },
            { id: 'family_hem',     label: 'Family History',          section: 'family_history' },
        ],
    },
};

export const ALL_SPECIALTY_KEYS = Object.keys(SPECIALTY_TEMPLATES) as SpecialtyKey[];

export interface SitePatientProfileConfig {
    specialties: SpecialtyKey[];
    enabled_options: string[]; // option ids the manager has checked
}

export const DEFAULT_ENABLED_BY_SPECIALTY: Record<SpecialtyKey, string[]> = {
    HEPATOLOGY: ['fibroscan_kpa', 'biopsy_stage', 'meld_score', 'alt', 'ast', 'platelets', 'bilirubin', 'albumin', 'inr', 'bmi_vital', 'fibroscan_lsm', 'dx_nafld', 'dx_cirrhosis', 'medications', 'allergies', 'smoking_alcohol'],
    ONCOLOGY:   ['ecog_status', 'ldh_onc', 'cbc_onc', 'cmp', 'weight_onc', 'ct_staging', 'dx_cancer_type', 'dx_prior_tx', 'medications_onc', 'allergies_onc'],
    HEMATOLOGY: ['hemoglobin', 'wbc', 'anc', 'blast_pct', 'platelets_hem', 'cbc_diff', 'ferritin', 'bm_biopsy', 'ct_lymph', 'dx_hem_type', 'dx_cytogenetics', 'medications_hem', 'allergies_hem'],
};
