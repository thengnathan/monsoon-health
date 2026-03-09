const express = require('express');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/me', authMiddleware, async (req, res) => {
    const db = req.app.locals.db;
    const user = (await db.query(
        'SELECT id, site_id, name, email, role, is_active, notification_prefs, created_at FROM users WHERE id = $1',
        [req.user.id]
    )).rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
});

module.exports = router;
