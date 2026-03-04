const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware, auditLog } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/screening-cases
router.get('/', (req, res) => {
    const db = req.app.locals.db;
    const { status, trial_id, assigned_user_id, patient_id, revisit_due, limit = 50, offset = 0 } = req.query;
    const siteId = req.user.site_id;

    let sql = `
    SELECT sc.*, 
      p.first_name, p.last_name, p.dob, p.internal_identifier,
      t.name as trial_name, t.protocol_number, t.specialty,
      u.name as assigned_user_name,
      sfr.code as fail_reason_code, sfr.label as fail_reason_label
    FROM screening_cases sc
    JOIN patients p ON sc.patient_id = p.id
    JOIN trials t ON sc.trial_id = t.id
    LEFT JOIN users u ON sc.assigned_user_id = u.id
    LEFT JOIN screen_fail_reasons sfr ON sc.fail_reason_id = sfr.id
    WHERE sc.site_id = ?
  `;
    const params = [siteId];

    if (status) {
        const statuses = status.split(',');
        sql += ` AND sc.status IN (${statuses.map(() => '?').join(',')})`;
        params.push(...statuses);
    }
    if (trial_id) { sql += ` AND sc.trial_id = ?`; params.push(trial_id); }
    if (assigned_user_id) { sql += ` AND sc.assigned_user_id = ?`; params.push(assigned_user_id); }
    if (patient_id) { sql += ` AND sc.patient_id = ?`; params.push(patient_id); }
    if (revisit_due === 'true') {
        sql += ` AND sc.revisit_date IS NOT NULL AND sc.revisit_date <= date('now') AND sc.status IN ('FUTURE_CANDIDATE', 'SCREEN_FAILED')`;
    }

    sql += ` ORDER BY sc.updated_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const cases = db.prepare(sql).all(...params);

    // Get pending item counts
    const caseIds = cases.map(c => c.id);
    if (caseIds.length > 0) {
        const pendingCounts = db.prepare(`
      SELECT screening_case_id, 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) as open_count
      FROM pending_items 
      WHERE screening_case_id IN (${caseIds.map(() => '?').join(',')})
      GROUP BY screening_case_id
    `).all(...caseIds);

        const countMap = {};
        pendingCounts.forEach(c => { countMap[c.screening_case_id] = c; });
        cases.forEach(c => {
            c.pending_items_total = countMap[c.id]?.total || 0;
            c.pending_items_open = countMap[c.id]?.open_count || 0;
        });
    }

    res.json({ cases, total: cases.length });
});

// POST /api/screening-cases
router.post('/', (req, res) => {
    const db = req.app.locals.db;
    const id = uuidv4();
    const { patient_id, trial_id, assigned_user_id, status = 'NEW' } = req.body;

    if (!patient_id || !trial_id) {
        return res.status(400).json({ error: 'patient_id and trial_id are required' });
    }

    // Verify patient and trial exist
    const patient = db.prepare('SELECT id FROM patients WHERE id = ? AND site_id = ?').get(patient_id, req.user.site_id);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const trial = db.prepare('SELECT id FROM trials WHERE id = ? AND site_id = ?').get(trial_id, req.user.site_id);
    if (!trial) return res.status(404).json({ error: 'Trial not found' });

    // Check for existing active case
    const existingActive = db.prepare(`
    SELECT id FROM screening_cases 
    WHERE patient_id = ? AND trial_id = ? AND site_id = ?
    AND status NOT IN ('SCREEN_FAILED', 'DECLINED', 'LOST_TO_FOLLOWUP', 'ENROLLED')
  `).get(patient_id, trial_id, req.user.site_id);

    if (existingActive) {
        return res.status(409).json({ error: 'An active screening case already exists for this patient-trial combination', existing_case_id: existingActive.id });
    }

    db.prepare(`
    INSERT INTO screening_cases (id, site_id, patient_id, trial_id, assigned_user_id, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, req.user.site_id, patient_id, trial_id, assigned_user_id || req.user.id, status);

    auditLog(db, { siteId: req.user.site_id, userId: req.user.id, entityType: 'screening_case', entityId: id, action: 'CREATE', diff: req.body });

    const newCase = db.prepare(`
    SELECT sc.*, p.first_name, p.last_name, t.name as trial_name
    FROM screening_cases sc
    JOIN patients p ON sc.patient_id = p.id
    JOIN trials t ON sc.trial_id = t.id
    WHERE sc.id = ?
  `).get(id);
    res.status(201).json(newCase);
});

// GET /api/screening-cases/:id
router.get('/:id', (req, res) => {
    const db = req.app.locals.db;
    const sc = db.prepare(`
    SELECT sc.*, 
      p.first_name, p.last_name, p.dob, p.internal_identifier, p.notes as patient_notes,
      t.name as trial_name, t.protocol_number, t.specialty, t.description as trial_description,
      u.name as assigned_user_name,
      sfr.code as fail_reason_code, sfr.label as fail_reason_label, sfr.explanation_template
    FROM screening_cases sc
    JOIN patients p ON sc.patient_id = p.id
    JOIN trials t ON sc.trial_id = t.id
    LEFT JOIN users u ON sc.assigned_user_id = u.id
    LEFT JOIN screen_fail_reasons sfr ON sc.fail_reason_id = sfr.id
    WHERE sc.id = ? AND sc.site_id = ?
  `).get(req.params.id, req.user.site_id);

    if (!sc) return res.status(404).json({ error: 'Screening case not found' });

    // Get pending items
    const pendingItems = db.prepare(`
    SELECT * FROM pending_items WHERE screening_case_id = ? ORDER BY due_date ASC, created_at ASC
  `).all(req.params.id);

    // Get patient's relevant signals
    const signals = db.prepare(`
    SELECT ps.*, st.name as signal_name, st.label as signal_label, st.unit, st.value_type
    FROM patient_signals ps
    JOIN signal_types st ON ps.signal_type_id = st.id
    WHERE ps.patient_id = ? AND ps.site_id = ?
    ORDER BY ps.collected_at DESC
  `).all(sc.patient_id, req.user.site_id);

    // Get trial signal rules for context
    const rules = db.prepare(`
    SELECT tsr.*, st.name as signal_name, st.label as signal_label, st.unit
    FROM trial_signal_rules tsr
    JOIN signal_types st ON tsr.signal_type_id = st.id
    WHERE tsr.trial_id = ? AND tsr.is_active = 1
  `).all(sc.trial_id);

    res.json({ ...sc, pending_items: pendingItems, signals, trial_signal_rules: rules });
});

// PATCH /api/screening-cases/:id
router.patch('/:id', (req, res) => {
    const db = req.app.locals.db;
    const existing = db.prepare('SELECT * FROM screening_cases WHERE id = ? AND site_id = ?').get(req.params.id, req.user.site_id);
    if (!existing) return res.status(404).json({ error: 'Screening case not found' });

    const fields = ['status', 'assigned_user_id', 'fail_reason_id', 'fail_reason_text', 'what_would_change_text', 'revisit_date', 'next_action_date'];
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
    updates.push("last_touched_at = datetime('now')");
    values.push(req.params.id, req.user.site_id);

    db.prepare(`UPDATE screening_cases SET ${updates.join(', ')} WHERE id = ? AND site_id = ?`).run(...values);
    auditLog(db, { siteId: req.user.site_id, userId: req.user.id, entityType: 'screening_case', entityId: req.params.id, action: 'UPDATE', diff: req.body });

    // If status changed to SCREEN_FAILED or FUTURE_CANDIDATE with a revisit date, we could create notification
    if (req.body.status === 'FUTURE_CANDIDATE' && req.body.revisit_date) {
        // Will be picked up by the revisit scanner
    }

    const updated = db.prepare(`
    SELECT sc.*, p.first_name, p.last_name, t.name as trial_name
    FROM screening_cases sc
    JOIN patients p ON sc.patient_id = p.id
    JOIN trials t ON sc.trial_id = t.id
    WHERE sc.id = ?
  `).get(req.params.id);
    res.json(updated);
});

// POST /api/screening-cases/:id/assign
router.post('/:id/assign', (req, res) => {
    const db = req.app.locals.db;
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id is required' });

    const result = db.prepare(`
    UPDATE screening_cases SET assigned_user_id = ?, updated_at = datetime('now'), last_touched_at = datetime('now')
    WHERE id = ? AND site_id = ?
  `).run(user_id, req.params.id, req.user.site_id);

    if (result.changes === 0) return res.status(404).json({ error: 'Screening case not found' });

    auditLog(db, { siteId: req.user.site_id, userId: req.user.id, entityType: 'screening_case', entityId: req.params.id, action: 'UPDATE', diff: { assigned_user_id: user_id } });

    res.json({ message: 'Assigned' });
});

module.exports = router;
