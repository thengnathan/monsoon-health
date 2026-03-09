import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { StatusBadge, formatDate, isOverdue } from '../utils';
import type { TodayData, UpcomingVisit, NotificationEvent } from '../types';

export default function DashboardPage() {
    const [data, setData] = useState<TodayData | null>(null);
    const [upcomingVisits, setUpcomingVisits] = useState<UpcomingVisit[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        Promise.all([
            api.getToday(),
            api.getUpcomingVisits().catch(() => [] as UpcomingVisit[])
        ]).then(([todayData, visits]) => {
            setData(todayData);
            setUpcomingVisits(visits);
        }).catch(console.error).finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
    if (!data) return null;

    return (
        <div>
            <div className="page-header">
                <h1>Today</h1>
                <p>Your screening overview — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            </div>

            {/* Stats */}
            <div className="stats-grid">
                <div className="stat-card animate-in">
                    <div className="stat-label">Active Cases</div>
                    <div className="stat-value accent">{data.stats.total_active_cases}</div>
                </div>
                <div className="stat-card animate-in">
                    <div className="stat-label">Open Items</div>
                    <div className="stat-value">{data.stats.pending_items_open}</div>
                </div>
                <div className="stat-card animate-in">
                    <div className="stat-label">Patients</div>
                    <div className="stat-value">{data.stats.total_patients}</div>
                </div>
                <div className="stat-card animate-in">
                    <div className="stat-label">Active Trials</div>
                    <div className="stat-value">{data.stats.active_trials}</div>
                </div>
                <div className="stat-card animate-in">
                    <div className="stat-label">Enrolled</div>
                    <div className="stat-value" style={{ color: 'var(--status-enrolled)' }}>{data.stats.cases_enrolled}</div>
                </div>
            </div>

            <div className="detail-grid">
                <div>
                    {/* Active Cases */}
                    <div className="detail-section animate-in">
                        <div className="detail-section-title">Active Cases — Needs Attention</div>
                        {data.active_cases.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">✓</div>
                                <h3>All caught up</h3>
                                <p>No screening cases needing immediate attention.</p>
                            </div>
                        ) : (
                            data.active_cases.map(sc => (
                                <div key={sc.id} className="alert-card" onClick={() => navigate(`/screening/${sc.id}`)} style={{ cursor: 'pointer' }}>
                                    <div className="alert-content">
                                        <div className="alert-title">{sc.first_name} {sc.last_name}</div>
                                        <div className="alert-meta">
                                            {sc.trial_name} · <StatusBadge status={sc.status} /> · {sc.assigned_user_name || 'Unassigned'}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Pending Items Due */}
                    <div className="detail-section animate-in">
                        <div className="detail-section-title">Pending Items Due</div>
                        {data.pending_items_due.length === 0 ? (
                            <div className="empty-state" style={{ padding: '2rem' }}>
                                <p>No items due this week</p>
                            </div>
                        ) : (
                            data.pending_items_due.map(pi => (
                                <div key={pi.id} className="alert-card" onClick={() => navigate(`/screening/${pi.screening_case_id}`)} style={{ cursor: 'pointer' }}>
                                    <div className={`alert-icon pending`}>📋</div>
                                    <div className="alert-content">
                                        <div className="alert-title">{pi.name}</div>
                                        <div className="alert-meta">
                                            {pi.first_name} {pi.last_name} · {pi.trial_name}
                                            {pi.due_date && (
                                                <span style={{ color: isOverdue(pi.due_date) ? 'var(--error)' : 'inherit' }}>
                                                    {' '}· Due {formatDate(pi.due_date)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <span className="checklist-type">{pi.type}</span>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Upcoming Visits */}
                    {upcomingVisits.length > 0 && (
                        <div className="detail-section animate-in">
                            <div className="detail-section-title">Upcoming Visits (Next 7 days)</div>
                            {upcomingVisits.map(v => (
                                <div key={v.id} className="alert-card" onClick={() => navigate(`/screening/${v.screening_case_id}`)} style={{ cursor: 'pointer' }}>
                                    <div className="alert-icon" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>📅</div>
                                    <div className="alert-content">
                                        <div className="alert-title">{v.first_name} {v.last_name} — {v.visit_name}</div>
                                        <div className="alert-meta">
                                            {v.trial_name} · {formatDate(v.scheduled_date)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div>
                    {/* Revisit Due */}
                    <div className="detail-section animate-in">
                        <div className="detail-section-title">Revisit Due</div>
                        {data.revisit_due.length === 0 ? (
                            <div className="empty-state" style={{ padding: '2rem' }}>
                                <p>No revisits due this week</p>
                            </div>
                        ) : (
                            data.revisit_due.map(sc => (
                                <div key={sc.id} className="alert-card" onClick={() => navigate(`/screening/${sc.id}`)} style={{ cursor: 'pointer' }}>
                                    <div className="alert-icon revisit">↻</div>
                                    <div className="alert-content">
                                        <div className="alert-title">{sc.first_name} {sc.last_name}</div>
                                        <div className="alert-meta">
                                            {sc.trial_name} · Revisit {formatDate(sc.revisit_date)}
                                        </div>
                                        {sc.fail_reason_label && (
                                            <div className="alert-meta" style={{ marginTop: 2 }}>Reason: {sc.fail_reason_label}</div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Recent Alerts */}
                    <div className="detail-section animate-in">
                        <div className="detail-section-title">Recent Alerts</div>
                        {data.recent_alerts.length === 0 ? (
                            <div className="empty-state" style={{ padding: '2rem' }}>
                                <p>No recent alerts</p>
                            </div>
                        ) : (
                            data.recent_alerts.slice(0, 8).map((alert: NotificationEvent) => {
                                const payload = typeof alert.payload === 'string' ? JSON.parse(alert.payload) as Record<string, string> : alert.payload as Record<string, string>;
                                return (
                                    <div key={alert.id} className="alert-card" onClick={() => alert.screening_case_id && navigate(`/screening/${alert.screening_case_id}`)} style={{ cursor: alert.screening_case_id ? 'pointer' : 'default' }}>
                                        <div className={`alert-icon ${alert.type === 'THRESHOLD_CROSSED' ? 'threshold' : alert.type === 'REVISIT_DUE' ? 'revisit' : 'pending'}`}>
                                            {alert.type === 'THRESHOLD_CROSSED' ? '⚡' : alert.type === 'REVISIT_DUE' ? '↻' : alert.type === 'VISIT_REMINDER' ? '📅' : '✓'}
                                        </div>
                                        <div className="alert-content">
                                            <div className="alert-title">
                                                {alert.type === 'THRESHOLD_CROSSED' && `Signal match: ${payload.signal_label || payload.signal_type}`}
                                                {alert.type === 'REVISIT_DUE' && `Revisit due: ${payload.patient_name}`}
                                                {alert.type === 'PENDING_ITEM_COMPLETED' && `Item completed: ${payload.item_name}`}
                                                {alert.type === 'VISIT_REMINDER' && `Visit reminder: ${payload.patient_name} — ${payload.visit_name}`}
                                            </div>
                                            <div className="alert-meta">
                                                {alert.first_name && `${alert.first_name} ${alert.last_name}`}
                                                {alert.trial_name && ` · ${alert.trial_name}`}
                                                {' · '}{formatDate(alert.created_at)}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
