const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/signal-types
router.get('/', (req, res) => {
    const db = req.app.locals.db;
    const types = db.prepare('SELECT * FROM signal_types WHERE site_id = ? ORDER BY label').all(req.user.site_id);
    res.json(types);
});

// POST /api/signal-types
router.post('/', (req, res) => {
    const db = req.app.locals.db;
    const id = uuidv4();
    const { name, label, value_type, unit } = req.body;

    if (!name || !label || !value_type) {
        return res.status(400).json({ error: 'name, label, and value_type are required' });
    }

    db.prepare(`
    INSERT INTO signal_types (id, site_id, name, label, value_type, unit)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, req.user.site_id, name, label, value_type, unit || null);

    const st = db.prepare('SELECT * FROM signal_types WHERE id = ?').get(id);
    res.status(201).json(st);
});

// PATCH /api/signal-types/:id
router.patch('/:id', (req, res) => {
    const db = req.app.locals.db;
    const existing = db.prepare('SELECT * FROM signal_types WHERE id = ? AND site_id = ?').get(req.params.id, req.user.site_id);
    if (!existing) return res.status(404).json({ error: 'Signal type not found' });

    const fields = ['name', 'label', 'value_type', 'unit'];
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
    values.push(req.params.id, req.user.site_id);
    db.prepare(`UPDATE signal_types SET ${updates.join(', ')} WHERE id = ? AND site_id = ?`).run(...values);

    const st = db.prepare('SELECT * FROM signal_types WHERE id = ?').get(req.params.id);
    res.json(st);
});

module.exports = router;
