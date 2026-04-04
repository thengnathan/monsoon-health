import { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useToast } from '../contexts/ToastContext';
import { StatusBadge, formatDate } from '../utils';
import type { TrialDetail, SignalType, VisitTemplate } from '../types';
import ProtocolViewer from '../components/ProtocolViewer';


interface VisitForm {
    visit_name: string;
    day_offset: string | number;
    window_before: string | number;
    window_after: string | number;
    reminder_days_before: string | number;
    sort_order: string | number;
}

interface SignalForm {
    mode: 'catalog' | 'freeform';
    // catalog mode
    signal_type_id: string;
    // freeform mode
    signal_label: string;
    criteria_text: string;
    // shared
    operator: string;
    threshold_number: string;
    min_value: string;
    max_value: string;
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

// ── Signal Rule Card ─────────────────────────────────────────────────────────

interface SignalRuleCardProps {
    chipLabel: string;
    chipStyle: React.CSSProperties;
    label: string;
    field?: string | null;
    threshold: string;
    isMatch: boolean;
    citationText: string | null;
    isAI: boolean;
    onEdit: () => void;
    onDelete: () => void;
}

function SignalRuleCard({ chipLabel, chipStyle, label, field, threshold, isMatch, citationText, isAI, onEdit, onDelete }: SignalRuleCardProps) {
    const [citationExpanded, setCitationExpanded] = useState(false);

    return (
        <div className="card" style={{ padding: 'var(--space-3) var(--space-4)' }}>
            {/* Top row: chip + label + threshold + badges + actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    padding: '2px 7px',
                    borderRadius: 4,
                    flexShrink: 0,
                    ...chipStyle,
                }}>
                    {chipLabel}
                </span>

                <span style={{ fontWeight: 600, fontSize: 'var(--font-base)', flex: 1, minWidth: 0 }}>
                    {label}
                </span>

                {!isMatch && threshold && (
                    <span style={{
                        fontSize: 'var(--font-sm)',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        marginLeft: 'auto',
                        flexShrink: 0,
                        fontVariantNumeric: 'tabular-nums',
                    }}>
                        {threshold}
                    </span>
                )}

                {isAI && (
                    <span style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: '2px 7px',
                        borderRadius: 10,
                        background: '#ccfbf1',
                        color: '#0f766e',
                        flexShrink: 0,
                    }}>
                        AI
                    </span>
                )}

                <button
                    onClick={onEdit}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '2px 4px', fontSize: 13, lineHeight: 1, flexShrink: 0 }}
                    title="Edit rule"
                >
                    ✎
                </button>
                <button
                    onClick={onDelete}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '2px 4px', fontSize: 13, lineHeight: 1, flexShrink: 0 }}
                    title="Delete rule"
                >
                    ✕
                </button>
            </div>

            {/* Field identifier */}
            {field && (
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginTop: 3 }}>
                    field: {field}
                </div>
            )}

            {/* TEXT_MATCH threshold shown below */}
            {isMatch && threshold && (
                <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', marginTop: 4, fontStyle: 'italic' }}>
                    {threshold}
                </div>
            )}

            {/* Citation line */}
            {citationText && (
                <div
                    onClick={() => setCitationExpanded(v => !v)}
                    style={{
                        marginTop: 6,
                        fontSize: 'var(--font-xs)',
                        color: 'var(--text-tertiary)',
                        fontStyle: 'italic',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitBoxOrient: 'vertical',
                        WebkitLineClamp: citationExpanded ? undefined : 1,
                        lineClamp: citationExpanded ? undefined : 1,
                    } as React.CSSProperties}
                    title={citationExpanded ? 'Click to collapse' : 'Click to expand'}
                >
                    "{citationText}"
                </div>
            )}
        </div>
    );
}

export default function TrialDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [trial, setTrial] = useState<TrialDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [showVisitModal, setShowVisitModal] = useState(false);
    const [showSignalModal, setShowSignalModal] = useState(false);
    const [reextracting, setReextracting] = useState(false);
    const [extractionPhase, setExtractionPhase] = useState<'idle' | 'waiting' | 'animating'>('idle');
    const extractionPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const animationTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
    const preExtractionBackupRef = useRef<TrialDetail | null>(null);
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
        }).catch(console.error).finally(() => setLoading(false));
    };

    // Clear any running animation timers
    const clearAnimationTimers = () => {
        animationTimersRef.current.forEach(t => clearTimeout(t));
        animationTimersRef.current = [];
    };

    // Kick off sequential animation: criteria → visits → rules, then back to idle
    const startSequentialAnimation = (data: TrialDetail) => {
        clearAnimationTimers();
        const criteriaCount =
            (data.protocol?.structured_data?.inclusion_criteria?.length ?? 0) +
            (data.protocol?.structured_data?.exclusion_criteria?.length ?? 0);
        const visitsCount = data.visit_templates?.length ?? 0;
        const rulesCount = data.signal_rules?.length ?? 0;

        // Criteria animate immediately (60ms stagger + 300ms animation duration)
        const criteriaEndMs = criteriaCount * 60 + 300;
        // Visits start 200ms after criteria finish
        const visitsEndMs = criteriaEndMs + 200 + visitsCount * 100 + 350;
        // Rules start 200ms after visits finish
        const rulesEndMs = visitsEndMs + 200 + rulesCount * 100 + 280;
        // Return to idle 200ms after last rule finishes
        const idleMs = rulesEndMs + 200;

        const t = setTimeout(() => {
            setExtractionPhase('idle');
            preExtractionBackupRef.current = null;
            clearAnimationTimers();
        }, Math.max(idleMs, 1500)); // minimum 1.5s so it's always visible
        animationTimersRef.current.push(t);
    };

    // Poll after extraction starts; stop when data arrives or after ~45s
    const startExtractionPoll = () => {
        if (extractionPollRef.current) clearInterval(extractionPollRef.current);
        setExtractionPhase('waiting');
        let attempts = 0;
        extractionPollRef.current = setInterval(async () => {
            attempts++;
            try {
                const data = await api.getTrial(id!);
                const hasData =
                    (data.visit_templates?.length > 0) ||
                    (data.signal_rules?.length > 0) ||
                    (data.protocol?.structured_data?.inclusion_criteria?.length ?? 0) > 0;
                if (hasData) {
                    clearInterval(extractionPollRef.current!);
                    setTrial(data);
                    setReextracting(false);
                    setExtractionPhase('animating');
                    startSequentialAnimation(data);
                } else if (attempts >= 15) {
                    clearInterval(extractionPollRef.current!);
                    setReextracting(false);
                    // Restore backup on timeout
                    if (preExtractionBackupRef.current) {
                        setTrial(preExtractionBackupRef.current);
                        addToast('Extraction timed out — previous data restored', 'error');
                    }
                    setExtractionPhase('idle');
                    preExtractionBackupRef.current = null;
                }
            } catch {
                clearInterval(extractionPollRef.current!);
                setReextracting(false);
                if (preExtractionBackupRef.current) {
                    setTrial(preExtractionBackupRef.current);
                    addToast('Extraction failed — previous data restored', 'error');
                }
                setExtractionPhase('idle');
                preExtractionBackupRef.current = null;
            }
        }, 3000);
    };

    useEffect(() => {
        loadTrial();
        api.getSignalTypes().then(setSignalTypes).catch(() => {});
        return () => {
            if (extractionPollRef.current) clearInterval(extractionPollRef.current);
            clearAnimationTimers();
        };
    }, [id]);

    const handleProtocolUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            await api.uploadProtocol(id!, file);
            addToast('Protocol uploaded — extracting criteria and visits…', 'success');
            loadTrial();
            startExtractionPoll();
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
        // Snapshot current data so we can restore on failure
        if (trial) preExtractionBackupRef.current = structuredClone(trial);
        try {
            await api.reextractProtocol(id!);
            addToast('Re-extraction started — updating in the background…', 'success');
            startExtractionPoll();
        } catch (err) {
            addToast((err as Error).message, 'error');
            setReextracting(false);
            setExtractionPhase('idle');
            preExtractionBackupRef.current = null;
        }
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

    const emptySignalForm: SignalForm = { mode: 'freeform', signal_type_id: '', signal_label: '', criteria_text: '', operator: 'GTE', threshold_number: '', min_value: '', max_value: '', unit: '' };
    const [signalForm, setSignalForm] = useState<SignalForm>(emptySignalForm);
    const [editingRule, setEditingRule] = useState<import('../types').SignalRule | null>(null);

    const handleAddSignal = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload: Record<string, unknown> = { operator: signalForm.operator };
            if (signalForm.mode === 'catalog') {
                payload.signal_type_id = signalForm.signal_type_id;
                if (signalForm.threshold_number) payload.threshold_number = parseFloat(signalForm.threshold_number);
                if (signalForm.unit) payload.unit = signalForm.unit;
            } else {
                payload.signal_label = signalForm.signal_label;
                payload.criteria_text = signalForm.criteria_text;
                if (signalForm.operator === 'BETWEEN') {
                    if (signalForm.min_value) payload.min_value = parseFloat(signalForm.min_value);
                    if (signalForm.max_value) payload.max_value = parseFloat(signalForm.max_value);
                } else {
                    if (signalForm.threshold_number) payload.threshold_number = parseFloat(signalForm.threshold_number);
                }
                if (signalForm.unit) payload.unit = signalForm.unit;
            }
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
            if (signalForm.criteria_text) payload.criteria_text = signalForm.criteria_text;
            if (signalForm.signal_label) payload.signal_label = signalForm.signal_label;
            if (signalForm.operator === 'BETWEEN') {
                if (signalForm.min_value) payload.min_value = parseFloat(signalForm.min_value);
                if (signalForm.max_value) payload.max_value = parseFloat(signalForm.max_value);
            } else {
                if (signalForm.threshold_number) payload.threshold_number = parseFloat(signalForm.threshold_number);
            }
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
    const operatorLabels: Record<string, string> = { GTE: '≥', LTE: '≤', EQ: '=', IN: 'in', BETWEEN: '↔', TEXT_MATCH: '≈' };

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
                    <p style={{ fontSize: 'var(--font-base)', color: 'var(--text-secondary)', lineHeight: 'var(--leading-relaxed)' }}>{trial.description}</p>
                </div>
            )}

            <div className="detail-grid">
                <div style={{ position: 'sticky', top: 'var(--space-8)', maxHeight: 'calc(100vh - 2 * var(--space-8))', overflowY: 'auto', alignSelf: 'start', paddingRight: 'var(--space-2)' }}>
                    {/* Protocol Upload */}
                    <div className="detail-section">
                        <div className="detail-section-title">Protocol Document</div>
                        {trial.protocol ? (
                            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4)' }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'var(--accent-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>📄</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 500, fontSize: 'var(--font-base)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={trial.protocol.filename}>
                                            {trial.protocol.filename.length > 25 ? trial.protocol.filename.slice(0, 25) + '…' : trial.protocol.filename}
                                        </div>
                                        <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)' }}>
                                            {formatFileSize(trial.protocol.file_size)} · {formatDate(trial.protocol.created_at)}
                                            {trial.protocol.version && ` · ${trial.protocol.version}`}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                        <a href={api.getProtocolUrl(id!)} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary" style={{ padding: '4px 10px' }}>View</a>
                                        <button className="btn btn-sm btn-ghost" onClick={handleDeleteProtocol} style={{ color: 'var(--error)', padding: '4px 10px' }}>Remove</button>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 'var(--space-2)', padding: '0 var(--space-4) var(--space-3)', borderTop: '1px solid var(--border-subtle)' }}>
                                    <button className="btn btn-sm btn-ghost" onClick={() => fileInputRef.current?.click()} style={{ marginTop: 'var(--space-2)' }}>Replace Protocol</button>
                                    <button
                                        className="btn btn-sm btn-ghost"
                                        onClick={handleReextract}
                                        disabled={reextracting || extractionPhase !== 'idle'}
                                        title="Re-run AI extraction on the uploaded protocol PDF"
                                        style={{ color: 'var(--text-tertiary)', marginTop: 'var(--space-2)' }}
                                    >
                                        {reextracting ? 'Re-extracting…' : '↺ Re-extract'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                                <div style={{ fontSize: 32, marginBottom: 'var(--space-3)', opacity: 0.4 }}>📄</div>
                                <p style={{ fontSize: 'var(--font-base)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-4)' }}>No protocol uploaded</p>
                                <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>Upload Protocol PDF</button>
                            </div>
                        )}
                        <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleProtocolUpload} style={{ display: 'none' }} />
                    </div>

                    {/* I/E Criteria */}
                    <div className="detail-section" style={{ marginTop: 'var(--space-6)' }}>
                        <div className="detail-section-title">Eligibility Criteria</div>
                        <div style={{ marginTop: 'var(--space-4)' }}>
                            {extractionPhase === 'waiting' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                    {[90, 75, 85, 60, 80, 70].map((w, i) => (
                                        <div key={i} className="skeleton" style={{ height: 36, width: `${w}%`, borderRadius: 6 }} />
                                    ))}
                                </div>
                            ) : trial.protocol?.structured_data ? (
                                <ProtocolViewer
                                    structuredData={trial.protocol.structured_data as Parameters<typeof ProtocolViewer>[0]['structuredData']}
                                    tab="criteria"
                                    animating={extractionPhase === 'animating'}
                                />
                            ) : (
                                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
                                    <p style={{ fontSize: 'var(--font-base)', color: 'var(--text-tertiary)' }}>No criteria defined yet. Upload the protocol to populate eligibility criteria.</p>
                                </div>
                            )}
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
                            padding: '8px 14px',
                            fontSize: 'var(--font-base)',
                            fontWeight: active ? 600 : 400,
                            color: active ? 'var(--accent)' : 'var(--text-secondary)',
                            background: 'none',
                            border: 'none',
                            borderBottom: active ? '3px solid var(--accent)' : '3px solid transparent',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            marginBottom: '-1px',
                            transition: 'color var(--transition-fast)',
                        });

                        const badgeStyle = (active: boolean): React.CSSProperties => ({
                            marginLeft: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            background: active ? 'var(--accent-muted)' : 'var(--bg-secondary)',
                            color: active ? 'var(--accent)' : 'var(--text-tertiary)',
                            borderRadius: 10,
                            padding: '2px 8px',
                            display: 'inline-block',
                            minWidth: 20,
                            textAlign: 'center',
                        });

                        const activeCases =
                            caseTab === 'potential' ? potentialCases :
                            caseTab === 'screening' ? screeningCases :
                            enrolledCases;

                        return (
                            <div className="detail-section">
                                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 'var(--space-4)', gap: 0 }}>
                                    <button style={tabStyle(caseTab === 'potential')} onClick={() => setCaseTab('potential')}>
                                        Potential
                                        <span style={badgeStyle(caseTab === 'potential')}>{potentialCases.length}</span>
                                    </button>
                                    <button style={tabStyle(caseTab === 'screening')} onClick={() => setCaseTab('screening')}>
                                        Screening
                                        <span style={badgeStyle(caseTab === 'screening')}>{screeningCases.length}</span>
                                    </button>
                                    <button style={tabStyle(caseTab === 'enrolled')} onClick={() => setCaseTab('enrolled')}>
                                        Enrolled
                                        <span style={badgeStyle(caseTab === 'enrolled')}>{enrolledCases.length}</span>
                                    </button>
                                </div>
                                {activeCases.length === 0 ? (
                                    <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8) var(--space-6)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)' }}>
                                        <div style={{ fontSize: 32, opacity: 0.35, marginBottom: 'var(--space-1)' }}>
                                            {caseTab === 'potential' ? '🔍' : caseTab === 'screening' ? '📋' : '✓'}
                                        </div>
                                        <p style={{ fontSize: 'var(--font-base)', color: 'var(--text-tertiary)', margin: 0, maxWidth: 240 }}>
                                            {caseTab === 'potential' && 'No future candidates for this trial yet.'}
                                            {caseTab === 'screening' && 'No active screening cases for this trial.'}
                                            {caseTab === 'enrolled' && 'No enrolled patients for this trial yet.'}
                                        </p>
                                        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', marginTop: 'var(--space-2)' }}>
                                            <button className="btn btn-sm btn-primary" onClick={() => navigate('/screening')}>Add Screening Case</button>
                                            <button className="btn btn-sm btn-ghost" onClick={() => navigate('/patients')} style={{ fontSize: 'var(--font-xs)', color: 'var(--accent)' }}>Import Patient List</button>
                                        </div>
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

                </div>

                <div>

                    {/* Visit Schedule */}
                    <div className="detail-section">
                        <div className="detail-section-title">Visit Schedule</div>
                        <div style={{ marginTop: 'var(--space-4)' }}>
                            {extractionPhase === 'waiting' ? (
                                <div className="card" style={{ padding: 'var(--space-4)' }}>
                                    {[80, 65, 75, 55, 70].map((w, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', marginBottom: i < 4 ? 'var(--space-4)' : 0 }}>
                                            <div className="skeleton" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
                                            <div style={{ flex: 1, paddingTop: 4 }}>
                                                <div className="skeleton" style={{ height: 14, width: `${w}%`, marginBottom: 8 }} />
                                                <div className="skeleton" style={{ height: 11, width: '40%' }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : trial.protocol?.structured_data ? (
                                <ProtocolViewer
                                    structuredData={trial.protocol.structured_data as Parameters<typeof ProtocolViewer>[0]['structuredData']}
                                    tab="visits"
                                    animating={extractionPhase === 'animating'}
                                />
                            ) : (
                                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
                                    <p style={{ fontSize: 'var(--font-base)', color: 'var(--text-tertiary)' }}>No visit schedule yet. Upload the protocol to populate visits.</p>
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
                            {extractionPhase === 'waiting' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                    {[70, 85, 60, 78, 65, 90].map((w, i) => (
                                        <div key={i} className="card" style={{ padding: 'var(--space-3) var(--space-4)' }}>
                                            <div className="skeleton" style={{ height: 14, width: '35%', marginBottom: 8 }} />
                                            <div className="skeleton" style={{ height: 13, width: `${w}%` }} />
                                        </div>
                                    ))}
                                </div>
                            ) : (!trial.signal_rules || trial.signal_rules.length === 0) ? (
                                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
                                    <p style={{ fontSize: 'var(--font-base)', color: 'var(--text-tertiary)' }}>No signal rules configured. Add rules to define eligibility thresholds.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                    {trial.signal_rules.map((rule, ruleIndex) => {
                                        const isBetween = rule.operator === 'BETWEEN';
                                        const isMatch = rule.operator === 'TEXT_MATCH';
                                        const chipType = isBetween ? 'BETWEEN' : isMatch ? 'MATCH' : 'NUMERIC';
                                        const chipStyles: Record<string, React.CSSProperties> = {
                                            NUMERIC: { background: '#dbeafe', color: '#1d4ed8' },
                                            BETWEEN: { background: '#ede9fe', color: '#7c3aed' },
                                            MATCH:   { background: '#fef3c7', color: '#b45309' },
                                        };
                                        const thresholdDisplay = isBetween
                                            ? `${rule.min_value ?? '?'} – ${rule.max_value ?? '?'}${rule.unit ? ' ' + rule.unit : ''}`
                                            : isMatch
                                            ? (rule.threshold_text || rule.criteria_text || '')
                                            : `${operatorLabels[rule.operator] || rule.operator} ${rule.threshold_number ?? rule.threshold_text ?? ''}${rule.unit ? ' ' + rule.unit : ''}`;

                                        return (
                                            <div
                                                key={rule.id}
                                                className={extractionPhase === 'animating' ? 'rule-fade-in' : undefined}
                                                style={extractionPhase === 'animating' ? { animationDelay: `${ruleIndex * 100}ms` } : undefined}
                                            >
                                            <SignalRuleCard
                                                chipLabel={chipType}
                                                chipStyle={chipStyles[chipType]}
                                                label={rule.signal_label || ''}
                                                field={rule.field}
                                                threshold={thresholdDisplay}
                                                isMatch={isMatch}
                                                citationText={rule.criteria_text || null}
                                                isAI={rule.source === 'ai_extracted'}
                                                onEdit={() => { setEditingRule(rule); setSignalForm({ mode: rule.source === 'ai_extracted' || !rule.signal_type_id ? 'freeform' : 'catalog', signal_type_id: rule.signal_type_id || '', signal_label: rule.signal_label || '', criteria_text: rule.criteria_text || '', operator: rule.operator, threshold_number: rule.threshold_number?.toString() ?? '', min_value: rule.min_value?.toString() ?? '', max_value: rule.max_value?.toString() ?? '', unit: rule.unit ?? '' }); }}
                                                onDelete={() => handleDeleteSignal(rule.id)}
                                            />
                                            </div>
                                        );
                                    })}
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

            {/* Visit Assessments Modal */}
            {selectedVisit && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelectedVisit(null)}>
                    <div className="modal" style={{ maxWidth: 520 }}>
                        <div className="modal-header">
                            <div>
                                <h3 className="modal-title">{selectedVisit.visit_name}</h3>
                                <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)', marginTop: 2 }}>
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
                                style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 'var(--font-base)', lineHeight: 1.6 }}
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
                            <div className="form-group">
                                <label className="form-label">Label</label>
                                <input className="form-input" value={signalForm.signal_label} onChange={e => setSignalForm({ ...signalForm, signal_label: e.target.value })} placeholder="e.g. FibroScan, Age, HbA1c" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Criterion Text</label>
                                <input className="form-input" value={signalForm.criteria_text} onChange={e => setSignalForm({ ...signalForm, criteria_text: e.target.value })} placeholder="e.g. FibroScan ≥ 8 kPa" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Operator *</label>
                                <select className="form-select" value={signalForm.operator} onChange={e => setSignalForm({ ...signalForm, operator: e.target.value })}>
                                    <option value="GTE">≥ Greater or equal</option>
                                    <option value="LTE">≤ Less or equal</option>
                                    <option value="EQ">= Equals</option>
                                    <option value="BETWEEN">↔ Range (between)</option>
                                    <option value="IN">in (list)</option>
                                    <option value="TEXT_MATCH">≈ Qualitative match</option>
                                </select>
                            </div>
                            {signalForm.operator === 'BETWEEN' ? (
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Min</label>
                                        <input className="form-input" type="number" step="any" value={signalForm.min_value} onChange={e => setSignalForm({ ...signalForm, min_value: e.target.value })} placeholder="e.g. 18" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Max</label>
                                        <input className="form-input" type="number" step="any" value={signalForm.max_value} onChange={e => setSignalForm({ ...signalForm, max_value: e.target.value })} placeholder="e.g. 75" />
                                    </div>
                                </div>
                            ) : signalForm.operator !== 'TEXT_MATCH' ? (
                                <div className="form-group">
                                    <label className="form-label">Threshold</label>
                                    <input className="form-input" type="number" step="any" value={signalForm.threshold_number} onChange={e => setSignalForm({ ...signalForm, threshold_number: e.target.value })} placeholder="e.g. 8.0" />
                                </div>
                            ) : null}
                            <div className="form-group">
                                <label className="form-label">Unit</label>
                                <input className="form-input" value={signalForm.unit} onChange={e => setSignalForm({ ...signalForm, unit: e.target.value })} placeholder="e.g. kPa, years, %" />
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
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && (setShowSignalModal(false), setSignalForm(emptySignalForm))}>
                    <div className="modal">
                        <div className="modal-header">
                            <h3 className="modal-title">Add Signal Rule</h3>
                            <button className="modal-close" onClick={() => { setShowSignalModal(false); setSignalForm(emptySignalForm); }}>✕</button>
                        </div>
                        {/* Mode toggle */}
                        <div style={{ display: 'flex', gap: 0, margin: '0 0 var(--space-5)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                            {(['freeform', 'catalog'] as const).map(m => (
                                <button key={m} type="button"
                                    onClick={() => setSignalForm({ ...signalForm, mode: m })}
                                    style={{ flex: 1, padding: 'var(--space-2)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--font-base)', fontWeight: 600, transition: 'all var(--transition-fast)',
                                             background: signalForm.mode === m ? 'var(--accent)' : 'var(--bg-surface)',
                                             color: signalForm.mode === m ? 'white' : 'var(--text-secondary)' }}>
                                    {m === 'freeform' ? 'Free-form' : 'Signal Catalog'}
                                </button>
                            ))}
                        </div>
                        <form onSubmit={handleAddSignal}>
                            {signalForm.mode === 'freeform' ? (
                                <>
                                    <div className="form-group">
                                        <label className="form-label">Label *</label>
                                        <input className="form-input" value={signalForm.signal_label} onChange={e => setSignalForm({ ...signalForm, signal_label: e.target.value })} placeholder="e.g. FibroScan, Age, HbA1c" required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Criterion Text *</label>
                                        <input className="form-input" value={signalForm.criteria_text} onChange={e => setSignalForm({ ...signalForm, criteria_text: e.target.value })} placeholder="e.g. FibroScan ≥ 8 kPa or Age 18–75 years" required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Operator *</label>
                                        <select className="form-select" value={signalForm.operator} onChange={e => setSignalForm({ ...signalForm, operator: e.target.value })}>
                                            <option value="GTE">≥ Greater or equal</option>
                                            <option value="LTE">≤ Less or equal</option>
                                            <option value="EQ">= Equals</option>
                                            <option value="BETWEEN">↔ Range (between)</option>
                                            <option value="IN">in (list)</option>
                                            <option value="TEXT_MATCH">≈ Qualitative match</option>
                                        </select>
                                    </div>
                                    {signalForm.operator === 'BETWEEN' ? (
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label className="form-label">Min</label>
                                                <input className="form-input" type="number" step="any" value={signalForm.min_value} onChange={e => setSignalForm({ ...signalForm, min_value: e.target.value })} placeholder="e.g. 18" />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Max</label>
                                                <input className="form-input" type="number" step="any" value={signalForm.max_value} onChange={e => setSignalForm({ ...signalForm, max_value: e.target.value })} placeholder="e.g. 75" />
                                            </div>
                                        </div>
                                    ) : signalForm.operator !== 'TEXT_MATCH' ? (
                                        <div className="form-group">
                                            <label className="form-label">Threshold</label>
                                            <input className="form-input" type="number" step="any" value={signalForm.threshold_number} onChange={e => setSignalForm({ ...signalForm, threshold_number: e.target.value })} placeholder="e.g. 8.0" />
                                        </div>
                                    ) : null}
                                    <div className="form-group">
                                        <label className="form-label">Unit</label>
                                        <input className="form-input" value={signalForm.unit} onChange={e => setSignalForm({ ...signalForm, unit: e.target.value })} placeholder="e.g. kPa, years, %" />
                                    </div>
                                </>
                            ) : (
                                <>
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
                                                <option value="BETWEEN">↔ Range (between)</option>
                                                <option value="IN">in (list)</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Threshold *</label>
                                            <input className="form-input" type="number" step="any" value={signalForm.threshold_number} onChange={e => setSignalForm({ ...signalForm, threshold_number: e.target.value })} placeholder="e.g. 8.0" required />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Unit</label>
                                        <input className="form-input" value={signalForm.unit} onChange={e => setSignalForm({ ...signalForm, unit: e.target.value })} placeholder="e.g. kPa, IU/mL" />
                                    </div>
                                </>
                            )}
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => { setShowSignalModal(false); setSignalForm(emptySignalForm); }}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Add Rule</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
