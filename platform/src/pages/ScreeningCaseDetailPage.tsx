import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useToast } from '../contexts/ToastContext';
import { StatusBadge, formatDate, ALL_STATUSES, STATUS_CONFIG, isOverdue } from '../utils';
import type { ScreeningCaseDetail, PatientVisit, PendingItem, ScreenFailReason } from '../types';

interface StatusForm { status: string; next_action_date: string; }
interface FailForm {
    status: string;
    fail_reason_id: string;
    fail_reason_text: string;
    what_would_change_text: string;
    revisit_date: string;
}
interface EnrollForm { enrollment_date: string; }
interface PendingForm { type: string; name: string; due_date: string; }

export default function ScreeningCaseDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [sc, setSc] = useState<ScreeningCaseDetail | null>(null);
    const [visits, setVisits] = useState<PatientVisit[]>([]);
    const [loading, setLoading] = useState(true);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [showPendingModal, setShowPendingModal] = useState(false);
    const [showFailModal, setShowFailModal] = useState(false);
    const [showEnrollModal, setShowEnrollModal] = useState(false);
    const [failReasons, setFailReasons] = useState<ScreenFailReason[]>([]);
    const navigate = useNavigate();
    const { addToast } = useToast();

    const loadCase = () => {
        if (!id) return;
        api.getScreeningCase(id).then(data => {
            setSc(data);
            if (data.status === 'ENROLLED') {
                api.getCaseVisits(id).then(setVisits).catch(() => {});
            }
        }).catch(console.error).finally(() => setLoading(false));
    };

    useEffect(() => {
        loadCase();
        api.getScreenFailReasons().then(setFailReasons).catch(() => {});
    }, [id]);

    const [statusForm, setStatusForm] = useState<StatusForm>({ status: '', next_action_date: '' });
    const handleStatusUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.updateScreeningCase(id!, statusForm as unknown as Record<string, unknown>);
            addToast('Status updated', 'success');
            setShowStatusModal(false);
            loadCase();
        } catch (err) { addToast((err as Error).message, 'error'); }
    };

    const [failForm, setFailForm] = useState<FailForm>({ status: 'SCREEN_FAILED', fail_reason_id: '', fail_reason_text: '', what_would_change_text: '', revisit_date: '' });
    const handleScreenFail = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload: Record<string, unknown> = { ...failForm };
            if (failForm.revisit_date) payload.status = 'FUTURE_CANDIDATE';
            await api.updateScreeningCase(id!, payload);
            addToast('Screen fail documented', 'success');
            setShowFailModal(false);
            loadCase();
        } catch (err) { addToast((err as Error).message, 'error'); }
    };

    const [enrollForm, setEnrollForm] = useState<EnrollForm>({ enrollment_date: new Date().toISOString().split('T')[0] });
    const handleEnroll = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const result = await api.enrollPatient(id!, enrollForm as unknown as Record<string, unknown>);
            addToast(`Enrolled! ${result.visits_created} visits scheduled.`, 'success');
            setShowEnrollModal(false);
            loadCase();
        } catch (err) { addToast((err as Error).message, 'error'); }
    };

    const handleVisitStatusChange = async (visitId: string, status: string, actualDate?: string) => {
        try {
            const data: Record<string, unknown> = { status };
            if (status === 'COMPLETED') data.actual_date = actualDate || new Date().toISOString().split('T')[0];
            await api.updatePatientVisit(visitId, data);
            addToast(`Visit ${status.toLowerCase()}`, 'success');
            if (id) api.getCaseVisits(id).then(setVisits);
        } catch (err) { addToast((err as Error).message, 'error'); }
    };

    const [pendingForm, setPendingForm] = useState<PendingForm>({ type: 'LAB', name: '', due_date: '' });
    const handleAddPending = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.createPendingItem({ screening_case_id: id, ...pendingForm });
            addToast('Item added', 'success');
            setShowPendingModal(false);
            setPendingForm({ type: 'LAB', name: '', due_date: '' });
            loadCase();
        } catch (err) { addToast((err as Error).message, 'error'); }
    };

    const togglePendingItem = async (item: PendingItem) => {
        const newStatus = item.status === 'OPEN' ? 'COMPLETED' : 'OPEN';
        try {
            await api.updatePendingItem(item.id, { status: newStatus });
            addToast(newStatus === 'COMPLETED' ? 'Item completed' : 'Item reopened', 'success');
            loadCase();
        } catch (err) { addToast((err as Error).message, 'error'); }
    };

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
    if (!sc) return <div className="empty-state"><h3>Case not found</h3></div>;

    const openItems = sc.pending_items?.filter(i => i.status === 'OPEN') || [];
    const completedItems = sc.pending_items?.filter(i => i.status === 'COMPLETED') || [];

    const visitStatusIcons: Record<string, string> = { SCHEDULED: '○', COMPLETED: '●', MISSED: '✕', CANCELLED: '—' };
    const visitStatusColors: Record<string, string> = { SCHEDULED: 'var(--accent)', COMPLETED: 'var(--success)', MISSED: 'var(--error)', CANCELLED: 'var(--text-tertiary)' };

    return (
        <div>
            {/* Header */}
            <div className="detail-header">
                <div className="detail-header-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                        <h1 style={{ cursor: 'pointer' }} onClick={() => navigate(`/patients/${sc.patient_id}`)}>
                            {sc.first_name} {sc.last_name}
                        </h1>
                        <StatusBadge status={sc.status} />
                    </div>
                    <div className="detail-header-meta">
                        <span>{sc.trial_name}</span>
                        {sc.protocol_number && <span>{sc.protocol_number}</span>}
                        {sc.assigned_user_name && <span>CRC: {sc.assigned_user_name}</span>}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {sc.status === 'LIKELY_ELIGIBLE' && (
                        <button className="btn btn-primary" onClick={() => setShowEnrollModal(true)}>Enroll</button>
                    )}
                    <button className="btn btn-secondary" onClick={() => { setStatusForm({ status: sc.status, next_action_date: sc.next_action_date || '' }); setShowStatusModal(true); }}>
                        Update Status
                    </button>
                    {!['SCREEN_FAILED', 'FUTURE_CANDIDATE', 'ENROLLED'].includes(sc.status) && (
                        <button className="btn btn-danger" onClick={() => { setFailForm({ status: 'SCREEN_FAILED', fail_reason_id: '', fail_reason_text: '', what_would_change_text: '', revisit_date: '' }); setShowFailModal(true); }}>
                            Screen Fail
                        </button>
                    )}
                </div>
            </div>

            <div className="detail-grid">
                <div>
                    {/* Enrolled: Visit Timeline */}
                    {sc.status === 'ENROLLED' && visits.length > 0 && (
                        <div className="detail-section animate-in">
                            <div className="detail-section-title">Visit Schedule</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                {visits.map(v => (
                                    <div key={v.id} className="card" style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                        <div style={{ fontSize: 18, color: visitStatusColors[v.status], width: 24, textAlign: 'center', flexShrink: 0 }}>
                                            {visitStatusIcons[v.status]}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 500, fontSize: 'var(--font-sm)' }}>{v.visit_name}</div>
                                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>
                                                Day {v.day_offset} · Scheduled: {formatDate(v.scheduled_date)}
                                                {v.actual_date && ` · Actual: ${formatDate(v.actual_date)}`}
                                                {v.status === 'SCHEDULED' && isOverdue(v.scheduled_date) && (
                                                    <span style={{ color: 'var(--error)', marginLeft: 4 }}>(overdue)</span>
                                                )}
                                            </div>
                                        </div>
                                        {v.status === 'SCHEDULED' && (
                                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                                <button className="btn btn-sm btn-secondary" onClick={() => handleVisitStatusChange(v.id, 'COMPLETED')} title="Mark completed">✓</button>
                                                <button className="btn btn-sm btn-ghost" onClick={() => handleVisitStatusChange(v.id, 'MISSED')} title="Mark missed" style={{ color: 'var(--error)' }}>✕</button>
                                            </div>
                                        )}
                                        {v.status !== 'SCHEDULED' && (
                                            <span style={{ fontSize: 'var(--font-xs)', fontWeight: 500, color: visitStatusColors[v.status], textTransform: 'uppercase' }}>
                                                {v.status}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Screen Fail Documentation */}
                    {(sc.status === 'SCREEN_FAILED' || sc.status === 'FUTURE_CANDIDATE') && (
                        <div className="card animate-in" style={{ marginBottom: 'var(--space-6)', borderColor: sc.status === 'FUTURE_CANDIDATE' ? 'rgba(167,139,250,0.2)' : 'rgba(239,108,108,0.2)' }}>
                            <div className="card-header">
                                <div className="card-title" style={{ color: sc.status === 'FUTURE_CANDIDATE' ? 'var(--status-future)' : 'var(--status-failed)' }}>
                                    {sc.status === 'FUTURE_CANDIDATE' ? '↻ Future Candidate' : '✕ Screen Fail Documentation'}
                                </div>
                            </div>
                            {sc.fail_reason_label && (
                                <div style={{ marginBottom: 'var(--space-3)' }}>
                                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginBottom: 4 }}>Reason</div>
                                    <div style={{ fontSize: 'var(--font-sm)', fontWeight: 500 }}>{sc.fail_reason_label}</div>
                                </div>
                            )}
                            {sc.fail_reason_text && (
                                <div style={{ marginBottom: 'var(--space-3)' }}>
                                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginBottom: 4 }}>Details</div>
                                    <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>{sc.fail_reason_text}</div>
                                </div>
                            )}
                            {sc.what_would_change_text && (
                                <div style={{ marginBottom: 'var(--space-3)' }}>
                                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginBottom: 4 }}>What Would Need to Change</div>
                                    <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>{sc.what_would_change_text}</div>
                                </div>
                            )}
                            {sc.revisit_date && (
                                <div>
                                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginBottom: 4 }}>Revisit Date</div>
                                    <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: isOverdue(sc.revisit_date) ? 'var(--error)' : 'var(--status-future)' }}>
                                        {formatDate(sc.revisit_date)} {isOverdue(sc.revisit_date) && '(overdue)'}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Pending Items */}
                    <div className="detail-section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="detail-section-title" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
                                Pending Items ({openItems.length} open)
                            </div>
                            <button className="btn btn-sm btn-secondary" onClick={() => setShowPendingModal(true)}>+ Add Item</button>
                        </div>
                        <div style={{ marginTop: 'var(--space-4)' }}>
                            {openItems.length === 0 && completedItems.length === 0 ? (
                                <div className="empty-state" style={{ padding: '2rem' }}><p>No pending items. Add labs, imaging, or records to track.</p></div>
                            ) : (
                                <>
                                    {openItems.map(item => (
                                        <div key={item.id} className="checklist-item">
                                            <button className="checklist-checkbox" onClick={() => togglePendingItem(item)} title="Mark complete" />
                                            <div className="checklist-content">
                                                <div className="checklist-name">{item.name}</div>
                                                <div className="checklist-meta">
                                                    {item.due_date && (
                                                        <span style={{ color: isOverdue(item.due_date) ? 'var(--error)' : 'inherit' }}>
                                                            Due {formatDate(item.due_date)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="checklist-type">{item.type}</span>
                                        </div>
                                    ))}
                                    {completedItems.length > 0 && (
                                        <div style={{ marginTop: 'var(--space-4)' }}>
                                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-2)' }}>Completed</div>
                                            {completedItems.map(item => (
                                                <div key={item.id} className="checklist-item" style={{ opacity: 0.6 }}>
                                                    <button className="checklist-checkbox completed" onClick={() => togglePendingItem(item)} title="Reopen" />
                                                    <div className="checklist-content">
                                                        <div className="checklist-name completed">{item.name}</div>
                                                        <div className="checklist-meta">{item.completed_at && `Completed ${formatDate(item.completed_at)}`}</div>
                                                    </div>
                                                    <span className="checklist-type">{item.type}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Trial Signal Rules Context */}
                    {sc.trial_signal_rules && sc.trial_signal_rules.length > 0 && (
                        <div className="detail-section">
                            <div className="detail-section-title">Trial Eligibility Rules</div>
                            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                                {sc.trial_signal_rules.map(rule => {
                                    const opLabels: Record<string, string> = { GTE: '≥', LTE: '≤', EQ: '=', IN: 'in' };
                                    return (
                                        <div key={rule.id} className="card" style={{ padding: 'var(--space-3)', flex: '1 1 140px', minWidth: 140 }}>
                                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>{rule.signal_label}</div>
                                            <div style={{ fontSize: 'var(--font-md)', fontWeight: 700, color: 'var(--accent)', marginTop: 2 }}>
                                                {opLabels[rule.operator]}{' '}
                                                {rule.threshold_number != null ? rule.threshold_number : rule.threshold_text}
                                                {rule.threshold_list && JSON.parse(rule.threshold_list).join(', ')}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div>
                    <div className="detail-section">
                        <div className="detail-section-title">Patient Signals</div>
                        {(!sc.signals || sc.signals.length === 0) ? (
                            <div className="empty-state" style={{ padding: '2rem' }}><p>No signals recorded</p></div>
                        ) : (
                            <div className="signal-timeline">
                                {sc.signals.map(sig => (
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

                    {/* Case Info */}
                    <div className="detail-section">
                        <div className="detail-section-title">Case Info</div>
                        <div className="card" style={{ fontSize: 'var(--font-sm)' }}>
                            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                                <div><span style={{ color: 'var(--text-tertiary)' }}>Created:</span> {formatDate(sc.created_at)}</div>
                                <div><span style={{ color: 'var(--text-tertiary)' }}>Updated:</span> {formatDate(sc.updated_at)}</div>
                                {sc.next_action_date && <div><span style={{ color: 'var(--text-tertiary)' }}>Next Action:</span> {formatDate(sc.next_action_date)}</div>}
                                {sc.specialty && <div><span style={{ color: 'var(--text-tertiary)' }}>Specialty:</span> {sc.specialty}</div>}
                            </div>
                        </div>
                    </div>

                    {sc.patient_notes && (
                        <div className="detail-section">
                            <div className="detail-section-title">Patient Notes</div>
                            <div className="card">
                                <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>{sc.patient_notes}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Update Status Modal */}
            {showStatusModal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowStatusModal(false)}>
                    <div className="modal">
                        <div className="modal-header">
                            <h3 className="modal-title">Update Status</h3>
                            <button className="modal-close" onClick={() => setShowStatusModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleStatusUpdate}>
                            <div className="form-group">
                                <label className="form-label">Status</label>
                                <select className="form-select" value={statusForm.status} onChange={e => setStatusForm({ ...statusForm, status: e.target.value })}>
                                    {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Next Action Date</label>
                                <input className="form-input" type="date" value={statusForm.next_action_date} onChange={e => setStatusForm({ ...statusForm, next_action_date: e.target.value })} />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowStatusModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Update</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Screen Fail Modal */}
            {showFailModal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowFailModal(false)}>
                    <div className="modal">
                        <div className="modal-header">
                            <h3 className="modal-title">Document Screen Fail</h3>
                            <button className="modal-close" onClick={() => setShowFailModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleScreenFail}>
                            <div className="form-group">
                                <label className="form-label">Fail Reason Code *</label>
                                <select className="form-select" value={failForm.fail_reason_id} onChange={e => setFailForm({ ...failForm, fail_reason_id: e.target.value })} required>
                                    <option value="">Select reason…</option>
                                    {failReasons.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Supporting Details</label>
                                <textarea className="form-textarea" value={failForm.fail_reason_text} onChange={e => setFailForm({ ...failForm, fail_reason_text: e.target.value })} placeholder="Additional context…" rows={2} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">What Would Need to Change?</label>
                                <textarea className="form-textarea" value={failForm.what_would_change_text} onChange={e => setFailForm({ ...failForm, what_would_change_text: e.target.value })} placeholder="Conditions that would make this patient eligible in the future…" rows={2} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Revisit Date (sets status to Future Candidate)</label>
                                <input className="form-input" type="date" value={failForm.revisit_date} onChange={e => setFailForm({ ...failForm, revisit_date: e.target.value })} />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowFailModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-danger">Document Fail</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Enroll Modal */}
            {showEnrollModal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowEnrollModal(false)}>
                    <div className="modal">
                        <div className="modal-header">
                            <h3 className="modal-title">Enroll Patient</h3>
                            <button className="modal-close" onClick={() => setShowEnrollModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleEnroll}>
                            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
                                This will set the case status to <strong>Enrolled</strong> and auto-generate all scheduled visits from the trial's visit schedule.
                            </p>
                            <div className="form-group">
                                <label className="form-label">Enrollment Date</label>
                                <input className="form-input" type="date" value={enrollForm.enrollment_date} onChange={e => setEnrollForm({ ...enrollForm, enrollment_date: e.target.value })} required />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowEnrollModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Enroll Patient</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Pending Item Modal */}
            {showPendingModal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowPendingModal(false)}>
                    <div className="modal">
                        <div className="modal-header">
                            <h3 className="modal-title">Add Pending Item</h3>
                            <button className="modal-close" onClick={() => setShowPendingModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleAddPending}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Type *</label>
                                    <select className="form-select" value={pendingForm.type} onChange={e => setPendingForm({ ...pendingForm, type: e.target.value })} required>
                                        {['LAB', 'IMAGING', 'RECORDS', 'PROCEDURE', 'CONSULT'].map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Due Date</label>
                                    <input className="form-input" type="date" value={pendingForm.due_date} onChange={e => setPendingForm({ ...pendingForm, due_date: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description *</label>
                                <input className="form-input" value={pendingForm.name} onChange={e => setPendingForm({ ...pendingForm, name: e.target.value })} placeholder='e.g., "platelet count", "outside biopsy report"' required />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowPendingModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Add Item</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
