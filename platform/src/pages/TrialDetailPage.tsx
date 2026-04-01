import { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useToast } from '../contexts/ToastContext';
import { StatusBadge, formatDate } from '../utils';
import type { TrialDetail, SignalType, VisitTemplate } from '../types';

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

// ── Criteria display helper ───────────────────────────────────────────────────
// Converts plain-text criteria (existing DB data) to structured HTML.
// If the text already contains HTML tags, it is returned as-is.

function escHtml(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function boldThresholds(html: string) {
    return html.replace(
        /((?:[≥≤≠]|&lt;=?|&gt;=?)\s*\d+\.?\d*(?:\s*(?:mg\/dL|g\/dL|kPa|%|×\s*ULN|IU\/mL|mL\/min|μL|mmol\/L|IU\/day|IU\/L|ng\/mL))?)/g,
        '<strong>$1</strong>'
    );
}

function criteriaToHtml(raw: string): string {
    if (!raw.trim()) return '';
    if (/<(?:ol|ul|li|p|div|strong|em|br)\b/i.test(raw)) return DOMPurify.sanitize(raw);

    const text = raw
        .replace(/([.!?:])\s+(\d{1,2}[.)]\s)/g, '$1\n$2')
        .replace(/([.!?])\s+([a-z][.)]\s)/g, '$1\n   $2')
        .replace(/[""]/g, '"').replace(/['']/g, "'");

    const lines = text.split('\n').map((l: string) => l.trimEnd()).filter((l: string) => l.trimStart().length > 0);

    const SKIP = /^(main study|inclusion criteria|exclusion criteria|part [a-z]\b|study phase|subjects (must|who|in the)|eligibility criteria|to be eligible)/i;
    const PAGE_REF = /^(page \d|protocol:|amendment \d|confidential)/i;

    type Node = { text: string; children: string[]; notes: string[] };
    const roots: Node[] = [];
    let cur: Node | null = null;

    for (const raw of lines) {
        const line = raw.trimStart();
        if (!line || SKIP.test(line) || PAGE_REF.test(line)) continue;

        const leadSpaces = raw.length - line.length;
        const topM = line.match(/^(\d{1,2}[.)]\s*)([\s\S]*)/);
        const subM = line.match(/^([a-z]{1,3}[.)]\s*)([\s\S]*)/i);
        const romanM = line.match(/^(i{1,3}v?|vi{0,3}|ix|x{1,3})[.)]\s/i);
        const isNote = /^note:/i.test(line);

        if (topM) {
            cur = { text: topM[2].trim(), children: [], notes: [] };
            roots.push(cur);
        } else if (subM && !romanM) {
            const content = `${subM[1]}${subM[2].trim()}`;
            if (cur) cur.children.push(content);
            else roots.push({ text: content, children: [], notes: [] });
        } else if (leadSpaces >= 2 && cur) {
            cur.children.push(line);
        } else if (isNote && cur) {
            cur.notes.push(line);
        } else if (cur) {
            cur.text += ' ' + line;
        } else {
            cur = { text: line, children: [], notes: [] };
            roots.push(cur);
        }
    }

    if (roots.length === 0) return `<p>${escHtml(raw)}</p>`;

    const parts = ['<ol>'];
    for (const node of roots) {
        let li = boldThresholds(escHtml(node.text));
        if (node.notes.length > 0) {
            li += node.notes.map((n: string) =>
                `<div style="margin-top:4px;font-size:0.85em;color:var(--text-tertiary);font-style:italic">${escHtml(n)}</div>`
            ).join('');
        }
        if (node.children.length > 0) {
            li += '<ul>' + node.children.map((c: string) => `<li>${boldThresholds(escHtml(c))}</li>`).join('') + '</ul>';
        }
        parts.push(`<li>${li}</li>`);
    }
    parts.push('</ol>');
    return parts.join('');
}

// ── Rich Text Editor (Gmail-style) ───────────────────────────────────────────

function RichTextEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const editorRef = useRef<HTMLDivElement>(null);
    const isInternalChange = useRef(false);

    // Sync value from parent only when it changes externally (e.g. cancel/reset)
    useEffect(() => {
        if (editorRef.current && !isInternalChange.current) {
            editorRef.current.innerHTML = criteriaToHtml(value);
        }
        isInternalChange.current = false;
    }, [value]);

    const handleInput = () => {
        isInternalChange.current = true;
        onChange(editorRef.current?.innerHTML ?? '');
    };

    // Use onMouseDown + preventDefault so toolbar clicks don't steal focus from editor
    const exec = (cmd: string, val?: string) => {
        editorRef.current?.focus();
        document.execCommand(cmd, false, val ?? undefined);
    };

    const btnStyle: React.CSSProperties = {
        border: 'none', background: 'none', cursor: 'pointer',
        padding: '4px 7px', borderRadius: 3,
        color: 'var(--text-secondary)', fontFamily: 'inherit',
        fontSize: 13, lineHeight: 1,
        display: 'inline-flex', alignItems: 'center',
    };

    const divider = (
        <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)', margin: '3px 2px' }} />
    );

    return (
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', background: 'var(--bg-primary)' }}>
            {/* Toolbar */}
            <div style={{
                display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1,
                padding: '5px 8px', borderBottom: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
            }}>
                {/* Font size */}
                <select
                    defaultValue="3"
                    onChange={e => { exec('fontSize', e.target.value); editorRef.current?.focus(); }}
                    onMouseDown={e => e.stopPropagation()}
                    style={{
                        fontSize: 12, padding: '3px 5px', marginRight: 2,
                        border: '1px solid var(--border)', borderRadius: 3,
                        background: 'var(--bg-primary)', color: 'var(--text-secondary)',
                        cursor: 'pointer',
                    }}
                >
                    <option value="1">Small</option>
                    <option value="3">Normal</option>
                    <option value="4">Large</option>
                    <option value="5">Larger</option>
                </select>

                {divider}

                <button type="button" style={btnStyle} title="Bold (⌘B)"
                    onMouseDown={e => { e.preventDefault(); exec('bold'); }}>
                    <strong>B</strong>
                </button>
                <button type="button" style={btnStyle} title="Italic (⌘I)"
                    onMouseDown={e => { e.preventDefault(); exec('italic'); }}>
                    <em style={{ fontStyle: 'italic' }}>I</em>
                </button>
                <button type="button" style={{ ...btnStyle, textDecoration: 'underline' }} title="Underline (⌘U)"
                    onMouseDown={e => { e.preventDefault(); exec('underline'); }}>
                    U
                </button>
                <button type="button" style={btnStyle} title="Strikethrough"
                    onMouseDown={e => { e.preventDefault(); exec('strikeThrough'); }}>
                    <s>S</s>
                </button>

                {divider}

                <button type="button" style={btnStyle} title="Numbered list"
                    onMouseDown={e => { e.preventDefault(); exec('insertOrderedList'); }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <line x1="5" y1="3.5" x2="13" y2="3.5" /><line x1="5" y1="7" x2="13" y2="7" /><line x1="5" y1="10.5" x2="13" y2="10.5" />
                        <text x="1" y="4.5" fontSize="3.5" fill="currentColor" stroke="none">1</text>
                        <text x="1" y="8" fontSize="3.5" fill="currentColor" stroke="none">2</text>
                        <text x="1" y="11.5" fontSize="3.5" fill="currentColor" stroke="none">3</text>
                    </svg>
                </button>
                <button type="button" style={btnStyle} title="Bullet list"
                    onMouseDown={e => { e.preventDefault(); exec('insertUnorderedList'); }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="2" cy="3.5" r="1" fill="currentColor" stroke="none" /><line x1="5" y1="3.5" x2="13" y2="3.5" />
                        <circle cx="2" cy="7" r="1" fill="currentColor" stroke="none" /><line x1="5" y1="7" x2="13" y2="7" />
                        <circle cx="2" cy="10.5" r="1" fill="currentColor" stroke="none" /><line x1="5" y1="10.5" x2="13" y2="10.5" />
                    </svg>
                </button>

                {divider}

                <button type="button" style={btnStyle} title="Indent"
                    onMouseDown={e => { e.preventDefault(); exec('indent'); }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <line x1="1" y1="3" x2="13" y2="3" /><line x1="5" y1="7" x2="13" y2="7" /><line x1="1" y1="11" x2="13" y2="11" />
                        <polyline points="1,5.5 3,7 1,8.5" fill="currentColor" stroke="none" />
                    </svg>
                </button>
                <button type="button" style={btnStyle} title="Outdent"
                    onMouseDown={e => { e.preventDefault(); exec('outdent'); }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <line x1="1" y1="3" x2="13" y2="3" /><line x1="5" y1="7" x2="13" y2="7" /><line x1="1" y1="11" x2="13" y2="11" />
                        <polyline points="4,5.5 2,7 4,8.5" fill="currentColor" stroke="none" />
                    </svg>
                </button>

                {divider}

                <button type="button" style={{ ...btnStyle, fontSize: 11, color: 'var(--text-tertiary)' }} title="Remove formatting"
                    onMouseDown={e => { e.preventDefault(); exec('removeFormat'); }}>
                    T✕
                </button>
            </div>

            {/* Editable content area */}
            <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleInput}
                style={{
                    minHeight: 160,
                    padding: '10px 14px',
                    fontSize: 'var(--font-sm)',
                    color: 'var(--text-primary)',
                    lineHeight: 1.65,
                    outline: 'none',
                    background: 'var(--bg-primary)',
                    // Restore browser default list indentation inside contenteditable
                    ['--list-padding' as string]: '1.5rem',
                }}
            />
        </div>
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
    const [reextracting, setReextracting] = useState(false);
    const [inclusionCollapsed, setInclusionCollapsed] = useState(true);
    const [exclusionCollapsed, setExclusionCollapsed] = useState(true);
    const [caseTab, setCaseTab] = useState<'potential' | 'screening' | 'enrolled'>('screening');
    const [selectedVisit, setSelectedVisit] = useState<VisitTemplate | null>(null);
    const [visitNotes, setVisitNotes] = useState('');
    const [savingVisitNotes, setSavingVisitNotes] = useState(false);
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

    const handleReextract = async () => {
        setReextracting(true);
        try {
            await api.reextractProtocol(id!);
            addToast('Re-extraction started — criteria will update in the background', 'success');
            // Poll for updated criteria after a short delay
            setTimeout(() => { loadTrial(); setReextracting(false); }, 8000);
        } catch (err) {
            addToast((err as Error).message, 'error');
            setReextracting(false);
        }
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
    const [editingRule, setEditingRule] = useState<import('../types').SignalRule | null>(null);

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

    const handleUpdateSignal = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingRule) return;
        try {
            const payload: Record<string, unknown> = { operator: signalForm.operator };
            if (signalForm.threshold_number) payload.threshold_number = parseFloat(signalForm.threshold_number);
            if (signalForm.unit) payload.unit = signalForm.unit;
            await api.updateTrialRule(editingRule.id, payload);
            addToast('Signal rule updated', 'success');
            setEditingRule(null);
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
                            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                                <button className="btn btn-sm btn-ghost" onClick={() => fileInputRef.current?.click()}>Replace Protocol</button>
                                <button
                                    className="btn btn-sm btn-ghost"
                                    onClick={handleReextract}
                                    disabled={reextracting}
                                    title="Re-run AI extraction on the uploaded protocol PDF"
                                    style={{ color: 'var(--text-tertiary)' }}
                                >
                                    {reextracting ? 'Re-extracting…' : '↺ Re-extract'}
                                </button>
                            </div>
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
                                <div>
                                    <label className="form-label" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>Inclusion Criteria</label>
                                    <RichTextEditor
                                        value={criteriaForm.inclusion_criteria}
                                        onChange={v => setCriteriaForm(f => ({ ...f, inclusion_criteria: v }))}
                                    />
                                </div>
                                <div>
                                    <label className="form-label" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>Exclusion Criteria</label>
                                    <RichTextEditor
                                        value={criteriaForm.exclusion_criteria}
                                        onChange={v => setCriteriaForm(f => ({ ...f, exclusion_criteria: v }))}
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                    <button className="btn btn-primary btn-sm" onClick={handleSaveCriteria}>Save</button>
                                    <button className="btn btn-secondary btn-sm" onClick={() => { setEditingCriteria(false); setCriteriaForm({ inclusion_criteria: trial.inclusion_criteria || '', exclusion_criteria: trial.exclusion_criteria || '' }); }}>Cancel</button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                {!trial.inclusion_criteria && !trial.exclusion_criteria ? (
                                    <div className="card" style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
                                        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)' }}>No criteria defined yet. Upload the protocol and enter criteria here.</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Inclusion panel */}
                                        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                            <button
                                                onClick={() => setInclusionCollapsed(c => !c)}
                                                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px var(--space-4)', background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer', borderBottom: inclusionCollapsed ? 'none' : '1px solid var(--border)' }}
                                            >
                                                <span style={{ fontSize: 'var(--font-base)', fontWeight: 600, color: 'var(--text-primary)' }}>Inclusion Criteria</span>
                                                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{inclusionCollapsed ? '▼' : '▲'}</span>
                                            </button>
                                            {!inclusionCollapsed && (
                                                <div
                                                    className="criteria-html"
                                                    dangerouslySetInnerHTML={{ __html: criteriaToHtml(trial.inclusion_criteria || '') }}
                                                    style={{ padding: 'var(--space-4)', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', lineHeight: 1.65 }}
                                                />
                                            )}
                                        </div>
                                        {/* Exclusion panel */}
                                        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                            <button
                                                onClick={() => setExclusionCollapsed(c => !c)}
                                                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px var(--space-4)', background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer', borderBottom: exclusionCollapsed ? 'none' : '1px solid var(--border)' }}
                                            >
                                                <span style={{ fontSize: 'var(--font-base)', fontWeight: 600, color: 'var(--text-primary)' }}>Exclusion Criteria</span>
                                                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{exclusionCollapsed ? '▼' : '▲'}</span>
                                            </button>
                                            {!exclusionCollapsed && (
                                                <div
                                                    className="criteria-html"
                                                    dangerouslySetInnerHTML={{ __html: criteriaToHtml(trial.exclusion_criteria || '') }}
                                                    style={{ padding: 'var(--space-4)', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', lineHeight: 1.65 }}
                                                />
                                            )}
                                        </div>
                                    </>
                                )}
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
                                <div className="card" style={{ padding: 'var(--space-4)', maxHeight: 480, overflowY: 'auto' }}>
                                    {trial.visit_templates.map((vt, i) => (
                                        <div key={vt.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                                            {/* Left: connector line + circle */}
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 32 }}>
                                                <button
                                                    onClick={() => { setSelectedVisit(vt); setVisitNotes(vt.notes || ''); }}
                                                    style={{
                                                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                                                        background: 'var(--accent-muted)', color: 'var(--accent)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: 'var(--font-xs)', fontWeight: 700,
                                                        border: '2px solid var(--accent)',
                                                        cursor: 'pointer', padding: 0,
                                                    }}
                                                >
                                                    {i + 1}
                                                </button>
                                                {i < trial.visit_templates.length - 1 && (
                                                    <div style={{ width: 2, flex: 1, minHeight: 24, background: 'var(--border)', marginTop: 2, marginBottom: 2 }} />
                                                )}
                                            </div>
                                            {/* Right: visit info + actions */}
                                            <div style={{ flex: 1, paddingBottom: i < trial.visit_templates.length - 1 ? 'var(--space-3)' : 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <button
                                                        onClick={() => { setSelectedVisit(vt); setVisitNotes(vt.notes || ''); }}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                                                    >
                                                        <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)', color: 'var(--text-primary)', lineHeight: 1.3 }}>{vt.visit_name}</div>
                                                        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--accent)', fontWeight: 600, marginTop: 2 }}>
                                                            Day {vt.day_offset}
                                                            <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: 6 }}>±{vt.window_before}/{vt.window_after}d</span>
                                                        </div>
                                                    </button>
                                                    <div style={{ display: 'flex', gap: 2, flexShrink: 0, marginLeft: 'var(--space-2)' }}>
                                                        <button
                                                            className="btn btn-sm btn-ghost"
                                                            onClick={() => { setSelectedVisit(vt); setVisitNotes(vt.notes || ''); }}
                                                            style={{ color: 'var(--text-tertiary)', fontSize: 10, padding: '2px 6px' }}
                                                        >Edit</button>
                                                        <button
                                                            className="btn btn-sm btn-ghost"
                                                            onClick={() => handleDeleteVisit(vt.id)}
                                                            style={{ color: 'var(--text-tertiary)', fontSize: 10, padding: '2px 6px' }}
                                                        >✕</button>
                                                    </div>
                                                </div>
                                            </div>
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
                                            <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                                                <button className="btn btn-sm btn-ghost" onClick={() => { setEditingRule(rule); setSignalForm({ signal_type_id: rule.id, operator: rule.operator, threshold_number: rule.threshold_number?.toString() ?? '', unit: rule.unit ?? '' }); }} style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)' }}>Edit</button>
                                                <button className="btn btn-sm btn-ghost" onClick={() => handleDeleteSignal(rule.id)} style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)' }}>✕</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Cases Tabs */}
            {(() => {
                const SCREENING_STATUSES = ['NEW', 'IN_REVIEW', 'PENDING_INFO', 'LIKELY_ELIGIBLE'];
                const all = trial.screening_cases || [];
                const potentialCases = all.filter(c => c.status === 'FUTURE_CANDIDATE');
                const screeningCases = all.filter(c => SCREENING_STATUSES.includes(c.status));
                const enrolledCases = all.filter(c => c.status === 'ENROLLED');

                const tabStyle = (active: boolean): React.CSSProperties => ({
                    padding: '8px 18px',
                    fontSize: 'var(--font-sm)',
                    fontWeight: active ? 600 : 400,
                    color: active ? 'var(--accent)' : 'var(--text-secondary)',
                    background: 'none',
                    border: 'none',
                    borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                });

                const activeCases =
                    caseTab === 'potential' ? potentialCases :
                    caseTab === 'screening' ? screeningCases :
                    enrolledCases;

                return (
                    <div style={{ marginTop: 'var(--space-6)' }}>
                        {/* Tab bar */}
                        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 'var(--space-4)', gap: 0 }}>
                            <button style={tabStyle(caseTab === 'potential')} onClick={() => setCaseTab('potential')}>
                                Potential Cases
                                <span style={{ marginLeft: 6, fontSize: 11, background: 'var(--bg-secondary)', borderRadius: 10, padding: '1px 7px', color: 'var(--text-tertiary)' }}>{potentialCases.length}</span>
                            </button>
                            <button style={tabStyle(caseTab === 'screening')} onClick={() => setCaseTab('screening')}>
                                Screening Cases
                                <span style={{ marginLeft: 6, fontSize: 11, background: 'var(--bg-secondary)', borderRadius: 10, padding: '1px 7px', color: 'var(--text-tertiary)' }}>{screeningCases.length}</span>
                            </button>
                            <button style={tabStyle(caseTab === 'enrolled')} onClick={() => setCaseTab('enrolled')}>
                                Enrolled Cases
                                <span style={{ marginLeft: 6, fontSize: 11, background: 'var(--bg-secondary)', borderRadius: 10, padding: '1px 7px', color: 'var(--text-tertiary)' }}>{enrolledCases.length}</span>
                            </button>
                        </div>

                        {/* Tab content */}
                        {activeCases.length === 0 ? (
                            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                                <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)' }}>
                                    {caseTab === 'potential' && 'No future candidates for this trial.'}
                                    {caseTab === 'screening' && 'No active screening cases for this trial.'}
                                    {caseTab === 'enrolled' && 'No enrolled patients for this trial.'}
                                </p>
                            </div>
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
                                        {activeCases.map(sc => (
                                            <tr key={sc.id} onClick={() => navigate(`/screening/${sc.id}`)} style={{ cursor: 'pointer' }}>
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
                );
            })()}

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

            {/* Visit Assessments Modal */}
            {selectedVisit && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelectedVisit(null)}>
                    <div className="modal" style={{ maxWidth: 520 }}>
                        <div className="modal-header">
                            <div>
                                <h3 className="modal-title">{selectedVisit.visit_name}</h3>
                                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                                    Day {selectedVisit.day_offset} · Window −{selectedVisit.window_before}/+{selectedVisit.window_after}d · Reminder {selectedVisit.reminder_days_before}d before
                                </div>
                            </div>
                            <button className="modal-close" onClick={() => setSelectedVisit(null)}>✕</button>
                        </div>
                        <div style={{ padding: 'var(--space-4)' }}>
                            <label className="form-label" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>Assessments</label>
                            <textarea
                                className="form-input"
                                value={visitNotes}
                                onChange={e => setVisitNotes(e.target.value)}
                                placeholder={'List the assessments for this visit, e.g.:\n• Vital signs\n• Blood draw (CBC, LFTs, HbA1c)\n• Physical exam\n• ECG\n• Patient questionnaire'}
                                rows={10}
                                style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 'var(--font-sm)', lineHeight: 1.6 }}
                            />
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setSelectedVisit(null)}>Cancel</button>
                            <button
                                className="btn btn-primary"
                                disabled={savingVisitNotes}
                                onClick={async () => {
                                    setSavingVisitNotes(true);
                                    try {
                                        await api.updateVisitTemplate(selectedVisit.id, { notes: visitNotes });
                                        addToast('Assessments saved', 'success');
                                        setSelectedVisit(null);
                                        loadTrial();
                                    } catch (err) {
                                        addToast((err as Error).message, 'error');
                                    } finally {
                                        setSavingVisitNotes(false);
                                    }
                                }}
                            >
                                {savingVisitNotes ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Signal Rule Modal */}
            {editingRule && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditingRule(null)}>
                    <div className="modal">
                        <div className="modal-header">
                            <h3 className="modal-title">Edit Rule — {editingRule.signal_label}</h3>
                            <button className="modal-close" onClick={() => setEditingRule(null)}>✕</button>
                        </div>
                        <form onSubmit={handleUpdateSignal}>
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
                                <button type="button" className="btn btn-secondary" onClick={() => setEditingRule(null)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Save</button>
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
