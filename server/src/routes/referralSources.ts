import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const { rows } = await db.query(
        'SELECT * FROM referral_sources WHERE site_id = $1 ORDER BY name',
        [req.user.site_id]
    );
    res.json(rows);
});

router.post('/', async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const id = uuidv4();
    const { name, type = 'OTHER', contact_info } = req.body as {
        name?: string; type?: string; contact_info?: Record<string, unknown>;
    };

    if (!name) { res.status(400).json({ error: 'name is required' }); return; }

    await db.query(
        `INSERT INTO referral_sources (id, site_id, name, type, contact_info) VALUES ($1, $2, $3, $4, $5)`,
        [id, req.user.site_id, name, type, contact_info ? JSON.stringify(contact_info) : '{}']
    );

    const source = (await db.query('SELECT * FROM referral_sources WHERE id = $1', [id])).rows[0];
    res.status(201).json(source);
});

router.patch('/:id', async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const existing = (await db.query(
        'SELECT * FROM referral_sources WHERE id = $1 AND site_id = $2',
        [req.params.id, req.user.site_id]
    )).rows[0];
    if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

    const updates: string[] = [];
    const values: unknown[] = [];
    let p = 0;

    const body = req.body as { name?: string; type?: string; contact_info?: Record<string, unknown> };
    if (body.name) { updates.push(`name = $${++p}`); values.push(body.name); }
    if (body.type) { updates.push(`type = $${++p}`); values.push(body.type); }
    if (body.contact_info) { updates.push(`contact_info = $${++p}`); values.push(JSON.stringify(body.contact_info)); }
    if (updates.length === 0) { res.status(400).json({ error: 'No fields' }); return; }

    updates.push(`updated_at = NOW()`);
    values.push(req.params.id, req.user.site_id);

    await db.query(`UPDATE referral_sources SET ${updates.join(', ')} WHERE id = $${++p} AND site_id = $${++p}`, values);
    const source = (await db.query('SELECT * FROM referral_sources WHERE id = $1', [req.params.id])).rows[0];
    res.json(source);
});

export default router;
