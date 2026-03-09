import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { StatusBadge, formatDate, ALL_STATUSES, STATUS_CONFIG } from '../utils';
import type { ScreeningCaseRow, Trial } from '../types';

export default function ScreeningCasesPage() {
    const [cases, setCases] = useState<ScreeningCaseRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const [trialFilter, setTrialFilter] = useState('');
    const [trials, setTrials] = useState<Trial[]>([]);
    const navigate = useNavigate();

    useEffect(() => { api.getTrials().then(setTrials).catch(() => {}); }, []);

    useEffect(() => {
        setLoading(true);
        const params: Record<string, string> = {};
        if (statusFilter) params.status = statusFilter;
        if (trialFilter) params.trial_id = trialFilter;
        api.getScreeningCases(params).then(d => setCases(d.cases)).catch(console.error).finally(() => setLoading(false));
    }, [statusFilter, trialFilter]);

    return (
        <div>
            <div className="page-header">
                <h1>Screening Cases</h1>
                <p>All patient screening instances across trials</p>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-6)', flexWrap: 'wrap', alignItems: 'center' }}>
                <div className="filters" style={{ marginBottom: 0 }}>
                    <button className={`filter-pill ${statusFilter === '' ? 'active' : ''}`} onClick={() => setStatusFilter('')}>All</button>
                    {ALL_STATUSES.map(s => (
                        <button key={s} className={`filter-pill ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
                            {STATUS_CONFIG[s].label}
                        </button>
                    ))}
                </div>
                <select className="form-select" style={{ width: 'auto', minWidth: 180, fontSize: 'var(--font-xs)' }} value={trialFilter} onChange={e => setTrialFilter(e.target.value)}>
                    <option value="">All Trials</option>
                    {trials.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
            </div>

            {loading ? (
                <div className="loading-spinner"><div className="spinner" /></div>
            ) : cases.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">◎</div>
                    <h3>No screening cases found</h3>
                    <p>Adjust your filters or create a new case from a patient page.</p>
                </div>
            ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Patient</th>
                                <th>Trial</th>
                                <th>Status</th>
                                <th>CRC</th>
                                <th>Pending</th>
                                <th>Revisit</th>
                                <th>Updated</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cases.map(sc => (
                                <tr key={sc.id} onClick={() => navigate(`/screening/${sc.id}`)}>
                                    <td className="patient-name">{sc.last_name}, {sc.first_name}</td>
                                    <td style={{ fontSize: 'var(--font-sm)' }}>{sc.trial_name}</td>
                                    <td><StatusBadge status={sc.status} /></td>
                                    <td className="meta">{sc.assigned_user_name || '—'}</td>
                                    <td className="meta">
                                        {sc.pending_items_open > 0 ? (
                                            <span style={{ color: 'var(--status-in-review)' }}>{sc.pending_items_open} open</span>
                                        ) : '—'}
                                    </td>
                                    <td className="meta">{sc.revisit_date ? formatDate(sc.revisit_date) : '—'}</td>
                                    <td className="meta">{formatDate(sc.updated_at)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
