import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { createClerkClient } from '@clerk/express';
import { SPECIALTY_TEMPLATES, DEFAULT_ENABLED_BY_SPECIALTY, ALL_SPECIALTY_KEYS } from '../config/specialtyTemplates';
import type { SpecialtyKey, SitePatientProfileConfig } from '../config/specialtyTemplates';

const router = Router();
router.use(authMiddleware);

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

// GET /api/settings/site — get site config + specialty templates
router.get('/site', async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const site = (await db.query(
        'SELECT id, name, timezone, specialties, patient_profile_config FROM sites WHERE id = $1',
        [req.user.site_id]
    )).rows[0];

    if (!site) { res.status(404).json({ error: 'Site not found' }); return; }

    const parseJsonb = (v: unknown, fallback: unknown) => {
        if (!v) return fallback;
        if (typeof v === 'object') return v;
        try { return JSON.parse(v as string); } catch { return fallback; }
    };

    res.json({
        site: {
            ...site,
            specialties: parseJsonb(site.specialties, []),
            patient_profile_config: parseJsonb(site.patient_profile_config, { specialties: [], enabled_options: [] }),
        },
        specialty_templates: SPECIALTY_TEMPLATES,
        all_specialty_keys: ALL_SPECIALTY_KEYS,
    });
});

// PATCH /api/settings/site — manager updates specialty config
router.patch('/site', requireRole('MANAGER', 'CRC'), async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const { specialties, enabled_options } = req.body as { specialties?: SpecialtyKey[]; enabled_options?: string[] };

    if (!specialties || !Array.isArray(specialties)) {
        res.status(400).json({ error: 'specialties array is required' }); return;
    }

    // Validate specialty keys
    const validKeys = new Set(ALL_SPECIALTY_KEYS);
    const invalid = specialties.filter(s => !validKeys.has(s));
    if (invalid.length > 0) {
        res.status(400).json({ error: `Invalid specialty keys: ${invalid.join(', ')}` }); return;
    }

    // If no enabled_options provided, auto-select the defaults for newly added specialties
    let finalEnabledOptions = enabled_options;
    if (!finalEnabledOptions) {
        const existing = (await db.query(
            'SELECT patient_profile_config FROM sites WHERE id = $1',
            [req.user.site_id]
        )).rows[0];
        const existingConfig = (typeof existing?.patient_profile_config === 'object'
            ? existing.patient_profile_config
            : JSON.parse(existing?.patient_profile_config || '{}')) as SitePatientProfileConfig;

        const alreadyEnabled = new Set(existingConfig.enabled_options || []);
        const newSpecialties = specialties.filter(s => !(existingConfig.specialties || []).includes(s));
        for (const sp of newSpecialties) {
            for (const opt of DEFAULT_ENABLED_BY_SPECIALTY[sp]) alreadyEnabled.add(opt);
        }
        finalEnabledOptions = Array.from(alreadyEnabled);
    }

    const config: SitePatientProfileConfig = { specialties, enabled_options: finalEnabledOptions };

    await db.query(
        `UPDATE sites SET specialties = $1, patient_profile_config = $2, updated_at = NOW() WHERE id = $3`,
        [JSON.stringify(specialties), JSON.stringify(config), req.user.site_id]
    );

    const updated = (await db.query(
        'SELECT id, name, specialties, patient_profile_config FROM sites WHERE id = $1',
        [req.user.site_id]
    )).rows[0];

    res.json({
        ...updated,
        specialties: typeof updated.specialties === 'object' ? updated.specialties : JSON.parse(updated.specialties),
        patient_profile_config: typeof updated.patient_profile_config === 'object' ? updated.patient_profile_config : JSON.parse(updated.patient_profile_config),
    });
});

// GET /api/settings/users — list all users for this site
router.get('/users', requireRole('MANAGER'), async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const result = await db.query(
        `SELECT id, name, email, role, is_active, created_at
         FROM users WHERE site_id = $1 ORDER BY created_at ASC`,
        [req.user.site_id]
    );
    res.json(result.rows);
});

// PATCH /api/settings/users/:id — approve or change role
router.patch('/users/:id', requireRole('MANAGER'), async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const { id } = req.params;
    const { is_active, role } = req.body as { is_active?: boolean; role?: string };

    const check = await db.query(
        'SELECT id FROM users WHERE id = $1 AND site_id = $2',
        [id, req.user.site_id]
    );
    if (!check.rows[0]) { res.status(404).json({ error: 'User not found' }); return; }

    const updates: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (is_active !== undefined) { updates.push(`is_active = $${i++}`); values.push(is_active); }
    if (role !== undefined) { updates.push(`role = $${i++}`); values.push(role); }
    if (updates.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }

    values.push(id);
    const updated = await db.query(
        `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING id, name, email, role, is_active`,
        values
    );
    res.json(updated.rows[0]);
});

// DELETE /api/settings/users/:id — reject pending user (removes from DB + Clerk)
router.delete('/users/:id', requireRole('MANAGER'), async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const { id } = req.params;

    const result = await db.query(
        'SELECT id, clerk_id FROM users WHERE id = $1 AND site_id = $2 AND is_active = false',
        [id, req.user.site_id]
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'User not found or already active' }); return; }

    const { clerk_id } = result.rows[0];

    await db.query('DELETE FROM users WHERE id = $1', [id]);

    try {
        await clerkClient.users.deleteUser(clerk_id);
    } catch (e) {
        console.warn('[Settings] Could not delete Clerk user:', (e as Error).message);
    }

    res.json({ success: true });
});

// PATCH /api/settings/site-name — update site display name
router.patch('/site-name', requireRole('MANAGER'), async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const { name } = req.body as { name?: string };
    if (!name?.trim()) { res.status(400).json({ error: 'Name is required' }); return; }

    const updated = await db.query(
        `UPDATE sites SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name`,
        [name.trim(), req.user.site_id]
    );
    res.json(updated.rows[0]);
});

export default router;
