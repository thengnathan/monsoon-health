import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Select } from './Select';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CriterionSubitem {
    label: string;
    text: string;
    subitems?: CriterionSubitem[];
}


interface ExclusionCategory {
    category: string | null;
    note: string | null;
    criteria: {
        number: number;
        text: string;
        subitems?: CriterionSubitem[];
    }[];
}

interface SoaFootnote {
    key: string;
    text: string;
}

interface VisitAssessmentItem {
    name: string;
    footnote_keys: string[];
}

interface VisitAssessmentCategory {
    category: string;
    items: VisitAssessmentItem[];
}

interface ExtractedVisit {
    visit_name: string;
    visit_label?: string | null;
    day_offset: number;
    window_before?: number;
    window_after?: number;
    is_screening?: boolean;
    is_randomization?: boolean;
    notes?: string | null;
    assessments?: VisitAssessmentCategory[];
}

interface StructuredData {
    extracted_visits?: ExtractedVisit[];
    inclusion_criteria?: string[];
    exclusion_criteria?: string[];
    // New format: grouped by cohort/arm (same shape as exclusion_structured)
    inclusion_structured?: ExclusionCategory[];
    exclusion_structured?: ExclusionCategory[];
    soa_footnotes?: SoaFootnote[];
}

interface Props {
    structuredData: StructuredData;
    tab?: 'visits' | 'criteria';
    animating?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDayLabel(visit: ExtractedVisit): string {
    if (visit.is_screening) {
        const before = visit.window_before ?? 0;
        const after = visit.window_after ?? 0;
        return before > 0 || after > 0
            ? `Day ${visit.day_offset - before} to ${visit.day_offset + after}`
            : `Day ${visit.day_offset}`;
    }
    const offset = visit.day_offset;
    const before = visit.window_before ?? 0;
    const after = visit.window_after ?? 0;
    const dayStr = offset === 0 ? 'Day 1' : `Day ${offset}`;
    return before > 0 || after > 0 ? `${dayStr} (±${before === after ? before : `${before}/${after}`}d)` : dayStr;
}

function FootnoteTooltip({ keys, footnotes }: { keys: string[]; footnotes: SoaFootnote[] }) {
    const [pos, setPos] = useState<{ top: number; left: number; flipUp: boolean } | null>(null);
    const triggerRef = useRef<HTMLElement>(null);

    const show = useCallback(() => {
        const rect = triggerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const flipUp = rect.top > window.innerHeight / 2;
        setPos({
            top: flipUp ? rect.top - 8 : rect.bottom + 8,
            left: Math.min(rect.left, window.innerWidth - 340),
            flipUp,
        });
    }, []);

    const hide = useCallback(() => setPos(null), []);

    // Close on scroll so tooltip doesn't linger in the wrong spot
    useEffect(() => {
        if (!pos) return;
        window.addEventListener('scroll', hide, true);
        return () => window.removeEventListener('scroll', hide, true);
    }, [pos, hide]);

    if (!keys.length) return null;
    const defs = keys.map(k => footnotes.find(f => f.key === k)).filter(Boolean) as SoaFootnote[];
    if (!defs.length) return null;

    return (
        <>
            <sup
                ref={triggerRef}
                style={{ color: 'var(--accent-sea-blue, var(--accent))', cursor: 'help', fontSize: '0.7em', fontWeight: 700, marginLeft: 1 }}
                onMouseEnter={show}
                onMouseLeave={hide}
            >
                {keys.join(',')}
            </sup>

            {pos && createPortal(
                <div style={{
                    position: 'fixed',
                    top: pos.flipUp ? undefined : pos.top,
                    bottom: pos.flipUp ? window.innerHeight - pos.top : undefined,
                    left: pos.left,
                    zIndex: 99999,
                    background: 'var(--surface-elevated, var(--bg-surface-raised))',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 12px',
                    minWidth: 220,
                    maxWidth: 340,
                    fontSize: 'var(--font-xs)',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    pointerEvents: 'none',
                }}
                    onMouseEnter={show}
                    onMouseLeave={hide}
                >
                    {defs.map(d => (
                        <div key={d.key} style={{ marginBottom: defs.length > 1 ? 6 : 0 }}>
                            <strong style={{ color: 'var(--text-primary)' }}>{d.key}:</strong> {d.text}
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </>
    );
}

function SubitemList({ items, footnotes }: { items: CriterionSubitem[]; footnotes?: SoaFootnote[] }) {
    if (!items?.length) return null;
    return (
        <ul style={{ margin: '4px 0 0 0', paddingLeft: 20, listStyle: 'none' }}>
            {items.map((sub, i) => (
                <li key={i} style={{ marginBottom: 2, fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
                    <span style={{ fontWeight: 500, marginRight: 6 }}>{sub.label}.</span>
                    {sub.text}
                    {sub.subitems?.length ? <SubitemList items={sub.subitems} footnotes={footnotes} /> : null}
                </li>
            ))}
        </ul>
    );
}

// ── Visit Schedule Tab ────────────────────────────────────────────────────────

function VisitScheduleTab({ visits, footnotes, animating }: { visits: ExtractedVisit[]; footnotes: SoaFootnote[]; animating?: boolean }) {
    const [selectedVisit, setSelectedVisit] = useState<string | null>(null);
    const [expandedVisits, setExpandedVisits] = useState<Set<string>>(new Set());
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const scrollTo = (name: string) => {
        setSelectedVisit(name);
        const container = scrollContainerRef.current;
        const target = container?.querySelector(`#visit-${CSS.escape(name)}`) as HTMLElement | null;
        if (container && target) {
            container.scrollTo({ top: target.offsetTop - 8, behavior: 'smooth' });
        }
    };

    const toggleVisit = (name: string) => {
        setExpandedVisits(prev => {
            const next = new Set(prev);
            next.has(name) ? next.delete(name) : next.add(name);
            return next;
        });
    };

    return (
        <div>
            {/* Jump to visit dropdown */}
            {visits.length > 3 && (
                <div style={{ marginBottom: 'var(--space-3)' }}>
                    <Select
                        value={selectedVisit ?? ''}
                        onChange={val => scrollTo(val)}
                        options={[
                            { value: '', label: 'Jump to visit…' },
                            ...visits.map(v => ({ value: v.visit_name, label: v.visit_name })),
                        ]}
                        style={{ maxWidth: 280 }}
                    />
                </div>
            )}

            {/* Scroll container — separate from flex layout so cards never compress */}
            <div ref={scrollContainerRef} style={{ maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {visits.map((visit, visitIndex) => {
                    const isExpanded = expandedVisits.has(visit.visit_name);
                    const assessmentCount = visit.assessments?.reduce((sum, cat) => sum + cat.items.length, 0) ?? 0;
                    const hasContent = assessmentCount > 0 || !!visit.notes;

                    return (
                        <div
                            key={visit.visit_name}
                            id={`visit-${visit.visit_name}`}
                            className={animating ? 'card visit-slide-in' : 'card'}
                            style={{ padding: 0, overflow: 'hidden', ...(animating ? { animationDelay: `${visitIndex * 100}ms` } : {}) }}
                        >
                            {/* Card header — clickable if there's content */}
                            <div
                                onClick={hasContent ? () => toggleVisit(visit.visit_name) : undefined}
                                style={{
                                    padding: 'var(--space-3) var(--space-4)',
                                    background: 'var(--surface-elevated, var(--bg-surface-raised))',
                                    borderBottom: isExpanded ? '1px solid var(--border-default)' : 'none',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)',
                                    cursor: hasContent ? 'pointer' : 'default',
                                    userSelect: 'none',
                                }}
                            >
                                {/* Left: name + day */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
                                    <span style={{ fontWeight: 600, fontSize: 'var(--font-sm)', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {visit.visit_name}
                                    </span>
                                    <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                                        {formatDayLabel(visit)}
                                    </span>
                                    {visit.visit_label && (
                                        <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', background: 'var(--border-strong)', borderRadius: 3, padding: '1px 5px', flexShrink: 0 }}>
                                            {visit.visit_label}
                                        </span>
                                    )}
                                </div>

                                {/* Right: badges + count + chevron */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                    {visit.is_screening && (
                                        <span className="badge badge-info" style={{ fontSize: 11 }}>Screening</span>
                                    )}
                                    {visit.is_randomization && (
                                        <span className="badge badge-success" style={{ fontSize: 11 }}>Randomization</span>
                                    )}
                                    {assessmentCount > 0 && (
                                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'var(--surface-secondary, var(--bg-surface))', border: '1px solid var(--border-default)', borderRadius: 10, padding: '1px 8px', whiteSpace: 'nowrap' }}>
                                            {assessmentCount}
                                        </span>
                                    )}
                                    {hasContent && (
                                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8"
                                            style={{ color: 'var(--text-tertiary)', transition: 'transform 0.15s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}>
                                            <path d="M2 4.5l4 3.5 4-3.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    )}
                                </div>
                            </div>

                            {/* Assessments — only shown when expanded */}
                            {isExpanded && (
                                visit.assessments?.length ? (
                                    <div style={{ padding: 'var(--space-3) var(--space-4)' }}>
                                        {visit.assessments.map(cat => (
                                            <div key={cat.category} style={{ marginBottom: 'var(--space-3)' }}>
                                                <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-sea-blue, var(--accent))', marginBottom: 6 }}>
                                                    {cat.category}
                                                </div>
                                                <ul style={{ margin: 0, paddingLeft: 16, listStyle: 'disc' }}>
                                                    {cat.items.map((item, i) => (
                                                        <li key={i} style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', marginBottom: 2, lineHeight: 1.5 }}>
                                                            {item.name}
                                                            <FootnoteTooltip keys={item.footnote_keys} footnotes={footnotes} />
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                ) : visit.notes ? (
                                    <div style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)' }}>
                                        {visit.notes}
                                    </div>
                                ) : null
                            )}
                        </div>
                    );
                })}
                </div>
            </div>

            {/* SoA Footnotes */}
            {footnotes.length > 0 && (
                <FootnotesCollapsible footnotes={footnotes} />
            )}
        </div>
    );
}

function FootnotesCollapsible({ footnotes }: { footnotes: SoaFootnote[] }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="card" style={{ marginTop: 'var(--space-4)', padding: 0, overflow: 'hidden' }}>
            <button
                onClick={() => setOpen(o => !o)}
                style={{
                    width: '100%', textAlign: 'left', padding: 'var(--space-3) var(--space-4)',
                    background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-secondary)',
                }}
            >
                SoA Footnotes ({footnotes.length})
                <span>{open ? '▲' : '▼'}</span>
            </button>
            {open && (
                <div style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {footnotes.map(fn => (
                        <div key={fn.key} style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            <strong style={{ color: 'var(--primary)' }}>{fn.key}:</strong> {fn.text}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Criteria Tab ──────────────────────────────────────────────────────────────

function CriteriaTab({ data, animating }: { data: StructuredData; animating?: boolean }) {
    const [inclusionOpen, setInclusionOpen] = useState(true);
    const [exclusionOpen, setExclusionOpen] = useState(true);
    const hasStructured = (data.inclusion_structured?.length ?? 0) > 0 || (data.exclusion_structured?.length ?? 0) > 0;
    const inclusionCount = hasStructured
        ? (data.inclusion_structured?.reduce((n, cat) => n + cat.criteria.length, 0) ?? 0)
        : (data.inclusion_criteria?.length ?? 0);
    const exclusionCount = hasStructured
        ? (data.exclusion_structured?.reduce((n, cat) => n + cat.criteria.length, 0) ?? 0)
        : (data.exclusion_criteria?.length ?? 0);

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', alignItems: 'start' }}>
            {/* Inclusion */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', borderLeft: '2px solid var(--success)' }}>
                <button
                    onClick={() => setInclusionOpen(o => !o)}
                    style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) var(--space-4)', background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer', borderBottom: inclusionOpen ? '1px solid var(--border)' : 'none' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span style={{ fontWeight: 600, fontSize: 'var(--font-base)', color: 'var(--success)' }}>Inclusion Criteria</span>
                        <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', background: 'var(--border)', borderRadius: 4, padding: '1px 6px' }}>{inclusionCount}</span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{inclusionOpen ? '▲' : '▼'}</span>
                </button>
                {inclusionOpen && (
                    <div style={{ padding: 'var(--space-4)' }}>
                        {hasStructured && data.inclusion_structured?.length ? (
                            <ExclusionStructuredList categories={data.inclusion_structured} animating={animating} />
                        ) : (
                            <FlatCriteriaList items={data.inclusion_criteria ?? []} animating={animating} />
                        )}
                    </div>
                )}
            </div>

            {/* Exclusion */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', borderLeft: '2px solid var(--error)' }}>
                <button
                    onClick={() => setExclusionOpen(o => !o)}
                    style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) var(--space-4)', background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer', borderBottom: exclusionOpen ? '1px solid var(--border)' : 'none' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span style={{ fontWeight: 600, fontSize: 'var(--font-base)', color: 'var(--error)' }}>Exclusion Criteria</span>
                        <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', background: 'var(--border)', borderRadius: 4, padding: '1px 6px' }}>{exclusionCount}</span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{exclusionOpen ? '▲' : '▼'}</span>
                </button>
                {exclusionOpen && (
                    <div style={{ padding: 'var(--space-4)' }}>
                        {hasStructured && data.exclusion_structured?.length ? (
                            <ExclusionStructuredList categories={data.exclusion_structured} animating={animating} startIndex={inclusionCount} />
                        ) : (
                            <FlatCriteriaList items={data.exclusion_criteria ?? []} animating={animating} startIndex={inclusionCount} />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}


function ExclusionStructuredList({ categories, animating, startIndex = 0 }: { categories: ExclusionCategory[]; animating?: boolean; startIndex?: number }) {
    let globalIndex = startIndex;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {categories.map((cat, i) => (
                <div key={i}>
                    {cat.category && (
                        <div style={{ fontWeight: 700, fontSize: 'var(--font-sm)', color: 'var(--text-primary)', marginBottom: 6, paddingBottom: 4, borderBottom: '1px solid var(--border)' }}>
                            {cat.category}
                        </div>
                    )}
                    {cat.note && (
                        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', fontStyle: 'italic', background: 'var(--bg-secondary)', borderRadius: 4, padding: '6px 10px', marginBottom: 8, lineHeight: 1.5 }}>
                            NOTE: {cat.note}
                        </div>
                    )}
                    <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {cat.criteria.map(c => {
                            const idx = globalIndex++;
                            return (
                                <li
                                    key={c.number}
                                    className={animating ? 'criterion-reveal' : undefined}
                                    style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, ...(animating ? { animationDelay: `${idx * 60}ms` } : {}) }}
                                >
                                    {c.text}
                                    {c.subitems?.length ? <SubitemList items={c.subitems} /> : null}
                                </li>
                            );
                        })}
                    </ol>
                </div>
            ))}
        </div>
    );
}

function FlatCriteriaList({ items, animating, startIndex = 0 }: { items: string[]; animating?: boolean; startIndex?: number }) {
    if (!items.length) return <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)' }}>No criteria available.</p>;
    return (
        <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map((c, i) => (
                <li
                    key={i}
                    className={animating ? 'criterion-reveal' : undefined}
                    style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, ...(animating ? { animationDelay: `${(startIndex + i) * 60}ms` } : {}) }}
                >
                    {c}
                </li>
            ))}
        </ol>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ProtocolViewer({ structuredData, tab: lockedTab, animating }: Props) {
    const [tab, setTab] = useState<'visits' | 'criteria'>(lockedTab ?? 'visits');

    const visits = structuredData.extracted_visits ?? [];
    const footnotes = structuredData.soa_footnotes ?? [];

    return (
        <div>
            {/* Tabs — hidden when locked to a single tab */}
            {!lockedTab && (
                <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 'var(--space-4)' }}>
                    {(['visits', 'criteria'] as const).map(t => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            style={{
                                padding: 'var(--space-2) var(--space-4)',
                                border: 'none', background: 'none', cursor: 'pointer',
                                fontSize: 'var(--font-sm)', fontWeight: tab === t ? 600 : 400,
                                color: tab === t ? 'var(--primary)' : 'var(--text-secondary)',
                                borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
                                marginBottom: -1,
                            }}
                        >
                            {t === 'visits' ? `Visit Schedule${visits.length ? ` (${visits.length})` : ''}` : 'Inclusion / Exclusion'}
                        </button>
                    ))}
                </div>
            )}

            {tab === 'visits' && <VisitScheduleTab visits={visits} footnotes={footnotes} animating={animating} />}
            {tab === 'criteria' && <CriteriaTab data={structuredData} animating={animating} />}
        </div>
    );
}
