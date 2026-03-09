import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const { unprocessed, limit = 50 } = req.query as { unprocessed?: string; limit?: string };

    let sql = `
    SELECT ne.*,
      p.first_name, p.last_name,
      t.name as trial_name
    FROM notification_events ne
    LEFT JOIN patients p ON ne.patient_id = p.id
    LEFT JOIN screening_cases sc ON ne.screening_case_id = sc.id
    LEFT JOIN trials t ON sc.trial_id = t.id
    WHERE ne.site_id = $1
  `;
    const params: unknown[] = [req.user.site_id];

    if (unprocessed === 'true') {
        sql += ' AND ne.processed_at IS NULL';
    }

    sql += ' ORDER BY ne.created_at DESC LIMIT $2';
    params.push(Number(limit));

    const { rows } = await db.query(sql, params);
    res.json(rows);
});

router.get('/email-logs', requireRole('MANAGER'), async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const { since, limit = 50 } = req.query as { since?: string; limit?: string };

    let sql = 'SELECT el.*, u.name as user_name FROM email_logs el JOIN users u ON el.user_id = u.id WHERE el.site_id = $1';
    const params: unknown[] = [req.user.site_id];
    let p = 1;

    if (since) {
        sql += ` AND el.created_at >= $${++p}`;
        params.push(since);
    }

    sql += ` ORDER BY el.created_at DESC LIMIT $${++p}`;
    params.push(Number(limit));

    const { rows } = await db.query(sql, params);
    res.json(rows);
});

export default router;
