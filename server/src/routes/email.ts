import { Router, Request, Response } from 'express';
import { Resend } from 'resend';
import { render } from '@react-email/components';
import { supabase } from '../db/init';
import ContactEmail from '../emails/ContactEmail';
import WaitlistEmail from '../emails/WaitlistEmail';
import WaitlistConfirmationEmail from '../emails/WaitlistConfirmationEmail';

const router = Router();
const resend = new Resend(process.env.RESEND_API_KEY);

const TO_EMAIL = 'team@monsoon-health.com';

// POST /api/email/contact — Schedule a Demo / Let's Talk form
router.post('/contact', async (req: Request, res: Response) => {
    const { name, email, org, message } = req.body;

    if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required.' });
    }

    try {
        const html = await render(ContactEmail({ name, email, org, message }));

        await resend.emails.send({
            from: 'Monsoon Health <noreply@monsoon-health.com>',
            to: TO_EMAIL,
            subject: `Demo Request from ${name}`,
            html,
        });

        res.json({ success: true });
    } catch (err: any) {
        console.error('Resend contact error:', err);
        res.status(500).json({ error: 'Failed to send email.' });
    }
});

// POST /api/email/waitlist — Zephyr / Rainfall waitlist signup
router.post('/waitlist', async (req: Request, res: Response) => {
    const { email, product } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required.' });
    }

    try {
        // Save to Supabase waitlist table
        const { error: dbError } = await supabase
            .from('waitlist')
            .upsert({ email, product }, { onConflict: 'email' });

        if (dbError) console.error('Supabase waitlist insert error:', dbError);

        // Notify the team
        const teamHtml = await render(WaitlistEmail({ email, product }));
        const teamResult = await resend.emails.send({
            from: 'Monsoon Health <noreply@monsoon-health.com>',
            to: TO_EMAIL,
            subject: `New Waitlist Signup — ${product || 'Product'}`,
            html: teamHtml,
        });
        console.log('Team email result:', JSON.stringify(teamResult));

        // Confirmation to the user
        const confirmHtml = await render(WaitlistConfirmationEmail({ product }));
        const confirmResult = await resend.emails.send({
            from: 'Monsoon Health <noreply@monsoon-health.com>',
            to: email,
            subject: "You're on the Monsoon Health waitlist",
            html: confirmHtml,
        });
        console.log('Confirmation email result:', JSON.stringify(confirmResult));

        res.json({ success: true });
    } catch (err: any) {
        console.error('Resend waitlist error:', err);
        res.status(500).json({ error: 'Failed to send email.' });
    }
});

export default router;
