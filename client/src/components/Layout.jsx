import { NavLink, Outlet } from 'react-router-dom';
import { useUser, UserButton } from '@clerk/clerk-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../App';

const navItems = [
    { to: '/', label: 'Today', icon: '◉', end: true },
    { to: '/screening', label: 'Screening Cases', icon: '◎' },
    { to: '/patients', label: 'Patients', icon: '◇' },
    { to: '/trials', label: 'Trials', icon: '△' },
];

export default function Layout() {
    const { user } = useAuth();
    const { user: clerkUser } = useUser();
    const { theme, toggle } = useTheme();

    // Use Clerk user name, fallback to internal user name
    const displayName = clerkUser
        ? [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || user?.name || 'User'
        : user?.name || 'User';

    const role = user?.role || 'CRC';

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
                        {/* Clerk UserButton — shows avatar with initials, click for settings */}
                        <UserButton
                            afterSignOutUrl="/login"
                            appearance={{
                                elements: {
                                    avatarBox: {
                                        width: 36,
                                        height: 36,
                                    },
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
                {/* Theme toggle — top right */}
                <div className="theme-toggle-container">
                    <button className="theme-toggle" onClick={toggle} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
                        <span className="theme-toggle-track">
                            <span className={`theme-toggle-thumb ${theme}`} />
                            <span className="theme-toggle-icon sun">☀️</span>
                            <span className="theme-toggle-icon moon">🌙</span>
                        </span>
                    </button>
                </div>
                <Outlet />
            </main>
        </div>
    );
}
