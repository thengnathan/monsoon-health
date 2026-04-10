import { useState } from 'react';
import { SignIn, SignUp } from '@clerk/clerk-react';
import WaveBackground from './WaveBackground';

const cardAppearance = {
    elements: {
        rootBox: { width: '100%', maxWidth: 440 },
        card: {
            backgroundColor: 'rgba(26, 37, 48, 0.65)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            border: '1px solid rgba(106, 137, 167, 0.12)',
            boxShadow: '0 32px 80px rgba(0, 0, 0, 0.35)',
            borderRadius: '20px',
        },
        footer: { display: 'none' },       // hide Clerk's built-in footer links
        footerAction: { display: 'none' }, // so we control the toggle ourselves
    },
};

export default function AuthLayout() {
    const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');

    return (
        <div className="login-page">
            <WaveBackground
                backgroundColor="#0a141e"
                strokeColor="rgba(136,189,223,0.25)"
            />
            <div style={{
                position: 'relative',
                zIndex: 10,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
            }}>
                {/* Card container — fixed size prevents layout jump during transition */}
                <div style={{ width: 440, position: 'relative' }}>
                    <div style={{
                        transition: 'opacity 0.2s ease, transform 0.2s ease',
                        opacity: mode === 'sign-in' ? 1 : 0,
                        transform: mode === 'sign-in' ? 'translateY(0)' : 'translateY(-8px)',
                        pointerEvents: mode === 'sign-in' ? 'auto' : 'none',
                        position: mode === 'sign-in' ? 'relative' : 'absolute',
                        top: 0, left: 0, right: 0,
                    }}>
                        <SignIn
                            routing="virtual"
                            fallbackRedirectUrl="/"
                            appearance={cardAppearance}
                        />
                    </div>
                    <div style={{
                        transition: 'opacity 0.2s ease, transform 0.2s ease',
                        opacity: mode === 'sign-up' ? 1 : 0,
                        transform: mode === 'sign-up' ? 'translateY(0)' : 'translateY(8px)',
                        pointerEvents: mode === 'sign-up' ? 'auto' : 'none',
                        position: mode === 'sign-up' ? 'relative' : 'absolute',
                        top: 0, left: 0, right: 0,
                    }}>
                        <SignUp
                            routing="virtual"
                            fallbackRedirectUrl="/"
                            appearance={cardAppearance}
                        />
                    </div>
                </div>

                {/* Toggle link */}
                <div style={{
                    fontSize: 13,
                    color: 'rgba(154, 176, 196, 0.8)',
                    transition: 'opacity 0.15s ease',
                }}>
                    {mode === 'sign-in' ? (
                        <>
                            Don't have an account?{' '}
                            <button
                                onClick={() => setMode('sign-up')}
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: '#88BDDF', fontSize: 13, padding: 0,
                                    textDecoration: 'underline', textUnderlineOffset: 2,
                                }}
                            >
                                Create account
                            </button>
                        </>
                    ) : (
                        <>
                            Already have an account?{' '}
                            <button
                                onClick={() => setMode('sign-in')}
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: '#88BDDF', fontSize: 13, padding: 0,
                                    textDecoration: 'underline', textUnderlineOffset: 2,
                                }}
                            >
                                Sign in
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
