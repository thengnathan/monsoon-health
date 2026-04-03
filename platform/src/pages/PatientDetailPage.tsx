import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { useToast } from '../contexts/ToastContext';
import { StatusBadge, formatDate } from '../utils';
import type {
    PatientDetail, PatientClinicalData, SignalType, Trial,
    LabValue, VitalValue, ImagingResult, ClinicalDiagnosis,
} from '../types';

// ── Sub-components ────────────────────────────────────────────────────────────

function FlagBadge({ flag }: { flag?: 'high' | 'low' | 'critical' | null }) {
    if (!flag) return null;
    const styles: Record<string, { bg: string; text: string }> = {
        high:     { bg: '#fff3cd', text: '#856404' },
        low:      { bg: '#cce5ff', text: '#004085' },
        critical: { bg: '#f8d7da', text: '#721c24' },
    };
    const s = styles[flag];
    return (
        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: s.bg, color: s.text, textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: 5 }}>
            {flag}
        </span>
    );
}

function StatusChip({ status }: { status?: string }) {
    if (!status) return null;
    const colors: Record<string, { bg: string; text: string }> = {
        active:   { bg: '#d4edda', text: '#155724' },
        chronic:  { bg: '#fff3cd', text: '#856404' },
        resolved: { bg: '#e2e3e5', text: '#383d41' },
    };
    const s = colors[status] || { bg: 'var(--bg-secondary)', text: 'var(--text-secondary)' };
    return (
        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: s.bg, color: s.text, marginLeft: 6, textTransform: 'capitalize' }}>
            {status}
        </span>
    );
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
    return (
        <div className="detail-section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{title}</span>
            {count !== undefined && (
                <span style={{ fontSize: 'var(--font-xs)', fontWeight: 400, color: 'var(--text-tertiary)' }}>{count}</span>
            )}
        </div>
    );
}

function LabsSection({ latest, timeline }: { latest: Record<string, LabValue>; timeline: LabValue[] }) {
    const [showTimeline, setShowTimeline] = useState(false);
    const entries = Object.entries(latest).sort(([a], [b]) => a.localeCompare(b));

    if (entries.length === 0) return <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)', padding: 'var(--space-2) 0' }}>No lab values extracted yet.</div>;

    return (
        <div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-sm)' }}>
                <tbody>
                    {entries.map(([name, lab]) => (
                        <tr key={name} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '6px 0', color: 'var(--text-primary)', fontWeight: 500, width: '45%' }}>{name}</td>
                            <td style={{ padding: '6px 4px', fontWeight: 600, color: lab.flag === 'critical' ? '#721c24' : lab.flag ? '#856404' : 'var(--text-primary)' }}>
                                {lab.value}
                                <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 4, fontSize: 11 }}>{lab.unit}</span>
                                <FlagBadge flag={lab.flag} />
                            </td>
                            <td style={{ padding: '6px 0', color: 'var(--text-tertiary)', fontSize: 11, textAlign: 'right' }}>{lab.date ? formatDate(lab.date) : '—'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {timeline.length > entries.length && (
                <button
                    className="btn btn-sm btn-ghost"
                    style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-xs)' }}
                    onClick={() => setShowTimeline(v => !v)}
                >
                    {showTimeline ? '▲ Hide timeline' : `▼ Show timeline (${timeline.length} values)`}
                </button>
            )}
            {showTimeline && (
                <div style={{ marginTop: 'var(--space-3)', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                <th style={{ textAlign: 'left', padding: '4px 6px', color: 'var(--text-tertiary)', fontWeight: 600 }}>Test</th>
                                <th style={{ textAlign: 'right', padding: '4px 6px', color: 'var(--text-tertiary)', fontWeight: 600 }}>Value</th>
                                <th style={{ textAlign: 'left', padding: '4px 6px', color: 'var(--text-tertiary)', fontWeight: 600 }}>Unit</th>
                                <th style={{ textAlign: 'right', padding: '4px 6px', color: 'var(--text-tertiary)', fontWeight: 600 }}>Date</th>
                                <th style={{ padding: '4px 6px' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...timeline].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((lab, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--border-light, var(--border))' }}>
                                    <td style={{ padding: '4px 6px' }}>{lab.name}</td>
                                    <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>{lab.value}</td>
                                    <td style={{ padding: '4px 6px', color: 'var(--text-tertiary)' }}>{lab.unit}</td>
                                    <td style={{ padding: '4px 6px', textAlign: 'right', color: 'var(--text-tertiary)' }}>{lab.date ? formatDate(lab.date) : '—'}</td>
                                    <td style={{ padding: '4px 6px' }}><FlagBadge flag={lab.flag} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function VitalsSection({ latest }: { latest: Record<string, VitalValue> }) {
    const entries = Object.entries(latest);
    if (entries.length === 0) return <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)', padding: 'var(--space-2) 0' }}>No vitals extracted yet.</div>;

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 'var(--space-2)' }}>
            {entries.map(([name, v]) => (
                <div key={name} style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-2) var(--space-3)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>{name}</div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--font-md)' }}>
                        {v.value}
                        <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 3 }}>{v.unit}</span>
                    </div>
                    {v.date && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{formatDate(v.date)}</div>}
                </div>
            ))}
        </div>
    );
}

function ImagingSection({ latest, timeline }: { latest: Record<string, ImagingResult>; timeline: ImagingResult[] }) {
    const [showTimeline, setShowTimeline] = useState(false);
    const entries = Object.entries(latest);
    if (entries.length === 0) return <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)', padding: 'var(--space-2) 0' }}>No imaging results extracted yet.</div>;

    return (
        <div>
            {entries.map(([type, img]) => (
                <div key={type} style={{ marginBottom: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>{type}</span>
                        <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>{img.date ? formatDate(img.date) : ''}</span>
                    </div>
                    {img.value !== undefined && (
                        <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, margin: '4px 0' }}>
                            {img.value}
                            <span style={{ fontSize: 'var(--font-sm)', fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 4 }}>{img.unit}</span>
                        </div>
                    )}
                    {img.findings && <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', marginTop: 4, fontStyle: 'italic' }}>{img.findings}</div>}
                </div>
            ))}
            {timeline.length > entries.length && (
                <button className="btn btn-sm btn-ghost" style={{ fontSize: 'var(--font-xs)' }} onClick={() => setShowTimeline(v => !v)}>
                    {showTimeline ? '▲ Hide timeline' : `▼ Show timeline (${timeline.length} results)`}
                </button>
            )}
            {showTimeline && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginTop: 'var(--space-2)' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid var(--border)' }}>
                            <th style={{ textAlign: 'left', padding: '4px 6px', color: 'var(--text-tertiary)', fontWeight: 600 }}>Type</th>
                            <th style={{ textAlign: 'right', padding: '4px 6px', color: 'var(--text-tertiary)', fontWeight: 600 }}>Value</th>
                            <th style={{ padding: '4px 6px', color: 'var(--text-tertiary)', fontWeight: 600 }}>Findings</th>
                            <th style={{ textAlign: 'right', padding: '4px 6px', color: 'var(--text-tertiary)', fontWeight: 600 }}>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[...timeline].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((img, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '4px 6px' }}>{img.type}</td>
                                <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>{img.value !== undefined ? `${img.value} ${img.unit || ''}` : '—'}</td>
                                <td style={{ padding: '4px 6px', color: 'var(--text-tertiary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{img.findings || '—'}</td>
                                <td style={{ padding: '4px 6px', textAlign: 'right', color: 'var(--text-tertiary)' }}>{img.date ? formatDate(img.date) : '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

function DiagnosesSection({ diagnoses }: { diagnoses: ClinicalDiagnosis[] }) {
    if (!diagnoses.length) return <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)' }}>None recorded.</div>;
    const active = diagnoses.filter(d => d.status !== 'resolved');
    const resolved = diagnoses.filter(d => d.status === 'resolved');
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            {active.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', fontSize: 'var(--font-sm)', padding: '3px 0' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: d.status === 'active' ? '#28a745' : '#ffc107', flexShrink: 0, marginRight: 8 }} />
                    {d.name}
                    <StatusChip status={d.status} />
                </div>
            ))}
            {resolved.length > 0 && (
                <div style={{ marginTop: 'var(--space-1)', fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>
                    Resolved: {resolved.map(d => d.name).join(' · ')}
                </div>
            )}
        </div>
    );
}

// ── Main page ────────────────────────────────────────────────────────────────

interface SigForm { signal_type_id: string; value: string; collected_at: string; source: string; }
interface CaseForm { trial_id: string; status: string; }

export default function PatientDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { addToast } = useToast();

    const [patient, setPatient] = useState<PatientDetail | null>(null);
    const [clinicalData, setClinicalData] = useState<PatientClinicalData | null>(null);
    const [loading, setLoading] = useState(true);
    const [showSignalModal, setShowSignalModal] = useState(false);
    const [showCaseModal, setShowCaseModal] = useState(false);
    const [signalTypes, setSignalTypes] = useState<SignalType[]>([]);
    const [trials, setTrials] = useState<Trial[]>([]);
    const [uploading, setUploading] = useState(false);
    const docFileRef = useRef<HTMLInputElement>(null);

    const [sigForm, setSigForm] = useState<SigForm>({
        signal_type_id: '', value: '', collected_at: new Date().toISOString().split('T')[0], source: '',
    });
    const [caseForm, setCaseForm] = useState<CaseForm>({ trial_id: '', status: 'NEW' });

    const loadPatient = () => {
        if (!id) return;
        api.getPatient(id).then(setPatient).catch(console.error);
        api.getPatientClinicalData(id).then(setClinicalData).catch(() => setClinicalData(null));
    };

    useEffect(() => {
        setLoading(true);
        if (!id) return;
        Promise.all([
            api.getPatient(id).then(setPatient),
            api.getPatientClinicalData(id).then(setClinicalData).catch(() => setClinicalData(null)),
            api.getSignalTypes().then(setSignalTypes).catch(() => {}),
            api.getTrials({ status: 'ACTIVE' }).then(setTrials).catch(() => {}),
        ]).finally(() => setLoading(false));
    }, [id]);

    const handleAddSignal = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const result = await api.addPatientSignal(id!, sigForm as unknown as Record<string, unknown>);
            addToast('Signal recorded', 'success');
            if (result.alerts_generated > 0) addToast(`${result.alerts_generated} threshold alert(s) triggered!`, 'info');
            setShowSignalModal(false);
            setSigForm({ signal_type_id: '', value: '', collected_at: new Date().toISOString().split('T')[0], source: '' });
            loadPatient();
        } catch (err) { addToast((err as Error).message, 'error'); }
    };

    const handleCreateCase = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const sc = await api.createScreeningCase({ patient_id: id, ...caseForm });
            addToast('Screening case created', 'success');
            navigate(`/screening/${sc.id}`);
        } catch (err) { addToast((err as Error).message, 'error'); }
    };

    const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            await api.uploadPatientDocument(file, { patient_id: id });
            addToast('Document uploaded and clinical data updated', 'success');
            loadPatient();
        } catch (err) {
            addToast((err as Error).message, 'error');
        }
        setUploading(false);
        if (docFileRef.current) docFileRef.current.value = '';
    };

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
    if (!patient) return <div className="empty-state"><h3>Patient not found</h3></div>;

    // Compute age
    const age = patient.dob
        ? Math.floor((Date.now() - new Date(patient.dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
        : null;

    return (
        <div>
            {/* Header */}
            <div className="detail-header">
                <div className="detail-header-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-1)' }}>
                        <Link to="/patients" style={{ color: 'var(--text-tertiary)', textDecoration: 'none', fontSize: 'var(--font-sm)' }}>← Patients</Link>
                    </div>
                    <h1 style={{ marginBottom: 'var(--space-1)' }}>{patient.first_name} {patient.last_name}</h1>
                    <div className="detail-header-meta">
                        {patient.dob && <span>DOB: {formatDate(patient.dob)}{age !== null ? ` (${age}y)` : ''}</span>}
                        {patient.internal_identifier && <span>ID: {patient.internal_identifier}</span>}
                        {clinicalData?.diagnoses[0]?.name && <span style={{ color: 'var(--text-secondary)' }}>{clinicalData.diagnoses.filter(d => d.status !== 'resolved').map(d => d.name).join(' · ')}</span>}
                        {patient.referral_source_name && <span>Ref: {patient.referral_source_name}</span>}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button className="btn btn-secondary" onClick={() => docFileRef.current?.click()} disabled={uploading}>
                        {uploading ? 'Uploading…' : 'Upload Document'}
                    </button>
                    <input ref={docFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleDocUpload} style={{ display: 'none' }} />
                    <button className="btn btn-secondary" onClick={() => setShowSignalModal(true)}>+ Signal</button>
                    <button className="btn btn-primary" onClick={() => setShowCaseModal(true)}>+ Screening Case</button>
                </div>
            </div>

            {/* Body */}
            <div className="detail-grid" style={{ gridTemplateColumns: '3fr 2fr' }}>
                {/* Left: Clinical Data */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {/* Conditions */}
                    <div className="detail-section">
                        <SectionHeader title="Conditions & Diagnoses" count={clinicalData?.diagnoses.length} />
                        {clinicalData
                            ? <DiagnosesSection diagnoses={clinicalData.diagnoses} />
                            : <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)', padding: 'var(--space-2) 0' }}>Upload a patient document to extract clinical data.</div>
                        }
                    </div>

                    {/* Medications */}
                    {clinicalData && clinicalData.medications.length > 0 && (
                        <div className="detail-section">
                            <SectionHeader title="Medications" count={clinicalData.medications.length} />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {clinicalData.medications.map((m, i) => (
                                    <div key={i} style={{ fontSize: 'var(--font-sm)', padding: '4px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontWeight: 500 }}>{m.name}</span>
                                        <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)' }}>
                                            {[m.dose, m.frequency].filter(Boolean).join(' · ')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Allergies */}
                    {clinicalData && clinicalData.allergies.length > 0 && (
                        <div className="detail-section">
                            <SectionHeader title="Allergies" />
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                                {clinicalData.allergies.map((a, i) => (
                                    <span key={i} style={{ fontSize: 'var(--font-xs)', padding: '3px 10px', borderRadius: 12, background: '#f8d7da', color: '#721c24', fontWeight: 500 }}>
                                        {a}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Labs */}
                    <div className="detail-section">
                        <SectionHeader title="Labs" count={clinicalData ? Object.keys(clinicalData.labs_latest).length : undefined} />
                        {clinicalData
                            ? <LabsSection latest={clinicalData.labs_latest} timeline={clinicalData.labs_timeline} />
                            : <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)', padding: 'var(--space-2) 0' }}>No lab data yet.</div>
                        }
                    </div>

                    {/* Vitals */}
                    {clinicalData && Object.keys(clinicalData.vitals_latest).length > 0 && (
                        <div className="detail-section">
                            <SectionHeader title="Vitals" />
                            <VitalsSection latest={clinicalData.vitals_latest} />
                        </div>
                    )}

                    {/* Imaging */}
                    {(clinicalData && Object.keys(clinicalData.imaging_latest).length > 0) && (
                        <div className="detail-section">
                            <SectionHeader title="Imaging" count={Object.keys(clinicalData.imaging_latest).length} />
                            <ImagingSection latest={clinicalData.imaging_latest} timeline={clinicalData.imaging_timeline} />
                        </div>
                    )}

                    {/* Lifestyle */}
                    {clinicalData && (clinicalData.smoking_status || clinicalData.alcohol_use) && (
                        <div className="detail-section">
                            <SectionHeader title="Lifestyle" />
                            <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--font-sm)' }}>
                                {clinicalData.smoking_status && <span><strong>Smoking:</strong> {clinicalData.smoking_status}</span>}
                                {clinicalData.alcohol_use && <span><strong>Alcohol:</strong> {clinicalData.alcohol_use}</span>}
                            </div>
                        </div>
                    )}

                    {/* Family History */}
                    {clinicalData && clinicalData.family_history.length > 0 && (
                        <div className="detail-section">
                            <SectionHeader title="Family History" />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                {clinicalData.family_history.map((f, i) => (
                                    <div key={i} style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>{f}</div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Screening, Documents, Signals */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {/* Screening Cases */}
                    <div className="detail-section">
                        <SectionHeader title="Screening Cases" count={patient.screening_cases?.length} />
                        {(!patient.screening_cases || patient.screening_cases.length === 0) ? (
                            <div className="empty-state" style={{ padding: 'var(--space-4)' }}>
                                <p>No screening cases yet.</p>
                            </div>
                        ) : (
                            patient.screening_cases.map(sc => (
                                <div key={sc.id} className="alert-card" onClick={() => navigate(`/screening/${sc.id}`)} style={{ cursor: 'pointer' }}>
                                    <div className="alert-content">
                                        <div className="alert-title">{sc.trial_name}</div>
                                        <div className="alert-meta">
                                            {sc.protocol_number && `${sc.protocol_number} · `}
                                            <StatusBadge status={sc.status} />
                                            {sc.assigned_user_name && ` · ${sc.assigned_user_name}`}
                                        </div>
                                        {sc.revisit_date && (
                                            <div className="alert-meta" style={{ marginTop: 2 }}>Revisit: {formatDate(sc.revisit_date)}</div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Documents */}
                    <div className="detail-section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="detail-section-title" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>Documents</div>
                            <button className="btn btn-sm btn-secondary" onClick={() => docFileRef.current?.click()} disabled={uploading}>
                                + Upload
                            </button>
                        </div>
                        <div style={{ marginTop: 'var(--space-3)' }}>
                            {(!patient.documents || (patient.documents as { id: string }[]).length === 0) ? (
                                <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)', padding: 'var(--space-2) 0' }}>
                                    No documents uploaded yet.
                                </div>
                            ) : (
                                (patient.documents as { id: string; filename: string; document_type: string; created_at: string }[]).map(doc => (
                                    <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 'var(--font-sm)' }}>
                                        <span style={{ fontSize: 16 }}>📄</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.filename}</div>
                                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>{doc.document_type} · {formatDate(doc.created_at)}</div>
                                        </div>
                                        <a
                                            href={api.getDocumentUrl(patient.id, doc.id)}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{ color: 'var(--accent)', fontSize: 'var(--font-xs)', textDecoration: 'none', flexShrink: 0 }}
                                        >
                                            View
                                        </a>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Surgical History */}
                    {clinicalData && clinicalData.surgical_history.length > 0 && (
                        <div className="detail-section">
                            <SectionHeader title="Surgical History" />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {clinicalData.surgical_history.map((s, i) => (
                                    <div key={i} style={{ fontSize: 'var(--font-sm)', display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                                        <span style={{ fontWeight: 500 }}>{s.procedure}</span>
                                        {s.date && <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)' }}>{formatDate(s.date)}</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Manual Signals (legacy) */}
                    {patient.signals && patient.signals.length > 0 && (
                        <div className="detail-section">
                            <SectionHeader title="Recorded Signals" count={patient.signals.length} />
                            <div className="signal-timeline">
                                {patient.signals.slice(0, 10).map(sig => (
                                    <div key={sig.id} className="signal-item">
                                        <div className="signal-dot">◉</div>
                                        <div className="signal-info">
                                            <div className="signal-label">{sig.signal_label}</div>
                                            <div className="signal-value">
                                                {sig.value_number != null ? sig.value_number : (sig.value_enum || sig.value_text)}
                                                {sig.unit && <span style={{ fontSize: 'var(--font-sm)', fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 4 }}>{sig.unit}</span>}
                                            </div>
                                            <div className="signal-meta">{formatDate(sig.collected_at)} {sig.source && `· ${sig.source}`}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    {patient.notes && (
                        <div className="detail-section">
                            <SectionHeader title="Notes" />
                            <div className="card">
                                <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>{patient.notes}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Signal Modal */}
            {showSignalModal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowSignalModal(false)}>
                    <div className="modal">
                        <div className="modal-header">
                            <h3 className="modal-title">Record Signal</h3>
                            <button className="modal-close" onClick={() => setShowSignalModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleAddSignal}>
                            <div className="form-group">
                                <label className="form-label">Signal Type *</label>
                                <select className="form-select" value={sigForm.signal_type_id} onChange={e => setSigForm({ ...sigForm, signal_type_id: e.target.value })} required>
                                    <option value="">Select signal type…</option>
                                    {signalTypes.map(st => <option key={st.id} value={st.id}>{st.label} {st.unit ? `(${st.unit})` : ''}</option>)}
                                </select>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Value *</label>
                                    <input className="form-input" value={sigForm.value} onChange={e => setSigForm({ ...sigForm, value: e.target.value })} required placeholder="e.g., 12.4 or F3" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Date Collected *</label>
                                    <input className="form-input" type="date" value={sigForm.collected_at} onChange={e => setSigForm({ ...sigForm, collected_at: e.target.value })} required />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Source</label>
                                <input className="form-input" value={sigForm.source} onChange={e => setSigForm({ ...sigForm, source: e.target.value })} placeholder="e.g., FibroScan, Lab, Biopsy" />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowSignalModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Record Signal</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Create Screening Case Modal */}
            {showCaseModal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCaseModal(false)}>
                    <div className="modal">
                        <div className="modal-header">
                            <h3 className="modal-title">Create Screening Case</h3>
                            <button className="modal-close" onClick={() => setShowCaseModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleCreateCase}>
                            <div className="form-group">
                                <label className="form-label">Trial *</label>
                                <select className="form-select" value={caseForm.trial_id} onChange={e => setCaseForm({ ...caseForm, trial_id: e.target.value })} required>
                                    <option value="">Select trial…</option>
                                    {trials.map(t => <option key={t.id} value={t.id}>{t.name} ({t.protocol_number || t.specialty})</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Initial Status</label>
                                <select className="form-select" value={caseForm.status} onChange={e => setCaseForm({ ...caseForm, status: e.target.value })}>
                                    <option value="NEW">New</option>
                                    <option value="IN_REVIEW">In Review</option>
                                    <option value="PENDING_INFO">Pending Info</option>
                                </select>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowCaseModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Create Case</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
