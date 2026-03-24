import { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ClerkProvider, useUser } from '@clerk/clerk-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import DashboardPage from './pages/DashboardPage';
import PatientsPage from './pages/PatientsPage';
import PatientDetailPage from './pages/PatientDetailPage';
import TrialsPage from './pages/TrialsPage';
import TrialDetailPage from './pages/TrialDetailPage';
import ScreeningCasesPage from './pages/ScreeningCasesPage';
import ScreeningCaseDetailPage from './pages/ScreeningCaseDetailPage';
import NotesPage from './pages/NotesPage';
import LandingPage from './pages/LandingPage';
import AboutPage from './pages/AboutPage';

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

interface ThemeContextValue {
    theme: 'light' | 'dark';
    toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'dark', toggle: () => { } });
export function useTheme() { return useContext(ThemeContext); }

function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('monsoon_theme') as 'light' | 'dark') || 'dark');

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('monsoon_theme', theme);
    }, [theme]);

    const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

    return (
        <ThemeContext.Provider value={{ theme, toggle }}>
            {children}
        </ThemeContext.Provider>
    );
}

function getClerkAppearance(theme: 'light' | 'dark'): object {
    const isDark = theme === 'dark';

    return {
        variables: {
            colorPrimary: isDark ? '#88BDDF' : '#4A7FA8',
            colorTextOnPrimaryBackground: isDark ? '#e4edf5' : '#ffffff',
            colorBackground: isDark ? '#1e2d3a' : '#ffffff',
            colorInputBackground: isDark ? 'rgba(20, 30, 40, 0.6)' : '#f5f8fb',
            colorInputText: isDark ? '#e4edf5' : '#1a2530',
            colorText: isDark ? '#e4edf5' : '#1a2530',
            colorTextSecondary: isDark ? '#9ab0c4' : '#5a7a94',
            colorDanger: '#e74c3c',
            borderRadius: '10px',
            fontFamily: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
        },
        elements: {
            card: {
                backgroundColor: isDark ? 'rgba(26, 37, 48, 0.95)' : '#ffffff',
                backdropFilter: 'blur(40px)',
                WebkitBackdropFilter: 'blur(40px)',
                border: isDark ? '1px solid rgba(106, 137, 167, 0.15)' : '1px solid rgba(106, 137, 167, 0.2)',
                boxShadow: isDark ? '0 32px 80px rgba(0, 0, 0, 0.35)' : '0 16px 48px rgba(0, 0, 0, 0.1)',
            },
            rootBox: { color: isDark ? '#e4edf5' : '#1a2530' },
            pageScrollBox: { backgroundColor: isDark ? '#1e2d3a' : '#ffffff', borderRadius: '16px', overflow: 'hidden' },
            page: { backgroundColor: 'transparent' },
            profilePage: { backgroundColor: 'transparent' },
            modalContent: { backgroundColor: isDark ? '#1e2d3a' : '#ffffff', borderRadius: '16px', overflow: 'hidden' },
            modalBackdrop: { backgroundColor: 'rgba(0,0,0,0.5)' },
            headerTitle: { color: isDark ? '#e4edf5' : '#1a2530' },
            headerSubtitle: { color: isDark ? '#9ab0c4' : '#5a7a94' },
            userPreviewMainIdentifier: { color: isDark ? '#e4edf5' : '#1a2530' },
            userPreviewSecondaryIdentifier: { color: isDark ? '#9ab0c4' : '#5a7a94' },
            userButtonPopoverCard: {
                backgroundColor: isDark ? '#1e2d3a' : '#ffffff',
                border: isDark ? '1px solid rgba(106, 137, 167, 0.2)' : '1px solid #e0e8ef',
            },
            userButtonPopoverActionButton: { color: isDark ? '#9ab0c4' : '#4a6a80' },
            userButtonPopoverActionButtonText: { color: isDark ? '#9ab0c4' : '#4a6a80' },
            userButtonPopoverActionButtonIcon: { color: isDark ? '#88BDDF' : '#4A7FA8' },
            userButtonPopoverFooter: { display: 'none' },
            menuButton: { color: isDark ? '#9ab0c4' : '#4a6a80' },
            menuItem: { color: isDark ? '#9ab0c4' : '#4a6a80' },
            profileSectionTitle: { color: isDark ? '#9ab0c4' : '#5a7a94', borderColor: isDark ? 'rgba(106, 137, 167, 0.2)' : '#e0e8ef' },
            profileSectionTitleText: { color: isDark ? '#9ab0c4' : '#5a7a94' },
            profileSectionContent: { color: isDark ? '#e4edf5' : '#1a2530' },
            profileSectionPrimaryButton: { color: isDark ? '#88BDDF' : '#4A7FA8' },
            formFieldLabel: { color: isDark ? '#9ab0c4' : '#5a7a94' },
            formFieldInput: {
                backgroundColor: isDark ? 'rgba(20, 30, 40, 0.6)' : '#f5f8fb',
                color: isDark ? '#e4edf5' : '#1a2530',
                borderColor: isDark ? 'rgba(106, 137, 167, 0.2)' : '#d0dae4',
            },
            formButtonPrimary: {
                background: isDark ? 'linear-gradient(135deg, #6A89A7, #384959)' : 'linear-gradient(135deg, #4A7FA8, #6A89A7)',
                color: '#ffffff',
            },
            formButtonReset: { color: isDark ? '#88BDDF' : '#4A7FA8' },
            avatarImageActionsUpload: { color: isDark ? '#88BDDF' : '#4A7FA8' },
            avatarImageActionsRemove: { color: isDark ? '#e74c3c' : '#c0392b' },
            fileDropAreaBox: {
                backgroundColor: isDark ? 'rgba(56, 73, 89, 0.3)' : '#f5f8fb',
                borderColor: isDark ? 'rgba(106, 137, 167, 0.3)' : '#d0dae4',
                color: isDark ? '#9ab0c4' : '#5a7a94',
            },
            fileDropAreaIconBox: { color: isDark ? '#88BDDF' : '#4A7FA8' },
            fileDropAreaHint: { color: isDark ? '#9ab0c4' : '#5a7a94' },
            fileDropAreaButtonPrimary: { color: isDark ? '#88BDDF' : '#4A7FA8' },
            badge: {
                backgroundColor: isDark ? 'rgba(136, 189, 223, 0.15)' : 'rgba(74, 127, 168, 0.12)',
                color: isDark ? '#88BDDF' : '#4A7FA8',
            },
            tagPrimaryText: { color: isDark ? '#88BDDF' : '#4A7FA8' },
            footerActionLink: { color: isDark ? '#88BDDF' : '#4A7FA8' },
            identityPreviewEditButton: { color: isDark ? '#88BDDF' : '#4A7FA8' },
            identityPreviewText: { color: isDark ? '#e4edf5' : '#1a2530' },
            dangerSection: { borderColor: isDark ? 'rgba(231, 76, 60, 0.3)' : 'rgba(192, 57, 43, 0.2)' },
            accordionTriggerButton: { color: isDark ? '#9ab0c4' : '#5a7a94' },
            navbarButton: { color: isDark ? '#9ab0c4' : '#4a6a80' },
            navbarButtonIcon: { color: isDark ? '#88BDDF' : '#4A7FA8' },
            socialButtonsBlockButton: {
                backgroundColor: isDark ? 'rgba(56, 73, 89, 0.5)' : '#f5f8fb',
                borderColor: isDark ? 'rgba(106, 137, 167, 0.2)' : '#d0dae4',
                color: isDark ? '#e4edf5' : '#1a2530',
            },
            activeDevice: { backgroundColor: isDark ? 'rgba(56, 73, 89, 0.3)' : '#f5f8fb' },
            activeDeviceListItem: { color: isDark ? '#e4edf5' : '#1a2530' },
        },
    };
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { isLoaded, isSignedIn } = useUser();
    const { loading } = useAuth();
    if (!isLoaded) return <div className="loading-spinner"><div className="spinner" /></div>;
    if (!isSignedIn) return <Navigate to="/login" />;
    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
    return <>{children}</>;
}

function AppRoutes() {
    return (
        <Routes>
            <Route path="/landing" element={<LandingPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/login/*" element={<LoginPage />} />
            <Route path="/sign-up/*" element={<SignUpPage />} />
            <Route path="/" element={
                <ProtectedRoute><Layout /></ProtectedRoute>
            }>
                <Route index element={<DashboardPage />} />
                <Route path="patients" element={<PatientsPage />} />
                <Route path="patients/:id" element={<PatientDetailPage />} />
                <Route path="trials" element={<TrialsPage />} />
                <Route path="trials/:id" element={<TrialDetailPage />} />
                <Route path="screening" element={<ScreeningCasesPage />} />
                <Route path="screening/:id" element={<ScreeningCaseDetailPage />} />
                <Route path="notes" element={<NotesPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/landing" />} />
        </Routes>
    );
}

function ClerkApp() {
    const { theme } = useTheme();
    return (
        <ClerkProvider
            publishableKey={CLERK_KEY}
            afterSignOutUrl="/login"
            appearance={getClerkAppearance(theme)}
        >
            <BrowserRouter>
                <AuthProvider>
                    <ToastProvider>
                        <AppRoutes />
                    </ToastProvider>
                </AuthProvider>
            </BrowserRouter>
        </ClerkProvider>
    );
}

export default function App() {
    return (
        <ThemeProvider>
            <ClerkApp />
        </ThemeProvider>
    );
}
