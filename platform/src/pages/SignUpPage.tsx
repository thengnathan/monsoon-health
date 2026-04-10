import { SignUp } from '@clerk/clerk-react';

export default function SignUpPage() {
    return (
        <SignUp
            routing="path"
            path="/sign-up"
            signInUrl="/login"
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
    );
}
