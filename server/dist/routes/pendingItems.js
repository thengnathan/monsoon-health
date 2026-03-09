"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uuid_1 = require("uuid");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.get('/', async (req, res) => {
    const db = req.app.locals.db;
    const { screening_case_id, status } = req.query;
    let sql = 'SELECT * FROM pending_items WHERE site_id = $1';
    const params = [req.user.site_id];
    let p = 1;
    if (screening_case_id) {
        sql += ` AND screening_case_id = $${++p}`;
        params.push(screening_case_id);
    }
    if (status) {
        sql += ` AND status = $${++p}`;
        params.push(status);
    }
    sql += ' ORDER BY due_date ASC, created_at ASC';
    const { rows } = await db.query(sql, params);
    res.json(rows);
});
router.post('/', async (req, res) => {
    const db = req.app.locals.db;
    const id = (0, uuid_1.v4)();
    const { screening_case_id, type, name, due_date } = req.body;
    if (!screening_case_id || !type || !name) {
        res.status(400).json({ error: 'screening_case_id, type, and name are required' });
        return;
    }
    const sc = (await db.query('SELECT id FROM screening_cases WHERE id = $1 AND site_id = $2', [screening_case_id, req.user.site_id])).rows[0];
    if (!sc) {
        res.status(404).json({ error: 'Screening case not found' });
        return;
    }
    await db.query(`INSERT INTO pending_items (id, site_id, screening_case_id, type, name, status, due_date) VALUES ($1, $2, $3, $4, $5, 'OPEN', $6)`, [id, req.user.site_id, screening_case_id, type, name, due_date || null]);
    await (0, auth_1.auditLog)(db, { siteId: req.user.site_id, userId: req.user.id, entityType: 'pending_item', entityId: id, action: 'CREATE', diff: req.body });
    const item = (await db.query('SELECT * FROM pending_items WHERE id = $1', [id])).rows[0];
    res.status(201).json(item);
});
router.patch('/:id', async (req, res) => {
    const db = req.app.locals.db;
    const existing = (await db.query('SELECT * FROM pending_items WHERE id = $1 AND site_id = $2', [req.params.id, req.user.site_id])).rows[0];
    if (!existing) {
        res.status(404).json({ error: 'Pending item not found' });
        return;
    }
    const updates = [];
    const values = [];
    let p = 0;
    const body = req.body;
    for (const field of ['name', 'type', 'status', 'due_date']) {
        if (body[field] !== undefined) {
            updates.push(`${field} = $${++p}`);
            values.push(body[field]);
        }
    }
    if (body.status === 'COMPLETED' && existing.status !== 'COMPLETED') {
        updates.push(`completed_at = NOW()`);
        const sc = (await db.query('SELECT * FROM screening_cases WHERE id = $1', [existing.screening_case_id])).rows[0];
        if (sc) {
            const dedupKey = `pending_complete:${existing.id}`;
            try {
                await db.query(`INSERT INTO notification_events (id, site_id, type, patient_id, screening_case_id, payload, dedup_key)
                     VALUES ($1, $2, 'PENDING_ITEM_COMPLETED', $3, $4, $5, $6)`, [(0, uuid_1.v4)(), req.user.site_id, sc.patient_id, sc.id,
                    JSON.stringify({ item_name: existing.name, item_type: existing.type }),
                    dedupKey]);
            }
            catch (e) {
                const err = e;
                if (err.code !== '23505')
                    throw e;
            }
        }
    }
    if (updates.length === 0) {
        res.status(400).json({ error: 'No fields to update' });
        return;
    }
    updates.push(`updated_at = NOW()`);
    values.push(req.params.id, req.user.site_id);
    await db.query(`UPDATE pending_items SET ${updates.join(', ')} WHERE id = $${++p} AND site_id = $${++p}`, values);
    await (0, auth_1.auditLog)(db, { siteId: req.user.site_id, userId: req.user.id, entityType: 'pending_item', entityId: req.params.id, action: 'UPDATE', diff: req.body });
    const item = (await db.query('SELECT * FROM pending_items WHERE id = $1', [req.params.id])).rows[0];
    res.json(item);
});
router.delete('/:id', async (req, res) => {
    const db = req.app.locals.db;
    const result = await db.query('DELETE FROM pending_items WHERE id = $1 AND site_id = $2', [req.params.id, req.user.site_id]);
    if (result.rowCount === 0) {
        res.status(404).json({ error: 'Pending item not found' });
        return;
    }
    res.json({ message: 'Deleted' });
});
exports.default = router;
