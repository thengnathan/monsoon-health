import { createContext, useContext, useState, useEffect } from 'react';
import { useUser, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const { user: clerkUser, isLoaded: clerkLoaded, isSignedIn } = useUser();
    const { getToken } = useClerkAuth();
    const [internalUser, setInternalUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!clerkLoaded) return;

        if (!isSignedIn) {
            setInternalUser(null);
            setLoading(false);
            return;
        }

        // Fetch internal user profile from our backend
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

    // Keep token fresh
    useEffect(() => {
        if (!isSignedIn) return;
        const interval = setInterval(async () => {
            try {
                const token = await getToken();
                if (token) localStorage.setItem('monsoon_clerk_token', token);
            } catch (err) { /* token refresh failed, Clerk will handle re-auth */ }
        }, 50000); // refresh every 50s (tokens expire in 60s)
        return () => clearInterval(interval);
    }, [isSignedIn, getToken]);

    const user = internalUser ? {
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

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
