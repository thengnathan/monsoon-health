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

const STATUS_COLORS: Record<string, string> = {
    PENDING: 'var(--warning)',
    CONVERTED: 'var(--success)',
    ARCHIVED: 'var(--text-tertiary)',
};

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
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 6, fontSize: 'var(--font-sm)' }}>
                    <span style={{ color: 'var(--text-tertiary)', minWidth: 150, flexShrink: 0 }}>{label}</span>
                    <span style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                        {Array.isArray(value) ? (value as string[]).join(', ') : String(value)}
                    </span>
                </div>
            ) : null;

        const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
            <div style={{ marginBottom: 'var(--space-5)' }}>
                <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, textTransform: 'uppercase',
                              letterSpacing: '0.1em', color: 'var(--accent)', marginBottom: 'var(--space-3)',
                              paddingBottom: 'var(--space-2)', borderBottom: '1px solid var(--border)' }}>
                    {title}
                </div>
                {children}
            </div>
        );

        return (
            <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
                <div className="modal" style={{ maxWidth: 540, maxHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
                    {/* Header */}
                    <div style={{ padding: 'var(--space-5) var(--space-6) var(--space-4)', borderBottom: '1px solid var(--border)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                        <div>
                            <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {selected.first_name} {selected.last_name}
                            </div>
                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                                Submitted {formatDateTime(selected.submitted_at)}
                                <span style={{ marginLeft: 'var(--space-2)', display: 'inline-block', fontSize: 10, fontWeight: 600,
                                               padding: '1px 8px', borderRadius: 10,
                                               background: 'var(--accent-muted)', color: STATUS_COLORS[selected.status] }}>
                                    {selected.status}
                                </span>
                            </div>
                        </div>
                        <button onClick={() => setSelected(null)} className="btn btn-sm btn-ghost"
                                style={{ fontSize: 18, padding: '2px 8px' }}>×</button>
                    </div>

                    {/* Body */}
                    <div style={{ padding: 'var(--space-5) var(--space-6)', overflowY: 'auto', flex: 1 }}>
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
                        <div style={{ padding: 'var(--space-4) var(--space-6)', borderTop: '1px solid var(--border)',
                                      display: 'flex', gap: 'var(--space-3)', flexShrink: 0 }}>
                            <button className="btn btn-primary" onClick={handleConvert} disabled={converting}
                                    style={{ flex: 2 }}>
                                {converting ? 'Creating…' : '+ Create Patient'}
                            </button>
                            <button className="btn btn-secondary" onClick={() => handleArchive(selected.id)} disabled={archiving}
                                    style={{ flex: 1 }}>
                                Archive
                            </button>
                        </div>
                    )}
                    {selected.status === 'CONVERTED' && (
                        <div style={{ padding: 'var(--space-4) var(--space-6)', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
                            <button className="btn btn-secondary" onClick={() => navigate(`/patients/${selected.patient_id}`)}
                                    style={{ width: '100%' }}>
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
        <>
            <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                    <h1>Intake Submissions</h1>
                    <p>Patient intake forms submitted via your intake link</p>
                </div>
                <button onClick={copyLink} className="btn btn-secondary">
                    Copy Intake Link
                </button>
            </div>

            {/* Intake link display */}
            <div className="card" style={{ padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-5)',
                          display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', flexShrink: 0 }}>Patient link:</span>
                <code style={{ flex: 1, fontSize: 'var(--font-xs)', color: 'var(--accent)',
                               background: 'var(--bg-secondary)', padding: '4px 8px',
                               borderRadius: 'var(--radius-sm)', overflow: 'hidden', textOverflow: 'ellipsis',
                               whiteSpace: 'nowrap' as const }}>
                    {intakeUrl}
                </code>
                <button onClick={copyLink} className="btn btn-sm btn-ghost"
                        style={{ flexShrink: 0 }}>
                    Copy
                </button>
            </div>

            {/* Status tabs */}
            <div className="filters" style={{ marginBottom: 'var(--space-5)' }}>
                {(['PENDING', 'CONVERTED', 'ARCHIVED'] as const).map(s => (
                    <button key={s} className={`filter-pill ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
                        {s.charAt(0) + s.slice(1).toLowerCase()}
                    </button>
                ))}
            </div>

            {/* Table */}
            {loading ? (
                <div className="loading-spinner"><div className="spinner" /></div>
            ) : submissions.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12) var(--space-6)',
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div style={{ fontSize: 36, opacity: 0.35 }}>📋</div>
                    <div style={{ fontSize: 'var(--font-base)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        No {statusFilter.toLowerCase()} submissions
                    </div>
                    {statusFilter === 'PENDING' && (
                        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)', maxWidth: 320, margin: 0 }}>
                            Send the intake link to patients and their completed forms will appear here.
                        </p>
                    )}
                </div>
            ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
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
                                    <td className="patient-name">
                                        {sub.last_name}, {sub.first_name}
                                    </td>
                                    <td className="meta">{sub.dob ? formatDate(sub.dob) : '—'}</td>
                                    <td className="meta">{sub.phone || '—'}</td>
                                    <td className="meta">{sub.email || '—'}</td>
                                    <td className="meta">
                                        {formatDateTime(sub.submitted_at)}
                                    </td>
                                    <td>
                                        <span style={{ fontSize: 'var(--font-xs)', color: 'var(--accent)',
                                                        fontWeight: 600 }}>View →</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {renderDetail()}
        </>
    );
}
