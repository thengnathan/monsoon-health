import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { StatusBadge, formatDate, formatDateTime, isOverdue } from '../utils';
import { Icon } from '../components/Icon';
import type { TodayData, UpcomingVisit, NotificationEvent } from '../types';

export default function DashboardPage() {
    const [data, setData] = useState<TodayData | null>(null);
    const [upcomingVisits, setUpcomingVisits] = useState<UpcomingVisit[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    // silent = background refresh: don't show the skeleton or clobber the screen
    // with an error if it fails — just keep the last good data.
    const load = useCallback((silent = false) => {
        if (!silent) setLoading(true);
        Promise.all([
            api.getToday(),
            api.getUpcomingVisits().catch(() => [] as UpcomingVisit[])
        ]).then(([todayData, visits]) => {
            setData(todayData);
            setUpcomingVisits(visits);
            setError(null);
        }).catch((err: unknown) => {
            console.error(err);
            if (!silent) setError(err instanceof Error ? err.message : 'Failed to load dashboard');
        }).finally(() => { if (!silent) setLoading(false); });
    }, []);

    useEffect(() => { load(); }, [load]);

    // Keep a long-lived dashboard current: silent refetch on tab focus and every
    // 60s while visible. No skeleton flash, no interruption.
    useEffect(() => {
        const onVisible = () => { if (document.visibilityState === 'visible') load(true); };
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('focus', onVisible);
        const interval = setInterval(onVisible, 60000);
        return () => {
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener('focus', onVisible);
            clearInterval(interval);
        };
    }, [load]);

    if (loading) return <DashboardSkeleton />;

    if (error || !data) {
        return (
            <div className="empty-state" style={{ maxWidth: 420, margin: '4rem auto' }}>
                <div className="empty-state-icon"><Icon name="alert" size={40} strokeWidth={1.5} /></div>
                <h3>Couldn't load your dashboard</h3>
                <p style={{ marginBottom: 'var(--space-6)' }}>{error || 'No data returned.'}</p>
                <button className="btn btn-primary" onClick={() => load()}>Try again</button>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <h1>Today</h1>
                <p>Your screening overview — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            </div>

            {/* Stats */}
            <div className="stats-grid">
                <StatCard label="Active Cases" value={data.stats.total_active_cases} accent onClick={() => navigate('/screening')} />
                <StatCard label="Open Items" value={data.stats.pending_items_open} />
                <StatCard label="Patients" value={data.stats.total_patients} onClick={() => navigate('/patients')} />
                <StatCard label="Active Trials" value={data.stats.active_trials} onClick={() => navigate('/trials')} />
                <StatCard label="Enrolled" value={data.stats.cases_enrolled} valueColor="var(--status-enrolled)" onClick={() => navigate('/screening?status=ENROLLED')} />
            </div>

            <div className="detail-grid">
                <div>
                    {/* Active Cases */}
                    <div className="detail-section animate-in">
                        <div className="detail-section-title">Active Cases — Needs Attention</div>
                        {data.active_cases.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon"><Icon name="check-circle" size={40} strokeWidth={1.5} /></div>
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
                                    <div className={`alert-icon pending`}><Icon name="clipboard" /></div>
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
                                    <div className="alert-icon" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}><Icon name="calendar" /></div>
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
                                    <div className="alert-icon revisit"><Icon name="refresh" /></div>
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
                                            <Icon name={alert.type === 'THRESHOLD_CROSSED' ? 'bolt' : alert.type === 'REVISIT_DUE' ? 'refresh' : alert.type === 'VISIT_REMINDER' ? 'calendar' : 'check'} />
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
                                                {' · '}{formatDateTime(alert.created_at)}
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

// Stat card — clickable when given onClick (cursor + keyboard activation).
function StatCard({ label, value, accent, valueColor, onClick }: {
    label: string;
    value: number;
    accent?: boolean;
    valueColor?: string;
    onClick?: () => void;
}) {
    return (
        <div
            className="stat-card animate-in"
            onClick={onClick}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
            style={onClick ? { cursor: 'pointer' } : undefined}
        >
            <div className="stat-label">{label}</div>
            <div className={`stat-value${accent ? ' accent' : ''}`} style={valueColor ? { color: valueColor } : undefined}>{value}</div>
        </div>
    );
}

// Skeleton placeholder shown while the dashboard loads — mirrors the real layout.
function DashboardSkeleton() {
    return (
        <div>
            <div className="page-header">
                <div className="skeleton" style={{ width: 160, height: 30, marginBottom: 10 }} />
                <div className="skeleton" style={{ width: 320, height: 16 }} />
            </div>
            <div className="stats-grid">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="stat-card">
                        <div className="skeleton" style={{ width: 80, height: 12, marginBottom: 14 }} />
                        <div className="skeleton" style={{ width: 48, height: 28 }} />
                    </div>
                ))}
            </div>
            <div className="detail-grid">
                <div>{[0, 1].map(s => <SkeletonSection key={s} rows={3} />)}</div>
                <div>{[0, 1].map(s => <SkeletonSection key={s} rows={2} />)}</div>
            </div>
        </div>
    );
}

function SkeletonSection({ rows }: { rows: number }) {
    return (
        <div className="detail-section">
            <div className="skeleton" style={{ width: 180, height: 14, marginBottom: 18 }} />
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="alert-card" style={{ alignItems: 'center' }}>
                    <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 6 }} />
                    <div style={{ flex: 1 }}>
                        <div className="skeleton" style={{ width: '60%', height: 14, marginBottom: 8 }} />
                        <div className="skeleton" style={{ width: '40%', height: 11 }} />
                    </div>
                </div>
            ))}
        </div>
    );
}
