const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware, auditLog } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
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
    WHERE sc.site_id = $1
  `;
    const params = [siteId];
    let p = 1;

    if (status) {
        const statuses = status.split(',');
        sql += ` AND sc.status = ANY($${++p})`;
        params.push(statuses);
    }
    if (trial_id) { sql += ` AND sc.trial_id = $${++p}`; params.push(trial_id); }
    if (assigned_user_id) { sql += ` AND sc.assigned_user_id = $${++p}`; params.push(assigned_user_id); }
    if (patient_id) { sql += ` AND sc.patient_id = $${++p}`; params.push(patient_id); }
    if (revisit_due === 'true') {
        sql += ` AND sc.revisit_date IS NOT NULL AND sc.revisit_date <= CURRENT_DATE::text AND sc.status IN ('FUTURE_CANDIDATE', 'SCREEN_FAILED')`;
    }

    sql += ` ORDER BY sc.updated_at DESC LIMIT $${++p} OFFSET $${++p}`;
    params.push(Number(limit), Number(offset));

    const { rows: cases } = await db.query(sql, params);

    if (cases.length > 0) {
        const caseIds = cases.map(c => c.id);
        const { rows: pendingCounts } = await db.query(
            `SELECT screening_case_id,
               COUNT(*) as total,
               SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) as open_count
             FROM pending_items
             WHERE screening_case_id = ANY($1)
             GROUP BY screening_case_id`,
            [caseIds]
        );

        const countMap = {};
        pendingCounts.forEach(c => { countMap[c.screening_case_id] = c; });
        cases.forEach(c => {
            c.pending_items_total = Number(countMap[c.id]?.total || 0);
            c.pending_items_open = Number(countMap[c.id]?.open_count || 0);
        });
    }

    res.json({ cases, total: cases.length });
});

router.post('/', async (req, res) => {
    const db = req.app.locals.db;
    const id = uuidv4();
    const { patient_id, trial_id, assigned_user_id, status = 'NEW' } = req.body;

    if (!patient_id || !trial_id) {
        return res.status(400).json({ error: 'patient_id and trial_id are required' });
    }

    const patient = (await db.query('SELECT id FROM patients WHERE id = $1 AND site_id = $2', [patient_id, req.user.site_id])).rows[0];
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const trial = (await db.query('SELECT id FROM trials WHERE id = $1 AND site_id = $2', [trial_id, req.user.site_id])).rows[0];
    if (!trial) return res.status(404).json({ error: 'Trial not found' });

    const existingActive = (await db.query(
        `SELECT id FROM screening_cases WHERE patient_id = $1 AND trial_id = $2 AND site_id = $3
         AND status NOT IN ('SCREEN_FAILED', 'DECLINED', 'LOST_TO_FOLLOWUP', 'ENROLLED')`,
        [patient_id, trial_id, req.user.site_id]
    )).rows[0];

    if (existingActive) {
        return res.status(409).json({ error: 'An active screening case already exists for this patient-trial combination', existing_case_id: existingActive.id });
    }

    await db.query(
        `INSERT INTO screening_cases (id, site_id, patient_id, trial_id, assigned_user_id, status) VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, req.user.site_id, patient_id, trial_id, assigned_user_id || req.user.id, status]
    );

    await auditLog(db, { siteId: req.user.site_id, userId: req.user.id, entityType: 'screening_case', entityId: id, action: 'CREATE', diff: req.body });

    const newCase = (await db.query(
        `SELECT sc.*, p.first_name, p.last_name, t.name as trial_name
         FROM screening_cases sc
         JOIN patients p ON sc.patient_id = p.id
         JOIN trials t ON sc.trial_id = t.id
         WHERE sc.id = $1`,
        [id]
    )).rows[0];
    res.status(201).json(newCase);
});

router.get('/:id', async (req, res) => {
    const db = req.app.locals.db;
    const sc = (await db.query(
        `SELECT sc.*,
          p.first_name, p.last_name, p.dob, p.internal_identifier, p.notes as patient_notes,
          t.name as trial_name, t.protocol_number, t.specialty, t.description as trial_description,
          u.name as assigned_user_name,
          sfr.code as fail_reason_code, sfr.label as fail_reason_label, sfr.explanation_template
         FROM screening_cases sc
         JOIN patients p ON sc.patient_id = p.id
         JOIN trials t ON sc.trial_id = t.id
         LEFT JOIN users u ON sc.assigned_user_id = u.id
         LEFT JOIN screen_fail_reasons sfr ON sc.fail_reason_id = sfr.id
         WHERE sc.id = $1 AND sc.site_id = $2`,
        [req.params.id, req.user.site_id]
    )).rows[0];

    if (!sc) return res.status(404).json({ error: 'Screening case not found' });

    const [pendingItems, signals, rules] = await Promise.all([
        db.query(`SELECT * FROM pending_items WHERE screening_case_id = $1 ORDER BY due_date ASC, created_at ASC`, [req.params.id]),
        db.query(`SELECT ps.*, st.name as signal_name, st.label as signal_label, st.unit, st.value_type
                  FROM patient_signals ps JOIN signal_types st ON ps.signal_type_id = st.id
                  WHERE ps.patient_id = $1 AND ps.site_id = $2 ORDER BY ps.collected_at DESC`,
                 [sc.patient_id, req.user.site_id]),
        db.query(`SELECT tsr.*, st.name as signal_name, st.label as signal_label, st.unit
                  FROM trial_signal_rules tsr JOIN signal_types st ON tsr.signal_type_id = st.id
                  WHERE tsr.trial_id = $1 AND tsr.is_active = true`,
                 [sc.trial_id]),
    ]);

    res.json({ ...sc, pending_items: pendingItems.rows, signals: signals.rows, trial_signal_rules: rules.rows });
});

router.patch('/:id', async (req, res) => {
    const db = req.app.locals.db;
    const existing = (await db.query(
        'SELECT * FROM screening_cases WHERE id = $1 AND site_id = $2',
        [req.params.id, req.user.site_id]
    )).rows[0];
    if (!existing) return res.status(404).json({ error: 'Screening case not found' });

    const updates = [];
    const values = [];
    let p = 0;

    for (const field of ['status', 'assigned_user_id', 'fail_reason_id', 'fail_reason_text', 'what_would_change_text', 'revisit_date', 'next_action_date']) {
        if (req.body[field] !== undefined) { updates.push(`${field} = $${++p}`); values.push(req.body[field]); }
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    updates.push(`updated_at = NOW()`, `last_touched_at = NOW()`);
    values.push(req.params.id, req.user.site_id);

    await db.query(`UPDATE screening_cases SET ${updates.join(', ')} WHERE id = $${++p} AND site_id = $${++p}`, values);
    await auditLog(db, { siteId: req.user.site_id, userId: req.user.id, entityType: 'screening_case', entityId: req.params.id, action: 'UPDATE', diff: req.body });

    const updated = (await db.query(
        `SELECT sc.*, p.first_name, p.last_name, t.name as trial_name
         FROM screening_cases sc
         JOIN patients p ON sc.patient_id = p.id
         JOIN trials t ON sc.trial_id = t.id
         WHERE sc.id = $1`,
        [req.params.id]
    )).rows[0];
    res.json(updated);
});

router.post('/:id/assign', async (req, res) => {
    const db = req.app.locals.db;
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id is required' });

    const result = await db.query(
        `UPDATE screening_cases SET assigned_user_id = $1, updated_at = NOW(), last_touched_at = NOW() WHERE id = $2 AND site_id = $3`,
        [user_id, req.params.id, req.user.site_id]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: 'Screening case not found' });

    await auditLog(db, { siteId: req.user.site_id, userId: req.user.id, entityType: 'screening_case', entityId: req.params.id, action: 'UPDATE', diff: { assigned_user_id: user_id } });

    res.json({ message: 'Assigned' });
});

module.exports = router;
