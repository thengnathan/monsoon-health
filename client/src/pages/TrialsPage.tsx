import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useToast } from '../contexts/ToastContext';
import type { Trial } from '../types';

interface CreateForm {
    name: string;
    protocol_number: string;
    specialty: string;
    description: string;
}

export default function TrialsPage() {
    const [trials, setTrials] = useState<Trial[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const emptyForm: CreateForm = { name: '', protocol_number: '', specialty: '', description: '' };
    const [createForm, setCreateForm] = useState<CreateForm>(emptyForm);
    const navigate = useNavigate();
    const { addToast } = useToast();

    const loadTrials = () => {
        api.getTrials(filter ? { status: filter } : {}).then(setTrials).catch(console.error).finally(() => setLoading(false));
    };

    useEffect(() => { loadTrials(); }, [filter]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const trial = await api.createTrial(createForm as unknown as Record<string, unknown>);
            addToast('Trial created', 'success');
            setShowCreateModal(false);
            setCreateForm(emptyForm);
            navigate(`/trials/${trial.id}`);
        } catch (err) { addToast((err as Error).message, 'error'); }
    };

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

    const statusColors: Record<string, string> = { ACTIVE: 'var(--status-enrolled)', PAUSED: 'var(--status-in-review)', CLOSED: 'var(--text-tertiary)' };

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1>Trials</h1>
                    <p>Active clinical trials at your site</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>+ New Trial</button>
            </div>

            <div className="filters">
                {['', 'ACTIVE', 'PAUSED', 'CLOSED'].map(s => (
                    <button key={s} className={`filter-pill ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
                        {s || 'All'}
                    </button>
                ))}
            </div>

            {trials.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">△</div>
                    <h3>No trials found</h3>
                    <p style={{ marginTop: 'var(--space-3)' }}>Create your first trial to get started.</p>
                    <button className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }} onClick={() => setShowCreateModal(true)}>+ New Trial</button>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                    {trials.map(trial => {
                        const totalCases = Object.values(trial.case_counts || {}).reduce((a, b) => a + b, 0);
                        const activeCases = ['NEW', 'IN_REVIEW', 'PENDING_INFO', 'LIKELY_ELIGIBLE'].reduce((a, s) => a + (trial.case_counts?.[s] || 0), 0);
                        return (
                            <div key={trial.id} className="card animate-in" onClick={() => navigate(`/trials/${trial.id}`)} style={{ cursor: 'pointer' }}>
                                <div className="card-header">
                                    <div>
                                        <div className="card-title" style={{ fontSize: 'var(--font-md)' }}>{trial.name}</div>
                                        <div className="card-subtitle" style={{ marginTop: 4 }}>
                                            {trial.protocol_number && `${trial.protocol_number} · `}{trial.specialty}
                                        </div>
                                    </div>
                                    <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: statusColors[trial.recruiting_status], textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        {trial.recruiting_status}
                                    </span>
                                </div>
                                {trial.description && (
                                    <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', lineHeight: 'var(--leading-relaxed)' }}>
                                        {trial.description.length > 150 ? trial.description.slice(0, 150) + '…' : trial.description}
                                    </p>
                                )}
                                <div style={{ display: 'flex', gap: 'var(--space-6)', fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>
                                    <span><strong style={{ color: 'var(--text-secondary)' }}>{totalCases}</strong> total cases</span>
                                    <span><strong style={{ color: 'var(--accent)' }}>{activeCases}</strong> active</span>
                                    <span><strong style={{ color: 'var(--status-enrolled)' }}>{trial.case_counts?.ENROLLED || 0}</strong> enrolled</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create Trial Modal */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCreateModal(false)}>
                    <div className="modal">
                        <div className="modal-header">
                            <h3 className="modal-title">New Trial</h3>
                            <button className="modal-close" onClick={() => setShowCreateModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleCreate}>
                            <div className="form-group">
                                <label className="form-label">Trial Name *</label>
                                <input className="form-input" value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} placeholder='e.g., "NASH-FIB Phase III"' required />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Protocol Number</label>
                                    <input className="form-input" value={createForm.protocol_number} onChange={e => setCreateForm({ ...createForm, protocol_number: e.target.value })} placeholder="e.g., NASH-301" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Specialty</label>
                                    <input className="form-input" value={createForm.specialty} onChange={e => setCreateForm({ ...createForm, specialty: e.target.value })} placeholder="e.g., Hepatology" />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea className="form-textarea" rows={3} value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })} placeholder="Brief study description…" />
                            </div>
                            <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-4)' }}>
                                After creating, you can upload the protocol PDF, define eligibility criteria, signal rules, and visit schedule on the trial detail page.
                            </p>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Create Trial</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
