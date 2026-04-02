import { useState, CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OtherMed { name: string; dose: string; }

interface FormData {
    about: {
        first_name: string; last_name: string; dob: string;
        biological_sex: string; gender_identity: string;
        phone: string; email: string; preferred_language: string;
        race_ethnicity: string[]; height: string; weight_lbs: string;
    };
    medical_history: {
        conditions: string[]; other_conditions: string;
        surgical_history: string[]; other_surgical_history: string;
        family_history: string[];
    };
    liver_health: {
        had_fibroscan: string; fibroscan_kpa: string; fibroscan_date: string;
        had_biopsy: string; biopsy_stage: string; biopsy_date: string;
        liver_procedures: string[]; liver_symptoms: string[];
        sees_hepatologist: string;
    };
    medications: {
        glp1_meds: string[]; glp1_last_dose: string;
        diabetes_meds: string[]; liver_cholesterol_meds: string[];
        blood_thinners: string[];
        other_meds: OtherMed[];
        supplements: string[]; drug_allergies: string;
    };
    lifestyle: {
        alcohol_frequency: string; drinks_per_occasion: string;
        doctor_drink_advice: string; smoking_status: string;
        activity_level: string; diet: string[];
        health_rating: number;
        prior_research: string; current_research: string;
        research_willingness: string; additional_notes: string;
    };
    consent: { signature: string; consent_date: string; consented: boolean; };
}

const empty: FormData = {
    about: { first_name: '', last_name: '', dob: '', biological_sex: '', gender_identity: '',
             phone: '', email: '', preferred_language: 'English', race_ethnicity: [],
             height: '', weight_lbs: '' },
    medical_history: { conditions: [], other_conditions: '', surgical_history: [],
                       other_surgical_history: '', family_history: [] },
    liver_health: { had_fibroscan: '', fibroscan_kpa: '', fibroscan_date: '',
                    had_biopsy: '', biopsy_stage: '', biopsy_date: '',
                    liver_procedures: [], liver_symptoms: [], sees_hepatologist: '' },
    medications: { glp1_meds: [], glp1_last_dose: '', diabetes_meds: [],
                   liver_cholesterol_meds: [], blood_thinners: [],
                   other_meds: [{ name: '', dose: '' }],
                   supplements: [], drug_allergies: '' },
    lifestyle: { alcohol_frequency: '', drinks_per_occasion: '', doctor_drink_advice: '',
                 smoking_status: '', activity_level: '', diet: [],
                 health_rating: 5,
                 prior_research: '', current_research: '', research_willingness: '',
                 additional_notes: '' },
    consent: { signature: '', consent_date: new Date().toISOString().split('T')[0], consented: false },
};

// ── Inline CSS constants ───────────────────────────────────────────────────────

const C = {
    bg: '#f4f6f9', surface: '#ffffff', border: '#e2e8f0',
    text: '#111827', muted: '#6b7280',
    accent: '#1a3a5c', accentLight: '#e8eef5',
    highlight: '#c8773a', success: '#2d7a4f', error: '#c0392b',
    inputBg: '#ffffff',
};

const s: Record<string, CSSProperties> = {
    page: { fontFamily: "'Inter', 'Segoe UI', sans-serif", background: C.bg,
            color: C.text, minHeight: '100vh', padding: '0 0 80px' },
    header: { background: 'linear-gradient(135deg, #0f2744 0%, #1a3a5c 60%, #1e4a72 100%)',
              padding: '36px 24px 32px', textAlign: 'center' as const,
              position: 'relative' as const },
    logoRow: { display: 'flex', alignItems: 'center', justifyContent: 'center',
               marginBottom: 22 },
    h1: { fontSize: 22, color: 'white', fontWeight: 600, letterSpacing: '-0.01em',
          marginBottom: 8, lineHeight: 1.3 },
    headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.65)', maxWidth: 360,
                 margin: '0 auto', lineHeight: 1.6 },
    progressBar: { background: C.surface, borderBottom: `1px solid ${C.border}`,
                   padding: '18px 24px 22px', position: 'sticky' as const, top: 0, zIndex: 100,
                   boxShadow: '0 1px 12px rgba(0,0,0,0.08)' },
    progressSteps: { display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                     maxWidth: 500, margin: '0 auto', position: 'relative' as const },
    container: { maxWidth: 580, margin: '0 auto', padding: '0 16px' },
    card: { background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`,
            padding: '28px 24px', marginTop: 20, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' },
    sectionHeader: { display: 'flex', alignItems: 'center', gap: 14,
                     marginBottom: 22, paddingBottom: 18, borderBottom: `1px solid ${C.border}` },
    sectionIcon: { width: 42, height: 42, borderRadius: 12, background: C.accentLight,
                   display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    sectionTitle: { fontSize: 17, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' },
    sectionSub: { fontSize: 12, color: C.muted, marginTop: 3 },
    field: { marginBottom: 18 },
    label: { display: 'block', fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 7 },
    required: { color: C.highlight, marginLeft: 2 },
    hint: { fontSize: 11, color: C.muted, marginBottom: 7 },
    input: { width: '100%', padding: '11px 14px', background: C.inputBg,
             border: `1.5px solid ${C.border}`, borderRadius: 10, fontSize: 14,
             color: C.text, outline: 'none', boxSizing: 'border-box' as const,
             fontFamily: 'inherit', transition: 'border-color 0.15s' },
    select: { width: '100%', padding: '11px 14px', background: C.inputBg,
              border: `1.5px solid ${C.border}`, borderRadius: 10, fontSize: 14,
              color: C.text, outline: 'none', boxSizing: 'border-box' as const,
              fontFamily: 'inherit', appearance: 'none' as const },
    textarea: { width: '100%', padding: '11px 14px', background: C.inputBg,
                border: `1.5px solid ${C.border}`, borderRadius: 10, fontSize: 14,
                color: C.text, outline: 'none', resize: 'vertical' as const,
                minHeight: 88, boxSizing: 'border-box' as const, fontFamily: 'inherit' },
    row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
    subsectionTitle: { fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const,
                       letterSpacing: '0.1em', color: C.accent, marginBottom: 12,
                       paddingBottom: 6, borderBottom: `2px solid ${C.accentLight}` },
    checkboxGroup: { display: 'flex', flexDirection: 'column' as const, gap: 6 },
    checkOption: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px',
                   border: `1.5px solid ${C.border}`, borderRadius: 10, cursor: 'pointer',
                   fontSize: 13, color: C.text, background: C.inputBg },
    radioGroup: { display: 'flex', flexDirection: 'column' as const, gap: 6 },
    radioGroupH: { display: 'flex', flexWrap: 'wrap' as const, gap: 6 },
    radioOption: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                   border: `1.5px solid ${C.border}`, borderRadius: 10, cursor: 'pointer',
                   fontSize: 13, color: C.text, background: C.inputBg },
    divider: { height: 1, background: C.border, margin: '18px 0' },
    navButtons: { display: 'flex', gap: 12, marginTop: 20, paddingBottom: 20 },
    btnBack: { flex: 1, padding: '14px 0', background: C.surface, border: `1.5px solid ${C.border}`,
               borderRadius: 12, fontSize: 14, fontWeight: 600, color: C.muted,
               cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s' },
    btnNext: { flex: 2, padding: '14px 0', background: C.accent, border: 'none', borderRadius: 12,
               fontSize: 14, fontWeight: 600, color: 'white', cursor: 'pointer',
               fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(26,58,92,0.3)',
               transition: 'opacity 0.15s' },
    btnSubmit: { flex: 2, padding: '14px 0', background: C.success, border: 'none', borderRadius: 12,
                 fontSize: 14, fontWeight: 600, color: 'white', cursor: 'pointer',
                 fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(45,122,79,0.3)',
                 transition: 'opacity 0.15s' },
    alertInfo: { display: 'flex', gap: 8, padding: '12px 14px', background: '#e8eef5',
                 border: '1px solid rgba(26,58,92,0.15)', borderRadius: 10,
                 fontSize: 12, color: '#1a3a5c', marginBottom: 16, lineHeight: 1.5 },
    alertWarn: { display: 'flex', gap: 8, padding: '12px 14px', background: '#fef5ec',
                 border: '1px solid rgba(200,119,58,0.2)', borderRadius: 10,
                 fontSize: 12, color: '#8a4a1a', marginBottom: 16, lineHeight: 1.5 },
    consentBox: { background: '#f0f4f8', border: '1.5px solid rgba(26,58,92,0.15)',
                  borderRadius: 12, padding: 16, fontSize: 12, color: C.muted,
                  lineHeight: 1.7, marginBottom: 16, maxHeight: 160, overflowY: 'auto' as const },
    privacyNote: { textAlign: 'center' as const, fontSize: 11, color: C.muted,
                   marginTop: 16, display: 'flex', alignItems: 'center',
                   justifyContent: 'center', gap: 4 },
    successCard: { textAlign: 'center' as const, padding: '40px 20px' },
    successIcon: { width: 72, height: 72, background: '#e8f5ee', borderRadius: '50%',
                   display: 'flex', alignItems: 'center', justifyContent: 'center',
                   margin: '0 auto 24px' },
    glpFlag: { display: 'inline-block', background: '#fef5ec',
               border: '1px solid rgba(200,119,58,0.3)', color: C.highlight,
               fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
               textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginLeft: 6 },
    medEntry: { border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px',
                marginBottom: 8, position: 'relative' as const, background: C.inputBg },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function CheckOption({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
    return (
        <label style={{ ...s.checkOption, borderColor: checked ? C.accent : C.border,
                        background: checked ? C.accentLight : C.inputBg }}>
            <input type="checkbox" checked={checked} onChange={onChange}
                   style={{ accentColor: C.accent, flexShrink: 0, marginTop: 2 }} />
            <span>{label}</span>
        </label>
    );
}

function RadioOption({ label, checked, onChange, horizontal }: {
    label: string; checked: boolean; onChange: () => void; horizontal?: boolean;
}) {
    return (
        <label style={{ ...(horizontal ? s.radioOption : s.radioOption),
                        borderColor: checked ? C.accent : C.border,
                        background: checked ? C.accentLight : C.inputBg }}>
            <input type="radio" checked={checked} onChange={onChange}
                   style={{ accentColor: C.accent, flexShrink: 0 }} />
            <span>{label}</span>
        </label>
    );
}

function CheckGroup({ options, values, onChange }: {
    options: string[]; values: string[]; onChange: (v: string[]) => void;
}) {
    const toggle = (opt: string) => {
        onChange(values.includes(opt) ? values.filter(v => v !== opt) : [...values, opt]);
    };
    return (
        <div style={s.checkboxGroup}>
            {options.map(opt => (
                <CheckOption key={opt} label={opt} checked={values.includes(opt)}
                             onChange={() => toggle(opt)} />
            ))}
        </div>
    );
}

function RadioGroup({ options, value, onChange, horizontal }: {
    options: string[]; value: string; onChange: (v: string) => void; horizontal?: boolean;
}) {
    return (
        <div style={horizontal ? s.radioGroupH : s.radioGroup}>
            {options.map(opt => (
                <RadioOption key={opt} label={opt} checked={value === opt}
                             onChange={() => onChange(opt)} horizontal={horizontal} />
            ))}
        </div>
    );
}

// ── Step dots ─────────────────────────────────────────────────────────────────

const STEPS = ['You', 'History', 'Liver', 'Meds', 'Lifestyle', 'Review'];

function ProgressBar({ step }: { step: number }) {
    const pct = (step / (STEPS.length - 1)) * 100;
    return (
        <div style={s.progressBar}>
            <div style={s.progressSteps}>
                <div style={{ position: 'absolute', top: 14, left: 14, right: 14,
                              height: 2, background: C.border, zIndex: 0 }} />
                <div style={{ position: 'absolute', top: 14, left: 14, height: 2,
                              width: `calc(${pct}% - 28px)`, background: C.accent,
                              zIndex: 1, transition: 'width 0.4s ease' }} />
                {STEPS.map((label, i) => {
                    const active = i === step;
                    const done = i < step;
                    return (
                        <div key={i} style={{ position: 'relative', zIndex: 2 }}>
                            <div style={{ width: 30, height: 30, borderRadius: '50%',
                                          background: done ? C.success : active ? C.accent : C.surface,
                                          border: `2px solid ${done ? C.success : active ? C.accent : C.border}`,
                                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                                          fontSize: 11, fontWeight: 700,
                                          color: done || active ? 'white' : C.muted,
                                          boxShadow: active ? '0 0 0 4px rgba(26,58,92,0.12)' : 'none',
                                          transition: 'all 0.25s ease' }}>
                                {done ? (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                ) : i + 1}
                            </div>
                            <div style={{ position: 'absolute', top: 36, fontSize: 9,
                                          color: active ? C.accent : C.muted, whiteSpace: 'nowrap',
                                          left: '50%', transform: 'translateX(-50%)',
                                          fontWeight: active ? 700 : 500, textTransform: 'uppercase',
                                          letterSpacing: '0.07em' }}>
                                {label}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function IntakeFormPage() {
    const [searchParams] = useSearchParams();
    const siteId = searchParams.get('site') || '';

    const [step, setStep] = useState(0);
    const [form, setForm] = useState<FormData>(empty);
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    if (!siteId) {
        return (
            <div style={{ ...s.page, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center' }}>
                <img src="/images/monsoon-braid-wordmark.svg" alt="Monsoon Health" style={{ height: 36, marginBottom: 40 }} />
                <div style={{ textAlign: 'center', padding: '32px 28px', maxWidth: 400,
                              background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`,
                              boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#fef2f2',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  margin: '0 auto 16px' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round">
                            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                    </div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: C.text }}>Invalid Link</h2>
                    <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.6 }}>
                        This link is missing a site identifier. Please use the link provided by your care team.
                    </p>
                </div>
            </div>
        );
    }

    const setAbout = (k: keyof FormData['about'], v: string | string[]) =>
        setForm(f => ({ ...f, about: { ...f.about, [k]: v } }));
    const setHistory = (k: keyof FormData['medical_history'], v: string | string[]) =>
        setForm(f => ({ ...f, medical_history: { ...f.medical_history, [k]: v } }));
    const setLiver = (k: keyof FormData['liver_health'], v: string | string[]) =>
        setForm(f => ({ ...f, liver_health: { ...f.liver_health, [k]: v } }));
    const setMeds = (k: keyof FormData['medications'], v: unknown) =>
        setForm(f => ({ ...f, medications: { ...f.medications, [k]: v } }));
    const setLifestyle = (k: keyof FormData['lifestyle'], v: unknown) =>
        setForm(f => ({ ...f, lifestyle: { ...f.lifestyle, [k]: v } }));
    const setConsent = (k: keyof FormData['consent'], v: unknown) =>
        setForm(f => ({ ...f, consent: { ...f.consent, [k]: v } }));

    const next = () => { setStep(s => s + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    const back = () => { setStep(s => s - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); };

    const handleSubmit = async () => {
        if (!form.consent.consented) { setError('Please confirm your consent before submitting.'); return; }
        if (!form.consent.signature.trim()) { setError('Please type your full name as a digital signature.'); return; }
        setError('');
        setSubmitting(true);
        try {
            const res = await fetch(`/api/intake/submit?site=${encodeURIComponent(siteId)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json() as { success?: boolean; error?: string };
            if (!res.ok) throw new Error(data.error || 'Submission failed');
            setSubmitted(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSubmitting(false);
        }
    };

    // ── Section 1: About You ───────────────────────────────────────────────────

    const section0 = (
        <>
            <div style={s.card}>
                <div style={s.sectionHeader}>
                    <div style={s.sectionIcon}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                        </svg>
                    </div>
                    <div>
                        <div style={s.sectionTitle}>About You</div>
                        <div style={s.sectionSub}>Basic personal information</div>
                    </div>
                </div>

                <div style={s.row}>
                    <div style={s.field}>
                        <label style={s.label}>First Name<span style={s.required}>*</span></label>
                        <input style={s.input} placeholder="First name" value={form.about.first_name}
                               onChange={e => setAbout('first_name', e.target.value)} />
                    </div>
                    <div style={s.field}>
                        <label style={s.label}>Last Name<span style={s.required}>*</span></label>
                        <input style={s.input} placeholder="Last name" value={form.about.last_name}
                               onChange={e => setAbout('last_name', e.target.value)} />
                    </div>
                </div>

                <div style={s.row}>
                    <div style={s.field}>
                        <label style={s.label}>Date of Birth<span style={s.required}>*</span></label>
                        <input type="date" style={s.input} value={form.about.dob}
                               onChange={e => setAbout('dob', e.target.value)} />
                    </div>
                    <div style={s.field}>
                        <label style={s.label}>Biological Sex<span style={s.required}>*</span></label>
                        <select style={s.select} value={form.about.biological_sex}
                                onChange={e => setAbout('biological_sex', e.target.value)}>
                            <option value="">Select</option>
                            <option>Male</option><option>Female</option><option>Prefer not to say</option>
                        </select>
                    </div>
                </div>

                <div style={s.field}>
                    <label style={s.label}>Gender Identity</label>
                    <select style={s.select} value={form.about.gender_identity}
                            onChange={e => setAbout('gender_identity', e.target.value)}>
                        <option value="">Select (optional)</option>
                        <option>Man</option><option>Woman</option><option>Non-binary</option>
                        <option>Prefer to self-describe</option><option>Prefer not to say</option>
                    </select>
                </div>

                <div style={s.field}>
                    <label style={s.label}>Phone Number<span style={s.required}>*</span></label>
                    <input type="tel" style={s.input} placeholder="(555) 000-0000" value={form.about.phone}
                           onChange={e => setAbout('phone', e.target.value)} />
                </div>

                <div style={s.field}>
                    <label style={s.label}>Email Address<span style={s.required}>*</span></label>
                    <input type="email" style={s.input} placeholder="your@email.com" value={form.about.email}
                           onChange={e => setAbout('email', e.target.value)} />
                </div>

                <div style={s.field}>
                    <label style={s.label}>Preferred Language</label>
                    <select style={s.select} value={form.about.preferred_language}
                            onChange={e => setAbout('preferred_language', e.target.value)}>
                        <option>English</option><option>Spanish</option><option>Hmong</option>
                        <option>Punjabi</option><option>Arabic</option><option>Other</option>
                    </select>
                </div>

                <div style={s.field}>
                    <label style={s.label}>Race / Ethnicity<span style={s.required}>*</span></label>
                    <div style={s.hint}>Select all that apply</div>
                    <CheckGroup
                        options={['White / Caucasian','Hispanic or Latino','Black or African American',
                                  'Asian','Native American or Alaska Native','Pacific Islander','Prefer not to say']}
                        values={form.about.race_ethnicity}
                        onChange={v => setAbout('race_ethnicity', v)} />
                </div>

                <div style={s.row}>
                    <div style={s.field}>
                        <label style={s.label}>Height</label>
                        <input style={s.input} placeholder="e.g. 5'10&quot;" value={form.about.height}
                               onChange={e => setAbout('height', e.target.value)} />
                    </div>
                    <div style={s.field}>
                        <label style={s.label}>Weight (lbs)</label>
                        <input type="number" style={s.input} placeholder="e.g. 185" value={form.about.weight_lbs}
                               onChange={e => setAbout('weight_lbs', e.target.value)} />
                    </div>
                </div>
            </div>
            <div style={s.navButtons}>
                <button style={s.btnNext} onClick={() => {
                    if (!form.about.first_name || !form.about.last_name || !form.about.dob ||
                        !form.about.biological_sex || !form.about.phone || !form.about.email) {
                        alert('Please fill in all required fields before continuing.');
                        return;
                    }
                    next();
                }}>Continue →</button>
            </div>
        </>
    );

    // ── Section 2: Medical History ─────────────────────────────────────────────

    const section1 = (
        <>
            <div style={s.card}>
                <div style={s.sectionHeader}>
                    <div style={s.sectionIcon}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2">
                            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                    </div>
                    <div>
                        <div style={s.sectionTitle}>Medical History</div>
                        <div style={s.sectionSub}>Existing conditions and diagnoses</div>
                    </div>
                </div>

                <div style={{ ...s.subsectionTitle, marginBottom: 12 }}>Liver &amp; GI Conditions</div>
                <CheckGroup
                    options={['Non-Alcoholic Fatty Liver Disease (NAFLD) / MASH','Liver cirrhosis',
                              'Hepatitis B','Hepatitis C','Alcoholic liver disease','Autoimmune hepatitis',
                              'Primary biliary cholangitis (PBC)','Inflammatory bowel disease (Crohn\'s / Ulcerative Colitis)',
                              'Liver cancer (hepatocellular carcinoma)']}
                    values={form.medical_history.conditions}
                    onChange={v => setHistory('conditions', v)} />

                <div style={{ ...s.subsectionTitle, marginTop: 16 }}>Metabolic &amp; Cardiovascular</div>
                <CheckGroup
                    options={['Type 2 diabetes','Type 1 diabetes','Prediabetes','High blood pressure (hypertension)',
                              'High cholesterol (hyperlipidemia)','Heart disease / coronary artery disease',
                              'Heart failure','Stroke or TIA','Obesity (BMI ≥ 30)','Metabolic syndrome','Thyroid disease']}
                    values={form.medical_history.conditions}
                    onChange={v => setHistory('conditions', v)} />

                <div style={{ ...s.subsectionTitle, marginTop: 16 }}>Other Conditions</div>
                <CheckGroup
                    options={['Kidney disease (chronic)','Sleep apnea',
                              'Cancer (other than liver) — please specify below','HIV / AIDS',
                              'Autoimmune disease','Mental health condition (depression, anxiety, etc.)','None of the above']}
                    values={form.medical_history.conditions}
                    onChange={v => setHistory('conditions', v)} />

                <div style={{ ...s.field, marginTop: 16 }}>
                    <label style={s.label}>Other conditions not listed above</label>
                    <textarea style={s.textarea} placeholder="Please describe any other diagnosed conditions..."
                              value={form.medical_history.other_conditions}
                              onChange={e => setHistory('other_conditions', e.target.value)} />
                </div>

                <div style={s.divider} />
                <div style={s.subsectionTitle}>Surgical History</div>
                <CheckGroup
                    options={['Bariatric / weight loss surgery (gastric bypass, sleeve gastrectomy)',
                              'Gallbladder removal (cholecystectomy)','Liver resection or liver surgery',
                              'Liver transplant','Abdominal surgery (other)','Heart surgery',
                              'Kidney surgery or transplant','No prior surgeries']}
                    values={form.medical_history.surgical_history}
                    onChange={v => setHistory('surgical_history', v)} />

                <div style={{ ...s.field, marginTop: 16 }}>
                    <label style={s.label}>Additional surgical history</label>
                    <div style={s.hint}>Please include approximate dates if known</div>
                    <textarea style={s.textarea} placeholder="e.g. Appendectomy 2015, knee replacement 2020..."
                              value={form.medical_history.other_surgical_history}
                              onChange={e => setHistory('other_surgical_history', e.target.value)} />
                </div>

                <div style={s.divider} />
                <div style={s.subsectionTitle}>Family History</div>
                <div style={s.hint}>Has anyone in your immediate family been diagnosed with:</div>
                <CheckGroup
                    options={['Liver disease or cirrhosis','Liver cancer','Type 2 diabetes',
                              'Heart disease','Obesity','None of the above / Unknown']}
                    values={form.medical_history.family_history}
                    onChange={v => setHistory('family_history', v)} />
            </div>
            <div style={s.navButtons}>
                <button style={s.btnBack} onClick={back}>← Back</button>
                <button style={s.btnNext} onClick={next}>Continue →</button>
            </div>
        </>
    );

    // ── Section 3: Liver Health ────────────────────────────────────────────────

    const section2 = (
        <>
            <div style={s.card}>
                <div style={s.sectionHeader}>
                    <div style={s.sectionIcon}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2">
                            <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                        </svg>
                    </div>
                    <div>
                        <div style={s.sectionTitle}>Liver Health</div>
                        <div style={s.sectionSub}>Specific information about your liver condition</div>
                    </div>
                </div>

                <div style={s.alertInfo}>
                    <span>This section helps our team understand your liver health in detail. Please answer as completely as possible — it directly helps us match you to relevant studies.</span>
                </div>

                <div style={s.field}>
                    <label style={s.label}>Have you ever had a FibroScan (liver stiffness test)?<span style={s.required}>*</span></label>
                    <RadioGroup options={['Yes','No','I\'m not sure']}
                                value={form.liver_health.had_fibroscan}
                                onChange={v => setLiver('had_fibroscan', v)} />
                </div>

                <div style={s.row}>
                    <div style={s.field}>
                        <label style={s.label}>Most recent FibroScan result (kPa)</label>
                        <div style={s.hint}>Leave blank if unknown</div>
                        <input type="number" step="0.1" style={s.input} placeholder="e.g. 9.2"
                               value={form.liver_health.fibroscan_kpa}
                               onChange={e => setLiver('fibroscan_kpa', e.target.value)} />
                    </div>
                    <div style={s.field}>
                        <label style={s.label}>Date of most recent FibroScan</label>
                        <input type="date" style={s.input} value={form.liver_health.fibroscan_date}
                               onChange={e => setLiver('fibroscan_date', e.target.value)} />
                    </div>
                </div>

                <div style={s.divider} />

                <div style={s.field}>
                    <label style={s.label}>Have you ever had a liver biopsy?<span style={s.required}>*</span></label>
                    <RadioGroup options={['Yes','No','I\'m not sure']}
                                value={form.liver_health.had_biopsy}
                                onChange={v => setLiver('had_biopsy', v)} />
                </div>

                <div style={s.row}>
                    <div style={s.field}>
                        <label style={s.label}>Biopsy result / fibrosis stage</label>
                        <select style={s.select} value={form.liver_health.biopsy_stage}
                                onChange={e => setLiver('biopsy_stage', e.target.value)}>
                            <option value="">Select if known</option>
                            <option>F0 — No fibrosis</option><option>F1 — Mild fibrosis</option>
                            <option>F2 — Moderate fibrosis</option><option>F3 — Severe fibrosis</option>
                            <option>F4 — Cirrhosis</option><option>Unknown / Not told result</option>
                        </select>
                    </div>
                    <div style={s.field}>
                        <label style={s.label}>Approximate date of biopsy</label>
                        <input type="date" style={s.input} value={form.liver_health.biopsy_date}
                               onChange={e => setLiver('biopsy_date', e.target.value)} />
                    </div>
                </div>

                <div style={s.divider} />

                <div style={s.field}>
                    <label style={s.label}>Have you had any of the following liver-related procedures?</label>
                    <CheckGroup
                        options={['Paracentesis (fluid removal from abdomen)','TIPS procedure',
                                  'Endoscopy for varices','Liver ultrasound','Liver MRI',
                                  'CT scan of abdomen','None of the above']}
                        values={form.liver_health.liver_procedures}
                        onChange={v => setLiver('liver_procedures', v)} />
                </div>

                <div style={s.divider} />

                <div style={s.field}>
                    <label style={s.label}>Do you currently experience any of the following symptoms?</label>
                    <CheckGroup
                        options={['Fatigue or low energy most days','Abdominal swelling or bloating',
                                  'Yellowing of skin or eyes (jaundice)','Swelling in legs or ankles',
                                  'Confusion or memory problems','Nausea','Itching of the skin',
                                  'Dark urine','Easy bruising or bleeding','None of the above']}
                        values={form.liver_health.liver_symptoms}
                        onChange={v => setLiver('liver_symptoms', v)} />
                </div>

                <div style={s.field}>
                    <label style={s.label}>Are you currently being seen by a liver specialist (hepatologist)?</label>
                    <RadioGroup options={['Yes','No']} horizontal
                                value={form.liver_health.sees_hepatologist}
                                onChange={v => setLiver('sees_hepatologist', v)} />
                </div>
            </div>
            <div style={s.navButtons}>
                <button style={s.btnBack} onClick={back}>← Back</button>
                <button style={s.btnNext} onClick={next}>Continue →</button>
            </div>
        </>
    );

    // ── Section 4: Medications ────────────────────────────────────────────────

    const section3 = (
        <>
            <div style={s.card}>
                <div style={s.sectionHeader}>
                    <div style={s.sectionIcon}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2">
                            <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/>
                        </svg>
                    </div>
                    <div>
                        <div style={s.sectionTitle}>Medications</div>
                        <div style={s.sectionSub}>Current and recent medications</div>
                    </div>
                </div>

                <div style={s.alertWarn}>
                    <strong>Important:</strong>&nbsp;Certain medications, especially weight loss injections, affect eligibility for some research studies. Please be thorough and honest in this section.
                </div>

                <div style={s.subsectionTitle}>
                    Weight Loss &amp; Diabetes Injections
                    <span style={s.glpFlag}>GLP-1 Important</span>
                </div>
                <div style={{ ...s.hint, marginBottom: 12 }}>Are you currently taking or have you recently stopped any of the following?</div>
                <CheckGroup
                    options={['Semaglutide — Ozempic, Wegovy, Rybelsus','Tirzepatide — Mounjaro, Zepbound',
                              'Liraglutide — Victoza, Saxenda','Dulaglutide — Trulicity',
                              'Exenatide — Byetta, Bydureon','Other GLP-1 / weight loss injection not listed',
                              'None of the above']}
                    values={form.medications.glp1_meds}
                    onChange={v => setMeds('glp1_meds', v)} />

                <div style={{ ...s.field, marginTop: 12 }}>
                    <label style={s.label}>If you recently stopped a GLP-1 injection, when did you take your last dose?</label>
                    <input type="date" style={s.input} value={form.medications.glp1_last_dose}
                           onChange={e => setMeds('glp1_last_dose', e.target.value)} />
                </div>

                <div style={s.divider} />
                <div style={s.subsectionTitle}>Diabetes Medications (Pills)</div>
                <CheckGroup
                    options={['Metformin — Glucophage','Insulin (any type)',
                              'SGLT2 inhibitor — Jardiance, Farxiga, Invokana',
                              'Sulfonylurea — Glipizide, Glyburide','DPP-4 inhibitor — Januvia, Tradjenta',
                              'Other diabetes medication','Not applicable']}
                    values={form.medications.diabetes_meds}
                    onChange={v => setMeds('diabetes_meds', v)} />

                <div style={{ ...s.subsectionTitle, marginTop: 16 }}>Liver &amp; Cholesterol Medications</div>
                <CheckGroup
                    options={['Statin — Atorvastatin, Rosuvastatin, Simvastatin',
                              'Vitamin E (high dose, prescribed)','Ursodiol / UDCA',
                              'Other cholesterol medication','Not applicable']}
                    values={form.medications.liver_cholesterol_meds}
                    onChange={v => setMeds('liver_cholesterol_meds', v)} />

                <div style={{ ...s.subsectionTitle, marginTop: 16 }}>Blood Thinners &amp; Heart Medications</div>
                <CheckGroup
                    options={['Aspirin (daily, prescribed)',
                              'Blood thinner — Warfarin, Eliquis, Xarelto, Plavix',
                              'Beta blocker — Metoprolol, Carvedilol',
                              'ACE inhibitor / ARB — Lisinopril, Losartan',
                              'Diuretic (water pill) — Furosemide, Spironolactone','Not applicable']}
                    values={form.medications.blood_thinners}
                    onChange={v => setMeds('blood_thinners', v)} />

                <div style={{ ...s.subsectionTitle, marginTop: 16 }}>Other Medications</div>
                <div style={s.field}>
                    <label style={s.label}>Please list any other prescription medications you currently take</label>
                    {form.medications.other_meds.map((med, i) => (
                        <div key={i} style={s.medEntry}>
                            {form.medications.other_meds.length > 1 && (
                                <button onClick={() => {
                                    const updated = form.medications.other_meds.filter((_, j) => j !== i);
                                    setMeds('other_meds', updated);
                                }} style={{ position: 'absolute', top: 8, right: 8, background: 'none',
                                            border: 'none', color: C.muted, cursor: 'pointer', fontSize: 16 }}>×</button>
                            )}
                            <div style={s.row}>
                                <div>
                                    <div style={{ ...s.label, fontSize: 11, color: C.muted }}>Medication Name</div>
                                    <input style={s.input} placeholder="e.g. Lisinopril" value={med.name}
                                           onChange={e => {
                                               const updated = [...form.medications.other_meds];
                                               updated[i] = { ...updated[i], name: e.target.value };
                                               setMeds('other_meds', updated);
                                           }} />
                                </div>
                                <div>
                                    <div style={{ ...s.label, fontSize: 11, color: C.muted }}>Dose / Frequency</div>
                                    <input style={s.input} placeholder="e.g. 10mg daily" value={med.dose}
                                           onChange={e => {
                                               const updated = [...form.medications.other_meds];
                                               updated[i] = { ...updated[i], dose: e.target.value };
                                               setMeds('other_meds', updated);
                                           }} />
                                </div>
                            </div>
                        </div>
                    ))}
                    <button onClick={() => setMeds('other_meds', [...form.medications.other_meds, { name: '', dose: '' }])}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px',
                                     background: C.accentLight, border: `1.5px dashed rgba(26,58,92,0.3)`,
                                     borderRadius: 10, color: C.accent, fontSize: 13, fontWeight: 600,
                                     cursor: 'pointer', width: '100%', justifyContent: 'center',
                                     marginTop: 8, fontFamily: 'inherit' }}>
                        + Add Another Medication
                    </button>
                </div>

                <div style={s.divider} />
                <div style={s.field}>
                    <label style={s.label}>Do you take any over-the-counter supplements?</label>
                    <CheckGroup
                        options={['Vitamin D','Fish oil / Omega-3','Milk thistle','Probiotics',
                                  'Multivitamin','Other herbal or dietary supplement','None']}
                        values={form.medications.supplements}
                        onChange={v => setMeds('supplements', v)} />
                </div>

                <div style={s.field}>
                    <label style={s.label}>Do you have any known drug allergies?</label>
                    <textarea style={s.textarea}
                              placeholder="List any medications you are allergic to and the reaction you experienced..."
                              value={form.medications.drug_allergies}
                              onChange={e => setMeds('drug_allergies', e.target.value)} />
                </div>
            </div>
            <div style={s.navButtons}>
                <button style={s.btnBack} onClick={back}>← Back</button>
                <button style={s.btnNext} onClick={next}>Continue →</button>
            </div>
        </>
    );

    // ── Section 5: Lifestyle ──────────────────────────────────────────────────

    const section4 = (
        <>
            <div style={s.card}>
                <div style={s.sectionHeader}>
                    <div style={s.sectionIcon}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2">
                            <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
                        </svg>
                    </div>
                    <div>
                        <div style={s.sectionTitle}>Lifestyle</div>
                        <div style={s.sectionSub}>Diet, activity, and habits</div>
                    </div>
                </div>

                <div style={s.subsectionTitle}>Alcohol Use</div>
                <div style={s.alertWarn}>
                    Alcohol use is a key factor in liver health and research eligibility. Please answer honestly. Your responses are confidential and will not affect your regular medical care.
                </div>
                <div style={s.field}>
                    <label style={s.label}>How often do you drink alcohol?<span style={s.required}>*</span></label>
                    <RadioGroup
                        options={['Never','Rarely (a few times a year)','Sometimes (1–3 times per month)',
                                  'Weekly (1–3 times per week)','Daily or almost daily',
                                  'I stopped drinking, previously drank regularly']}
                        value={form.lifestyle.alcohol_frequency}
                        onChange={v => setLifestyle('alcohol_frequency', v)} />
                </div>
                <div style={s.field}>
                    <label style={s.label}>On a typical drinking occasion, how many drinks do you have?</label>
                    <select style={s.select} value={form.lifestyle.drinks_per_occasion}
                            onChange={e => setLifestyle('drinks_per_occasion', e.target.value)}>
                        <option value="">Select</option>
                        <option>1–2 drinks</option><option>3–4 drinks</option>
                        <option>5–6 drinks</option><option>7 or more drinks</option><option>Not applicable</option>
                    </select>
                </div>
                <div style={s.field}>
                    <label style={s.label}>Have you ever been told by a doctor to cut back on drinking?</label>
                    <RadioGroup options={['Yes','No','Not applicable']} horizontal
                                value={form.lifestyle.doctor_drink_advice}
                                onChange={v => setLifestyle('doctor_drink_advice', v)} />
                </div>

                <div style={s.divider} />
                <div style={s.subsectionTitle}>Smoking &amp; Tobacco</div>
                <div style={s.field}>
                    <label style={s.label}>Do you currently smoke or use tobacco products?<span style={s.required}>*</span></label>
                    <RadioGroup
                        options={['Yes, currently','No, I quit less than 1 year ago',
                                  'No, I quit more than 1 year ago','Never smoked']}
                        value={form.lifestyle.smoking_status}
                        onChange={v => setLifestyle('smoking_status', v)} />
                </div>

                <div style={s.divider} />
                <div style={s.subsectionTitle}>Physical Activity</div>
                <div style={s.field}>
                    <label style={s.label}>How would you describe your typical activity level?</label>
                    <RadioGroup
                        options={['Sedentary (little to no exercise)','Lightly active (light exercise 1–3 days/week)',
                                  'Moderately active (moderate exercise 3–5 days/week)',
                                  'Very active (hard exercise 6–7 days/week)']}
                        value={form.lifestyle.activity_level}
                        onChange={v => setLifestyle('activity_level', v)} />
                </div>

                <div style={s.divider} />
                <div style={s.subsectionTitle}>Diet</div>
                <div style={s.field}>
                    <label style={s.label}>Do you follow any specific diet?</label>
                    <CheckGroup
                        options={['No specific diet','Low carbohydrate / Keto','Mediterranean',
                                  'Diabetic / low sugar diet','Low sodium / cardiac diet',
                                  'Vegetarian or Vegan','Gluten-free','Other']}
                        values={form.lifestyle.diet}
                        onChange={v => setLifestyle('diet', v)} />
                </div>

                <div style={s.divider} />
                <div style={s.subsectionTitle}>Overall Health Rating</div>
                <div style={s.field}>
                    <label style={s.label}>How would you rate your overall health today?</label>
                    <div style={{ padding: '12px 0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontSize: 11, color: C.muted }}>Very Poor</span>
                            <span style={{ fontSize: 11, color: C.muted }}>Excellent</span>
                        </div>
                        <input type="range" min="1" max="10" value={form.lifestyle.health_rating}
                               style={{ width: '100%', accentColor: C.accent }}
                               onChange={e => setLifestyle('health_rating', Number(e.target.value))} />
                        <div style={{ textAlign: 'center', fontSize: 22, fontWeight: 600,
                                      color: C.accent, marginTop: 8, fontFamily: 'Georgia, serif' }}>
                            {form.lifestyle.health_rating} / 10
                        </div>
                    </div>
                </div>

                <div style={s.divider} />
                <div style={s.subsectionTitle}>Research Participation</div>
                <div style={s.field}>
                    <label style={s.label}>Have you participated in a clinical research study before?</label>
                    <RadioGroup options={['Yes','No']} horizontal
                                value={form.lifestyle.prior_research}
                                onChange={v => setLifestyle('prior_research', v)} />
                </div>
                <div style={s.field}>
                    <label style={s.label}>Are you currently enrolled in any other research study?</label>
                    <RadioGroup options={['Yes','No']} horizontal
                                value={form.lifestyle.current_research}
                                onChange={v => setLifestyle('current_research', v)} />
                </div>
                <div style={s.field}>
                    <label style={s.label}>Would you be willing to participate in a clinical research study if eligible?</label>
                    <RadioGroup
                        options={['Yes, definitely','Yes, but I\'d need more information first','Not sure','No']}
                        value={form.lifestyle.research_willingness}
                        onChange={v => setLifestyle('research_willingness', v)} />
                </div>
                <div style={s.field}>
                    <label style={s.label}>Anything else you'd like our team to know?</label>
                    <textarea style={s.textarea}
                              placeholder="Additional notes, concerns, or questions for our team..."
                              value={form.lifestyle.additional_notes}
                              onChange={e => setLifestyle('additional_notes', e.target.value)} />
                </div>
            </div>
            <div style={s.navButtons}>
                <button style={s.btnBack} onClick={back}>← Back</button>
                <button style={s.btnNext} onClick={next}>Continue →</button>
            </div>
        </>
    );

    // ── Section 6: Review & Consent ───────────────────────────────────────────

    const section5 = (
        <>
            <div style={s.card}>
                <div style={s.sectionHeader}>
                    <div style={s.sectionIcon}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2">
                            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                    </div>
                    <div>
                        <div style={s.sectionTitle}>Review &amp; Submit</div>
                        <div style={s.sectionSub}>Almost done. Please review and confirm.</div>
                    </div>
                </div>

                <div style={s.alertInfo}>
                    Please review your information before submitting. You can go back to any section to make changes.
                </div>

                <div style={s.subsectionTitle}>Privacy &amp; Consent</div>
                <div style={s.consentBox}>
                    <strong style={{ fontSize: 13, color: C.text }}>How We Use Your Information</strong><br /><br />
                    The information you provide in this form is collected by Monsoon Health on behalf of this clinical research site. It will be used solely to:<br /><br />
                    • Help our clinical research coordinators understand your health background before your visit<br />
                    • Assess whether you are eligible for current or future clinical research studies<br />
                    • Build a longitudinal health profile that allows us to revisit your eligibility as new studies become available<br /><br />
                    Your information is stored securely and protected in accordance with HIPAA regulations. It will not be shared with sponsors or third parties without your explicit consent. You can request that your information be removed at any time by contacting our research team.<br /><br />
                    Completing this form does not enroll you in any research study. Participation in any study requires a separate informed consent process.
                </div>

                <div style={s.field}>
                    <label style={{ ...s.checkOption, borderColor: form.consent.consented ? C.accent : C.border,
                                    background: form.consent.consented ? C.accentLight : C.inputBg }}>
                        <input type="checkbox" checked={form.consent.consented}
                               onChange={e => setConsent('consented', e.target.checked)}
                               style={{ accentColor: C.accent, flexShrink: 0, marginTop: 2 }} />
                        <span style={{ fontWeight: 500 }}>
                            I confirm that the information I have provided is accurate and complete to the best of my knowledge. I understand how my information will be used as described above.
                        </span>
                    </label>
                </div>

                <div style={s.field}>
                    <label style={s.label}>Digital Signature (Type your full name)<span style={s.required}>*</span></label>
                    <input style={s.input} placeholder="Type your full legal name"
                           value={form.consent.signature}
                           onChange={e => setConsent('signature', e.target.value)} />
                </div>

                <div style={s.field}>
                    <label style={s.label}>Today's Date</label>
                    <input type="date" style={s.input} value={form.consent.consent_date}
                           onChange={e => setConsent('consent_date', e.target.value)} />
                </div>

                {error && (
                    <div style={{ padding: '10px 14px', background: '#fdecea',
                                  border: `1px solid rgba(192,57,43,0.2)`, borderRadius: 10,
                                  fontSize: 13, color: C.error, marginTop: 12 }}>
                        {error}
                    </div>
                )}
            </div>

            <div style={s.navButtons}>
                <button style={s.btnBack} onClick={back}>← Back</button>
                <button style={{ ...s.btnSubmit, opacity: submitting ? 0.7 : 1 }}
                        onClick={handleSubmit} disabled={submitting}>
                    {submitting ? 'Submitting…' : 'Submit Form ✓'}
                </button>
            </div>

            <div style={s.privacyNote}>
                🔒 Your information is encrypted and HIPAA-protected
            </div>
        </>
    );

    const sections = [section0, section1, section2, section3, section4, section5];

    // ── Success screen ─────────────────────────────────────────────────────────

    if (submitted) {
        return (
            <div style={s.page}>
                <div style={s.header}>
                    <div style={s.logoRow}>
                        <img src="/images/monsoon-braid-wordmark-white.svg" alt="Monsoon Health" style={{ height: 40 }} />
                    </div>
                </div>
                <div style={s.container}>
                    <div style={s.card}>
                        <div style={s.successCard}>
                            <div style={s.successIcon}>
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            </div>
                            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 10, color: C.text }}>Form Submitted</h2>
                            <p style={{ color: C.muted, lineHeight: 1.6 }}>
                                Thank you for completing your intake form. Our care team will review your information before your visit.
                            </p>
                            <div style={s.divider} />
                            <p style={{ fontSize: 12, color: C.muted }}>
                                If you have any questions before your appointment, please contact our research team. You can close this window.
                            </p>
                            <div style={{ ...s.privacyNote, marginTop: 20 }}>
                                🔒 Secured by Monsoon Health · HIPAA Compliant
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ── Main render ────────────────────────────────────────────────────────────

    return (
        <div style={s.page}>
            <div style={s.header}>
                <div style={s.logoRow}>
                    <img src="/images/monsoon-braid-wordmark-white.svg" alt="Monsoon Health" style={{ height: 40 }} />
                </div>
                <h1 style={s.h1}>Patient Intake Form</h1>
                <p style={s.headerSub}>Please complete this form before your upcoming visit. It takes about 5 minutes and helps our team provide you with the best care.</p>
            </div>

            <ProgressBar step={step} />

            <div style={s.container}>
                {sections[step]}
            </div>
        </div>
    );
}
