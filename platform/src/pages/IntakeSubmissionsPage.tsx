import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';

interface Submission {
    id: string;
    site_id: string;
    status: 'PENDING' | 'CONVERTED' | 'ARCHIVED';
    patient_id: string | null;
    submitted_at: string;
    first_name: string | null;
    last_name: string | null;
    dob: string | null;
    phone: string | null;
    email: string | null;
}

interface FullSubmission extends Submission {
    form_data: Record<string, unknown>;
}

function formatDate(iso: string) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(iso: string) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric',
        year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function IntakeSubmissionsPage() {
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [statusFilter, setStatusFilter] = useState<'PENDING' | 'CONVERTED' | 'ARCHIVED'>('PENDING');
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<FullSubmission | null>(null);
    const [converting, setConverting] = useState(false);
    const [archiving, setArchiving] = useState(false);
    const navigate = useNavigate();
    const { addToast } = useToast();
    const { user } = useAuth();

    const siteId = user?.site_id || '';

    const intakeUrl = `${window.location.origin}/intake?site=${encodeURIComponent(siteId)}`;

    const load = () => {
        setLoading(true);
        api.getIntakeSubmissions(statusFilter)
            .then(data => setSubmissions(data as unknown as Submission[]))
            .catch(() => addToast('Failed to load submissions', 'error'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, [statusFilter]);

    const openDetail = async (id: string) => {
        try {
            const sub = await api.getIntakeSubmission(id);
            setSelected(sub as unknown as FullSubmission);
        } catch {
            addToast('Failed to load submission', 'error');
        }
    };

    const handleConvert = async () => {
        if (!selected) return;
        setConverting(true);
        try {
            const result = await api.convertIntakeSubmission(selected.id);
            addToast(`Patient created: ${result.patient.first_name} ${result.patient.last_name}`, 'success');
            setSelected(null);
            load();
            navigate(`/patients/${result.patient.id}`);
        } catch (e) {
            addToast((e as Error).message, 'error');
        } finally {
            setConverting(false);
        }
    };

    const handleArchive = async (id: string) => {
        setArchiving(true);
        try {
            await api.archiveIntakeSubmission(id);
            addToast('Submission archived', 'success');
            setSelected(null);
            load();
        } catch {
            addToast('Failed to archive', 'error');
        } finally {
            setArchiving(false);
        }
    };

    const copyLink = () => {
        navigator.clipboard.writeText(intakeUrl)
            .then(() => addToast('Link copied to clipboard', 'success'))
            .catch(() => addToast('Could not copy link', 'error'));
    };

    // ── Detail panel ───────────────────────────────────────────────────────────

    const renderDetail = () => {
        if (!selected) return null;
        const fd = selected.form_data as Record<string, Record<string, unknown>>;
        const about = fd.about || {};
        const history = fd.medical_history || {};
        const liver = fd.liver_health || {};
        const meds = fd.medications || {};
        const lifestyle = fd.lifestyle || {};

        const Row = ({ label, value }: { label: string; value: unknown }) =>
            value ? (
                <div style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)', minWidth: 160, flexShrink: 0 }}>{label}</span>
                    <span style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                        {Array.isArray(value) ? (value as string[]).join(', ') : String(value)}
                    </span>
                </div>
            ) : null;

        const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
            <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                              letterSpacing: '0.1em', color: 'var(--accent)', marginBottom: 10,
                              paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
                    {title}
                </div>
                {children}
            </div>
        );

        return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                          display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
                          zIndex: 1000, padding: 16 }}
                 onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
                <div style={{ background: 'var(--surface)', borderRadius: 16,
                              border: '1px solid var(--border)', width: '100%', maxWidth: 540,
                              maxHeight: 'calc(100vh - 32px)', overflowY: 'auto',
                              boxShadow: '0 16px 40px rgba(0,0,0,0.2)' }}>
                    {/* Header */}
                    <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10 }}>
                        <div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                                {selected.first_name} {selected.last_name}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                                Submitted {formatDateTime(selected.submitted_at)}
                            </div>
                        </div>
                        <button onClick={() => setSelected(null)}
                                style={{ background: 'none', border: 'none', fontSize: 20,
                                         color: 'var(--text-muted)', cursor: 'pointer' }}>×</button>
                    </div>

                    {/* Body */}
                    <div style={{ padding: '20px 24px' }}>
                        <Section title="About">
                            <Row label="Date of Birth" value={about.dob ? formatDate(about.dob as string) : null} />
                            <Row label="Biological Sex" value={about.biological_sex} />
                            <Row label="Phone" value={about.phone} />
                            <Row label="Email" value={about.email} />
                            <Row label="Language" value={about.preferred_language} />
                            <Row label="Race / Ethnicity" value={about.race_ethnicity} />
                            <Row label="Height" value={about.height} />
                            <Row label="Weight" value={about.weight_lbs ? `${about.weight_lbs} lbs` : null} />
                        </Section>

                        <Section title="Medical History">
                            <Row label="Conditions" value={history.conditions} />
                            <Row label="Other Conditions" value={history.other_conditions} />
                            <Row label="Surgical History" value={history.surgical_history} />
                            <Row label="Family History" value={history.family_history} />
                        </Section>

                        <Section title="Liver Health">
                            <Row label="FibroScan" value={liver.had_fibroscan} />
                            <Row label="FibroScan kPa" value={liver.fibroscan_kpa} />
                            <Row label="FibroScan Date" value={liver.fibroscan_date ? formatDate(liver.fibroscan_date as string) : null} />
                            <Row label="Liver Biopsy" value={liver.had_biopsy} />
                            <Row label="Fibrosis Stage" value={liver.biopsy_stage} />
                            <Row label="Liver Procedures" value={liver.liver_procedures} />
                            <Row label="Current Symptoms" value={liver.liver_symptoms} />
                            <Row label="Sees Hepatologist" value={liver.sees_hepatologist} />
                        </Section>

                        <Section title="Medications">
                            <Row label="GLP-1 Meds" value={meds.glp1_meds} />
                            <Row label="Last GLP-1 Dose" value={meds.glp1_last_dose ? formatDate(meds.glp1_last_dose as string) : null} />
                            <Row label="Diabetes Meds" value={meds.diabetes_meds} />
                            <Row label="Liver/Cholesterol Meds" value={meds.liver_cholesterol_meds} />
                            <Row label="Blood Thinners" value={meds.blood_thinners} />
                            <Row label="Supplements" value={meds.supplements} />
                            <Row label="Drug Allergies" value={meds.drug_allergies} />
                        </Section>

                        <Section title="Lifestyle">
                            <Row label="Alcohol Frequency" value={lifestyle.alcohol_frequency} />
                            <Row label="Smoking" value={lifestyle.smoking_status} />
                            <Row label="Activity Level" value={lifestyle.activity_level} />
                            <Row label="Diet" value={lifestyle.diet} />
                            <Row label="Health Rating" value={lifestyle.health_rating ? `${lifestyle.health_rating} / 10` : null} />
                            <Row label="Research Willingness" value={lifestyle.research_willingness} />
                            <Row label="Additional Notes" value={lifestyle.additional_notes} />
                        </Section>
                    </div>

                    {/* Actions */}
                    {selected.status === 'PENDING' && (
                        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)',
                                      display: 'flex', gap: 10, position: 'sticky', bottom: 0,
                                      background: 'var(--surface)' }}>
                            <button onClick={handleConvert} disabled={converting}
                                    style={{ flex: 2, padding: '12px 16px', background: 'var(--accent)',
                                             border: 'none', borderRadius: 10, color: 'white',
                                             fontSize: 14, fontWeight: 600, cursor: 'pointer',
                                             opacity: converting ? 0.7 : 1, fontFamily: 'inherit' }}>
                                {converting ? 'Creating…' : '+ Create Patient'}
                            </button>
                            <button onClick={() => handleArchive(selected.id)} disabled={archiving}
                                    style={{ flex: 1, padding: '12px 16px',
                                             background: 'var(--surface-2)',
                                             border: '1px solid var(--border)', borderRadius: 10,
                                             color: 'var(--text-muted)', fontSize: 14, fontWeight: 600,
                                             cursor: 'pointer', fontFamily: 'inherit' }}>
                                Archive
                            </button>
                        </div>
                    )}
                    {selected.status === 'CONVERTED' && (
                        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
                            <button onClick={() => navigate(`/patients/${selected.patient_id}`)}
                                    style={{ width: '100%', padding: '12px 16px',
                                             background: 'var(--surface-2)',
                                             border: '1px solid var(--border)', borderRadius: 10,
                                             color: 'var(--accent)', fontSize: 14, fontWeight: 600,
                                             cursor: 'pointer', fontFamily: 'inherit' }}>
                                View Patient →
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // ── Main render ────────────────────────────────────────────────────────────

    return (
        <div className="page-content">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Intake Submissions</h1>
                    <p className="page-subtitle">
                        Patient intake forms submitted via your intake link
                    </p>
                </div>
                <button onClick={copyLink} className="btn btn-secondary" style={{ gap: 8 }}>
                    Copy Intake Link
                </button>
            </div>

            {/* Intake link display */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)',
                          borderRadius: 12, padding: '14px 16px', marginBottom: 20,
                          display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>Patient link:</span>
                <code style={{ flex: 1, fontSize: 12, color: 'var(--accent)',
                               background: 'var(--surface-2)', padding: '4px 8px',
                               borderRadius: 6, overflow: 'hidden', textOverflow: 'ellipsis',
                               whiteSpace: 'nowrap' as const }}>
                    {intakeUrl}
                </code>
                <button onClick={copyLink}
                        style={{ background: 'none', border: '1px solid var(--border)',
                                 borderRadius: 8, padding: '4px 10px', fontSize: 12,
                                 color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit',
                                 flexShrink: 0 }}>
                    Copy
                </button>
            </div>

            {/* Status tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
                {(['PENDING', 'CONVERTED', 'ARCHIVED'] as const).map(s => (
                    <button key={s} onClick={() => setStatusFilter(s)}
                            style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                                     border: '1px solid var(--border)', cursor: 'pointer',
                                     fontFamily: 'inherit',
                                     background: statusFilter === s ? 'var(--accent)' : 'var(--surface)',
                                     color: statusFilter === s ? 'white' : 'var(--text-muted)' }}>
                        {s.charAt(0) + s.slice(1).toLowerCase()}
                    </button>
                ))}
            </div>

            {/* Table */}
            {loading ? (
                <div className="loading-spinner"><div className="spinner" /></div>
            ) : submissions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>No {statusFilter.toLowerCase()} submissions</div>
                    {statusFilter === 'PENDING' && (
                        <div style={{ fontSize: 13 }}>
                            Send the intake link to patients and their completed forms will appear here.
                        </div>
                    )}
                </div>
            ) : (
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Patient</th>
                                <th>Date of Birth</th>
                                <th>Phone</th>
                                <th>Email</th>
                                <th>Submitted</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {submissions.map(sub => (
                                <tr key={sub.id} onClick={() => openDetail(sub.id)}
                                    style={{ cursor: 'pointer' }}>
                                    <td style={{ fontWeight: 600 }}>
                                        {sub.first_name} {sub.last_name}
                                    </td>
                                    <td>{sub.dob ? formatDate(sub.dob) : '—'}</td>
                                    <td>{sub.phone || '—'}</td>
                                    <td style={{ color: 'var(--text-muted)' }}>{sub.email || '—'}</td>
                                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                                        {formatDateTime(sub.submitted_at)}
                                    </td>
                                    <td>
                                        <span style={{ fontSize: 12, color: 'var(--accent)',
                                                        fontWeight: 600 }}>View →</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {renderDetail()}
        </div>
    );
}
