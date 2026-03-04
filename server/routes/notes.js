const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET all notes for the current user
router.get('/', (req, res) => {
    const db = req.app.locals.db;
    const notes = db.prepare(`
        SELECT * FROM notes
        WHERE site_id = ? AND user_id = ?
        ORDER BY is_pinned DESC, updated_at DESC
    `).all(req.user.site_id, req.user.id);
    res.json(notes);
});

// POST create a note
router.post('/', (req, res) => {
    const db = req.app.locals.db;
    const { title = '', content = '', color = 'default' } = req.body;
    const id = uuidv4();

    db.prepare(`
        INSERT INTO notes (id, site_id, user_id, title, content, color)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, req.user.site_id, req.user.id, title, content, color);

    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
    res.status(201).json(note);
});

// PATCH update a note
router.patch('/:id', (req, res) => {
    const db = req.app.locals.db;
    const note = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!note) return res.status(404).json({ error: 'Note not found' });

    const { title, content, color, is_pinned } = req.body;
    const updates = [];
    const values = [];

    if (title !== undefined) { updates.push('title = ?'); values.push(title); }
    if (content !== undefined) { updates.push('content = ?'); values.push(content); }
    if (color !== undefined) { updates.push('color = ?'); values.push(color); }
    if (is_pinned !== undefined) { updates.push('is_pinned = ?'); values.push(is_pinned ? 1 : 0); }

    if (updates.length === 0) return res.json(note);

    updates.push("updated_at = datetime('now')");
    values.push(req.params.id);

    db.prepare(`UPDATE notes SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    const updated = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
    res.json(updated);
});

// DELETE a note
router.delete('/:id', (req, res) => {
    const db = req.app.locals.db;
    const note = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!note) return res.status(404).json({ error: 'Note not found' });

    db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

module.exports = router;
