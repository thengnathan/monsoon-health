import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useUser, UserButton } from '@clerk/clerk-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../App';
import { NotePopup } from '../pages/NotesPage';
import { api } from '../api';
import type { Note } from '../types';

interface NavItem { to: string; label: string; icon: string; end?: boolean; }

const navItems: NavItem[] = [
    { to: '/', label: 'Today', icon: '◉', end: true },
    { to: '/screening', label: 'Screening Cases', icon: '◎' },
    { to: '/patients', label: 'Patients', icon: '◇' },
    { to: '/trials', label: 'Trials', icon: '△' },
    { to: '/notes', label: 'Notes', icon: '☰' },
];

export type LayoutOutletContext = { setFloatingNote: (note: Note | null | undefined) => void };

export default function Layout() {
    const { user } = useAuth();
    const { user: clerkUser } = useUser();
    const { theme, toggle } = useTheme();
    const [floatingNote, setFloatingNote] = useState<Note | null | undefined>(undefined);

    const displayName = clerkUser
        ? [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || user?.name || 'User'
        : user?.name || 'User';

    const role = user?.role || 'CRC';

    const handleFloatingSave = async (data: Partial<Note>, id?: string) => {
        if (id) {
            await api.updateNote(id, data as Record<string, unknown>);
        } else {
            await api.createNote(data as Record<string, unknown>);
        }
    };

    const handleFloatingDelete = async (id: string) => {
        await api.deleteNote(id);
    };

    return (
        <div className="app-layout">
            <aside className="sidebar">
                <div className="sidebar-brand">
                    <h2>
                        <span className="sidebar-brand-icon">M</span>
                        Monsoon Health
                    </h2>
                    <span>Screening Tracker</span>
                </div>

                <nav className="sidebar-nav">
                    <div className="sidebar-section-label">Navigation</div>
                    {navItems.map(item => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.end}
                            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                        >
                            <span style={{ fontSize: '16px', width: 18, textAlign: 'center' }}>{item.icon}</span>
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-user" style={{ gap: 'var(--space-3)' }}>
                        <UserButton
                            afterSignOutUrl="/login"
                            appearance={{
                                elements: {
                                    avatarBox: { width: 36, height: 36 },
                                    userButtonPopoverCard: {
                                        backgroundColor: 'var(--bg-surface)',
                                        border: '1px solid var(--border-default)',
                                    },
                                },
                            }}
                        />
                        <div className="sidebar-user-info">
                            <div className="sidebar-user-name">{displayName}</div>
                            <div className="sidebar-user-role">{role}</div>
                        </div>
                    </div>
                </div>
            </aside>

            <main className="app-main">
                {/* Theme toggle — top right, vertical pill */}
                <div className="theme-toggle-container">
                    <button className="theme-toggle-mini" onClick={toggle} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
                        <svg className={`theme-icon ${theme === 'light' ? 'active' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                        </svg>
                        <svg className={`theme-icon ${theme === 'dark' ? 'active' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" />
                        </svg>
                    </button>
                </div>

                <Outlet context={{ setFloatingNote } satisfies LayoutOutletContext} />
            </main>

            {/* Global floating note — persists across page navigation */}
            {floatingNote !== undefined && (
                <NotePopup
                    note={floatingNote}
                    onSave={handleFloatingSave}
                    onDelete={handleFloatingDelete}
                    onClose={() => setFloatingNote(undefined)}
                />
            )}
        </div>
    );
}
