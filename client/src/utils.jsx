export const STATUS_CONFIG = {
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

export const ALL_STATUSES = Object.keys(STATUS_CONFIG);

export const ACTIVE_STATUSES = ['NEW', 'IN_REVIEW', 'PENDING_INFO', 'LIKELY_ELIGIBLE'];
export const TERMINAL_STATUSES = ['SCREEN_FAILED', 'FUTURE_CANDIDATE', 'DECLINED', 'LOST_TO_FOLLOWUP', 'ENROLLED'];

export function StatusBadge({ status }) {
    const config = STATUS_CONFIG[status] || { label: status, class: '' };
    return <span className={`status-badge ${config.class}`}>{config.label}</span>;
}

export function formatDate(dateStr) {
    if (!dateStr) return '—';
    // Handle SQLite datetime format: '2026-03-03 00:07:58' (space instead of T)
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

export function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    let normalized = String(dateStr).trim();
    if (!normalized.includes('T') && normalized.includes(' ')) {
        normalized = normalized.replace(' ', 'T');
    }
    const d = new Date(normalized);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function getInitials(name) {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
}

export function daysSince(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const now = new Date();
    return Math.floor((now - d) / (1000 * 60 * 60 * 24));
}

export function isOverdue(dateStr) {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
}
