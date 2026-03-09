"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/me', auth_1.authMiddleware, async (req, res) => {
    const db = req.app.locals.db;
    const user = (await db.query('SELECT id, site_id, name, email, role, is_active, notification_prefs, created_at FROM users WHERE id = $1', [req.user.id])).rows[0];
    if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    res.json(user);
});
exports.default = router;
