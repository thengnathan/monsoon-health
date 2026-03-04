const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware, requireRole, auditLog } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// --- Visit Templates (per-trial schedule blueprint) ---

// GET /api/trials/:trialId/visit-templates
router.get('/trials/:trialId/visit-templates', (req, res) => {
    const db = req.app.locals.db;
    const templates = db.prepare(`
    SELECT * FROM visit_templates WHERE trial_id = ? AND site_id = ?
    ORDER BY sort_order, day_offset
  `).all(req.params.trialId, req.user.site_id);
    res.json(templates);
});

// POST /api/trials/:trialId/visit-templates
router.post('/trials/:trialId/visit-templates', requireRole('MANAGER', 'CRC'), (req, res) => {
    const db = req.app.locals.db;
    const id = uuidv4();
    const { visit_name, day_offset, window_before = 0, window_after = 0, reminder_days_before = 3, notes, sort_order = 0 } = req.body;

    if (!visit_name || day_offset === undefined) {
        return res.status(400).json({ error: 'visit_name and day_offset required' });
    }

    db.prepare(`
    INSERT INTO visit_templates (id, site_id, trial_id, visit_name, day_offset, window_before, window_after, reminder_days_before, notes, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.site_id, req.params.trialId, visit_name, day_offset, window_before, window_after, reminder_days_before, notes || null, sort_order);

    const template = db.prepare('SELECT * FROM visit_templates WHERE id = ?').get(id);
    res.status(201).json(template);
});

// PATCH /api/visit-templates/:id
router.patch('/visit-templates/:id', requireRole('MANAGER', 'CRC'), (req, res) => {
    const db = req.app.locals.db;
    const existing = db.prepare('SELECT * FROM visit_templates WHERE id = ? AND site_id = ?').get(req.params.id, req.user.site_id);
    if (!existing) return res.status(404).json({ error: 'Template not found' });

    const fields = ['visit_name', 'day_offset', 'window_before', 'window_after', 'reminder_days_before', 'notes', 'sort_order'];
    const updates = [];
    const values = [];

    for (const field of fields) {
        if (req.body[field] !== undefined) {
            updates.push(`${field} = ?`);
            values.push(req.body[field]);
        }
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    values.push(req.params.id, req.user.site_id);
    db.prepare(`UPDATE visit_templates SET ${updates.join(', ')} WHERE id = ? AND site_id = ?`).run(...values);

    const template = db.prepare('SELECT * FROM visit_templates WHERE id = ?').get(req.params.id);
    res.json(template);
});

// DELETE /api/visit-templates/:id
router.delete('/visit-templates/:id', requireRole('MANAGER'), (req, res) => {
    const db = req.app.locals.db;
    const result = db.prepare('DELETE FROM visit_templates WHERE id = ? AND site_id = ?').run(req.params.id, req.user.site_id);
    if (result.changes === 0) return res.status(404).json({ error: 'Template not found' });
    res.json({ message: 'Template deleted' });
});

// --- Patient Visits ---

// POST /api/screening-cases/:id/enroll — enroll patient, auto-generate visits from templates
router.post('/screening-cases/:id/enroll', requireRole('MANAGER', 'CRC'), (req, res) => {
    const db = req.app.locals.db;
    const sc = db.prepare(`
    SELECT sc.*, p.first_name, p.last_name, t.name as trial_name
    FROM screening_cases sc
    JOIN patients p ON sc.patient_id = p.id
    JOIN trials t ON sc.trial_id = t.id
    WHERE sc.id = ? AND sc.site_id = ?
  `).get(req.params.id, req.user.site_id);

    if (!sc) return res.status(404).json({ error: 'Case not found' });
    if (sc.status === 'ENROLLED') return res.status(400).json({ error: 'Already enrolled' });

    const enrollment_date = req.body.enrollment_date || new Date().toISOString().split('T')[0];

    // Update status to ENROLLED
    db.prepare(`
    UPDATE screening_cases SET status = 'ENROLLED', updated_at = datetime('now'), last_touched_at = datetime('now')
    WHERE id = ?
  `).run(sc.id);

    // Fetch visit templates for this trial
    const templates = db.prepare(`
    SELECT * FROM visit_templates WHERE trial_id = ? AND site_id = ?
    ORDER BY sort_order, day_offset
  `).all(sc.trial_id, req.user.site_id);

    // Generate patient visits
    const visits = [];
    for (const tmpl of templates) {
        const visitId = uuidv4();
        const enrollDate = new Date(enrollment_date + 'T00:00:00');
        const scheduledDate = new Date(enrollDate);
        scheduledDate.setDate(scheduledDate.getDate() + tmpl.day_offset);
        const scheduledStr = scheduledDate.toISOString().split('T')[0];

        db.prepare(`
      INSERT INTO patient_visits (id, site_id, screening_case_id, visit_template_id, scheduled_date, status)
      VALUES (?, ?, ?, ?, ?, 'SCHEDULED')
    `).run(visitId, req.user.site_id, sc.id, tmpl.id, scheduledStr);

        visits.push({ id: visitId, visit_name: tmpl.visit_name, scheduled_date: scheduledStr, day_offset: tmpl.day_offset, status: 'SCHEDULED' });
    }

    auditLog(db, { siteId: req.user.site_id, userId: req.user.id, entityType: 'screening_case', entityId: sc.id, action: 'UPDATE', diff: { status: 'ENROLLED', enrollment_date, visits_created: visits.length } });

    res.json({ message: 'Patient enrolled', enrollment_date, visits_created: visits.length, visits });
});

// GET /api/screening-cases/:id/visits
router.get('/screening-cases/:id/visits', (req, res) => {
    const db = req.app.locals.db;
    const visits = db.prepare(`
    SELECT pv.*, vt.visit_name, vt.day_offset, vt.window_before, vt.window_after, vt.reminder_days_before
    FROM patient_visits pv
    JOIN visit_templates vt ON pv.visit_template_id = vt.id
    WHERE pv.screening_case_id = ? AND pv.site_id = ?
    ORDER BY vt.sort_order, vt.day_offset
  `).all(req.params.id, req.user.site_id);
    res.json(visits);
});

// PATCH /api/patient-visits/:id
router.patch('/patient-visits/:id', requireRole('MANAGER', 'CRC'), (req, res) => {
    const db = req.app.locals.db;
    const existing = db.prepare('SELECT * FROM patient_visits WHERE id = ? AND site_id = ?').get(req.params.id, req.user.site_id);
    if (!existing) return res.status(404).json({ error: 'Visit not found' });

    const fields = ['scheduled_date', 'actual_date', 'status', 'notes'];
    const updates = [];
    const values = [];

    for (const field of fields) {
        if (req.body[field] !== undefined) {
            updates.push(`${field} = ?`);
            values.push(req.body[field]);
        }
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    updates.push("updated_at = datetime('now')");
    values.push(req.params.id, req.user.site_id);
    db.prepare(`UPDATE patient_visits SET ${updates.join(', ')} WHERE id = ? AND site_id = ?`).run(...values);

    const visit = db.prepare(`
    SELECT pv.*, vt.visit_name, vt.day_offset
    FROM patient_visits pv
    JOIN visit_templates vt ON pv.visit_template_id = vt.id
    WHERE pv.id = ?
  `).get(req.params.id);
    res.json(visit);
});

// GET /api/upcoming-visits — for the dashboard
router.get('/upcoming-visits', (req, res) => {
    const db = req.app.locals.db;
    const visits = db.prepare(`
    SELECT pv.*, vt.visit_name, vt.day_offset,
           p.first_name, p.last_name,
           t.name as trial_name,
           sc.id as screening_case_id
    FROM patient_visits pv
    JOIN visit_templates vt ON pv.visit_template_id = vt.id
    JOIN screening_cases sc ON pv.screening_case_id = sc.id
    JOIN patients p ON sc.patient_id = p.id
    JOIN trials t ON sc.trial_id = t.id
    WHERE pv.site_id = ?
      AND pv.status = 'SCHEDULED'
      AND pv.scheduled_date <= date('now', '+7 days')
      AND pv.scheduled_date >= date('now', '-1 day')
    ORDER BY pv.scheduled_date ASC
    LIMIT 20
  `).all(req.user.site_id);
    res.json(visits);
});

module.exports = router;
