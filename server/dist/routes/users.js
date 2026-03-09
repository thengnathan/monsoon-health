"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uuid_1 = require("uuid");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.get('/', async (req, res) => {
    const db = req.app.locals.db;
    const { rows } = await db.query('SELECT id, site_id, name, email, role, is_active, created_at FROM users WHERE site_id = $1 ORDER BY name', [req.user.site_id]);
    res.json(rows);
});
router.post('/', (0, auth_1.requireRole)('MANAGER'), async (req, res) => {
    const db = req.app.locals.db;
    const id = (0, uuid_1.v4)();
    const { name, email, role = 'CRC' } = req.body;
    if (!name || !email) {
        res.status(400).json({ error: 'name and email required' });
        return;
    }
    try {
        await db.query(`INSERT INTO users (id, site_id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, 'clerk-managed', $5)`, [id, req.user.site_id, name, email, role]);
    }
    catch (e) {
        const err = e;
        if (err.code === '23505') {
            res.status(409).json({ error: 'Email already exists' });
            return;
        }
        throw e;
    }
    const user = (await db.query('SELECT id, site_id, name, email, role, is_active, created_at FROM users WHERE id = $1', [id])).rows[0];
    res.status(201).json(user);
});
router.patch('/:id', async (req, res) => {
    const db = req.app.locals.db;
    if (req.user.id !== req.params.id && req.user.role !== 'MANAGER') {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
    }
    const existing = (await db.query('SELECT * FROM users WHERE id = $1 AND site_id = $2', [req.params.id, req.user.site_id])).rows[0];
    if (!existing) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    const updates = [];
    const values = [];
    let p = 0;
    const body = req.body;
    if (body.name) {
        updates.push(`name = $${++p}`);
        values.push(body.name);
    }
    if (body.email) {
        updates.push(`email = $${++p}`);
        values.push(body.email);
    }
    if (body.role && req.user.role === 'MANAGER') {
        updates.push(`role = $${++p}`);
        values.push(body.role);
    }
    if (body.is_active !== undefined && req.user.role === 'MANAGER') {
        updates.push(`is_active = $${++p}`);
        values.push(body.is_active);
    }
    if (body.notification_prefs) {
        updates.push(`notification_prefs = $${++p}`);
        values.push(JSON.stringify(body.notification_prefs));
    }
    if (updates.length === 0) {
        res.status(400).json({ error: 'No fields to update' });
        return;
    }
    updates.push(`updated_at = NOW()`);
    values.push(req.params.id, req.user.site_id);
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${++p} AND site_id = $${++p}`, values);
    const user = (await db.query('SELECT id, site_id, name, email, role, is_active, created_at FROM users WHERE id = $1', [req.params.id])).rows[0];
    res.json(user);
});
exports.default = router;
