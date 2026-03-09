const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware, requireRole, auditLog } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/trials/:trialId/visit-templates
router.get('/trials/:trialId/visit-templates', async (req, res) => {
    const db = req.app.locals.db;
    const { rows } = await db.query(
        `SELECT * FROM visit_templates WHERE trial_id = $1 AND site_id = $2 ORDER BY sort_order, day_offset`,
        [req.params.trialId, req.user.site_id]
    );
    res.json(rows);
});

// POST /api/trials/:trialId/visit-templates
router.post('/trials/:trialId/visit-templates', requireRole('MANAGER', 'CRC'), async (req, res) => {
    const db = req.app.locals.db;
    const id = uuidv4();
    const { visit_name, day_offset, window_before = 0, window_after = 0, reminder_days_before = 3, notes, sort_order = 0 } = req.body;

    if (!visit_name || day_offset === undefined) {
        return res.status(400).json({ error: 'visit_name and day_offset required' });
    }

    await db.query(
        `INSERT INTO visit_templates (id, site_id, trial_id, visit_name, day_offset, window_before, window_after, reminder_days_before, notes, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [id, req.user.site_id, req.params.trialId, visit_name, day_offset, window_before, window_after, reminder_days_before, notes || null, sort_order]
    );

    const template = (await db.query('SELECT * FROM visit_templates WHERE id = $1', [id])).rows[0];
    res.status(201).json(template);
});

// PATCH /api/visit-templates/:id
router.patch('/visit-templates/:id', requireRole('MANAGER', 'CRC'), async (req, res) => {
    const db = req.app.locals.db;
    const existing = (await db.query(
        'SELECT * FROM visit_templates WHERE id = $1 AND site_id = $2',
        [req.params.id, req.user.site_id]
    )).rows[0];
    if (!existing) return res.status(404).json({ error: 'Template not found' });

    const updates = [];
    const values = [];
    let p = 0;

    for (const field of ['visit_name', 'day_offset', 'window_before', 'window_after', 'reminder_days_before', 'notes', 'sort_order']) {
        if (req.body[field] !== undefined) { updates.push(`${field} = $${++p}`); values.push(req.body[field]); }
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    values.push(req.params.id, req.user.site_id);
    await db.query(`UPDATE visit_templates SET ${updates.join(', ')} WHERE id = $${++p} AND site_id = $${++p}`, values);

    const template = (await db.query('SELECT * FROM visit_templates WHERE id = $1', [req.params.id])).rows[0];
    res.json(template);
});

// DELETE /api/visit-templates/:id
router.delete('/visit-templates/:id', requireRole('MANAGER'), async (req, res) => {
    const db = req.app.locals.db;
    const result = await db.query(
        'DELETE FROM visit_templates WHERE id = $1 AND site_id = $2',
        [req.params.id, req.user.site_id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Template not found' });
    res.json({ message: 'Template deleted' });
});

// POST /api/screening-cases/:id/enroll
router.post('/screening-cases/:id/enroll', requireRole('MANAGER', 'CRC'), async (req, res) => {
    const db = req.app.locals.db;
    const sc = (await db.query(
        `SELECT sc.*, p.first_name, p.last_name, t.name as trial_name
         FROM screening_cases sc
         JOIN patients p ON sc.patient_id = p.id
         JOIN trials t ON sc.trial_id = t.id
         WHERE sc.id = $1 AND sc.site_id = $2`,
        [req.params.id, req.user.site_id]
    )).rows[0];

    if (!sc) return res.status(404).json({ error: 'Case not found' });
    if (sc.status === 'ENROLLED') return res.status(400).json({ error: 'Already enrolled' });

    const enrollment_date = req.body.enrollment_date || new Date().toISOString().split('T')[0];

    await db.query(
        `UPDATE screening_cases SET status = 'ENROLLED', updated_at = NOW(), last_touched_at = NOW() WHERE id = $1`,
        [sc.id]
    );

    const templates = (await db.query(
        `SELECT * FROM visit_templates WHERE trial_id = $1 AND site_id = $2 ORDER BY sort_order, day_offset`,
        [sc.trial_id, req.user.site_id]
    )).rows;

    const visits = [];
    for (const tmpl of templates) {
        const visitId = uuidv4();
        const enrollDate = new Date(enrollment_date + 'T00:00:00');
        const scheduledDate = new Date(enrollDate);
        scheduledDate.setDate(scheduledDate.getDate() + tmpl.day_offset);
        const scheduledStr = scheduledDate.toISOString().split('T')[0];

        await db.query(
            `INSERT INTO patient_visits (id, site_id, screening_case_id, visit_template_id, scheduled_date, status) VALUES ($1, $2, $3, $4, $5, 'SCHEDULED')`,
            [visitId, req.user.site_id, sc.id, tmpl.id, scheduledStr]
        );

        visits.push({ id: visitId, visit_name: tmpl.visit_name, scheduled_date: scheduledStr, day_offset: tmpl.day_offset, status: 'SCHEDULED' });
    }

    await auditLog(db, { siteId: req.user.site_id, userId: req.user.id, entityType: 'screening_case', entityId: sc.id, action: 'UPDATE', diff: { status: 'ENROLLED', enrollment_date, visits_created: visits.length } });

    res.json({ message: 'Patient enrolled', enrollment_date, visits_created: visits.length, visits });
});

// GET /api/screening-cases/:id/visits
router.get('/screening-cases/:id/visits', async (req, res) => {
    const db = req.app.locals.db;
    const { rows } = await db.query(
        `SELECT pv.*, vt.visit_name, vt.day_offset, vt.window_before, vt.window_after, vt.reminder_days_before
         FROM patient_visits pv
         JOIN visit_templates vt ON pv.visit_template_id = vt.id
         WHERE pv.screening_case_id = $1 AND pv.site_id = $2
         ORDER BY vt.sort_order, vt.day_offset`,
        [req.params.id, req.user.site_id]
    );
    res.json(rows);
});

// PATCH /api/patient-visits/:id
router.patch('/patient-visits/:id', requireRole('MANAGER', 'CRC'), async (req, res) => {
    const db = req.app.locals.db;
    const existing = (await db.query(
        'SELECT * FROM patient_visits WHERE id = $1 AND site_id = $2',
        [req.params.id, req.user.site_id]
    )).rows[0];
    if (!existing) return res.status(404).json({ error: 'Visit not found' });

    const updates = [];
    const values = [];
    let p = 0;

    for (const field of ['scheduled_date', 'actual_date', 'status', 'notes']) {
        if (req.body[field] !== undefined) { updates.push(`${field} = $${++p}`); values.push(req.body[field]); }
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    updates.push(`updated_at = NOW()`);
    values.push(req.params.id, req.user.site_id);
    await db.query(`UPDATE patient_visits SET ${updates.join(', ')} WHERE id = $${++p} AND site_id = $${++p}`, values);

    const visit = (await db.query(
        `SELECT pv.*, vt.visit_name, vt.day_offset FROM patient_visits pv JOIN visit_templates vt ON pv.visit_template_id = vt.id WHERE pv.id = $1`,
        [req.params.id]
    )).rows[0];
    res.json(visit);
});

// GET /api/upcoming-visits
router.get('/upcoming-visits', async (req, res) => {
    const db = req.app.locals.db;
    const { rows } = await db.query(
        `SELECT pv.*, vt.visit_name, vt.day_offset,
               p.first_name, p.last_name,
               t.name as trial_name,
               sc.id as screening_case_id
         FROM patient_visits pv
         JOIN visit_templates vt ON pv.visit_template_id = vt.id
         JOIN screening_cases sc ON pv.screening_case_id = sc.id
         JOIN patients p ON sc.patient_id = p.id
         JOIN trials t ON sc.trial_id = t.id
         WHERE pv.site_id = $1
           AND pv.status = 'SCHEDULED'
           AND pv.scheduled_date <= (CURRENT_DATE + INTERVAL '7 days')::text
           AND pv.scheduled_date >= (CURRENT_DATE - INTERVAL '1 day')::text
         ORDER BY pv.scheduled_date ASC
         LIMIT 20`,
        [req.user.site_id]
    );
    res.json(rows);
});

module.exports = router;
