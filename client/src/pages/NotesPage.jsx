import { useState, useEffect, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../api';

const NOTE_COLORS = [
    { id: 'default', bg: 'var(--bg-surface)', border: 'var(--border-default)' },
    { id: 'blue', bg: 'rgba(136, 189, 223, 0.08)', border: 'rgba(136, 189, 223, 0.2)' },
    { id: 'green', bg: 'rgba(46, 204, 113, 0.08)', border: 'rgba(46, 204, 113, 0.2)' },
    { id: 'amber', bg: 'rgba(241, 196, 15, 0.08)', border: 'rgba(241, 196, 15, 0.2)' },
    { id: 'rose', bg: 'rgba(231, 76, 60, 0.08)', border: 'rgba(231, 76, 60, 0.2)' },
    { id: 'purple', bg: 'rgba(155, 89, 182, 0.08)', border: 'rgba(155, 89, 182, 0.2)' },
];

function getColor(id) {
    return NOTE_COLORS.find(c => c.id === id) || NOTE_COLORS[0];
}

function formatDate(d) {
    const date = new Date(d + 'Z');
    const now = new Date();
    const diff = now - date;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Exported for use in Layout (global floating note)
export function NotePopup({ note, onSave, onDelete, onClose }) {
    const [title, setTitle] = useState(note?.title || '');
    const [content, setContent] = useState(note?.content || '');
    const [color, setColor] = useState(note?.color || 'default');
    const [pinned, setPinned] = useState(note?.is_pinned || false);
    const [isDragging, setIsDragging] = useState(false);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const popupRef = useRef(null);
    const titleRef = useRef(null);
    const isNew = !note;

    useEffect(() => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        setPos({ x: Math.max(60, (w - 480) / 2), y: Math.max(40, (h - 500) / 2.5) });
        if (titleRef.current && isNew) titleRef.current.focus();
    }, []);

    const handleMouseDown = useCallback((e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON') return;
        setIsDragging(true);
        const rect = popupRef.current.getBoundingClientRect();
        setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }, []);

    useEffect(() => {
        if (!isDragging) return;
        const handleMove = (e) => {
            setPos({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y });
        };
        const handleUp = () => setIsDragging(false);
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleUp);
        return () => {
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleUp);
        };
    }, [isDragging, dragOffset]);

    const handleSave = async () => {
        const data = { title: title.trim() || 'Untitled', content, color, is_pinned: pinned };
        if (onSave) await onSave(data, note?.id);
        onClose();
    };

    const handleDelete = async () => {
        if (note && window.confirm('Delete this note?')) {
            if (onDelete) await onDelete(note.id);
            onClose();
        }
    };

    const colorObj = getColor(color);

    return (
        <div
            ref={popupRef}
            className="note-popup"
            style={{
                left: pos.x,
                top: pos.y,
                backgroundColor: colorObj.bg,
                borderColor: colorObj.border,
                cursor: isDragging ? 'grabbing' : 'default',
            }}
            onMouseDown={handleMouseDown}
        >
            <div className="note-popup-header" style={{ cursor: 'grab' }}>
                <div className="note-popup-drag-hint">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" opacity="0.5">
                        <circle cx="8" cy="4" r="2" /><circle cx="16" cy="4" r="2" />
                        <circle cx="8" cy="12" r="2" /><circle cx="16" cy="12" r="2" />
                        <circle cx="8" cy="20" r="2" /><circle cx="16" cy="20" r="2" />
                    </svg>
                    <span>Drag to move</span>
                </div>
                <div className="note-popup-actions">
                    <button
                        className={`note-action-btn ${pinned ? 'active' : ''}`}
                        onClick={() => setPinned(!pinned)}
                        title={pinned ? 'Unpin' : 'Pin to top'}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2v8m-5-3l4 4 4-4M5 14h14M7 14v4a2 2 0 002 2h6a2 2 0 002-2v-4" />
                        </svg>
                    </button>
                    {note && (
                        <button className="note-action-btn danger" onClick={handleDelete} title="Delete">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                            </svg>
                        </button>
                    )}
                    <button className="note-action-btn" onClick={onClose} title="Close">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            <input
                ref={titleRef}
                type="text"
                className="note-popup-title"
                placeholder="Note title..."
                value={title}
                onChange={e => setTitle(e.target.value)}
            />

            <textarea
                className="note-popup-content"
                placeholder="Start typing your note..."
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={10}
            />

            <div className="note-popup-footer">
                <div className="note-color-picker">
                    {NOTE_COLORS.map(c => (
                        <button
                            key={c.id}
                            className={`note-color-dot ${color === c.id ? 'active' : ''}`}
                            style={{ backgroundColor: c.border, borderColor: color === c.id ? 'var(--text-primary)' : 'transparent' }}
                            onClick={() => setColor(c.id)}
                            title={c.id}
                        />
                    ))}
                </div>
                <button className="btn btn-primary" onClick={handleSave}>
                    {isNew ? '+ Create Note' : 'Save Changes'}
                </button>
            </div>
        </div>
    );
}

export default function NotesPage() {
    const [notes, setNotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const { setFloatingNote } = useOutletContext();

    const fetchNotes = async () => {
        try {
            const data = await api.getNotes();
            setNotes(data);
        } catch (e) {
            console.error('Failed to load notes:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchNotes(); }, []);

    // Open a note in the global floating popup (persists across pages)
    const openNote = (note) => {
        setFloatingNote(note); // null = new, object = edit
    };

    const filtered = notes.filter(n => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
    });

    const pinned = filtered.filter(n => n.is_pinned);
    const unpinned = filtered.filter(n => !n.is_pinned);

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                    <h1>Notes</h1>
                    <p>Your personal workspace — quick notes, reminders, and ideas</p>
                </div>
                <button className="btn btn-primary" onClick={() => openNote(null)}>+ New Note</button>
            </div>

            <div className="search-bar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <input
                    placeholder="Search notes by title or content…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {notes.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">☰</div>
                    <h3>No notes yet</h3>
                    <p>Create your first note to get started.</p>
                    <button className="btn btn-primary" onClick={() => openNote(null)} style={{ marginTop: 'var(--space-4)' }}>
                        + New Note
                    </button>
                </div>
            ) : filtered.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                        </svg>
                    </div>
                    <h3>No matching notes</h3>
                    <p>Try a different search term.</p>
                </div>
            ) : (
                <>
                    {pinned.length > 0 && (
                        <>
                            <div className="notes-section-label">Pinned</div>
                            <div className="notes-grid">
                                {pinned.map(note => (
                                    <NoteCard key={note.id} note={note} onClick={() => openNote(note)} />
                                ))}
                            </div>
                        </>
                    )}
                    {unpinned.length > 0 && (
                        <>
                            {pinned.length > 0 && <div className="notes-section-label">All Notes</div>}
                            <div className="notes-grid">
                                {unpinned.map(note => (
                                    <NoteCard key={note.id} note={note} onClick={() => openNote(note)} />
                                ))}
                            </div>
                        </>
                    )}
                </>
            )}

        </div>
    );
}

function NoteCard({ note, onClick }) {
    const colorObj = getColor(note.color);
    const preview = note.content.length > 150 ? note.content.slice(0, 150) + '…' : note.content;

    return (
        <div
            className="note-card"
            onClick={onClick}
            style={{
                backgroundColor: colorObj.bg,
                borderColor: colorObj.border,
            }}
        >
            {note.is_pinned && (
                <span className="note-card-pin">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" opacity="0.6">
                        <path d="M12 2v8m-5-3l4 4 4-4M5 14h14M7 14v4a2 2 0 002 2h6a2 2 0 002-2v-4" />
                    </svg>
                </span>
            )}
            <div className="note-card-title">{note.title || 'Untitled'}</div>
            {preview && <div className="note-card-preview">{preview}</div>}
            <div className="note-card-date">{formatDate(note.updated_at)}</div>
        </div>
    );
}
