import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useToast } from '../contexts/ToastContext';
import { StatusBadge, formatDate } from '../utils';
import type { TrialDetail, SignalType } from '../types';

interface CriteriaForm {
    inclusion_criteria: string;
    exclusion_criteria: string;
}

interface VisitForm {
    visit_name: string;
    day_offset: string | number;
    window_before: string | number;
    window_after: string | number;
    reminder_days_before: string | number;
    sort_order: string | number;
}

interface SignalForm {
    signal_type_id: string;
    operator: string;
    threshold_number: string;
    unit: string;
}

function CriteriaList({ text, color }: { text: string; color: string }) {
    // Parse lines into top-level items and sub-items (a. b. c. or i. ii.)
    type CriterionItem = { label: string; text: string; sub: { label: string; text: string }[] };
    const items: CriterionItem[] = [];

    text.split('\n').forEach(raw => {
        const line = raw.trim();
        if (!line || line.length < 3) return;

        // Sub-item: starts with a letter+dot/paren or roman numeral
        const subMatch = line.match(/^([a-z]{1,3}[.)]\s*|[ivxlc]+[.)]\s*)/i);
        const topMatch = line.match(/^(\d+[.)]\s*)/);

        if (subMatch && items.length > 0) {
            const label = subMatch[1].trim();
            const content = line.slice(subMatch[1].length).trim();
            items[items.length - 1].sub.push({ label, text: content });
        } else if (topMatch) {
            const content = line.slice(topMatch[1].length).trim();
            items.push({ label: String(items.length + 1), text: content, sub: [] });
        } else {
            items.push({ label: String(items.length + 1), text: line, sub: [] });
        }
    });

    return (
        <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {items.map((item, i) => (
                <li key={i}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                        <span style={{ minWidth: 22, height: 22, borderRadius: '50%', background: `color-mix(in srgb, ${color} 15%, transparent)`, color, fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                        <span>{item.text}</span>
                    </div>
                    {item.sub.length > 0 && (
                        <ol style={{ listStyle: 'none', padding: '0.4rem 0 0 2.5rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {item.sub.map((sub, j) => (
                                <li key={j} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                                    <span style={{ minWidth: 18, height: 18, borderRadius: '3px', background: `color-mix(in srgb, ${color} 10%, transparent)`, color, fontSize: '0.65rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>{String.fromCharCode(97 + j)}</span>
                                    <span>{sub.text}</span>
                                </li>
                            ))}
                        </ol>
                    )}
                </li>
            ))}
        </ol>
    );
}

export default function TrialDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [trial, setTrial] = useState<TrialDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [showVisitModal, setShowVisitModal] = useState(false);
    const [showSignalModal, setShowSignalModal] = useState(false);
    const [editingCriteria, setEditingCriteria] = useState(false);
    const [criteriaForm, setCriteriaForm] = useState<CriteriaForm>({ inclusion_criteria: '', exclusion_criteria: '' });
    const [signalTypes, setSignalTypes] = useState<SignalType[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();
    const { addToast } = useToast();

    const loadTrial = () => {
        if (!id) return;
        api.getTrial(id).then(data => {
            setTrial(data);
            setCriteriaForm({ inclusion_criteria: data.inclusion_criteria || '', exclusion_criteria: data.exclusion_criteria || '' });
        }).catch(console.error).finally(() => setLoading(false));
    };

    useEffect(() => {
        loadTrial();
        api.getSignalTypes().then(setSignalTypes).catch(() => {});
    }, [id]);

    const handleProtocolUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const result = await api.uploadProtocol(id!, file);
            let msg = 'Protocol uploaded';
            if (result.auto_extracted?.inclusion_criteria || result.auto_extracted?.exclusion_criteria) {
                msg += ' — eligibility criteria auto-extracted from PDF!';
            }
            addToast(msg, 'success');
            loadTrial();
        } catch (err) { addToast((err as Error).message, 'error'); }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDeleteProtocol = async () => {
        if (!confirm('Remove this protocol?')) return;
        try {
            await api.deleteProtocol(id!);
            addToast('Protocol removed', 'success');
            loadTrial();
        } catch (err) { addToast((err as Error).message, 'error'); }
    };

    const handleSaveCriteria = async () => {
        try {
            await api.updateTrial(id!, criteriaForm as unknown as Record<string, unknown>);
            addToast('Criteria saved', 'success');
            setEditingCriteria(false);
            loadTrial();
        } catch (err) { addToast((err as Error).message, 'error'); }
    };

    const emptyVisitForm: VisitForm = { visit_name: '', day_offset: 0, window_before: 3, window_after: 3, reminder_days_before: 3, sort_order: 0 };
    const [visitForm, setVisitForm] = useState<VisitForm>(emptyVisitForm);

    const handleAddVisit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.createVisitTemplate(id!, {
                ...visitForm,
                day_offset: parseInt(String(visitForm.day_offset)),
                sort_order: parseInt(String(visitForm.sort_order)),
            });
            addToast('Visit added', 'success');
            setShowVisitModal(false);
            setVisitForm(emptyVisitForm);
            loadTrial();
        } catch (err) { addToast((err as Error).message, 'error'); }
    };

    const handleDeleteVisit = async (tmplId: string) => {
        try {
            await api.deleteVisitTemplate(tmplId);
            addToast('Visit removed', 'success');
            loadTrial();
        } catch (err) { addToast((err as Error).message, 'error'); }
    };

    const emptySignalForm: SignalForm = { signal_type_id: '', operator: 'GTE', threshold_number: '', unit: '' };
    const [signalForm, setSignalForm] = useState<SignalForm>(emptySignalForm);

    const handleAddSignal = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload: Record<string, unknown> = { ...signalForm };
            if (signalForm.threshold_number) payload.threshold_number = parseFloat(signalForm.threshold_number);
            await api.createTrialRule(id!, payload);
            addToast('Signal rule added', 'success');
            setShowSignalModal(false);
            setSignalForm(emptySignalForm);
            loadTrial();
        } catch (err) { addToast((err as Error).message, 'error'); }
    };

    const handleDeleteSignal = async (ruleId: string) => {
        try {
            await api.deleteTrialRule(ruleId);
            addToast('Signal rule removed', 'success');
            loadTrial();
        } catch (err) { addToast((err as Error).message, 'error'); }
    };

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
    if (!trial) return <div className="empty-state"><h3>Trial not found</h3></div>;

    const statusColors: Record<string, string> = { ACTIVE: 'var(--status-enrolled)', PAUSED: 'var(--status-in-review)', CLOSED: 'var(--text-tertiary)' };
    const operatorLabels: Record<string, string> = { GTE: '≥', LTE: '≤', EQ: '=', IN: 'in' };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1048576).toFixed(1)} MB`;
    };

    return (
        <div>
            <div className="detail-header">
                <div className="detail-header-info">
                    <h1>{trial.name}</h1>
                    <div className="detail-header-meta">
                        {trial.protocol_number && <span>{trial.protocol_number}</span>}
                        <span>{trial.specialty}</span>
                        <span style={{ color: statusColors[trial.recruiting_status], fontWeight: 600 }}>{trial.recruiting_status}</span>
                    </div>
                </div>
            </div>

            {trial.description && (
                <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                    <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', lineHeight: 'var(--leading-relaxed)' }}>{trial.description}</p>
                </div>
            )}

            <div className="detail-grid">
                <div>
                    {/* Protocol Upload */}
                    <div className="detail-section">
                        <div className="detail-section-title">Protocol Document</div>
                        {trial.protocol ? (
                            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                                <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'var(--accent-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📄</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 500, fontSize: 'var(--font-sm)' }}>{trial.protocol.filename}</div>
                                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>
                                        {formatFileSize(trial.protocol.file_size)} · {formatDate(trial.protocol.created_at)}
                                        {trial.protocol.version && ` · ${trial.protocol.version}`}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                    <a href={api.getProtocolUrl(id!)} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary">View PDF</a>
                                    <button className="btn btn-sm btn-ghost" onClick={handleDeleteProtocol} style={{ color: 'var(--error)' }}>Remove</button>
                                </div>
                            </div>
                        ) : (
                            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                                <div style={{ fontSize: 32, marginBottom: 'var(--space-3)', opacity: 0.4 }}>📄</div>
                                <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-4)' }}>No protocol uploaded</p>
                                <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>Upload Protocol PDF</button>
                            </div>
                        )}
                        <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleProtocolUpload} style={{ display: 'none' }} />
                        {trial.protocol && (
                            <button className="btn btn-sm btn-ghost" style={{ marginTop: 'var(--space-2)' }} onClick={() => fileInputRef.current?.click()}>Replace Protocol</button>
                        )}
                    </div>

                    {/* I/E Criteria */}
                    <div className="detail-section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="detail-section-title" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>Eligibility Criteria</div>
                            {!editingCriteria && (
                                <button className="btn btn-sm btn-secondary" onClick={() => setEditingCriteria(true)}>Edit</button>
                            )}
                        </div>
                        {editingCriteria ? (
                            <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Inclusion Criteria</label>
                                    <textarea className="form-textarea" rows={5} value={criteriaForm.inclusion_criteria} onChange={e => setCriteriaForm({ ...criteriaForm, inclusion_criteria: e.target.value })} placeholder="One criterion per line…" />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Exclusion Criteria</label>
                                    <textarea className="form-textarea" rows={5} value={criteriaForm.exclusion_criteria} onChange={e => setCriteriaForm({ ...criteriaForm, exclusion_criteria: e.target.value })} placeholder="One criterion per line…" />
                                </div>
                                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                    <button className="btn btn-primary btn-sm" onClick={handleSaveCriteria}>Save</button>
                                    <button className="btn btn-secondary btn-sm" onClick={() => { setEditingCriteria(false); setCriteriaForm({ inclusion_criteria: trial.inclusion_criteria || '', exclusion_criteria: trial.exclusion_criteria || '' }); }}>Cancel</button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ marginTop: 'var(--space-4)' }}>
                                {!trial.inclusion_criteria && !trial.exclusion_criteria ? (
                                    <div className="card" style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
                                        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)' }}>No criteria defined yet. Upload the protocol and enter criteria here.</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                                        {trial.inclusion_criteria && (
                                            <div className="card">
                                                <div className="card-header"><div className="card-title" style={{ color: 'var(--success)', fontSize: 'var(--font-sm)' }}>✓ Inclusion Criteria</div></div>
                                                <CriteriaList text={trial.inclusion_criteria} color="var(--success)" />
                                            </div>
                                        )}
                                        {trial.exclusion_criteria && (
                                            <div className="card">
                                                <div className="card-header"><div className="card-title" style={{ color: 'var(--error)', fontSize: 'var(--font-sm)' }}>✕ Exclusion Criteria</div></div>
                                                <CriteriaList text={trial.exclusion_criteria} color="var(--error)" />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Screening Cases */}
                    <div className="detail-section">
                        <div className="detail-section-title">Screening Cases ({trial.screening_cases?.length || 0})</div>
                        {(!trial.screening_cases || trial.screening_cases.length === 0) ? (
                            <div className="empty-state" style={{ padding: '2rem' }}><p>No screening cases for this trial</p></div>
                        ) : (
                            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Patient</th>
                                            <th>Status</th>
                                            <th>CRC</th>
                                            <th>Updated</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {trial.screening_cases.map(sc => (
                                            <tr key={sc.id} onClick={() => navigate(`/screening/${sc.id}`)}>
                                                <td className="patient-name">{sc.last_name}, {sc.first_name}</td>
                                                <td><StatusBadge status={sc.status} /></td>
                                                <td className="meta">{sc.assigned_user_name || '—'}</td>
                                                <td className="meta">{formatDate(sc.updated_at)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                <div>
                    {/* Visit Schedule */}
                    <div className="detail-section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="detail-section-title" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>Visit Schedule</div>
                            <button className="btn btn-sm btn-secondary" onClick={() => setShowVisitModal(true)}>+ Add Visit</button>
                        </div>
                        <div style={{ marginTop: 'var(--space-4)' }}>
                            {(!trial.visit_templates || trial.visit_templates.length === 0) ? (
                                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
                                    <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)' }}>No visits defined. Add visits to set up the study schedule.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                    {trial.visit_templates.map((vt, i) => (
                                        <div key={vt.id} className="card" style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-muted)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--font-xs)', fontWeight: 700, flexShrink: 0 }}>
                                                {i + 1}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 500, fontSize: 'var(--font-sm)' }}>{vt.visit_name}</div>
                                                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>
                                                    Day {vt.day_offset} · Window ±{vt.window_before}/{vt.window_after}d · Reminder {vt.reminder_days_before}d before
                                                </div>
                                            </div>
                                            <button className="btn btn-sm btn-ghost" onClick={() => handleDeleteVisit(vt.id)} style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)' }}>✕</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Signal Rules */}
                    <div className="detail-section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="detail-section-title" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>Signal Rules</div>
                            <button className="btn btn-sm btn-secondary" onClick={() => setShowSignalModal(true)}>+ Add Rule</button>
                        </div>
                        <div style={{ marginTop: 'var(--space-4)' }}>
                            {(!trial.signal_rules || trial.signal_rules.length === 0) ? (
                                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
                                    <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)' }}>No signal rules configured. Add rules to define eligibility thresholds.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                    {trial.signal_rules.map(rule => (
                                        <div key={rule.id} className="card" style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 500, fontSize: 'var(--font-sm)' }}>{rule.signal_label}</div>
                                                <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: 'var(--accent)', marginTop: 2 }}>
                                                    {operatorLabels[rule.operator] || rule.operator}{' '}
                                                    {rule.threshold_number != null ? rule.threshold_number : rule.threshold_text || ''}
                                                    {rule.threshold_list && JSON.parse(rule.threshold_list).join(', ')}
                                                    {rule.unit && <span style={{ fontSize: 'var(--font-sm)', fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 4 }}>{rule.unit}</span>}
                                                </div>
                                            </div>
                                            <button className="btn btn-sm btn-ghost" onClick={() => handleDeleteSignal(rule.id)} style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)' }}>✕</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Visit Template Modal */}
            {showVisitModal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowVisitModal(false)}>
                    <div className="modal">
                        <div className="modal-header">
                            <h3 className="modal-title">Add Visit</h3>
                            <button className="modal-close" onClick={() => setShowVisitModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleAddVisit}>
                            <div className="form-group">
                                <label className="form-label">Visit Name *</label>
                                <input className="form-input" value={visitForm.visit_name} onChange={e => setVisitForm({ ...visitForm, visit_name: e.target.value })} placeholder='e.g., "Screening", "Day 0", "Week 4"' required />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Day Offset *</label>
                                    <input className="form-input" type="number" value={visitForm.day_offset} onChange={e => setVisitForm({ ...visitForm, day_offset: e.target.value })} required />
                                    <span className="form-hint">Days from enrollment (0 = enrollment day)</span>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Sort Order</label>
                                    <input className="form-input" type="number" value={visitForm.sort_order} onChange={e => setVisitForm({ ...visitForm, sort_order: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Window Before (days)</label>
                                    <input className="form-input" type="number" value={visitForm.window_before} onChange={e => setVisitForm({ ...visitForm, window_before: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Window After (days)</label>
                                    <input className="form-input" type="number" value={visitForm.window_after} onChange={e => setVisitForm({ ...visitForm, window_after: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Reminder (days before)</label>
                                <input className="form-input" type="number" value={visitForm.reminder_days_before} onChange={e => setVisitForm({ ...visitForm, reminder_days_before: e.target.value })} />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowVisitModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Add Visit</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Signal Rule Modal */}
            {showSignalModal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowSignalModal(false)}>
                    <div className="modal">
                        <div className="modal-header">
                            <h3 className="modal-title">Add Signal Rule</h3>
                            <button className="modal-close" onClick={() => setShowSignalModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleAddSignal}>
                            <div className="form-group">
                                <label className="form-label">Signal Type *</label>
                                <select className="form-select" value={signalForm.signal_type_id} onChange={e => setSignalForm({ ...signalForm, signal_type_id: e.target.value })} required>
                                    <option value="">Select signal…</option>
                                    {signalTypes.map(st => <option key={st.id} value={st.id}>{st.label} ({st.data_type})</option>)}
                                </select>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Operator *</label>
                                    <select className="form-select" value={signalForm.operator} onChange={e => setSignalForm({ ...signalForm, operator: e.target.value })}>
                                        <option value="GTE">≥ Greater or equal</option>
                                        <option value="LTE">≤ Less or equal</option>
                                        <option value="EQ">= Equals</option>
                                        <option value="IN">in (list)</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Threshold *</label>
                                    <input className="form-input" value={signalForm.threshold_number} onChange={e => setSignalForm({ ...signalForm, threshold_number: e.target.value })} placeholder="e.g., 8.0" required />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Unit</label>
                                <input className="form-input" value={signalForm.unit} onChange={e => setSignalForm({ ...signalForm, unit: e.target.value })} placeholder="e.g., kPa, IU/mL" />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowSignalModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Add Rule</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
