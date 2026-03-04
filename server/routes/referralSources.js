const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/referral-sources
router.get('/', (req, res) => {
    const db = req.app.locals.db;
    const sources = db.prepare('SELECT * FROM referral_sources WHERE site_id = ? ORDER BY name').all(req.user.site_id);
    res.json(sources);
});

// POST /api/referral-sources
router.post('/', (req, res) => {
    const db = req.app.locals.db;
    const id = uuidv4();
    const { name, type = 'OTHER', contact_info } = req.body;

    if (!name) return res.status(400).json({ error: 'name is required' });

    db.prepare(`
    INSERT INTO referral_sources (id, site_id, name, type, contact_info) VALUES (?, ?, ?, ?, ?)
  `).run(id, req.user.site_id, name, type, contact_info ? JSON.stringify(contact_info) : '{}');

    const source = db.prepare('SELECT * FROM referral_sources WHERE id = ?').get(id);
    res.status(201).json(source);
});

// PATCH /api/referral-sources/:id
router.patch('/:id', (req, res) => {
    const db = req.app.locals.db;
    const existing = db.prepare('SELECT * FROM referral_sources WHERE id = ? AND site_id = ?').get(req.params.id, req.user.site_id);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const updates = [];
    const values = [];
    if (req.body.name) { updates.push('name = ?'); values.push(req.body.name); }
    if (req.body.type) { updates.push('type = ?'); values.push(req.body.type); }
    if (req.body.contact_info) { updates.push('contact_info = ?'); values.push(JSON.stringify(req.body.contact_info)); }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields' });

    updates.push("updated_at = datetime('now')");
    values.push(req.params.id, req.user.site_id);
    db.prepare(`UPDATE referral_sources SET ${updates.join(', ')} WHERE id = ? AND site_id = ?`).run(...values);

    const source = db.prepare('SELECT * FROM referral_sources WHERE id = ?').get(req.params.id);
    res.json(source);
});

module.exports = router;
