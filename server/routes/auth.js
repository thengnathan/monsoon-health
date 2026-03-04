const express = require('express');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/auth/me — returns the current authenticated user's internal profile
router.get('/me', authMiddleware, (req, res) => {
    const db = req.app.locals.db;
    const user = db.prepare(
        'SELECT id, site_id, name, email, role, is_active, notification_prefs, created_at FROM users WHERE id = ?'
    ).get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
});

module.exports = router;
