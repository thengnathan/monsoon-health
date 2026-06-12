import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { api, setTokenGetter, setUnauthorizedHandler } from '../api';
import type { DbUser } from '../types';

interface AuthContextValue {
    user: DbUser | null;
    loading: boolean;
    isSignedIn: boolean | undefined;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const { user: clerkUser, isLoaded: clerkLoaded, isSignedIn } = useUser();
    const { getToken } = useClerkAuth();
    const navigate = useNavigate();
    const [internalUser, setInternalUser] = useState<DbUser | null>(null);
    const [loading, setLoading] = useState(true);

    // Register Clerk's getToken with the API layer DURING render (not in an effect)
    // so it's available before any child component's effect fires its first request.
    // Clerk caches the token and only re-mints when near expiry, so per-request
    // fetching is cheap and always fresh.
    setTokenGetter(getToken);

    // On an unrecoverable 401 (token couldn't be refreshed), drop the profile and
    // bounce to login via the router instead of a hard reload.
    useEffect(() => {
        setUnauthorizedHandler(() => {
            setInternalUser(null);
            navigate('/login');
        });
        return () => setUnauthorizedHandler(null);
    }, [navigate]);

    useEffect(() => {
        if (!clerkLoaded) return;

        if (!isSignedIn) {
            setInternalUser(null);
            setLoading(false);
            return;
        }

        const fetchProfile = async () => {
            try {
                const profile = await api.me();
                setInternalUser(profile);
            } catch (err) {
                console.error('[Auth] Failed to fetch profile:', err);
                setInternalUser(null);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [clerkLoaded, isSignedIn, clerkUser]);

    const user: DbUser | null = internalUser ? {
        ...internalUser,
        name: internalUser.name === 'New User'
            ? [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ') || 'User'
            : internalUser.name,
    } : null;

    return (
        <AuthContext.Provider value={{ user, loading, isSignedIn }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
