import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useUser, UserButton } from '@clerk/clerk-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { NotePopup } from '../pages/NotesPage';
import { api } from '../api';
import type { Note } from '../types';

interface NavItem { to: string; label: string; icon: string; end?: boolean; }

const navItems: NavItem[] = [
    { to: '/', label: 'Today', icon: '◉', end: true },
    { to: '/screening', label: 'Screening Cases', icon: '◎' },
    { to: '/patients', label: 'Patients', icon: '◇' },
    { to: '/trials', label: 'Trials', icon: '△' },
    { to: '/intake-submissions', label: 'Intake Forms', icon: '◫' },
    { to: '/notes', label: 'Notes', icon: '☰' },
    { to: '/settings', label: 'Settings', icon: '⚙' },
];

export type LayoutOutletContext = {
    setFloatingNote: (note: Note | null | undefined) => void;
    setNotesRefresh: (fn: (() => void) | null) => void;
};

export default function Layout() {
    const { user } = useAuth();
    const { user: clerkUser } = useUser();
    const { resolvedTheme: theme, toggle } = useTheme();
    const [floatingNote, setFloatingNote] = useState<Note | null | undefined>(undefined);
    const [notesRefresh, setNotesRefresh] = useState<(() => void) | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(
        () => localStorage.getItem('sidebarOpen') === 'true'
    );

    const openSidebar = () => {
        setSidebarOpen(true);
        localStorage.setItem('sidebarOpen', 'true');
    };

    const closeSidebar = () => {
        setSidebarOpen(false);
        localStorage.setItem('sidebarOpen', 'false');
    };

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
        notesRefresh?.();
    };

    const handleFloatingDelete = async (id: string) => {
        await api.deleteNote(id);
        notesRefresh?.();
    };

    return (
        <div className="app-layout">
            <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
                <div className="sidebar-brand">
                    <img src="/images/monsoon-braid-wordmark-white.svg" alt="Monsoon Health" className="sidebar-brand-wordmark" />
                    <span style={{ fontWeight: 700, textAlign: 'center', width: '100%' }}>Zephyr</span>
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
                            <span style={{ fontSize: '16px', width: 18, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                            <span className="sidebar-link-label">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-user" style={{ gap: 'var(--space-3)', cursor: 'pointer' }} onClick={e => {
                        const btn = (e.currentTarget as HTMLElement).querySelector<HTMLElement>('[data-clerk-user-button-trigger]') ?? (e.currentTarget as HTMLElement).querySelector<HTMLElement>('button');
                        if (btn && !btn.contains(e.target as Node)) btn.click();
                    }}>
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

                {/* Sliver indicator — visible when collapsed, click to open */}
                <div className="sidebar-sliver-indicator" onClick={openSidebar} />
            </aside>

            {/* Drawer handle — outside aside to escape overflow:hidden, tracks sidebar position */}
            <button
                className={`sidebar-edge-handle ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}
                onClick={sidebarOpen ? closeSidebar : openSidebar}
                title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
                {sidebarOpen ? '‹' : '›'}
            </button>

            <main className={`app-main ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
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

                <Outlet context={{ setFloatingNote, setNotesRefresh } satisfies LayoutOutletContext} />
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
