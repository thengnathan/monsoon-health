import { createContext, useContext, useState, useEffect } from 'react';
import { useUser, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { api } from '../api';
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
    const [internalUser, setInternalUser] = useState<DbUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!clerkLoaded) return;

        if (!isSignedIn) {
            setInternalUser(null);
            setLoading(false);
            return;
        }

        const fetchProfile = async () => {
            try {
                const token = await getToken();
                if (token) {
                    localStorage.setItem('monsoon_clerk_token', token);
                }
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

    useEffect(() => {
        if (!isSignedIn) return;
        const interval = setInterval(async () => {
            try {
                const token = await getToken();
                if (token) localStorage.setItem('monsoon_clerk_token', token);
            } catch { /* token refresh failed, Clerk will handle re-auth */ }
        }, 50000);
        return () => clearInterval(interval);
    }, [isSignedIn, getToken]);

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
