import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useToast } from '../contexts/ToastContext';
import { StatusBadge, formatDate } from '../utils';
import type { PatientDetail, SignalType, Trial } from '../types';

interface SigForm {
    signal_type_id: string;
    value: string;
    collected_at: string;
    source: string;
}

interface CaseForm {
    trial_id: string;
    status: string;
}

export default function PatientDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [patient, setPatient] = useState<PatientDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [showSignalModal, setShowSignalModal] = useState(false);
    const [showCaseModal, setShowCaseModal] = useState(false);
    const [signalTypes, setSignalTypes] = useState<SignalType[]>([]);
    const [trials, setTrials] = useState<Trial[]>([]);
    const navigate = useNavigate();
    const { addToast } = useToast();

    const loadPatient = () => {
        if (!id) return;
        api.getPatient(id).then(setPatient).catch(console.error).finally(() => setLoading(false));
    };

    useEffect(() => {
        loadPatient();
        api.getSignalTypes().then(setSignalTypes).catch(() => {});
        api.getTrials({ status: 'ACTIVE' }).then(setTrials).catch(() => {});
    }, [id]);

    const [sigForm, setSigForm] = useState<SigForm>({ signal_type_id: '', value: '', collected_at: new Date().toISOString().split('T')[0], source: '' });
    const [caseForm, setCaseForm] = useState<CaseForm>({ trial_id: '', status: 'NEW' });

    const handleAddSignal = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const result = await api.addPatientSignal(id!, sigForm as unknown as Record<string, unknown>);
            addToast('Signal recorded', 'success');
            if (result.alerts_generated > 0) {
                addToast(`⚡ ${result.alerts_generated} threshold alert(s) triggered!`, 'info');
            }
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

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
    if (!patient) return <div className="empty-state"><h3>Patient not found</h3></div>;

    return (
        <div>
            <div className="detail-header">
                <div className="detail-header-info">
                    <h1>{patient.first_name} {patient.last_name}</h1>
                    <div className="detail-header-meta">
                        <span>DOB: {formatDate(patient.dob)}</span>
                        {patient.internal_identifier && <span>ID: {patient.internal_identifier}</span>}
                        {patient.referral_source_name && <span>Ref: {patient.referral_source_name}</span>}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary" onClick={() => setShowSignalModal(true)}>+ Signal</button>
                    <button className="btn btn-primary" onClick={() => setShowCaseModal(true)}>+ Screening Case</button>
                </div>
            </div>

            <div className="detail-grid">
                <div>
                    {/* Screening Cases */}
                    <div className="detail-section">
                        <div className="detail-section-title">Screening Cases ({patient.screening_cases?.length || 0})</div>
                        {(!patient.screening_cases || patient.screening_cases.length === 0) ? (
                            <div className="empty-state" style={{ padding: '2rem' }}>
                                <p>No screening cases yet. Create one to start the screening workflow.</p>
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

                    {patient.notes && (
                        <div className="detail-section">
                            <div className="detail-section-title">Notes</div>
                            <div className="card"><p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>{patient.notes}</p></div>
                        </div>
                    )}
                </div>

                <div>
                    {/* Signal Timeline */}
                    <div className="detail-section">
                        <div className="detail-section-title">Signal Timeline</div>
                        {(!patient.signals || patient.signals.length === 0) ? (
                            <div className="empty-state" style={{ padding: '2rem' }}>
                                <p>No signals recorded. Add a FibroScan, lab result, or other signal.</p>
                            </div>
                        ) : (
                            <div className="signal-timeline">
                                {patient.signals.map(sig => (
                                    <div key={sig.id} className="signal-item">
                                        <div className="signal-dot">📊</div>
                                        <div className="signal-info">
                                            <div className="signal-label">{sig.signal_label}</div>
                                            <div className="signal-value">
                                                {sig.value_number != null ? sig.value_number : (sig.value_enum || sig.value_text)}
                                                {sig.unit && <span style={{ fontSize: 'var(--font-sm)', fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 4 }}>{sig.unit}</span>}
                                            </div>
                                            <div className="signal-meta">
                                                {formatDate(sig.collected_at)} {sig.source && `· ${sig.source}`}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
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
