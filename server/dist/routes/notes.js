"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uuid_1 = require("uuid");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.get('/', async (req, res) => {
    const db = req.app.locals.db;
    const { rows } = await db.query(`SELECT * FROM notes WHERE site_id = $1 AND user_id = $2 ORDER BY is_pinned DESC, updated_at DESC`, [req.user.site_id, req.user.id]);
    res.json(rows);
});
router.post('/', async (req, res) => {
    const db = req.app.locals.db;
    const { title = '', content = '', color = 'default', is_pinned = false } = req.body;
    const id = (0, uuid_1.v4)();
    await db.query(`INSERT INTO notes (id, site_id, user_id, title, content, color, is_pinned) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [id, req.user.site_id, req.user.id, title, content, color, is_pinned]);
    const note = (await db.query('SELECT * FROM notes WHERE id = $1', [id])).rows[0];
    res.status(201).json(note);
});
router.patch('/:id', async (req, res) => {
    const db = req.app.locals.db;
    const note = (await db.query('SELECT * FROM notes WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id])).rows[0];
    if (!note) {
        res.status(404).json({ error: 'Note not found' });
        return;
    }
    const updates = [];
    const values = [];
    let p = 0;
    const { title, content, color, is_pinned } = req.body;
    if (title !== undefined) {
        updates.push(`title = $${++p}`);
        values.push(title);
    }
    if (content !== undefined) {
        updates.push(`content = $${++p}`);
        values.push(content);
    }
    if (color !== undefined) {
        updates.push(`color = $${++p}`);
        values.push(color);
    }
    if (is_pinned !== undefined) {
        updates.push(`is_pinned = $${++p}`);
        values.push(is_pinned);
    }
    if (updates.length === 0) {
        res.json(note);
        return;
    }
    updates.push(`updated_at = NOW()`);
    values.push(req.params.id);
    await db.query(`UPDATE notes SET ${updates.join(', ')} WHERE id = $${++p}`, values);
    const updated = (await db.query('SELECT * FROM notes WHERE id = $1', [req.params.id])).rows[0];
    res.json(updated);
});
router.delete('/:id', async (req, res) => {
    const db = req.app.locals.db;
    const note = (await db.query('SELECT * FROM notes WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id])).rows[0];
    if (!note) {
        res.status(404).json({ error: 'Note not found' });
        return;
    }
    await db.query('DELETE FROM notes WHERE id = $1', [req.params.id]);
    res.json({ success: true });
});
exports.default = router;
