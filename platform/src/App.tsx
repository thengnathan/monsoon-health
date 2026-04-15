import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ClerkProvider, useUser } from '@clerk/clerk-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { SiteConfigProvider } from './contexts/SiteConfigContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout';
import AuthLayout from './components/AuthLayout';
import DashboardPage from './pages/DashboardPage';
import PatientsPage from './pages/PatientsPage';
import PatientDetailPage from './pages/PatientDetailPage';
import TrialsPage from './pages/TrialsPage';
import TrialDetailPage from './pages/TrialDetailPage';
import ScreeningCasesPage from './pages/ScreeningCasesPage';
import ScreeningCaseDetailPage from './pages/ScreeningCaseDetailPage';
import NotesPage from './pages/NotesPage';
import IntakeFormPage from './pages/IntakeFormPage';
import IntakeSubmissionsPage from './pages/IntakeSubmissionsPage';
import SettingsPage from './pages/SettingsPage';

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

const CLERK_APPEARANCE = {
    variables: {
        colorPrimary: 'var(--accent-sea-blue)',
        colorTextOnPrimaryBackground: 'var(--text-inverse)',
        colorBackground: 'var(--surface-secondary)',
        colorInputBackground: 'var(--surface-tertiary)',
        colorInputText: 'var(--text-primary)',
        colorText: 'var(--text-primary)',
        colorTextSecondary: 'var(--text-secondary)',
        colorDanger: 'var(--status-error)',
        borderRadius: '6px',
        fontFamily: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
    },
    elements: {
        card: {
            backgroundColor: 'var(--surface-secondary)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-lg)',
        },
        rootBox: { color: 'var(--text-primary)' },
        pageScrollBox: { backgroundColor: 'var(--surface-secondary)', borderRadius: '8px', overflow: 'hidden' },
        page: { backgroundColor: 'transparent' },
        profilePage: { backgroundColor: 'transparent' },
        modalContent: { backgroundColor: 'var(--surface-secondary)', borderRadius: '8px', overflow: 'hidden' },
        modalBackdrop: { backgroundColor: 'var(--surface-overlay)' },
        headerTitle: { color: 'var(--text-primary)' },
        headerSubtitle: { color: 'var(--text-secondary)' },
        userPreviewMainIdentifier: { color: 'var(--text-primary)' },
        userPreviewSecondaryIdentifier: { color: 'var(--text-secondary)' },
        userButtonPopoverCard: {
            backgroundColor: 'var(--surface-secondary)',
            border: '1px solid var(--border-default)',
        },
        userButtonPopoverActionButton: { color: 'var(--text-secondary)' },
        userButtonPopoverActionButtonText: { color: 'var(--text-secondary)' },
        userButtonPopoverActionButtonIcon: { color: 'var(--accent-sea-blue)' },
        userButtonPopoverFooter: { display: 'none' },
        menuButton: { color: 'var(--text-secondary)' },
        menuItem: { color: 'var(--text-secondary)' },
        profileSectionTitle: { color: 'var(--text-secondary)', borderColor: 'var(--border-default)' },
        profileSectionTitleText: { color: 'var(--text-secondary)' },
        profileSectionContent: { color: 'var(--text-primary)' },
        profileSectionPrimaryButton: { color: 'var(--accent-sea-blue)' },
        formFieldLabel: { color: 'var(--text-secondary)' },
        formFieldInput: {
            backgroundColor: 'var(--surface-tertiary)',
            color: 'var(--text-primary)',
            borderColor: 'var(--border-default)',
        },
        formButtonPrimary: {
            background: 'var(--accent-sea-blue)',
            color: 'var(--text-inverse)',
        },
        formButtonReset: { color: 'var(--accent-sea-blue)' },
        avatarImageActionsUpload: { color: 'var(--accent-sea-blue)' },
        avatarImageActionsRemove: { color: 'var(--status-error)' },
        fileDropAreaBox: {
            backgroundColor: 'var(--surface-tertiary)',
            borderColor: 'var(--border-strong)',
            color: 'var(--text-secondary)',
        },
        fileDropAreaIconBox: { color: 'var(--accent-sea-blue)' },
        fileDropAreaHint: { color: 'var(--text-secondary)' },
        fileDropAreaButtonPrimary: { color: 'var(--accent-sea-blue)' },
        badge: {
            backgroundColor: 'var(--accent-sea-blue-subtle)',
            color: 'var(--accent-sea-blue)',
        },
        tagPrimaryText: { color: 'var(--accent-sea-blue)' },
        footerActionLink: { color: 'var(--accent-sea-blue)' },
        identityPreviewEditButton: { color: 'var(--accent-sea-blue)' },
        identityPreviewText: { color: 'var(--text-primary)' },
        dangerSection: { borderColor: 'var(--status-error-bg)' },
        accordionTriggerButton: { color: 'var(--text-secondary)' },
        navbarButton: { color: 'var(--text-secondary)' },
        navbarButtonIcon: { color: 'var(--accent-sea-blue)' },
        socialButtonsBlockButton: {
            backgroundColor: 'var(--surface-tertiary)',
            borderColor: 'var(--border-default)',
            color: 'var(--text-primary)',
        },
        activeDevice: { backgroundColor: 'var(--surface-tertiary)' },
        activeDeviceListItem: { color: 'var(--text-primary)' },
    },
};

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { isLoaded, isSignedIn } = useUser();
    const { loading } = useAuth();
    if (!isLoaded) return <div className="loading-spinner"><div className="spinner" /></div>;
    if (!isSignedIn) return <Navigate to="/login" />;
    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
    return <>{children}</>;
}

function PageWrapper({ children }: { children: React.ReactNode }) {
    const location = useLocation();
    const segment = location.pathname.split('/')[1];
    const baseKey = '/' + segment;
    return (
        <div key={baseKey} className="page-transition">
            {children}
        </div>
    );
}

function AppRoutes() {
    return (
        <PageWrapper>
        <Routes>
            {/* Public — no auth required */}
            <Route path="/intake" element={<IntakeFormPage />} />

            <Route path="/login/*" element={<AuthLayout />} />
            <Route path="/sign-up/*" element={<AuthLayout />} />
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
                <Route path="intake-submissions" element={<IntakeSubmissionsPage />} />
                <Route path="settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/landing" />} />
        </Routes>
        </PageWrapper>
    );
}

function ClerkApp() {
    return (
        <ClerkProvider
            publishableKey={CLERK_KEY}
            afterSignOutUrl="/login"
            appearance={CLERK_APPEARANCE}
        >
            <BrowserRouter>
                <AuthProvider>
                    <SiteConfigProvider>
                    <ToastProvider>
                        <AppRoutes />
                    </ToastProvider>
                    </SiteConfigProvider>
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
