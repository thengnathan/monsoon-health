import {
    Html,
    Head,
    Body,
    Container,
    Heading,
    Text,
    Hr,
    Section,
} from '@react-email/components';
import * as React from 'react';

interface WaitlistEmailProps {
    email: string;
    product?: string;
}

export default function WaitlistEmail({ email, product }: WaitlistEmailProps) {
    return (
        <Html>
            <Head />
            <Body style={body}>
                <Container style={container}>
                    <Heading style={heading}>New Waitlist Signup</Heading>
                    <Hr style={hr} />
                    <Section>
                        <Text style={label}>Product</Text>
                        <Text style={value}>{product || 'Unknown'}</Text>

                        <Text style={label}>Email</Text>
                        <Text style={value}>{email}</Text>
                    </Section>
                    <Hr style={hr} />
                    <Text style={footer}>Monsoon Health · team@monsoon-health.com</Text>
                </Container>
            </Body>
        </Html>
    );
}

const body: React.CSSProperties = {
    backgroundColor: '#f4f4f5',
    fontFamily: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
};

const container: React.CSSProperties = {
    margin: '40px auto',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    padding: '40px',
    maxWidth: '560px',
};

const heading: React.CSSProperties = {
    fontSize: '22px',
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: '8px',
};

const hr: React.CSSProperties = {
    borderColor: '#e2e8f0',
    margin: '20px 0',
};

const label: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#64748b',
    margin: '16px 0 2px',
};

const value: React.CSSProperties = {
    fontSize: '15px',
    color: '#0f172a',
    margin: '0',
};

const footer: React.CSSProperties = {
    fontSize: '12px',
    color: '#94a3b8',
    textAlign: 'center',
};
