const express = require('express');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/users
router.get('/', (req, res) => {
    const db = req.app.locals.db;
    const users = db.prepare(
        'SELECT id, site_id, name, email, role, is_active, created_at FROM users WHERE site_id = ? ORDER BY name'
    ).all(req.user.site_id);
    res.json(users);
});

// POST /api/users
router.post('/', requireRole('MANAGER'), (req, res) => {
    const db = req.app.locals.db;
    const id = uuidv4();
    const { name, email, password, role = 'CRC' } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'name, email, and password required' });
    }

    const hash = bcrypt.hashSync(password, 10);
    try {
        db.prepare(`
      INSERT INTO users (id, site_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, req.user.site_id, name, email, hash, role);
    } catch (e) {
        if (e.message.includes('UNIQUE')) {
            return res.status(409).json({ error: 'Email already exists' });
        }
        throw e;
    }

    const user = db.prepare('SELECT id, site_id, name, email, role, is_active, created_at FROM users WHERE id = ?').get(id);
    res.status(201).json(user);
});

// PATCH /api/users/:id
router.patch('/:id', (req, res) => {
    const db = req.app.locals.db;
    // Users can update themselves; managers can update anyone at site
    if (req.user.id !== req.params.id && req.user.role !== 'MANAGER') {
        return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const existing = db.prepare('SELECT * FROM users WHERE id = ? AND site_id = ?').get(req.params.id, req.user.site_id);
    if (!existing) return res.status(404).json({ error: 'User not found' });

    const updates = [];
    const values = [];

    if (req.body.name) { updates.push('name = ?'); values.push(req.body.name); }
    if (req.body.email) { updates.push('email = ?'); values.push(req.body.email); }
    if (req.body.role && req.user.role === 'MANAGER') { updates.push('role = ?'); values.push(req.body.role); }
    if (req.body.is_active !== undefined && req.user.role === 'MANAGER') { updates.push('is_active = ?'); values.push(req.body.is_active ? 1 : 0); }
    if (req.body.password) { updates.push('password_hash = ?'); values.push(bcrypt.hashSync(req.body.password, 10)); }
    if (req.body.notification_prefs) { updates.push('notification_prefs = ?'); values.push(JSON.stringify(req.body.notification_prefs)); }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    updates.push("updated_at = datetime('now')");
    values.push(req.params.id, req.user.site_id);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ? AND site_id = ?`).run(...values);
    const user = db.prepare('SELECT id, site_id, name, email, role, is_active, created_at FROM users WHERE id = ?').get(req.params.id);
    res.json(user);
});

module.exports = router;
