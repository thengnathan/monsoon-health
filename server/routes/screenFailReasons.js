const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
    const db = req.app.locals.db;
    const { specialty } = req.query;
    let sql = 'SELECT * FROM screen_fail_reasons WHERE site_id = $1';
    const params = [req.user.site_id];

    if (specialty) {
        sql += ' AND (specialty = $2 OR specialty IS NULL)';
        params.push(specialty);
    }

    sql += ' ORDER BY label';
    const { rows } = await db.query(sql, params);
    res.json(rows);
});

router.post('/', async (req, res) => {
    const db = req.app.locals.db;
    const id = uuidv4();
    const { code, label, specialty, explanation_template } = req.body;

    if (!code || !label) return res.status(400).json({ error: 'code and label required' });

    await db.query(
        `INSERT INTO screen_fail_reasons (id, site_id, specialty, code, label, explanation_template) VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, req.user.site_id, specialty || null, code, label, explanation_template || null]
    );

    const reason = (await db.query('SELECT * FROM screen_fail_reasons WHERE id = $1', [id])).rows[0];
    res.status(201).json(reason);
});

router.patch('/:id', async (req, res) => {
    const db = req.app.locals.db;
    const existing = (await db.query(
        'SELECT * FROM screen_fail_reasons WHERE id = $1 AND site_id = $2',
        [req.params.id, req.user.site_id]
    )).rows[0];
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const updates = [];
    const values = [];
    let p = 0;

    for (const f of ['code', 'label', 'specialty', 'explanation_template']) {
        if (req.body[f] !== undefined) { updates.push(`${f} = $${++p}`); values.push(req.body[f]); }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    updates.push(`updated_at = NOW()`);
    values.push(req.params.id, req.user.site_id);

    await db.query(`UPDATE screen_fail_reasons SET ${updates.join(', ')} WHERE id = $${++p} AND site_id = $${++p}`, values);
    const reason = (await db.query('SELECT * FROM screen_fail_reasons WHERE id = $1', [req.params.id])).rows[0];
    res.json(reason);
});

module.exports = router;
