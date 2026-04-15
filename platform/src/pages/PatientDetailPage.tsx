import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { useToast } from '../contexts/ToastContext';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import { StatusBadge, formatDate } from '../utils';
import PDFViewerModal from '../components/PDFViewerModal';
import { Select } from '../components/Select';
import type {
    PatientDetail, PatientClinicalData, SignalType, Trial,
    LabValue, VitalValue, ImagingResult, ClinicalDiagnosis,
    ProtocolSignal, SignalRuleAlignment, UploadResult, PatientSpecialty,
} from '../types';

const SPECIALTY_META: Record<PatientSpecialty, { label: string; color: string; bg: string }> = {
    HEPATOLOGY: { label: 'Hepatology', color: '#4a90c4', bg: 'rgba(74,144,196,0.12)' },
    ONCOLOGY:   { label: 'Oncology',   color: '#c4744a', bg: 'rgba(196,116,74,0.12)' },
    HEMATOLOGY: { label: 'Hematology', color: '#7a4ac4', bg: 'rgba(122,74,196,0.12)' },
};

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
                <button className="btn btn-sm btn-ghost" style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-xs)' }} onClick={() => setShowTimeline(v => !v)}>
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
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{
                        fontWeight: 500, fontSize: 'var(--font-sm)', color: 'var(--text-secondary)',
                        flex: '1 1 0', minWidth: 0,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }} title={type}>{type}</span>
                    <span style={{ fontWeight: 700, fontSize: 'var(--font-lg)', color: 'var(--text-primary)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {img.value !== undefined
                            ? <>{img.value}<span style={{ fontWeight: 400, fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)', marginLeft: 4 }}>{img.unit}</span></>
                            : img.findings
                                ? <span style={{ fontWeight: 400, fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>{img.findings}</span>
                                : <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>—</span>
                        }
                    </span>
                    {img.date && <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', flexShrink: 0 }}>{formatDate(img.date)}</span>}
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

// ── Match History ─────────────────────────────────────────────────────────────

function MatchHistorySection({ signals }: { signals: ProtocolSignal[] }) {
    const [expanded, setExpanded] = useState<string | null>(null);

    if (signals.length === 0) {
        return <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)', padding: 'var(--space-2) 0' }}>No AI matching has been run yet.</div>;
    }

    const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
        LIKELY_ELIGIBLE:   { bg: '#d4edda', text: '#155724', label: 'Likely Eligible' },
        BORDERLINE:        { bg: '#fff3cd', text: '#856404', label: 'Borderline' },
        LIKELY_INELIGIBLE: { bg: '#f8d7da', text: '#721c24', label: 'Likely Ineligible' },
    };
    const CONFIDENCE_COLOR: Record<string, string> = { HIGH: '#155724', MEDIUM: '#856404', LOW: '#6c757d' };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {signals.map(sig => {
                const sc = STATUS_STYLE[sig.overall_status] || STATUS_STYLE.BORDERLINE;
                const isExpanded = expanded === sig.id;
                return (
                    <div key={sig.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                        <div
                            style={{ padding: 'var(--space-3)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
                            onClick={() => setExpanded(isExpanded ? null : sig.id)}
                        >
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)', marginBottom: 4 }}>{sig.trial_name}</div>
                                {sig.protocol_number && <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginBottom: 6 }}>{sig.protocol_number}</div>}
                                <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>{sig.summary}</div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, marginLeft: 'var(--space-3)', flexShrink: 0 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 10, background: sc.bg, color: sc.text }}>{sc.label}</span>
                                <span style={{ fontSize: 10, color: CONFIDENCE_COLOR[sig.confidence] || '#6c757d' }}>{sig.confidence} confidence</span>
                                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{formatDate(sig.last_evaluated_at)}</span>
                            </div>
                        </div>
                        {isExpanded && (
                            <div style={{ borderTop: '1px solid var(--border)', padding: 'var(--space-3)', background: 'var(--bg-secondary)' }}>
                                {sig.missing_data.length > 0 && (
                                    <div style={{ marginBottom: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', background: '#fff3cd', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-xs)', color: '#856404' }}>
                                        <strong>Missing data:</strong> {sig.missing_data.join(', ')}
                                    </div>
                                )}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {sig.criteria_breakdown.map((c, i) => (
                                        <div key={i} style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start', fontSize: 'var(--font-xs)' }}>
                                            <span style={{ flexShrink: 0, fontWeight: 700, color: c.status === 'PASS' ? '#155724' : c.status === 'FAIL' ? '#721c24' : '#6c757d' }}>
                                                {c.status === 'PASS' ? '✓' : c.status === 'FAIL' ? '✗' : '?'}
                                            </span>
                                            <div>
                                                <span style={{ color: 'var(--text-tertiary)' }}>[{c.type}]</span>{' '}
                                                <span style={{ color: 'var(--text-primary)' }}>{c.criterion}</span>
                                                {c.reason && <div style={{ color: 'var(--text-tertiary)', marginTop: 2, fontStyle: 'italic' }}>{c.reason}</div>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ── Signal-Rule Alignment ─────────────────────────────────────────────────────

function SignalAlignmentSection({ alignment }: { alignment: SignalRuleAlignment[] }) {
    if (alignment.length === 0) {
        return <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)', padding: 'var(--space-2) 0' }}>No active trial signal rules found.</div>;
    }

    const byTrial = alignment.reduce<Record<string, { name: string; protocol_number: string | null; rules: SignalRuleAlignment[] }>>((acc, item) => {
        if (!acc[item.trial_id]) acc[item.trial_id] = { name: item.trial_name, protocol_number: item.protocol_number, rules: [] };
        acc[item.trial_id].rules.push(item);
        return acc;
    }, {});

    const formatThreshold = (r: SignalRuleAlignment): string => {
        const u = r.unit ? ` ${r.unit}` : '';
        switch (r.operator) {
            case 'GTE': return `≥ ${r.threshold_number}${u}`;
            case 'LTE': return `≤ ${r.threshold_number}${u}`;
            case 'EQ':  return `= ${r.threshold_number ?? r.threshold_text}${u}`;
            case 'BETWEEN': return `${r.min_value}–${r.max_value}${u}`;
            case 'IN': { try { return `in [${(JSON.parse(r.threshold_list || '[]') as string[]).join(', ')}]`; } catch { return r.threshold_list || '—'; } }
            default: return r.threshold_text || '—';
        }
    };

    const formatPatientValue = (r: SignalRuleAlignment): string => {
        const val = r.patient_value_number ?? r.patient_value_enum ?? r.patient_value_text;
        if (val === null || val === undefined) return '—';
        return `${val}${r.unit ? ` ${r.unit}` : ''}`;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            {Object.entries(byTrial).map(([trialId, trial]) => {
                const pass = trial.rules.filter(r => r.passes === true).length;
                const fail = trial.rules.filter(r => r.passes === false).length;
                const nodata = trial.rules.filter(r => r.passes === null).length;
                return (
                    <div key={trialId}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                            <div>
                                <span style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>{trial.name}</span>
                                {trial.protocol_number && <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginLeft: 8 }}>{trial.protocol_number}</span>}
                            </div>
                            <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                                {pass > 0 && <span style={{ color: '#155724', fontWeight: 600 }}>{pass} pass</span>}
                                {fail > 0 && <span style={{ color: '#721c24', fontWeight: 600 }}>{fail} fail</span>}
                                {nodata > 0 && <span style={{ color: 'var(--text-tertiary)' }}>{nodata} no data</span>}
                            </div>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-xs)' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <th style={{ textAlign: 'left', padding: '4px 6px', color: 'var(--text-tertiary)', fontWeight: 600 }}>Signal</th>
                                    <th style={{ textAlign: 'left', padding: '4px 6px', color: 'var(--text-tertiary)', fontWeight: 600 }}>Rule</th>
                                    <th style={{ textAlign: 'right', padding: '4px 6px', color: 'var(--text-tertiary)', fontWeight: 600 }}>Patient Value</th>
                                    <th style={{ width: 24, padding: '4px 6px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {trial.rules.map(rule => (
                                    <tr key={rule.rule_id} style={{ borderBottom: '1px solid var(--border-light, var(--border))' }}>
                                        <td style={{ padding: '6px', fontWeight: 500 }}>{rule.signal_label}</td>
                                        <td style={{ padding: '6px', color: 'var(--text-secondary)' }}>{formatThreshold(rule)}</td>
                                        <td style={{ padding: '6px', textAlign: 'right', fontWeight: rule.passes !== null ? 600 : 400, color: rule.passes === true ? '#155724' : rule.passes === false ? '#721c24' : 'var(--text-tertiary)' }}>
                                            {formatPatientValue(rule)}
                                            {rule.patient_signal_date && <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 4 }}>({formatDate(rule.patient_signal_date)})</span>}
                                        </td>
                                        <td style={{ padding: '6px', textAlign: 'center', fontSize: 13, fontWeight: 700 }}>
                                            {rule.passes === true && <span style={{ color: '#155724' }}>✓</span>}
                                            {rule.passes === false && <span style={{ color: '#721c24' }}>✗</span>}
                                            {rule.passes === null && <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            })}
        </div>
    );
}

// ── Extraction Review Modal ───────────────────────────────────────────────────

function ExtractionReviewModal({ result, onMatch, matching, onClose }: {
    result: UploadResult; onMatch: () => void; matching: boolean; onClose: () => void;
}) {
    const s = result.extraction_summary;
    const counts = s ? [
        { label: 'conditions', val: s.diagnoses_count },
        { label: 'medications', val: s.medications_count },
        { label: 'labs', val: s.labs_count },
        { label: 'vitals', val: s.vitals_count },
        { label: 'imaging', val: s.imaging_count },
    ].filter(c => c.val > 0) : [];

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal">
                <div className="modal-header">
                    <h3 className="modal-title">Extraction Complete</h3>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                {counts.length > 0 && (
                    <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
                        {counts.map(c => (
                            <div key={c.label} style={{ textAlign: 'center' }}>
                                <div style={{ fontWeight: 700, fontSize: 'var(--font-xl, 1.25rem)' }}>{c.val}</div>
                                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>{c.label}</div>
                            </div>
                        ))}
                    </div>
                )}

                {s?.key_labs && s.key_labs.length > 0 && (
                    <div style={{ marginBottom: 'var(--space-4)' }}>
                        <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Key Values</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-sm)' }}>
                            <tbody>
                                {s.key_labs.map((lab, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '5px 0', fontWeight: 500 }}>{lab.name}</td>
                                        <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 600 }}>
                                            {String(lab.value)}
                                            {lab.unit && <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 4, fontSize: 11 }}>{lab.unit}</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {result.signals_created?.length > 0 && (
                    <div style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
                        Signals recorded: {result.signals_created.join(', ')}
                    </div>
                )}

                <div style={{ padding: 'var(--space-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
                    Run AI matching to check this patient against all active trials with extracted eligibility criteria.
                </div>

                <div className="modal-actions">
                    <button className="btn btn-secondary" onClick={onClose}>Close</button>
                    <button className="btn btn-primary" onClick={onMatch} disabled={matching}>
                        {matching ? 'Matching…' : 'Match Against Active Trials'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Main page ────────────────────────────────────────────────────────────────

interface SigForm { signal_type_id: string; value: string; collected_at: string; source: string; }
interface CaseForm { trial_id: string; status: string; }

type Tab = 'clinical' | 'diagnoses' | 'trials' | 'documents';

export default function PatientDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const { isSectionVisible, profileConfig, templates } = useSiteConfig();

    const [patient, setPatient] = useState<PatientDetail | null>(null);
    const [clinicalData, setClinicalData] = useState<PatientClinicalData | null>(null);
    const [protocolSignals, setProtocolSignals] = useState<ProtocolSignal[]>([]);
    const [signalAlignment, setSignalAlignment] = useState<SignalRuleAlignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>('clinical');
    const [showSignalModal, setShowSignalModal] = useState(false);
    const [showCaseModal, setShowCaseModal] = useState(false);
    const [signalTypes, setSignalTypes] = useState<SignalType[]>([]);
    const [trials, setTrials] = useState<Trial[]>([]);
    const [uploading, setUploading] = useState(false);
    const [matching, setMatching] = useState(false);
    const [extractionReview, setExtractionReview] = useState<UploadResult | null>(null);
    const [pdfViewer, setPdfViewer] = useState<{ url: string; filename: string } | null>(null);
    const [updatingSpecialty, setUpdatingSpecialty] = useState(false);
    const docFileRef = useRef<HTMLInputElement>(null);

    const [sigForm, setSigForm] = useState<SigForm>({
        signal_type_id: '', value: '', collected_at: new Date().toISOString().split('T')[0], source: '',
    });
    const [caseForm, setCaseForm] = useState<CaseForm>({ trial_id: '', status: 'NEW' });

    const loadPatient = () => {
        if (!id) return;
        api.getPatient(id).then(setPatient).catch(console.error);
        api.getPatientClinicalData(id).then(setClinicalData).catch(() => setClinicalData(null));
        api.getPatientProtocolSignals(id).then(setProtocolSignals).catch(() => {});
        api.getSignalRuleAlignment(id).then(setSignalAlignment).catch(() => {});
    };

    useEffect(() => {
        setLoading(true);
        if (!id) return;
        Promise.all([
            api.getPatient(id).then(setPatient),
            api.getPatientClinicalData(id).then(setClinicalData).catch(() => setClinicalData(null)),
            api.getSignalTypes().then(setSignalTypes).catch(() => {}),
            api.getTrials({ status: 'ACTIVE' }).then(setTrials).catch(() => {}),
            api.getPatientProtocolSignals(id).then(setProtocolSignals).catch(() => {}),
            api.getSignalRuleAlignment(id).then(setSignalAlignment).catch(() => {}),
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

    const handleSpecialtyChange = async (specialty: PatientSpecialty | '') => {
        setUpdatingSpecialty(true);
        try {
            await api.updatePatient(patient!.id, { specialty: specialty || null });
            await loadPatient();
        } catch (err) { addToast((err as Error).message, 'error'); }
        setUpdatingSpecialty(false);
    };

    const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const result = await api.uploadPatientDocument(file, { patient_id: id });
            addToast('Document uploaded — data extracted', 'success');
            setExtractionReview(result);
            loadPatient();
        } catch (err) {
            addToast((err as Error).message, 'error');
        }
        setUploading(false);
        if (docFileRef.current) docFileRef.current.value = '';
    };

    const handleMatchNow = async () => {
        setMatching(true);
        try {
            const result = await api.matchPatient(id!);
            const eligible = result.results.filter(r => r.overall_status === 'LIKELY_ELIGIBLE').length;
            const borderline = result.results.filter(r => r.overall_status === 'BORDERLINE').length;
            if (result.matched === 0) {
                addToast('No active trials with extracted criteria to match against.', 'info');
            } else {
                addToast(`Matched ${result.matched} trial(s): ${eligible} likely eligible, ${borderline} borderline`, eligible > 0 ? 'success' : 'info');
            }
            setExtractionReview(null);
            loadPatient();
            if (eligible > 0 || borderline > 0) setActiveTab('trials');
        } catch (err) {
            addToast((err as Error).message, 'error');
        }
        setMatching(false);
    };

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
    if (!patient) return <div className="empty-state"><h3>Patient not found</h3></div>;

    const age = patient.dob
        ? Math.floor((Date.now() - new Date(patient.dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
        : null;

    // Build enabled options map from active specialty templates
    const enabledSet = new Set(profileConfig?.enabled_options || []);
    const hasConfig = enabledSet.size > 0;

    const getEnabledOptions = (section: string) => {
        if (!hasConfig || !profileConfig?.specialties?.length || !templates) return null;
        const opts: { id: string; label: string }[] = [];
        for (const key of profileConfig.specialties) {
            for (const opt of templates[key]?.options || []) {
                if (opt.section === section && enabledSet.has(opt.id)) {
                    opts.push(opt);
                }
            }
        }
        return opts;
    };

    // Fuzzy-match extracted data (labs/vitals/imaging) by option label
    const matchExtracted = (record: Record<string, { value: unknown; unit?: string; date?: string; flag?: string | null; findings?: string }>, label: string) => {
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
        const needle = norm(label);
        const labelWords = label.toLowerCase().split(/[\s\/\(\)\-,]+/).map(norm).filter(Boolean);

        // Explicit clinical aliases only — normalized label → normalized extracted key synonyms.
        // Add new entries here as new extraction patterns are discovered.
        const ALIASES: Record<string, string[]> = {
            // Hepatology — imaging
            'fibroscanlsm':              ['vcte', 'lsm', 'liverstiffness', 'fibroscankpa', 'transientelastography', 'fibroscanvcte', 'fibroscanliverstiffnessvcte', 'fibroscanliverstiffness'],
            'fibroscancapscore':         ['cap', 'capscore', 'controlledattenuation', 'controlledattenuationparameter', 'fibroscancap', 'fibroscancapcontrolledattenuationparameter', 'fibroscancapcontrolledattenuation'],
            'liverultrasound':           ['liverus', 'hepaticultrasound', 'rueultrasound', 'abdominultrasound'],
            'ctabdomen':                 ['ctabd', 'ctabdomen', 'ctabdpelvis', 'computedtomographyabdomen'],
            'mriliver':                  ['mriabdomen', 'mrcp', 'hepaticmri', 'livermri'],
            // Hepatology — labs
            'alt':                       ['sgpt', 'alanineaminotransferase'],
            'ast':                       ['sgot', 'aspartateaminotransferase'],
            'ggt':                       ['gammaglutamyltransferase', 'gammaglutamyltranspeptidase'],
            'alkalinephosphatase':       ['alkphos', 'alp', 'alkp'],
            'totalbilirubin':            ['tbili', 'totalbili', 'bilirubin'],
            'directbilirubin':           ['dbili', 'directbili', 'conjugatedbilirubin'],
            'albumin':                   ['serumalbumin'],
            'plateletcount':             ['platelets', 'plt'],
            'inr':                       ['prothrombintime', 'pt'],
            'hemoglobin':                ['hgb', 'hb'],
            'whitebloodcell':            ['wbc', 'whitebloodcellcount', 'leukocytes'],
            'creatinine':                ['scr', 'serumcreatinine'],
            'sodiumna':                  ['sodium', 'serumna', 'na'],
        };
        const aliases = ALIASES[needle] ?? [];

        for (const [name, val] of Object.entries(record)) {
            const hay = norm(name);
            const nameWords = name.toLowerCase().split(/[\s\/\(\)\-,]+/).map(norm).filter(Boolean);

            if (
                hay === needle ||                              // exact normalized match
                nameWords.some(w => w === needle) ||          // one extracted word equals full normalized label
                labelWords.some(w => w === hay && w.length >= 4) ||  // full extracted name equals a label word (min 4 chars)
                aliases.includes(hay) ||                       // direct alias
                nameWords.some(w => aliases.includes(w))       // alias found within extracted name words
            ) {
                return { name, val };
            }
        }
        return null;
    };

    const TAB_LABELS: Record<Tab, string> = {
        clinical:  'Clinical',
        diagnoses: 'Diagnoses & History',
        trials:    `Trials${protocolSignals.length > 0 ? ` (${protocolSignals.length})` : ''}`,
        documents: `Documents${patient.documents?.length ? ` (${(patient.documents as unknown[]).length})` : ''}`,
    };

    const specialtyColor = patient.specialty ? SPECIALTY_META[patient.specialty].color : 'var(--accent)';
    const initials = `${patient.first_name[0] ?? ''}${patient.last_name[0] ?? ''}`.toUpperCase();

    return (
        <div>
            <input ref={docFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleDocUpload} style={{ display: 'none' }} />

            {/* ── Two-panel layout ── */}
            <div style={{ display: 'flex', gap: 'var(--space-5)', alignItems: 'flex-start' }}>

                {/* ── Left Sidebar ── */}
                <aside style={{ width: 232, flexShrink: 0, position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>

                    {/* Back */}
                    <Link to="/patients" style={{ color: 'var(--text-tertiary)', textDecoration: 'none', fontSize: 'var(--font-sm)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        ← Patients
                    </Link>

                    {/* Identity card */}
                    <div className="card" style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        {/* Avatar */}
                        <div style={{
                            width: 56, height: 56, borderRadius: '50%',
                            background: patient.specialty ? SPECIALTY_META[patient.specialty].bg : 'var(--accent-muted)',
                            border: `2px solid ${specialtyColor}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 20, fontWeight: 700, color: specialtyColor,
                            marginBottom: 12,
                        }}>
                            {initials}
                        </div>

                        {/* Name */}
                        <div style={{ fontWeight: 700, fontSize: 'var(--font-lg)', lineHeight: 1.2, marginBottom: 8 }}>
                            {patient.first_name} {patient.last_name}
                        </div>

                        {/* Specialty selector */}
                        <div style={{ marginBottom: 14 }}>
                            <Select
                                value={patient.specialty || ''}
                                onChange={val => handleSpecialtyChange(val as PatientSpecialty | '')}
                                disabled={updatingSpecialty}
                                options={[
                                    { value: '', label: 'Set specialty…' },
                                    ...(Object.keys(SPECIALTY_META) as PatientSpecialty[]).map(k => ({ value: k, label: SPECIALTY_META[k].label })),
                                ]}
                                style={patient.specialty ? {
                                    width: 'auto', fontSize: 11, fontWeight: 700, padding: '3px 10px',
                                    borderRadius: 'var(--radius-full)',
                                    background: SPECIALTY_META[patient.specialty as PatientSpecialty].bg,
                                    color: SPECIALTY_META[patient.specialty as PatientSpecialty].color,
                                    border: 'none', letterSpacing: '0.04em',
                                } : {
                                    width: 'auto', fontSize: 11, padding: '3px 10px',
                                    borderRadius: 'var(--radius-full)',
                                    background: 'transparent', border: '1px dashed var(--border-default)',
                                    color: 'var(--text-tertiary)',
                                }}
                            />
                        </div>

                        {/* Meta rows */}
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 5, fontSize: 'var(--font-sm)', textAlign: 'left' }}>
                            {age !== null && (
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-tertiary)' }}>Age</span>
                                    <span style={{ fontWeight: 500 }}>{age} yrs</span>
                                </div>
                            )}
                            {patient.dob && (
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-tertiary)' }}>DOB</span>
                                    <span style={{ fontWeight: 500 }}>{formatDate(patient.dob)}</span>
                                </div>
                            )}
                            {patient.internal_identifier && (
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-tertiary)' }}>MRN</span>
                                    <span style={{ fontWeight: 500 }}>{patient.internal_identifier}</span>
                                </div>
                            )}
                            {patient.referral_source_name && (
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-tertiary)' }}>Referred by</span>
                                    <span style={{ fontWeight: 500, textAlign: 'right', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{patient.referral_source_name}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Key Signals */}
                    {patient.signals && patient.signals.length > 0 && (
                        <div className="card" style={{ padding: 'var(--space-4)' }}>
                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 8 }}>
                                Key Values
                            </div>
                            {patient.signals.slice(0, 5).map(sig => (
                                <div key={sig.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 'var(--font-sm)' }}>
                                    <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>{sig.signal_label}</span>
                                    <span style={{ fontWeight: 600, flexShrink: 0, marginLeft: 4 }}>
                                        {sig.value_number != null ? sig.value_number : (sig.value_enum || sig.value_text || '—')}
                                        {sig.unit && <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', fontSize: 10, marginLeft: 2 }}>{sig.unit}</span>}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Quick stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {[
                            { label: 'Cases', value: patient.screening_cases?.length ?? 0 },
                            { label: 'Documents', value: (patient.documents as unknown[] | undefined)?.length ?? 0 },
                        ].map(({ label, value }) => (
                            <div key={label} className="card" style={{ padding: 'var(--space-3)', textAlign: 'center' }}>
                                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>{value}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingRight: '2.5rem' }}>
                        <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}
                            onClick={() => docFileRef.current?.click()} disabled={uploading}>
                            {uploading ? 'Uploading…' : '↑ Upload Document'}
                        </button>
                        <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}
                            onClick={() => setShowSignalModal(true)}>
                            + Record Signal
                        </button>
                        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
                            onClick={() => setShowCaseModal(true)}>
                            + Screening Case
                        </button>
                    </div>
                </aside>

                {/* ── Right Panel ── */}
                <main style={{ flex: 1, minWidth: 0 }}>

                    {/* Tab Bar */}
                    <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 'var(--space-5)' }}>
                        {(Object.keys(TAB_LABELS) as Tab[]).map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)} style={{
                                padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
                                fontSize: 'var(--font-sm)',
                                fontWeight: activeTab === tab ? 600 : 400,
                                color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-tertiary)',
                                borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                                marginBottom: -1, whiteSpace: 'nowrap',
                            }}>
                                {TAB_LABELS[tab]}
                            </button>
                        ))}
                    </div>

                    {/* ── Clinical Tab: Labs + Vitals (2-col) + Imaging + Signals ── */}
                    {activeTab === 'clinical' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', alignItems: 'start' }}>
                                {/* Labs */}
                                {isSectionVisible('labs') && (() => {
                                    const opts = getEnabledOptions('labs');
                                    if (opts && opts.length > 0) {
                                        const matchedNames = new Set<string>();
                                        return (
                                            <div className="detail-section">
                                                <SectionHeader title="Labs" />
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-sm)' }}>
                                                    <tbody>
                                                        {opts.map(opt => {
                                                            const match = clinicalData ? matchExtracted(clinicalData.labs_latest as Record<string, { value: unknown; unit?: string; date?: string; flag?: string | null }>, opt.label) : null;
                                                            if (match) matchedNames.add(match.name);
                                                            const lab = match?.val as LabValue | undefined;
                                                            return (
                                                                <tr key={opt.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                                    <td style={{ padding: '7px 0', color: 'var(--text-primary)', fontWeight: 500, width: '50%' }}>{opt.label}</td>
                                                                    <td style={{ padding: '7px 4px', fontWeight: 600, color: lab?.flag === 'critical' ? '#721c24' : lab?.flag ? '#856404' : 'var(--text-primary)' }}>
                                                                        {lab ? (
                                                                            <>
                                                                                {String(lab.value)}
                                                                                <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 4, fontSize: 11 }}>{lab.unit}</span>
                                                                                {lab.flag && <FlagBadge flag={lab.flag} />}
                                                                            </>
                                                                        ) : <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>—</span>}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                                {clinicalData && Object.keys(clinicalData.labs_latest).some(k => !matchedNames.has(k)) && (
                                                    <details style={{ marginTop: 'var(--space-3)' }}>
                                                        <summary style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', cursor: 'pointer', listStyle: 'none', userSelect: 'none' }}>▶ Additional extracted labs</summary>
                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-sm)', marginTop: 'var(--space-2)' }}>
                                                            <tbody>
                                                                {Object.entries(clinicalData.labs_latest).filter(([k]) => !matchedNames.has(k)).map(([name, lab]) => (
                                                                    <tr key={name} style={{ borderBottom: '1px solid var(--border)' }}>
                                                                        <td style={{ padding: '5px 0', color: 'var(--text-secondary)', width: '50%' }}>{name}</td>
                                                                        <td style={{ padding: '5px 4px', fontWeight: 600 }}>{String(lab.value)} <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', fontSize: 11 }}>{lab.unit}</span></td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </details>
                                                )}
                                            </div>
                                        );
                                    }
                                    return (
                                        <div className="detail-section">
                                            <SectionHeader title="Labs" count={clinicalData ? Object.keys(clinicalData.labs_latest).length : undefined} />
                                            {clinicalData
                                                ? <LabsSection latest={clinicalData.labs_latest} timeline={clinicalData.labs_timeline} />
                                                : <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)' }}>No lab data yet.</div>
                                            }
                                        </div>
                                    );
                                })()}

                                {/* Vitals */}
                                {isSectionVisible('vitals') && (() => {
                                    const opts = getEnabledOptions('vitals');
                                    if (opts && opts.length > 0) {
                                        const matchedNames = new Set<string>();
                                        return (
                                            <div className="detail-section">
                                                <SectionHeader title="Vitals" />
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-sm)' }}>
                                                    <tbody>
                                                        {opts.map(opt => {
                                                            const match = clinicalData ? matchExtracted(clinicalData.vitals_latest as Record<string, { value: unknown; unit?: string; date?: string }>, opt.label) : null;
                                                            if (match) matchedNames.add(match.name);
                                                            const v = match?.val as VitalValue | undefined;
                                                            return (
                                                                <tr key={opt.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                                    <td style={{ padding: '7px 0', fontWeight: 500, width: '50%' }}>{opt.label}</td>
                                                                    <td style={{ padding: '7px 4px', fontWeight: 600 }}>
                                                                        {v ? (
                                                                            <>{String(v.value)} <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', fontSize: 11 }}>{v.unit}</span></>
                                                                        ) : <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>—</span>}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                                {clinicalData && Object.keys(clinicalData.vitals_latest).some(k => !matchedNames.has(k)) && (
                                                    <details style={{ marginTop: 'var(--space-3)' }}>
                                                        <summary style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', cursor: 'pointer', listStyle: 'none', userSelect: 'none' }}>▶ Additional vitals</summary>
                                                        <div style={{ marginTop: 'var(--space-2)' }}>
                                                            {Object.entries(clinicalData.vitals_latest).filter(([k]) => !matchedNames.has(k)).map(([name, v]) => (
                                                                <div key={name} style={{ fontSize: 'var(--font-sm)', display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                                                                    <span style={{ color: 'var(--text-secondary)' }}>{name}</span>
                                                                    <span style={{ fontWeight: 600 }}>{String(v.value)} <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', fontSize: 11 }}>{v.unit}</span></span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </details>
                                                )}
                                            </div>
                                        );
                                    }
                                    return (
                                        <div className="detail-section">
                                            <SectionHeader title="Vitals" />
                                            {clinicalData && Object.keys(clinicalData.vitals_latest).length > 0
                                                ? <VitalsSection latest={clinicalData.vitals_latest} />
                                                : <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)' }}>No vitals recorded.</div>
                                            }
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Imaging — full width */}
                            {isSectionVisible('imaging') && (() => {
                                const opts = getEnabledOptions('imaging');
                                if (opts && opts.length > 0) {
                                    const matchedNames = new Set<string>();
                                    return (
                                        <div className="detail-section">
                                            <SectionHeader title="Imaging" />
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                {opts.map(opt => {
                                                    const match = clinicalData ? matchExtracted(clinicalData.imaging_latest as Record<string, { value: unknown; unit?: string; date?: string; findings?: string }>, opt.label) : null;
                                                    if (match) matchedNames.add(match.name);
                                                    const img = match?.val as ImagingResult | undefined;
                                                    return (
                                                        <div key={opt.id} style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                                                            <span style={{ fontWeight: 500, fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', flex: '0 0 auto', minWidth: 160 }}>{opt.label}</span>
                                                            <span style={{ fontWeight: 700, fontSize: 'var(--font-lg)', color: 'var(--text-primary)' }}>
                                                                {img?.value !== undefined ? (
                                                                    <>{img.value}<span style={{ fontWeight: 400, color: 'var(--text-tertiary)', fontSize: 'var(--font-sm)', marginLeft: 4 }}>{img.unit}</span></>
                                                                ) : img ? (
                                                                    <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: 'var(--font-sm)' }}>{img.findings || 'Result available'}</span>
                                                                ) : <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, fontSize: 'var(--font-sm)' }}>—</span>}
                                                            </span>
                                                            {img?.date && <span style={{ marginLeft: 'auto', color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)' }}>{formatDate(img.date)}</span>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {clinicalData && Object.keys(clinicalData.imaging_latest).some(k => !matchedNames.has(k)) && (
                                                <details style={{ marginTop: 'var(--space-3)' }}>
                                                    <summary style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', cursor: 'pointer', listStyle: 'none', userSelect: 'none' }}>▶ Additional imaging</summary>
                                                    <ImagingSection latest={Object.fromEntries(Object.entries(clinicalData.imaging_latest).filter(([k]) => !matchedNames.has(k)))} timeline={[]} />
                                                </details>
                                            )}
                                        </div>
                                    );
                                }
                                return (
                                    <div className="detail-section">
                                        <SectionHeader title="Imaging" count={clinicalData ? Object.keys(clinicalData.imaging_latest).length : undefined} />
                                        {clinicalData && Object.keys(clinicalData.imaging_latest).length > 0
                                            ? <ImagingSection latest={clinicalData.imaging_latest} timeline={clinicalData.imaging_timeline} />
                                            : <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)' }}>No imaging results recorded.</div>
                                        }
                                    </div>
                                );
                            })()}

                            {/* Recorded Signals */}
                            {isSectionVisible('signals') && (
                                <div className="detail-section">
                                    <SectionHeader title="Recorded Signals" count={patient.signals?.length} />
                                    {patient.signals && patient.signals.length > 0 ? (
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
                                    ) : (
                                        <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)' }}>No signals recorded yet.</div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Diagnoses & History Tab ── */}
                    {activeTab === 'diagnoses' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                            <div className="detail-section">
                                <SectionHeader title="Conditions & Diagnoses" count={clinicalData?.diagnoses.length} />
                                {clinicalData
                                    ? <DiagnosesSection diagnoses={clinicalData.diagnoses} />
                                    : <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)' }}>Upload a patient document to extract diagnoses.</div>
                                }
                            </div>

                            {isSectionVisible('medications') && (
                                <div className="detail-section">
                                    <SectionHeader title="Medications" count={clinicalData?.medications.length} />
                                    {clinicalData && clinicalData.medications.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                            {clinicalData.medications.map((m, i) => (
                                                <div key={i} style={{ fontSize: 'var(--font-sm)', padding: '6px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                                                    <span style={{ fontWeight: 500 }}>{m.name}</span>
                                                    <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)' }}>{[m.dose, m.frequency].filter(Boolean).join(' · ')}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)' }}>No medications recorded.</div>}
                                </div>
                            )}

                            {isSectionVisible('medications') && clinicalData && clinicalData.allergies.length > 0 && (
                                <div className="detail-section">
                                    <SectionHeader title="Allergies" />
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                                        {clinicalData.allergies.map((a, i) => (
                                            <span key={i} style={{ fontSize: 'var(--font-xs)', padding: '3px 10px', borderRadius: 12, background: '#f8d7da', color: '#721c24', fontWeight: 500 }}>{a}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {isSectionVisible('lifestyle') && (
                                <div className="detail-section">
                                    <SectionHeader title="Lifestyle" />
                                    {clinicalData && (clinicalData.smoking_status || clinicalData.alcohol_use) ? (
                                        <div style={{ display: 'flex', gap: 'var(--space-6)', fontSize: 'var(--font-sm)' }}>
                                            {clinicalData.smoking_status && <span><strong>Smoking:</strong> {clinicalData.smoking_status}</span>}
                                            {clinicalData.alcohol_use && <span><strong>Alcohol:</strong> {clinicalData.alcohol_use}</span>}
                                        </div>
                                    ) : <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)' }}>No lifestyle data recorded.</div>}
                                </div>
                            )}

                            {isSectionVisible('surgical_history') && (
                                <div className="detail-section">
                                    <SectionHeader title="Surgical History" />
                                    {clinicalData && clinicalData.surgical_history.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                            {clinicalData.surgical_history.map((s, i) => (
                                                <div key={i} style={{ fontSize: 'var(--font-sm)', display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                                                    <span style={{ fontWeight: 500 }}>{s.procedure}</span>
                                                    {s.date && <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)' }}>{formatDate(s.date)}</span>}
                                                </div>
                                            ))}
                                        </div>
                                    ) : <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)' }}>No surgical history recorded.</div>}
                                </div>
                            )}

                            {isSectionVisible('family_history') && (
                                <div className="detail-section">
                                    <SectionHeader title="Family History" />
                                    {clinicalData && clinicalData.family_history.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                            {clinicalData.family_history.map((f, i) => (
                                                <div key={i} style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>{f}</div>
                                            ))}
                                        </div>
                                    ) : <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)' }}>No family history recorded.</div>}
                                </div>
                            )}

                            {patient.notes && (
                                <div className="detail-section">
                                    <SectionHeader title="Clinical Notes" />
                                    <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', margin: 0 }}>{patient.notes}</p>
                                </div>
                            )}
                        </div>
                    )}

            {/* ── Trials Tab ── */}
            {activeTab === 'trials' && (() => {
                const enrolledCases = patient.screening_cases?.filter(sc => sc.status === 'ENROLLED') ?? [];
                const otherCases = patient.screening_cases?.filter(sc => sc.status !== 'ENROLLED') ?? [];
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '100%' }}>

                        {/* Current Trials */}
                        <div className="detail-section">
                            <SectionHeader title="Current Trials" count={enrolledCases.length} />
                            {enrolledCases.length === 0 ? (
                                <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)', padding: 'var(--space-2) 0' }}>No active trial enrollments.</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                    {enrolledCases.map(sc => (
                                        <div key={sc.id} onClick={() => navigate(`/screening/${sc.id}`)} style={{
                                            cursor: 'pointer', padding: 'var(--space-3) var(--space-4)',
                                            borderRadius: 'var(--radius-md)', border: '1px solid var(--accent)',
                                            background: 'var(--accent-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        }}>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: 'var(--font-base)', color: 'var(--text-primary)' }}>{sc.trial_name}</div>
                                                <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', marginTop: 2 }}>
                                                    {[sc.protocol_number, sc.assigned_user_name ? `Assigned to ${sc.assigned_user_name}` : null].filter(Boolean).join(' · ')}
                                                </div>
                                            </div>
                                            <StatusBadge status={sc.status} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Signal-Rule Alignment */}
                        <div className="detail-section">
                            <div className="detail-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Signal Eligibility Preview</span>
                                <span style={{ fontSize: 'var(--font-xs)', fontWeight: 400, color: 'var(--text-tertiary)' }}>No AI · instant</span>
                            </div>
                            <SignalAlignmentSection alignment={signalAlignment} />
                        </div>

                        {/* Screening Cases */}
                        <div className="detail-section">
                            <SectionHeader title="Screening Cases" count={otherCases.length} />
                            {otherCases.length === 0 ? (
                                <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)', padding: 'var(--space-2) 0' }}>No screening cases yet.</div>
                            ) : (
                                otherCases.map(sc => (
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

                    </div>
                );
            })()}

            {/* ── Documents Tab ── */}
            {activeTab === 'documents' && (
                <div style={{ maxWidth: "100%" }}>
                    <div className="detail-section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="detail-section-title" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>Documents</div>
                            <button className="btn btn-sm btn-secondary" onClick={() => docFileRef.current?.click()} disabled={uploading}>
                                + Upload
                            </button>
                        </div>
                        <div style={{ marginTop: 'var(--space-3)' }}>
                            {(!patient.documents || (patient.documents as unknown[]).length === 0) ? (
                                <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)', padding: 'var(--space-4) 0', textAlign: 'center' }}>
                                    No documents uploaded yet. Upload a lab report, imaging result, or clinic note to extract clinical data.
                                </div>
                            ) : (
                                (patient.documents as { id: string; filename: string; document_type: string; created_at: string }[]).map(doc => (
                                    <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 'var(--font-sm)' }}>
                                        <span style={{ fontSize: 18 }}>📄</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.filename}</div>
                                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>{doc.document_type} · {formatDate(doc.created_at)}</div>
                                        </div>
                                        <button
                                            className="btn btn-sm btn-ghost"
                                            style={{ color: 'var(--accent)', fontSize: 'var(--font-xs)', padding: '2px 8px', flexShrink: 0 }}
                                            onClick={async () => {
                                                const signedUrl = await api.getDocumentSignedUrl(patient.id, doc.id);
                                                setPdfViewer({ url: signedUrl, filename: doc.filename });
                                            }}
                                        >
                                            View
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

                </main>
            </div>

            {/* ── Add Signal Modal ── */}
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
                                <Select
                                    value={sigForm.signal_type_id}
                                    onChange={val => setSigForm({ ...sigForm, signal_type_id: val })}
                                    options={[
                                        { value: '', label: 'Select signal type…' },
                                        ...signalTypes.map(st => ({ value: st.id, label: `${st.label}${st.unit ? ` (${st.unit})` : ''}` })),
                                    ]}
                                />
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

            {/* ── Create Screening Case Modal ── */}
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
                                <Select
                                    value={caseForm.trial_id}
                                    onChange={val => setCaseForm({ ...caseForm, trial_id: val })}
                                    options={[
                                        { value: '', label: 'Select trial…' },
                                        ...trials.map(t => ({ value: t.id, label: `${t.name} (${t.protocol_number || t.specialty})` })),
                                    ]}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Initial Status</label>
                                <Select
                                    value={caseForm.status}
                                    onChange={val => setCaseForm({ ...caseForm, status: val })}
                                    options={[
                                        { value: 'NEW', label: 'New' },
                                        { value: 'IN_REVIEW', label: 'In Review' },
                                        { value: 'PENDING_INFO', label: 'Pending Info' },
                                    ]}
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowCaseModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Create Case</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Extraction Review Modal ── */}
            {extractionReview && (
                <ExtractionReviewModal
                    result={extractionReview}
                    onMatch={handleMatchNow}
                    matching={matching}
                    onClose={() => setExtractionReview(null)}
                />
            )}

            {pdfViewer && (
                <PDFViewerModal
                    url={pdfViewer.url}
                    filename={pdfViewer.filename}
                    onClose={() => setPdfViewer(null)}
                />
            )}
        </div>
    );
}
