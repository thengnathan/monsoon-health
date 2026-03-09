import type { StatusKey } from './types';

interface StatusConfigEntry { label: string; class: string; }

export const STATUS_CONFIG: Record<StatusKey, StatusConfigEntry> = {
    NEW: { label: 'New', class: 'new' },
    IN_REVIEW: { label: 'In Review', class: 'in-review' },
    PENDING_INFO: { label: 'Pending Info', class: 'pending-info' },
    LIKELY_ELIGIBLE: { label: 'Likely Eligible', class: 'likely-eligible' },
    SCREEN_FAILED: { label: 'Screen Failed', class: 'screen-failed' },
    FUTURE_CANDIDATE: { label: 'Future Candidate', class: 'future-candidate' },
    DECLINED: { label: 'Declined', class: 'declined' },
    LOST_TO_FOLLOWUP: { label: 'Lost to Follow-up', class: 'lost-to-followup' },
    ENROLLED: { label: 'Enrolled', class: 'enrolled' },
};

export const ALL_STATUSES = Object.keys(STATUS_CONFIG) as StatusKey[];
export const ACTIVE_STATUSES: StatusKey[] = ['NEW', 'IN_REVIEW', 'PENDING_INFO', 'LIKELY_ELIGIBLE'];
export const TERMINAL_STATUSES: StatusKey[] = ['SCREEN_FAILED', 'FUTURE_CANDIDATE', 'DECLINED', 'LOST_TO_FOLLOWUP', 'ENROLLED'];

interface StatusBadgeProps { status: string; }
export function StatusBadge({ status }: StatusBadgeProps) {
    const config = STATUS_CONFIG[status as StatusKey] || { label: status, class: '' };
    return <span className={`status-badge ${config.class}`}>{config.label}</span>;
}

export function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    let normalized = String(dateStr).trim();
    if (normalized.length === 10) {
        normalized += 'T00:00:00';
    } else if (!normalized.includes('T') && normalized.includes(' ')) {
        normalized = normalized.replace(' ', 'T');
    }
    const d = new Date(normalized);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    let normalized = String(dateStr).trim();
    if (!normalized.includes('T') && normalized.includes(' ')) {
        normalized = normalized.replace(' ', 'T');
    }
    const d = new Date(normalized);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function getInitials(name: string | null | undefined): string {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
}

export function daysSince(dateStr: string | null | undefined): number | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const now = new Date();
    return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function isOverdue(dateStr: string | null | undefined): boolean {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
}
