const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
    const db = req.app.locals.db;
    const { rows } = await db.query(
        'SELECT * FROM signal_types WHERE site_id = $1 ORDER BY label',
        [req.user.site_id]
    );
    res.json(rows);
});

router.post('/', async (req, res) => {
    const db = req.app.locals.db;
    const id = uuidv4();
    const { name, label, value_type, unit } = req.body;

    if (!name || !label || !value_type) {
        return res.status(400).json({ error: 'name, label, and value_type are required' });
    }

    await db.query(
        `INSERT INTO signal_types (id, site_id, name, label, value_type, unit) VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, req.user.site_id, name, label, value_type, unit || null]
    );

    const st = (await db.query('SELECT * FROM signal_types WHERE id = $1', [id])).rows[0];
    res.status(201).json(st);
});

router.patch('/:id', async (req, res) => {
    const db = req.app.locals.db;
    const existing = (await db.query(
        'SELECT * FROM signal_types WHERE id = $1 AND site_id = $2',
        [req.params.id, req.user.site_id]
    )).rows[0];
    if (!existing) return res.status(404).json({ error: 'Signal type not found' });

    const updates = [];
    const values = [];
    let p = 0;

    for (const field of ['name', 'label', 'value_type', 'unit']) {
        if (req.body[field] !== undefined) { updates.push(`${field} = $${++p}`); values.push(req.body[field]); }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    updates.push(`updated_at = NOW()`);
    values.push(req.params.id, req.user.site_id);

    await db.query(`UPDATE signal_types SET ${updates.join(', ')} WHERE id = $${++p} AND site_id = $${++p}`, values);
    const st = (await db.query('SELECT * FROM signal_types WHERE id = $1', [req.params.id])).rows[0];
    res.json(st);
});

module.exports = router;
