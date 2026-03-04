const express = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/notifications
router.get('/', (req, res) => {
    const db = req.app.locals.db;
    const { unprocessed, limit = 50 } = req.query;

    let sql = `
    SELECT ne.*,
      p.first_name, p.last_name,
      t.name as trial_name
    FROM notification_events ne
    LEFT JOIN patients p ON ne.patient_id = p.id
    LEFT JOIN screening_cases sc ON ne.screening_case_id = sc.id
    LEFT JOIN trials t ON sc.trial_id = t.id
    WHERE ne.site_id = ?
  `;
    const params = [req.user.site_id];

    if (unprocessed === 'true') {
        sql += ' AND ne.processed_at IS NULL';
    }

    sql += ' ORDER BY ne.created_at DESC LIMIT ?';
    params.push(Number(limit));

    const events = db.prepare(sql).all(...params);
    res.json(events);
});

// GET /api/notifications/email-logs
router.get('/email-logs', requireRole('MANAGER'), (req, res) => {
    const db = req.app.locals.db;
    const { since, limit = 50 } = req.query;

    let sql = 'SELECT el.*, u.name as user_name FROM email_logs el JOIN users u ON el.user_id = u.id WHERE el.site_id = ?';
    const params = [req.user.site_id];

    if (since) {
        sql += ' AND el.created_at >= ?';
        params.push(since);
    }

    sql += ' ORDER BY el.created_at DESC LIMIT ?';
    params.push(Number(limit));

    const logs = db.prepare(sql).all(...params);
    res.json(logs);
});

module.exports = router;
