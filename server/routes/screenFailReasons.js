const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/screen-fail-reasons
router.get('/', (req, res) => {
    const db = req.app.locals.db;
    const { specialty } = req.query;
    let sql = 'SELECT * FROM screen_fail_reasons WHERE site_id = ?';
    const params = [req.user.site_id];

    if (specialty) {
        sql += ' AND (specialty = ? OR specialty IS NULL)';
        params.push(specialty);
    }

    sql += ' ORDER BY label';
    const reasons = db.prepare(sql).all(...params);
    res.json(reasons);
});

// POST /api/screen-fail-reasons
router.post('/', (req, res) => {
    const db = req.app.locals.db;
    const id = uuidv4();
    const { code, label, specialty, explanation_template } = req.body;

    if (!code || !label) return res.status(400).json({ error: 'code and label required' });

    db.prepare(`
    INSERT INTO screen_fail_reasons (id, site_id, specialty, code, label, explanation_template)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, req.user.site_id, specialty || null, code, label, explanation_template || null);

    const reason = db.prepare('SELECT * FROM screen_fail_reasons WHERE id = ?').get(id);
    res.status(201).json(reason);
});

// PATCH /api/screen-fail-reasons/:id
router.patch('/:id', (req, res) => {
    const db = req.app.locals.db;
    const existing = db.prepare('SELECT * FROM screen_fail_reasons WHERE id = ? AND site_id = ?').get(req.params.id, req.user.site_id);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const fields = ['code', 'label', 'specialty', 'explanation_template'];
    const updates = [];
    const values = [];
    for (const f of fields) {
        if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f]); }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    updates.push("updated_at = datetime('now')");
    values.push(req.params.id, req.user.site_id);

    db.prepare(`UPDATE screen_fail_reasons SET ${updates.join(', ')} WHERE id = ? AND site_id = ?`).run(...values);
    const reason = db.prepare('SELECT * FROM screen_fail_reasons WHERE id = ?').get(req.params.id);
    res.json(reason);
});

module.exports = router;
