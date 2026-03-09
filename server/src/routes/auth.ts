import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.get('/me', authMiddleware, async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const user = (await db.query(
        'SELECT id, site_id, name, email, role, is_active, notification_prefs, created_at FROM users WHERE id = $1',
        [req.user.id]
    )).rows[0];
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(user);
});

export default router;
