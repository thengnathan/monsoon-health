import { useState, useRef } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CriterionSubitem {
    label: string;
    text: string;
    subitems?: CriterionSubitem[];
}

interface InclusionCriterion {
    number: number;
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
    inclusion_structured?: InclusionCriterion[];
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
    const [open, setOpen] = useState(false);
    if (!keys.length) return null;
    const defs = keys.map(k => footnotes.find(f => f.key === k)).filter(Boolean) as SoaFootnote[];
    return (
        <span style={{ position: 'relative', display: 'inline-block', marginLeft: 2 }}>
            <sup
                style={{ color: 'var(--primary)', cursor: 'pointer', fontSize: '0.7em', fontWeight: 600 }}
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
            >
                {keys.join(',')}
            </sup>
            {open && defs.length > 0 && (
                <span style={{
                    position: 'absolute', bottom: '100%', left: 0, zIndex: 50,
                    background: 'var(--bg-primary)', border: '1px solid var(--border)',
                    borderRadius: 6, padding: '8px 10px', minWidth: 220, maxWidth: 320,
                    fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', lineHeight: 1.5,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)', whiteSpace: 'normal',
                }}>
                    {defs.map(d => <div key={d.key}><strong>{d.key}:</strong> {d.text}</div>)}
                </span>
            )}
        </span>
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
                    <select
                        className="form-input"
                        style={{ maxWidth: 280 }}
                        value={selectedVisit ?? ''}
                        onChange={e => scrollTo(e.target.value)}
                    >
                        <option value="">Jump to visit...</option>
                        {visits.map(v => (
                            <option key={v.visit_name} value={v.visit_name}>{v.visit_name}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Scroll container — separate from flex layout so cards never compress */}
            <div ref={scrollContainerRef} style={{ maxHeight: 600, overflowY: 'auto', paddingRight: 4 }}>
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
                                    background: 'var(--bg-secondary)',
                                    borderBottom: isExpanded ? '1px solid var(--border)' : 'none',
                                    display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                                    cursor: hasContent ? 'pointer' : 'default',
                                    userSelect: 'none',
                                }}
                            >
                                <span style={{ fontWeight: 600, fontSize: 'var(--font-base)', color: 'var(--text-primary)' }}>
                                    {visit.visit_name}
                                </span>
                                {visit.visit_label && (
                                    <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', background: 'var(--border)', borderRadius: 4, padding: '1px 6px' }}>
                                        {visit.visit_label}
                                    </span>
                                )}
                                <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)', marginLeft: 4 }}>
                                    {formatDayLabel(visit)}
                                </span>
                                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {visit.is_screening && (
                                        <span className="badge badge-info" style={{ fontSize: 'var(--font-xs)' }}>Screening</span>
                                    )}
                                    {visit.is_randomization && (
                                        <span className="badge badge-success" style={{ fontSize: 'var(--font-xs)' }}>Randomization</span>
                                    )}
                                    {assessmentCount > 0 && (
                                        <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, padding: '1px 8px' }}>
                                            {assessmentCount} assessments
                                        </span>
                                    )}
                                    {hasContent && (
                                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                                            {isExpanded ? '▲' : '▼'}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Assessments — only shown when expanded */}
                            {isExpanded && (
                                visit.assessments?.length ? (
                                    <div style={{ padding: 'var(--space-3) var(--space-4)' }}>
                                        {visit.assessments.map(cat => (
                                            <div key={cat.category} style={{ marginBottom: 'var(--space-3)' }}>
                                                <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary)', marginBottom: 6 }}>
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
    const inclusionCount = hasStructured ? (data.inclusion_structured?.length ?? 0) : (data.inclusion_criteria?.length ?? 0);
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
                            <InclusionStructuredList items={data.inclusion_structured} animating={animating} />
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

function InclusionStructuredList({ items, animating, startIndex = 0 }: { items: InclusionCriterion[]; animating?: boolean; startIndex?: number }) {
    return (
        <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((item, i) => (
                <li
                    key={item.number}
                    className={animating ? 'criterion-reveal' : undefined}
                    style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, ...(animating ? { animationDelay: `${(startIndex + i) * 60}ms` } : {}) }}
                >
                    {item.text}
                    {item.subitems?.length ? <SubitemList items={item.subitems} /> : null}
                </li>
            ))}
        </ol>
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
