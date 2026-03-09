import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const { specialty } = req.query as { specialty?: string };
    let sql = 'SELECT * FROM screen_fail_reasons WHERE site_id = $1';
    const params: unknown[] = [req.user.site_id];

    if (specialty) {
        sql += ' AND (specialty = $2 OR specialty IS NULL)';
        params.push(specialty);
    }

    sql += ' ORDER BY label';
    const { rows } = await db.query(sql, params);
    res.json(rows);
});

router.post('/', async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const id = uuidv4();
    const { code, label, specialty, explanation_template } = req.body as {
        code?: string; label?: string; specialty?: string; explanation_template?: string;
    };

    if (!code || !label) { res.status(400).json({ error: 'code and label required' }); return; }

    await db.query(
        `INSERT INTO screen_fail_reasons (id, site_id, specialty, code, label, explanation_template) VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, req.user.site_id, specialty || null, code, label, explanation_template || null]
    );

    const reason = (await db.query('SELECT * FROM screen_fail_reasons WHERE id = $1', [id])).rows[0];
    res.status(201).json(reason);
});

router.patch('/:id', async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const existing = (await db.query(
        'SELECT * FROM screen_fail_reasons WHERE id = $1 AND site_id = $2',
        [req.params.id, req.user.site_id]
    )).rows[0];
    if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

    const updates: string[] = [];
    const values: unknown[] = [];
    let p = 0;

    const body = req.body as Record<string, unknown>;
    for (const f of ['code', 'label', 'specialty', 'explanation_template']) {
        if (body[f] !== undefined) { updates.push(`${f} = $${++p}`); values.push(body[f]); }
    }
    if (updates.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }

    updates.push(`updated_at = NOW()`);
    values.push(req.params.id, req.user.site_id);

    await db.query(`UPDATE screen_fail_reasons SET ${updates.join(', ')} WHERE id = $${++p} AND site_id = $${++p}`, values);
    const reason = (await db.query('SELECT * FROM screen_fail_reasons WHERE id = $1', [req.params.id])).rows[0];
    res.json(reason);
});

export default router;
