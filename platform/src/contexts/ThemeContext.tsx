import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';

type ThemeMode = 'system' | 'light' | 'dark';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
    mode: ThemeMode;
    resolvedTheme: ResolvedTheme;
    theme: ResolvedTheme; // alias for backward compat
    setMode: (mode: ThemeMode) => void;
    toggle: () => void;
    smoothTransition: boolean;
    setSmoothTransition: (enabled: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'monsoon-theme-mode';
const SMOOTH_KEY = 'monsoon-theme-smooth';

function getSystemPreference(): ResolvedTheme {
    if (typeof window === 'undefined') return 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
    if (mode === 'system') return getSystemPreference();
    return mode;
}

function applyTheme(resolved: ResolvedTheme) {
    document.documentElement.setAttribute('data-theme', resolved);
    if (resolved === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

const STYLE_ID = 'monsoon-theme-transition';
const TRANSITION_CSS = `*, *::before, *::after { transition: background-color 200ms ease-out, border-color 200ms ease-out, color 200ms ease-out, fill 200ms ease-out, stroke 200ms ease-out, box-shadow 200ms ease-out !important; }`;

let transitionTimer: ReturnType<typeof setTimeout> | null = null;

// Inject only for the brief duration of a theme change — prevents !important
// from permanently overriding component-level transitions (e.g. sidebar transform)
function flashTransitionStyles() {
    if (transitionTimer) clearTimeout(transitionTimer);
    if (!document.getElementById(STYLE_ID)) {
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = TRANSITION_CSS;
        document.head.appendChild(style);
    }
    transitionTimer = setTimeout(() => {
        document.getElementById(STYLE_ID)?.remove();
        transitionTimer = null;
    }, 300);
}

interface ThemeProviderProps {
    children: ReactNode;
    defaultMode?: ThemeMode;
    defaultSmooth?: boolean;
}

export function ThemeProvider({ children, defaultMode = 'system', defaultSmooth = true }: ThemeProviderProps) {
    const [mode, setModeState] = useState<ThemeMode>(() => {
        if (typeof window === 'undefined') return defaultMode;
        // migrate old key
        const legacy = localStorage.getItem('monsoon_theme');
        if (legacy) {
            localStorage.setItem(STORAGE_KEY, legacy);
            localStorage.removeItem('monsoon_theme');
        }
        return (localStorage.getItem(STORAGE_KEY) as ThemeMode) || defaultMode;
    });

    const [smoothTransition, setSmoothState] = useState<boolean>(() => {
        if (typeof window === 'undefined') return defaultSmooth;
        const stored = localStorage.getItem(SMOOTH_KEY);
        return stored !== null ? stored === 'true' : defaultSmooth;
    });

    const resolvedTheme = resolveTheme(mode);

    useEffect(() => { applyTheme(resolvedTheme); }, [resolvedTheme]);

    useEffect(() => {
        if (mode !== 'system') return;
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => applyTheme(resolveTheme('system'));
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, [mode]);

    // Cmd/Ctrl+Shift+L keyboard shortcut
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'L') {
                e.preventDefault();
                setModeState(prev => {
                    const next: ThemeMode = resolveTheme(prev) === 'dark' ? 'light' : 'dark';
                    localStorage.setItem(STORAGE_KEY, next);
                    return next;
                });
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    const setMode = useCallback((newMode: ThemeMode) => {
        if (smoothTransition) flashTransitionStyles();
        localStorage.setItem(STORAGE_KEY, newMode);
        setModeState(newMode);
    }, [smoothTransition]);

    const toggle = useCallback(() => {
        if (smoothTransition) flashTransitionStyles();
        setModeState(prev => {
            const next: ThemeMode = resolveTheme(prev) === 'dark' ? 'light' : 'dark';
            localStorage.setItem(STORAGE_KEY, next);
            return next;
        });
    }, [smoothTransition]);

    const setSmoothTransition = useCallback((enabled: boolean) => {
        localStorage.setItem(SMOOTH_KEY, String(enabled));
        setSmoothState(enabled);
    }, []);

    return (
        <ThemeContext.Provider value={{ mode, resolvedTheme, theme: resolvedTheme, setMode, toggle, smoothTransition, setSmoothTransition }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
}
