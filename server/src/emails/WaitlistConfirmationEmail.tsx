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

interface WaitlistConfirmationEmailProps {
    product?: string;
}

export default function WaitlistConfirmationEmail({ product: _product }: WaitlistConfirmationEmailProps) {
    return (
        <Html>
            <Head />
            <Body style={body}>
                <Container style={container}>
                    <Heading style={heading}>You're on the waitlist.</Heading>
                    <Hr style={hr} />
                    <Section>
                        <Text style={text}>
                            Thanks for joining the waitlist. We're building the operating system for clinical research sites and you'll be among the first to get access.
                        </Text>
                        <Text style={text}>
                            We'll reach out as we get closer to launch with early access details. If you run a research site and want to shape what we build, just reply to this email. We read every one.
                        </Text>
                        <Text style={text}>
                            Cheers,
                            <br />
                            Ashman, Nathan &amp; Amin
                        </Text>
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

const text: React.CSSProperties = {
    fontSize: '15px',
    lineHeight: '1.7',
    color: '#0f172a',
    margin: '0 0 16px',
};

const footer: React.CSSProperties = {
    fontSize: '12px',
    color: '#94a3b8',
    textAlign: 'center',
};
