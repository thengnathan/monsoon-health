const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
    const db = req.app.locals.db;
    const { rows } = await db.query(
        'SELECT id, site_id, name, email, role, is_active, created_at FROM users WHERE site_id = $1 ORDER BY name',
        [req.user.site_id]
    );
    res.json(rows);
});

router.post('/', requireRole('MANAGER'), async (req, res) => {
    const db = req.app.locals.db;
    const id = uuidv4();
    const { name, email, role = 'CRC' } = req.body;

    if (!name || !email) {
        return res.status(400).json({ error: 'name and email required' });
    }

    try {
        await db.query(
            `INSERT INTO users (id, site_id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, 'clerk-managed', $5)`,
            [id, req.user.site_id, name, email, role]
        );
    } catch (e) {
        if (e.code === '23505') return res.status(409).json({ error: 'Email already exists' });
        throw e;
    }

    const user = (await db.query(
        'SELECT id, site_id, name, email, role, is_active, created_at FROM users WHERE id = $1',
        [id]
    )).rows[0];
    res.status(201).json(user);
});

router.patch('/:id', async (req, res) => {
    const db = req.app.locals.db;
    if (req.user.id !== req.params.id && req.user.role !== 'MANAGER') {
        return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const existing = (await db.query(
        'SELECT * FROM users WHERE id = $1 AND site_id = $2',
        [req.params.id, req.user.site_id]
    )).rows[0];
    if (!existing) return res.status(404).json({ error: 'User not found' });

    const updates = [];
    const values = [];
    let p = 0;

    if (req.body.name) { updates.push(`name = $${++p}`); values.push(req.body.name); }
    if (req.body.email) { updates.push(`email = $${++p}`); values.push(req.body.email); }
    if (req.body.role && req.user.role === 'MANAGER') { updates.push(`role = $${++p}`); values.push(req.body.role); }
    if (req.body.is_active !== undefined && req.user.role === 'MANAGER') { updates.push(`is_active = $${++p}`); values.push(req.body.is_active); }
    if (req.body.notification_prefs) { updates.push(`notification_prefs = $${++p}`); values.push(JSON.stringify(req.body.notification_prefs)); }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    updates.push(`updated_at = NOW()`);
    values.push(req.params.id, req.user.site_id);

    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${++p} AND site_id = $${++p}`, values);
    const user = (await db.query(
        'SELECT id, site_id, name, email, role, is_active, created_at FROM users WHERE id = $1',
        [req.params.id]
    )).rows[0];
    res.json(user);
});

module.exports = router;
