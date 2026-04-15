import { useState, useEffect } from 'react';
import { api } from '../api';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import { Select } from '../components/Select';
import type { SpecialtyKey, SpecialtyTemplate, SiteSettingsResponse, SignalType } from '../types';

type Section = 'general' | 'profile' | 'trial_profile' | 'team' | 'preview';

interface TeamUser {
    id: string;
    name: string;
    email: string;
    role: string;
    is_active: boolean;
    created_at: string;
}

const SPECIALTY_META: Record<SpecialtyKey, { color: string; lightBg: string; icon: string; description: string }> = {
    HEPATOLOGY: { color: '#4a90c4', lightBg: 'rgba(74,144,196,0.07)', icon: 'H', description: 'Liver disease & fibrosis' },
    ONCOLOGY:   { color: '#c4744a', lightBg: 'rgba(196,116,74,0.07)', icon: 'O', description: 'Cancer & tumor trials' },
    HEMATOLOGY: { color: '#7a4ac4', lightBg: 'rgba(122,74,196,0.07)', icon: 'B', description: 'Blood & bone marrow disorders' },
};

const SECTION_LABELS: Record<string, string> = {
    signals: 'Signals', labs: 'Labs', vitals: 'Vitals', imaging: 'Imaging',
    diagnoses: 'Diagnoses', medications: 'Medications', lifestyle: 'Lifestyle',
    surgical_history: 'Surgical History', family_history: 'Family History',
};

const ROLE_OPTIONS = ['CRC', 'MANAGER'];

function initials(name: string) {
    return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
}

// ── Nav ───────────────────────────────────────────────────────────────────────

function SectionNav({ active, onChange }: { active: Section; onChange: (s: Section) => void }) {
    const items: { key: Section; label: string }[] = [
        { key: 'general', label: 'General' },
        { key: 'profile', label: 'Patient Profile' },
        { key: 'trial_profile', label: 'Trial Profile' },
        { key: 'preview', label: 'Patient Preview' },
        { key: 'team', label: 'Team' },
    ];
    return (
        <div style={{ display: 'flex', gap: 2, marginBottom: 'var(--space-6)', borderBottom: '1px solid var(--border-subtle)' }}>
            {items.map(item => (
                <button key={item.key} onClick={() => onChange(item.key)} style={{
                    padding: '8px 16px', background: 'none', border: 'none',
                    borderBottom: active === item.key ? '2px solid var(--accent)' : '2px solid transparent',
                    marginBottom: -1,
                    color: active === item.key ? 'var(--accent)' : 'var(--text-tertiary)',
                    fontWeight: active === item.key ? 600 : 400,
                    fontSize: 'var(--font-sm)', cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                }}>
                    {item.label}
                </button>
            ))}
        </div>
    );
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, color }: { checked: boolean; onChange: () => void; color: string }) {
    return (
        <button onClick={onChange} style={{
            width: 38, height: 21, borderRadius: 11,
            background: checked ? color : 'var(--border-strong)',
            border: 'none', cursor: 'pointer', position: 'relative',
            transition: 'background 0.2s', flexShrink: 0,
        }}>
            <span style={{
                position: 'absolute', top: 2.5, left: checked ? 19 : 2.5,
                width: 16, height: 16, borderRadius: '50%', background: '#fff',
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
            }} />
        </button>
    );
}

// ── General ───────────────────────────────────────────────────────────────────

function GeneralSection({ siteName, siteId }: { siteName: string; siteId: string }) {
    const { addToast } = useToast();
    const [name, setName] = useState(siteName);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const intakeUrl = `${window.location.origin}/intake?site=${encodeURIComponent(siteId)}`;

    const handleSaveName = async () => {
        if (!name.trim() || name === siteName) return;
        setSaving(true);
        try {
            await api.updateSiteName(name.trim());
            addToast('Site name updated', 'success');
        } catch (e) { addToast((e as Error).message, 'error'); }
        setSaving(false);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(intakeUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                {/* Site Name Row */}
                <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 6 }}>
                            Site Name
                        </div>
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                            style={{
                                width: '100%', padding: '7px 11px',
                                background: 'var(--bg-root)', border: '1px solid var(--border-default)',
                                borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                                fontSize: 'var(--font-base)', outline: 'none', fontFamily: 'inherit',
                            }}
                        />
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={handleSaveName}
                        disabled={saving || !name.trim() || name === siteName}
                        style={{ alignSelf: 'flex-end' }}>
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>

                {/* Intake Link Row */}
                <div style={{ padding: 'var(--space-4) var(--space-5)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 6 }}>
                            Patient Intake Link
                        </div>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            background: 'var(--bg-root)', border: '1px solid var(--border-default)',
                            borderRadius: 'var(--radius-sm)', padding: '7px 11px',
                        }}>
                            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>🔗</span>
                            <span style={{ flex: 1, fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {intakeUrl}
                            </span>
                        </div>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={handleCopy} style={{ alignSelf: 'flex-end', minWidth: 76 }}>
                        {copied ? '✓ Copied' : 'Copy'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Patient Profile ───────────────────────────────────────────────────────────

function ProfileSection({ data }: { data: SiteSettingsResponse }) {
    const { addToast } = useToast();
    const { reload: reloadSiteConfig } = useSiteConfig();
    const [selectedSpecialties, setSelectedSpecialties] = useState<SpecialtyKey[]>(data.site.patient_profile_config?.specialties || []);
    const [enabledOptions, setEnabledOptions] = useState<Set<string>>(new Set(data.site.patient_profile_config?.enabled_options || []));
    const [expandedSpecialty, setExpandedSpecialty] = useState<SpecialtyKey | null>(selectedSpecialties[0] || null);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    const toggleSpecialty = (key: SpecialtyKey) => {
        setSelectedSpecialties(prev => {
            const isOn = prev.includes(key);
            const next = isOn ? prev.filter(s => s !== key) : [...prev, key];
            if (!isOn && data.specialty_templates[key]) {
                const defaults = data.specialty_templates[key].options.slice(0, 10).map(o => o.id);
                setEnabledOptions(opts => { const s = new Set(opts); defaults.forEach(d => s.add(d)); return s; });
                setExpandedSpecialty(key);
            }
            if (isOn && expandedSpecialty === key) setExpandedSpecialty(next[0] || null);
            setDirty(true);
            return next;
        });
    };

    const toggleOption = (id: string) => {
        setEnabledOptions(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
        setDirty(true);
    };

    const selectAll = (key: SpecialtyKey) => {
        const ids = data.specialty_templates[key].options.map(o => o.id);
        setEnabledOptions(prev => { const s = new Set(prev); ids.forEach(id => s.add(id)); return s; });
        setDirty(true);
    };

    const selectNone = (key: SpecialtyKey) => {
        const ids = new Set(data.specialty_templates[key].options.map(o => o.id));
        setEnabledOptions(prev => { const s = new Set(prev); ids.forEach(id => s.delete(id)); return s; });
        setDirty(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.updateSiteSettings({ specialties: selectedSpecialties, enabled_options: Array.from(enabledOptions) });
            addToast('Saved', 'success');
            setDirty(false);
            reloadSiteConfig();
        } catch (e) { addToast((e as Error).message, 'error'); }
        setSaving(false);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                {data.all_specialty_keys.map((key, i) => {
                    const meta = SPECIALTY_META[key];
                    const tmpl = data.specialty_templates[key];
                    const isOn = selectedSpecialties.includes(key);
                    const enabledCount = tmpl.options.filter(o => enabledOptions.has(o.id)).length;
                    const isExpanded = expandedSpecialty === key && isOn;
                    const isLast = i === data.all_specialty_keys.length - 1;

                    const bySection: Record<string, SpecialtyTemplate['options']> = {};
                    for (const opt of tmpl.options) {
                        if (!bySection[opt.section]) bySection[opt.section] = [];
                        bySection[opt.section].push(opt);
                    }

                    return (
                        <div key={key} style={{ borderBottom: isLast && !isExpanded ? 'none' : '1px solid var(--border-subtle)' }}>
                            {/* Specialty row */}
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                                padding: 'var(--space-3) var(--space-5)',
                                borderLeft: `3px solid ${isOn ? meta.color : 'transparent'}`,
                                background: isOn ? meta.lightBg : 'transparent',
                                transition: 'all 0.2s',
                            }}>
                                <div style={{
                                    width: 34, height: 34, borderRadius: 'var(--radius-sm)', flexShrink: 0,
                                    background: isOn ? meta.color : 'var(--bg-root)',
                                    border: `1px solid ${isOn ? meta.color : 'var(--border-default)'}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: isOn ? '#fff' : 'var(--text-tertiary)',
                                    fontWeight: 700, fontSize: 13, transition: 'all 0.2s',
                                }}>
                                    {meta.icon}
                                </div>

                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontWeight: 600, fontSize: 'var(--font-sm)', color: isOn ? meta.color : 'var(--text-primary)' }}>
                                            {tmpl.label}
                                        </span>
                                        {isOn && (
                                            <span style={{
                                                fontSize: 10, padding: '1px 6px', borderRadius: 'var(--radius-full)',
                                                background: `${meta.color}20`, color: meta.color, fontWeight: 600,
                                            }}>
                                                {enabledCount}/{tmpl.options.length} fields
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>
                                        {meta.description}
                                    </div>
                                </div>

                                {isOn && (
                                    <button className="btn btn-ghost btn-sm" onClick={() => setExpandedSpecialty(isExpanded ? null : key)}
                                        style={{ color: meta.color, fontSize: 11 }}>
                                        {isExpanded ? 'Done' : 'Fields'}
                                    </button>
                                )}

                                <Toggle checked={isOn} onChange={() => toggleSpecialty(key)} color={meta.color} />
                            </div>

                            {/* Expanded field picker */}
                            {isExpanded && (
                                <div style={{ borderTop: `1px solid ${meta.color}20`, background: 'var(--bg-root)', padding: 'var(--space-4) var(--space-5)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                                        <button className="btn btn-ghost btn-sm" onClick={() => selectAll(key)}>Select all</button>
                                        <button className="btn btn-ghost btn-sm" onClick={() => selectNone(key)}>Clear all</button>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
                                        {Object.entries(bySection).map(([section, opts]) => (
                                            <div key={section}>
                                                <div style={{
                                                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                                                    letterSpacing: '0.07em', color: meta.color,
                                                    marginBottom: 6, paddingBottom: 4,
                                                    borderBottom: `1px solid ${meta.color}25`,
                                                }}>
                                                    {SECTION_LABELS[section] || section}
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                                    {opts.map(opt => {
                                                        const checked = enabledOptions.has(opt.id);
                                                        return (
                                                            <div key={opt.id} onClick={e => { e.stopPropagation(); toggleOption(opt.id); }} style={{
                                                                display: 'flex', alignItems: 'center', gap: 8,
                                                                cursor: 'pointer', fontSize: 'var(--font-sm)',
                                                                color: checked ? 'var(--text-primary)' : 'var(--text-secondary)',
                                                                padding: '4px 6px', borderRadius: 4,
                                                                background: checked ? 'var(--accent-sea-blue-subtle)' : 'transparent',
                                                                transition: 'background 0.15s, color 0.15s',
                                                                userSelect: 'none',
                                                            }}>
                                                                <span style={{
                                                                    width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                                                                    border: `1.5px solid ${checked ? 'var(--accent-sea-blue)' : 'var(--border-strong)'}`,
                                                                    background: checked ? 'var(--accent-sea-blue)' : 'transparent',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    transition: 'all 0.15s',
                                                                    opacity: checked ? 0.85 : 1,
                                                                }}>
                                                                    {checked && (
                                                                        <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                                                                            <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                                                        </svg>
                                                                    )}
                                                                </span>
                                                                {opt.label}
                                                            </div>
                                                        );
                                                    })}
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

            {dirty && (
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-lg)', padding: 'var(--space-3) var(--space-5)',
                }}>
                    <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>Unsaved changes</span>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => {
                            setSelectedSpecialties(data.site.patient_profile_config?.specialties || []);
                            setEnabledOptions(new Set(data.site.patient_profile_config?.enabled_options || []));
                            setDirty(false);
                        }}>Discard</button>
                        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Patient Preview ───────────────────────────────────────────────────────────

const PREVIEW_SECTIONS = [
    { key: 'diagnoses', label: 'Diagnoses', description: 'Active & chronic diagnoses for the patient' },
    { key: 'labs', label: 'Latest Labs', description: 'Most recent lab values (ALT, AST, etc.)' },
    { key: 'imaging', label: 'Imaging', description: 'FibroScan results and other imaging' },
    { key: 'medications', label: 'Medications', description: 'Current medications and dosages' },
] as const;

type PreviewKey = typeof PREVIEW_SECTIONS[number]['key'];

function loadPreviewConfig(): Record<PreviewKey, boolean> {
    try {
        const raw = localStorage.getItem('patientPreviewConfig');
        if (raw) return JSON.parse(raw);
    } catch {}
    return { diagnoses: true, labs: true, imaging: true, medications: true };
}

function PreviewSection() {
    const { addToast } = useToast();
    const [config, setConfig] = useState<Record<PreviewKey, boolean>>(loadPreviewConfig);

    const toggle = (key: PreviewKey) => {
        setConfig(prev => {
            const next = { ...prev, [key]: !prev[key] };
            localStorage.setItem('patientPreviewConfig', JSON.stringify(next));
            return next;
        });
        addToast('Preview updated', 'success');
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                Choose which sections appear in the patient list dropdown preview. Changes take effect immediately.
            </div>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                {PREVIEW_SECTIONS.map((sec, i) => {
                    const isLast = i === PREVIEW_SECTIONS.length - 1;
                    const isOn = config[sec.key];
                    return (
                        <div key={sec.key} style={{
                            display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
                            padding: 'var(--space-4) var(--space-5)',
                            borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)',
                            borderLeft: `3px solid ${isOn ? 'var(--accent)' : 'transparent'}`,
                            background: isOn ? 'var(--accent-muted)' : 'transparent',
                            transition: 'all 0.2s',
                        }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)', color: isOn ? 'var(--accent)' : 'var(--text-primary)', marginBottom: 2 }}>
                                    {sec.label}
                                </div>
                                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>
                                    {sec.description}
                                </div>
                            </div>
                            <Toggle checked={isOn} onChange={() => toggle(sec.key)} color="var(--accent)" />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Team ──────────────────────────────────────────────────────────────────────

function TeamSection() {
    const { addToast } = useToast();
    const { user: currentUser } = useAuth();
    const [team, setTeam] = useState<TeamUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    useEffect(() => {
        api.getSiteTeam()
            .then(setTeam)
            .catch(() => addToast('Could not load team', 'error'))
            .finally(() => setLoading(false));
    }, []);

    const handleApprove = async (user: TeamUser) => {
        setUpdatingId(user.id);
        try {
            const updated = await api.updateTeamMember(user.id, { is_active: true });
            setTeam(t => t.map(u => u.id === user.id ? { ...u, ...updated } : u));
            addToast(`${user.name} approved`, 'success');
        } catch (e) { addToast((e as Error).message, 'error'); }
        setUpdatingId(null);
    };

    const handleReject = async (user: TeamUser) => {
        if (!window.confirm(`Reject and remove ${user.name}? This will delete their account from Clerk and cannot be undone.`)) return;
        setUpdatingId(user.id);
        try {
            await api.rejectTeamMember(user.id);
            setTeam(t => t.filter(u => u.id !== user.id));
            addToast(`${user.name} rejected and removed`, 'info');
        } catch (e) { addToast((e as Error).message, 'error'); }
        setUpdatingId(null);
    };

    const handleRoleChange = async (user: TeamUser, role: string) => {
        setUpdatingId(user.id);
        try {
            const updated = await api.updateTeamMember(user.id, { role });
            setTeam(t => t.map(u => u.id === user.id ? { ...u, ...updated } : u));
            addToast('Role updated', 'success');
        } catch (e) { addToast((e as Error).message, 'error'); }
        setUpdatingId(null);
    };

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

    const pending = team.filter(u => !u.is_active);
    const active = team.filter(u => u.is_active);

    const UserRow = ({ user }: { user: TeamUser }) => {
        const isSelf = user.id === currentUser?.id;
        const isUpdating = updatingId === user.id;
        const roleColor = user.role === 'MANAGER' ? 'var(--accent)' : 'var(--text-tertiary)';

        return (
            <div style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                padding: 'var(--space-3) var(--space-5)',
                borderBottom: '1px solid var(--border-subtle)',
                opacity: isUpdating ? 0.5 : 1, transition: 'opacity 0.15s',
            }}>
                <div style={{
                    width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                    background: user.is_active ? 'var(--accent-muted)' : 'var(--bg-root)',
                    border: `1px solid ${user.is_active ? 'var(--accent)' : 'var(--border-default)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    color: user.is_active ? 'var(--accent)' : 'var(--text-tertiary)',
                }}>
                    {initials(user.name)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 'var(--font-sm)', color: 'var(--text-primary)' }}>{user.name}</span>
                        {isSelf && (
                            <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 'var(--radius-full)', background: 'var(--accent-muted)', color: 'var(--accent)', fontWeight: 600 }}>
                                You
                            </span>
                        )}
                    </div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>{user.email}</div>
                </div>

                {!isSelf ? (
                    <Select
                        value={user.role}
                        onChange={val => handleRoleChange(user, val)}
                        disabled={isUpdating}
                        options={ROLE_OPTIONS.map(r => ({ value: r, label: r }))}
                        style={{
                            width: 'auto', padding: '3px 8px',
                            background: 'var(--bg-root)',
                            border: '1px solid var(--border-default)',
                            borderRadius: 'var(--radius-sm)',
                            color: roleColor, fontSize: 'var(--font-xs)', fontWeight: 600,
                        }}
                    />
                ) : (
                    <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: roleColor, padding: '3px 8px' }}>{user.role}</span>
                )}

                {user.is_active ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 64 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--status-eligible)', flexShrink: 0 }} />
                        <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Active</span>
                    </div>
                ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-danger btn-sm" onClick={() => handleReject(user)} disabled={isUpdating}>
                            Reject
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={() => handleApprove(user)} disabled={isUpdating}>
                            {isUpdating ? '…' : 'Approve'}
                        </button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {pending.length > 0 && (
                <div style={{ background: 'var(--bg-surface)', border: '1px solid rgba(212,169,90,0.3)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                    <div style={{ padding: 'var(--space-3) var(--space-5)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--status-in-review)', flexShrink: 0 }} />
                        <span style={{ fontSize: 'var(--font-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--status-in-review)' }}>
                            Pending Approval — {pending.length}
                        </span>
                    </div>
                    {pending.map(u => <UserRow key={u.id} user={u} />)}
                </div>
            )}

            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                <div style={{ padding: 'var(--space-3) var(--space-5)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: 'var(--font-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>
                        Team — {active.length}
                    </span>
                </div>
                {active.length === 0
                    ? <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--font-sm)' }}>No active members yet.</div>
                    : active.map(u => <UserRow key={u.id} user={u} />)
                }
            </div>
        </div>
    );
}

// ── Trial Profile ─────────────────────────────────────────────────────────────

function TrialProfileSection({ data }: { data: SiteSettingsResponse }) {
    const { addToast } = useToast();
    const [signalTypes, setSignalTypes] = useState<SignalType[]>([]);
    const [loadingSignals, setLoadingSignals] = useState(true);
    const [expandedSpecialty, setExpandedSpecialty] = useState<SpecialtyKey | null>(null);

    const initialSpecialties = data.site.patient_profile_config?.trial_profile_specialties ?? [];
    const initialSignals = data.site.patient_profile_config?.trial_profile_signals ?? {};
    const [enabledSpecialties, setEnabledSpecialties] = useState<SpecialtyKey[]>(initialSpecialties);
    const [selections, setSelections] = useState<Record<SpecialtyKey, Set<string>>>(() => ({
        HEPATOLOGY: new Set(initialSignals.HEPATOLOGY ?? []),
        ONCOLOGY:   new Set(initialSignals.ONCOLOGY   ?? []),
        HEMATOLOGY: new Set(initialSignals.HEMATOLOGY ?? []),
    }));
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.getSignalTypes()
            .then(setSignalTypes)
            .catch(() => addToast('Could not load signal types', 'error'))
            .finally(() => setLoadingSignals(false));
    }, []);

    const toggleSpecialty = (key: SpecialtyKey) => {
        setEnabledSpecialties(prev => {
            const isOn = prev.includes(key);
            const next = isOn ? prev.filter(s => s !== key) : [...prev, key];
            if (!isOn) setExpandedSpecialty(key);
            if (isOn && expandedSpecialty === key) setExpandedSpecialty(null);
            return next;
        });
        setDirty(true);
    };

    const toggle = (key: SpecialtyKey, id: string) => {
        setSelections(prev => {
            const s = new Set(prev[key]);
            s.has(id) ? s.delete(id) : s.add(id);
            return { ...prev, [key]: s };
        });
        setDirty(true);
    };

    const selectAll = (key: SpecialtyKey, types: SignalType[]) => {
        setSelections(prev => ({ ...prev, [key]: new Set(types.map(t => t.id)) }));
        setDirty(true);
    };

    const clearAll = (key: SpecialtyKey) => {
        setSelections(prev => ({ ...prev, [key]: new Set() }));
        setDirty(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.updateTrialProfile({
                trial_profile_specialties: enabledSpecialties,
                trial_profile_signals: Object.fromEntries(
                    Object.entries(selections).map(([k, ids]) => [k, Array.from(ids)])
                ),
            });
            addToast('Saved', 'success');
            setDirty(false);
        } catch (e) { addToast((e as Error).message, 'error'); }
        setSaving(false);
    };

    // Bucket signal types by specialty
    const bySpecialty: Record<SpecialtyKey, SignalType[]> = {
        HEPATOLOGY: signalTypes.filter(s => s.specialty === 'HEPATOLOGY'),
        ONCOLOGY:   signalTypes.filter(s => s.specialty === 'ONCOLOGY'),
        HEMATOLOGY: signalTypes.filter(s => s.specialty === 'HEMATOLOGY'),
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                {data.all_specialty_keys.map((key, i) => {
                    const meta = SPECIALTY_META[key];
                    const tmpl = data.specialty_templates[key];
                    const types = bySpecialty[key];
                    const selectedSet = selections[key];
                    const isOn = enabledSpecialties.includes(key);
                    const isExpanded = expandedSpecialty === key && isOn;
                    const isLast = i === data.all_specialty_keys.length - 1;

                    return (
                        <div key={key} style={{ borderBottom: isLast && !isExpanded ? 'none' : '1px solid var(--border-subtle)' }}>
                            {/* Specialty row */}
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                                padding: 'var(--space-3) var(--space-5)',
                                borderLeft: `3px solid ${isOn ? meta.color : 'transparent'}`,
                                background: isOn ? meta.lightBg : 'transparent',
                                transition: 'all 0.2s',
                            }}>
                                <div style={{
                                    width: 34, height: 34, borderRadius: 'var(--radius-sm)', flexShrink: 0,
                                    background: isOn ? meta.color : 'var(--bg-root)',
                                    border: `1px solid ${isOn ? meta.color : 'var(--border-default)'}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: isOn ? '#fff' : 'var(--text-tertiary)',
                                    fontWeight: 700, fontSize: 13, transition: 'all 0.2s',
                                }}>
                                    {meta.icon}
                                </div>

                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontWeight: 600, fontSize: 'var(--font-sm)', color: isOn ? meta.color : 'var(--text-primary)' }}>
                                            {tmpl.label}
                                        </span>
                                        {isOn && selectedSet.size > 0 && (
                                            <span style={{
                                                fontSize: 10, padding: '1px 6px', borderRadius: 'var(--radius-full)',
                                                background: `${meta.color}20`, color: meta.color, fontWeight: 600,
                                            }}>
                                                {selectedSet.size}/{types.length} signals
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>
                                        {meta.description}
                                    </div>
                                </div>

                                {isOn && (
                                    <button className="btn btn-ghost btn-sm"
                                        onClick={() => setExpandedSpecialty(isExpanded ? null : key)}
                                        style={{ color: meta.color, fontSize: 11 }}>
                                        {isExpanded ? 'Done' : 'Signals'}
                                    </button>
                                )}

                                <Toggle checked={isOn} onChange={() => toggleSpecialty(key)} color={meta.color} />
                            </div>

                            {/* Expanded signal picker */}
                            {isExpanded && (
                                <div style={{ borderTop: `1px solid ${meta.color}20`, background: 'var(--bg-root)', padding: 'var(--space-4) var(--space-5)' }}>
                                    {loadingSignals ? (
                                        <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--font-sm)' }}>Loading…</div>
                                    ) : types.length === 0 ? (
                                        <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--font-sm)' }}>No signals for this specialty yet.</div>
                                    ) : (
                                        <>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                                                <button className="btn btn-ghost btn-sm" onClick={() => selectAll(key, types)}>Select all</button>
                                                <button className="btn btn-ghost btn-sm" onClick={() => clearAll(key)}>Clear all</button>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                                                {Object.entries(
                                                    types.reduce<Record<string, SignalType[]>>((acc, st) => {
                                                        const cat = st.category ?? 'Other';
                                                        if (!acc[cat]) acc[cat] = [];
                                                        acc[cat].push(st);
                                                        return acc;
                                                    }, {})
                                                ).map(([cat, catTypes]) => (
                                                    <div key={cat}>
                                                        <div style={{
                                                            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                                                            letterSpacing: '0.07em', color: meta.color,
                                                            marginBottom: 6, paddingBottom: 4,
                                                            borderBottom: `1px solid ${meta.color}25`,
                                                        }}>
                                                            {cat}
                                                        </div>
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 2 }}>
                                                            {catTypes.map(st => {
                                                                const checked = selectedSet.has(st.id);
                                                                return (
                                                                    <div key={st.id} onClick={() => toggle(key, st.id)} style={{
                                                                        display: 'flex', alignItems: 'center', gap: 8,
                                                                        cursor: 'pointer', fontSize: 'var(--font-sm)',
                                                                        color: checked ? 'var(--text-primary)' : 'var(--text-secondary)',
                                                                        padding: '4px 6px', borderRadius: 4,
                                                                        background: checked ? `${meta.color}12` : 'transparent',
                                                                        transition: 'background 0.15s, color 0.15s',
                                                                        userSelect: 'none',
                                                                    }}>
                                                                        <span style={{
                                                                            width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                                                                            border: `1.5px solid ${checked ? meta.color : 'var(--border-strong)'}`,
                                                                            background: checked ? meta.color : 'transparent',
                                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                            transition: 'all 0.15s', opacity: checked ? 0.85 : 1,
                                                                        }}>
                                                                            {checked && (
                                                                                <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                                                                                    <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                                                                </svg>
                                                                            )}
                                                                        </span>
                                                                        {st.label}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {dirty && (
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-lg)', padding: 'var(--space-3) var(--space-5)',
                }}>
                    <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>Unsaved changes</span>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => {
                            setEnabledSpecialties(initialSpecialties);
                            setSelections({
                                HEPATOLOGY: new Set(initialSignals.HEPATOLOGY ?? []),
                                ONCOLOGY:   new Set(initialSignals.ONCOLOGY   ?? []),
                                HEMATOLOGY: new Set(initialSignals.HEMATOLOGY ?? []),
                            });
                            setDirty(false);
                        }}>Discard</button>
                        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
    const { user } = useAuth();
    const { addToast } = useToast();
    const [section, setSection] = useState<Section>('general');
    const [data, setData] = useState<SiteSettingsResponse | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getSiteSettings()
            .then(setData)
            .catch(() => addToast('Failed to load settings', 'error'))
            .finally(() => setLoading(false));
    }, []);

    const isManager = user?.role === 'MANAGER';

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
    if (!data) return <div className="empty-state"><h3>Failed to load settings</h3></div>;

    return (
        <div>
            <div style={{ marginBottom: 'var(--space-5)' }}>
                <h1 style={{ fontSize: 'var(--font-xl)', fontWeight: 600, letterSpacing: 'var(--tracking-tight)', margin: 0 }}>Settings</h1>
                <p style={{ margin: '2px 0 0', fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)' }}>{data.site.name}</p>
            </div>

            <SectionNav active={section} onChange={setSection} />

            {section === 'general' && <GeneralSection siteName={data.site.name} siteId={data.site.id} />}
            {section === 'profile' && (
                isManager ? <ProfileSection data={data} />
                : <div className="empty-state"><h3>Manager access required</h3></div>
            )}
            {section === 'trial_profile' && (
                isManager ? <TrialProfileSection data={data} />
                : <div className="empty-state"><h3>Manager access required</h3></div>
            )}
            {section === 'preview' && (
                isManager ? <PreviewSection />
                : <div className="empty-state"><h3>Manager access required</h3></div>
            )}
            {section === 'team' && (
                isManager ? <TeamSection />
                : <div className="empty-state"><h3>Manager access required</h3></div>
            )}
        </div>
    );
}
