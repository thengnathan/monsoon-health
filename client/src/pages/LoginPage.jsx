import { SignIn } from '@clerk/clerk-react';
import StormyBackdrop from '../components/StormyBackdrop';

export default function LoginPage() {
    return (
        <div className="login-page">
            <StormyBackdrop />
            <div style={{ position: 'relative', zIndex: 10 }}>
                <SignIn
                    routing="path"
                    path="/login"
                    signUpUrl="/sign-up"
                    fallbackRedirectUrl="/"
                    appearance={{
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
                        },
                    }}
                />
            </div>
        </div>
    );
}
