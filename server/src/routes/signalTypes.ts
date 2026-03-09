import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const { rows } = await db.query(
        'SELECT * FROM signal_types WHERE site_id = $1 ORDER BY label',
        [req.user.site_id]
    );
    res.json(rows);
});

router.post('/', async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const id = uuidv4();
    const { name, label, value_type, unit } = req.body as {
        name?: string; label?: string; value_type?: string; unit?: string;
    };

    if (!name || !label || !value_type) {
        res.status(400).json({ error: 'name, label, and value_type are required' }); return;
    }

    await db.query(
        `INSERT INTO signal_types (id, site_id, name, label, value_type, unit) VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, req.user.site_id, name, label, value_type, unit || null]
    );

    const st = (await db.query('SELECT * FROM signal_types WHERE id = $1', [id])).rows[0];
    res.status(201).json(st);
});

router.patch('/:id', async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const existing = (await db.query(
        'SELECT * FROM signal_types WHERE id = $1 AND site_id = $2',
        [req.params.id, req.user.site_id]
    )).rows[0];
    if (!existing) { res.status(404).json({ error: 'Signal type not found' }); return; }

    const updates: string[] = [];
    const values: unknown[] = [];
    let p = 0;

    const body = req.body as Record<string, unknown>;
    for (const field of ['name', 'label', 'value_type', 'unit']) {
        if (body[field] !== undefined) { updates.push(`${field} = $${++p}`); values.push(body[field]); }
    }
    if (updates.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }

    updates.push(`updated_at = NOW()`);
    values.push(req.params.id, req.user.site_id);

    await db.query(`UPDATE signal_types SET ${updates.join(', ')} WHERE id = $${++p} AND site_id = $${++p}`, values);
    const st = (await db.query('SELECT * FROM signal_types WHERE id = $1', [req.params.id])).rows[0];
    res.json(st);
});

export default router;
