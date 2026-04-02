import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware, auditLog } from '../middleware/auth';

const router = Router();

// POST /api/intake/submit — public, no auth required
// Patients submit their intake form via a link like /intake?site=site-001
router.post('/submit', async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const siteId = (req.query.site as string) || (req.body as Record<string, unknown>).site_id as string;

    if (!siteId) {
        res.status(400).json({ error: 'Missing site identifier. Please use the link provided by your care team.' });
        return;
    }

    const formData = req.body as Record<string, unknown>;

    // Validate site exists
    const site = (await db.query('SELECT id FROM sites WHERE id = $1', [siteId])).rows[0];
    if (!site) {
        res.status(400).json({ error: 'Invalid site. Please use the link provided by your care team.' });
        return;
    }

    // Basic validation — require at least a name
    const about = formData.about as Record<string, unknown> | undefined;
    if (!about?.first_name || !about?.last_name) {
        res.status(400).json({ error: 'First name and last name are required.' });
        return;
    }

    const id = uuidv4();
    await db.query(
        `INSERT INTO intake_submissions (id, site_id, form_data, status)
         VALUES ($1, $2, $3, 'PENDING')`,
        [id, siteId, JSON.stringify(formData)]
    );

    res.status(201).json({ success: true, submission_id: id });
});

// All routes below require authentication
router.use(authMiddleware);

// GET /api/intake/submissions — list pending submissions for this site
router.get('/submissions', async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const siteId = req.user.site_id;
    const { status = 'PENDING' } = req.query as Record<string, string>;

    const { rows } = await db.query(
        `SELECT id, site_id, status, patient_id, submitted_at,
                form_data->'about'->>'first_name' AS first_name,
                form_data->'about'->>'last_name'  AS last_name,
                form_data->'about'->>'dob'         AS dob,
                form_data->'about'->>'phone'       AS phone,
                form_data->'about'->>'email'       AS email
         FROM intake_submissions
         WHERE site_id = $1 AND status = $2
         ORDER BY submitted_at DESC`,
        [siteId, status.toUpperCase()]
    );

    res.json(rows);
});

// GET /api/intake/submissions/:id — get full submission
router.get('/submissions/:id', async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const submission = (await db.query(
        'SELECT * FROM intake_submissions WHERE id = $1 AND site_id = $2',
        [req.params.id, req.user.site_id]
    )).rows[0];

    if (!submission) {
        res.status(404).json({ error: 'Submission not found' });
        return;
    }

    res.json(submission);
});

// POST /api/intake/submissions/:id/convert — create patient from submission
router.post('/submissions/:id/convert', async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const siteId = req.user.site_id;

    const submission = (await db.query(
        'SELECT * FROM intake_submissions WHERE id = $1 AND site_id = $2',
        [req.params.id, siteId]
    )).rows[0];

    if (!submission) {
        res.status(404).json({ error: 'Submission not found' });
        return;
    }

    if (submission.status === 'CONVERTED') {
        res.status(409).json({ error: 'Submission already converted', patient_id: submission.patient_id });
        return;
    }

    const formData = submission.form_data as Record<string, unknown>;
    const about = formData.about as Record<string, string> | undefined;
    const body = req.body as Record<string, string>;

    const firstName = body.first_name || about?.first_name || '';
    const lastName = body.last_name || about?.last_name || '';
    const dob = body.dob || about?.dob || null;

    if (!firstName || !lastName) {
        res.status(400).json({ error: 'first_name and last_name are required' });
        return;
    }

    const patientId = uuidv4();

    // Build intake notes summary from key fields
    const liver = formData.liver_health as Record<string, unknown> | undefined;
    const meds = formData.medications as Record<string, unknown> | undefined;
    const lifestyle = formData.lifestyle as Record<string, unknown> | undefined;

    const noteLines: string[] = ['[Auto-created from patient intake form]'];
    if (about?.phone) noteLines.push(`Phone: ${about.phone}`);
    if (about?.email) noteLines.push(`Email: ${about.email}`);
    if (about?.preferred_language && about.preferred_language !== 'English') noteLines.push(`Language: ${about.preferred_language}`);
    if (liver?.fibroscan_kpa) noteLines.push(`FibroScan: ${liver.fibroscan_kpa} kPa`);
    if (liver?.biopsy_stage) noteLines.push(`Biopsy stage: ${liver.biopsy_stage}`);
    if (lifestyle?.alcohol_frequency) noteLines.push(`Alcohol: ${lifestyle.alcohol_frequency}`);
    if (meds?.drug_allergies) noteLines.push(`Allergies: ${meds.drug_allergies}`);
    if (lifestyle?.additional_notes) noteLines.push(`Patient notes: ${lifestyle.additional_notes}`);

    await db.query(
        `INSERT INTO patients (id, site_id, first_name, last_name, dob, notes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [patientId, siteId, firstName, lastName, dob || null, noteLines.join('\n')]
    );

    await db.query(
        `UPDATE intake_submissions SET status = 'CONVERTED', patient_id = $1 WHERE id = $2`,
        [patientId, submission.id]
    );

    await auditLog(db, {
        siteId,
        userId: req.user.id,
        entityType: 'patient',
        entityId: patientId,
        action: 'CREATE',
        diff: { source: 'intake_form', submission_id: submission.id },
    });

    const patient = (await db.query('SELECT * FROM patients WHERE id = $1', [patientId])).rows[0];
    res.status(201).json({ patient, submission_id: submission.id });
});

// PATCH /api/intake/submissions/:id/archive
router.patch('/submissions/:id/archive', async (req: Request, res: Response) => {
    const db = req.app.locals.db;

    const result = await db.query(
        `UPDATE intake_submissions SET status = 'ARCHIVED' WHERE id = $1 AND site_id = $2 RETURNING id`,
        [req.params.id, req.user.site_id]
    );

    if (result.rowCount === 0) {
        res.status(404).json({ error: 'Submission not found' });
        return;
    }

    res.json({ success: true });
});

export default router;
