const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
    const db = req.app.locals.db;
    const { rows } = await db.query(
        'SELECT * FROM referral_sources WHERE site_id = $1 ORDER BY name',
        [req.user.site_id]
    );
    res.json(rows);
});

router.post('/', async (req, res) => {
    const db = req.app.locals.db;
    const id = uuidv4();
    const { name, type = 'OTHER', contact_info } = req.body;

    if (!name) return res.status(400).json({ error: 'name is required' });

    await db.query(
        `INSERT INTO referral_sources (id, site_id, name, type, contact_info) VALUES ($1, $2, $3, $4, $5)`,
        [id, req.user.site_id, name, type, contact_info ? JSON.stringify(contact_info) : '{}']
    );

    const source = (await db.query('SELECT * FROM referral_sources WHERE id = $1', [id])).rows[0];
    res.status(201).json(source);
});

router.patch('/:id', async (req, res) => {
    const db = req.app.locals.db;
    const existing = (await db.query(
        'SELECT * FROM referral_sources WHERE id = $1 AND site_id = $2',
        [req.params.id, req.user.site_id]
    )).rows[0];
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const updates = [];
    const values = [];
    let p = 0;

    if (req.body.name) { updates.push(`name = $${++p}`); values.push(req.body.name); }
    if (req.body.type) { updates.push(`type = $${++p}`); values.push(req.body.type); }
    if (req.body.contact_info) { updates.push(`contact_info = $${++p}`); values.push(JSON.stringify(req.body.contact_info)); }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields' });

    updates.push(`updated_at = NOW()`);
    values.push(req.params.id, req.user.site_id);

    await db.query(`UPDATE referral_sources SET ${updates.join(', ')} WHERE id = $${++p} AND site_id = $${++p}`, values);
    const source = (await db.query('SELECT * FROM referral_sources WHERE id = $1', [req.params.id])).rows[0];
    res.json(source);
});

module.exports = router;
