const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware, auditLog } = require('../middleware/auth');
const { evaluateThresholds } = require('../services/alertEngine');

const router = express.Router();
router.use(authMiddleware);

router.get('/patient/:patientId', async (req, res) => {
    const db = req.app.locals.db;
    const { signal_type_id } = req.query;
    let sql = `
    SELECT ps.*, st.name as signal_name, st.label as signal_label, st.unit, st.value_type
    FROM patient_signals ps
    JOIN signal_types st ON ps.signal_type_id = st.id
    WHERE ps.patient_id = $1 AND ps.site_id = $2
  `;
    const params = [req.params.patientId, req.user.site_id];

    if (signal_type_id) {
        sql += ' AND ps.signal_type_id = $3';
        params.push(signal_type_id);
    }

    sql += ' ORDER BY ps.collected_at DESC';
    const { rows } = await db.query(sql, params);
    res.json(rows);
});

router.post('/patient/:patientId', async (req, res) => {
    const db = req.app.locals.db;
    const id = uuidv4();
    const patientId = req.params.patientId;
    const { signal_type_id, value, collected_at, source } = req.body;

    if (!signal_type_id || value === undefined || !collected_at) {
        return res.status(400).json({ error: 'signal_type_id, value, and collected_at are required' });
    }

    const signalType = (await db.query(
        'SELECT * FROM signal_types WHERE id = $1 AND site_id = $2',
        [signal_type_id, req.user.site_id]
    )).rows[0];
    if (!signalType) return res.status(404).json({ error: 'Signal type not found' });

    let value_number = null, value_text = null, value_enum = null;
    if (signalType.value_type === 'NUMBER') {
        value_number = Number(value);
    } else if (signalType.value_type === 'ENUM') {
        value_enum = String(value);
    } else {
        value_text = String(value);
    }

    await db.query(
        `INSERT INTO patient_signals (id, site_id, patient_id, signal_type_id, value_number, value_text, value_enum, collected_at, source, entered_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [id, req.user.site_id, patientId, signal_type_id, value_number, value_text, value_enum, collected_at, source || null, req.user.id]
    );

    await auditLog(db, { siteId: req.user.site_id, userId: req.user.id, entityType: 'patient_signal', entityId: id, action: 'CREATE', diff: req.body });

    const alerts = await evaluateThresholds(db, {
        siteId: req.user.site_id,
        patientId,
        signalTypeId: signal_type_id,
        value: value_number !== null ? value_number : (value_enum || value_text),
        signalType
    });

    const signal = (await db.query(
        `SELECT ps.*, st.name as signal_name, st.label as signal_label, st.unit, st.value_type
         FROM patient_signals ps
         JOIN signal_types st ON ps.signal_type_id = st.id
         WHERE ps.id = $1`,
        [id]
    )).rows[0];

    res.status(201).json({ signal, alerts_generated: alerts.length, alerts });
});

module.exports = router;
