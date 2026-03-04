const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware, auditLog } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/pending-items (for a screening case, via query)
router.get('/', (req, res) => {
    const db = req.app.locals.db;
    const { screening_case_id, status } = req.query;

    let sql = 'SELECT * FROM pending_items WHERE site_id = ?';
    const params = [req.user.site_id];

    if (screening_case_id) {
        sql += ' AND screening_case_id = ?';
        params.push(screening_case_id);
    }
    if (status) {
        sql += ' AND status = ?';
        params.push(status);
    }

    sql += ' ORDER BY due_date ASC, created_at ASC';
    const items = db.prepare(sql).all(...params);
    res.json(items);
});

// POST /api/pending-items
router.post('/', (req, res) => {
    const db = req.app.locals.db;
    const id = uuidv4();
    const { screening_case_id, type, name, due_date } = req.body;

    if (!screening_case_id || !type || !name) {
        return res.status(400).json({ error: 'screening_case_id, type, and name are required' });
    }

    // Verify screening case exists
    const sc = db.prepare('SELECT id FROM screening_cases WHERE id = ? AND site_id = ?').get(screening_case_id, req.user.site_id);
    if (!sc) return res.status(404).json({ error: 'Screening case not found' });

    db.prepare(`
    INSERT INTO pending_items (id, site_id, screening_case_id, type, name, status, due_date)
    VALUES (?, ?, ?, ?, ?, 'OPEN', ?)
  `).run(id, req.user.site_id, screening_case_id, type, name, due_date || null);

    auditLog(db, { siteId: req.user.site_id, userId: req.user.id, entityType: 'pending_item', entityId: id, action: 'CREATE', diff: req.body });

    const item = db.prepare('SELECT * FROM pending_items WHERE id = ?').get(id);
    res.status(201).json(item);
});

// PATCH /api/pending-items/:id
router.patch('/:id', (req, res) => {
    const db = req.app.locals.db;
    const existing = db.prepare('SELECT * FROM pending_items WHERE id = ? AND site_id = ?').get(req.params.id, req.user.site_id);
    if (!existing) return res.status(404).json({ error: 'Pending item not found' });

    const fields = ['name', 'type', 'status', 'due_date'];
    const updates = [];
    const values = [];

    for (const field of fields) {
        if (req.body[field] !== undefined) {
            updates.push(`${field} = ?`);
            values.push(req.body[field]);
        }
    }

    // Handle completion
    if (req.body.status === 'COMPLETED' && existing.status !== 'COMPLETED') {
        updates.push("completed_at = datetime('now')");

        // Create PENDING_ITEM_COMPLETED notification
        const sc = db.prepare('SELECT * FROM screening_cases WHERE id = ?').get(existing.screening_case_id);
        if (sc) {
            const dedupKey = `pending_complete:${existing.id}`;
            try {
                db.prepare(`
          INSERT INTO notification_events (id, site_id, type, patient_id, screening_case_id, payload, dedup_key)
          VALUES (?, ?, 'PENDING_ITEM_COMPLETED', ?, ?, ?, ?)
        `).run(uuidv4(), req.user.site_id, sc.patient_id, sc.id,
                    JSON.stringify({ item_name: existing.name, item_type: existing.type }),
                    dedupKey);
            } catch (e) {
                // Dedup - ignore unique constraint violation
            }
        }
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    updates.push("updated_at = datetime('now')");
    values.push(req.params.id, req.user.site_id);

    db.prepare(`UPDATE pending_items SET ${updates.join(', ')} WHERE id = ? AND site_id = ?`).run(...values);
    auditLog(db, { siteId: req.user.site_id, userId: req.user.id, entityType: 'pending_item', entityId: req.params.id, action: 'UPDATE', diff: req.body });

    const item = db.prepare('SELECT * FROM pending_items WHERE id = ?').get(req.params.id);
    res.json(item);
});

// DELETE /api/pending-items/:id
router.delete('/:id', (req, res) => {
    const db = req.app.locals.db;
    const result = db.prepare('DELETE FROM pending_items WHERE id = ? AND site_id = ?').run(req.params.id, req.user.site_id);
    if (result.changes === 0) return res.status(404).json({ error: 'Pending item not found' });
    res.json({ message: 'Deleted' });
});

module.exports = router;
