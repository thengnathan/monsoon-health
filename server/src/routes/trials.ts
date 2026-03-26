import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import { authMiddleware, requireRole, auditLog } from '../middleware/auth';
import { extractProtocolData, cleanPdfText } from '../services/aiIngestion';
import { runProtocolMatching } from '../services/patientMatching';

function extractCriteria(text: string): { inclusion: string | null; exclusion: string | null } {
    const result = { inclusion: null as string | null, exclusion: null as string | null };
    const normalized = text.replace(/\r\n/g, '\n');
    const inclMatch = normalized.match(/(?:inclusion\s+criteria|eligibility\s+criteria|key\s+inclusion)[:\s]*\n([\s\S]*?)(?=(?:exclusion\s+criteria|key\s+exclusion|study\s+procedures|study\s+design|endpoints|primary\s+endpoint|statistical)|$)/i);
    if (inclMatch) result.inclusion = cleanCriteriaText(inclMatch[1]);
    const exclMatch = normalized.match(/(?:exclusion\s+criteria|key\s+exclusion)[:\s]*\n([\s\S]*?)(?=(?:study\s+procedures|study\s+design|endpoints|primary\s+endpoint|statistical|visit\s+schedule|study\s+assessments)|$)/i);
    if (exclMatch) result.exclusion = cleanCriteriaText(exclMatch[1]);
    return result;
}

function cleanCriteriaText(raw: string): string | null {
    const lines = raw.split('\n')
        .map(l => l.replace(/^[\s•●○▪\-–—\d.)+]+\s*/, '').trim())
        .filter(l => l.length > 5 && l.length < 500)
        .slice(0, 30);
    return lines.length > 0 ? lines.join('\n') : null;
}

const router = Router();
router.use(authMiddleware);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'application/pdf') cb(null, true);
        else cb(new Error('Only PDF files are accepted'));
    }
});

router.get('/', async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const { status } = req.query as { status?: string };
    let sql = 'SELECT * FROM trials WHERE site_id = $1';
    const params: unknown[] = [req.user.site_id];

    if (status) {
        sql += ' AND recruiting_status = $2';
        params.push(status);
    }
    sql += ' ORDER BY name';

    const { rows: trials } = await db.query(sql, params);

    const { rows: caseCounts } = await db.query(
        `SELECT trial_id, status, COUNT(*) as cnt FROM screening_cases WHERE site_id = $1 GROUP BY trial_id, status`,
        [req.user.site_id]
    );

    const countMap: Record<string, Record<string, number>> = {};
    (caseCounts as Array<{ trial_id: string; status: string; cnt: string }>).forEach(c => {
        if (!countMap[c.trial_id]) countMap[c.trial_id] = {};
        countMap[c.trial_id][c.status] = Number(c.cnt);
    });

    res.json(trials.map((t: { id: string }) => ({ ...t, case_counts: countMap[t.id] || {} })));
});

router.post('/', requireRole('MANAGER', 'CRC'), async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const id = uuidv4();
    const { name, protocol_number, specialty, recruiting_status = 'ACTIVE', description, inclusion_criteria, exclusion_criteria } = req.body as {
        name?: string; protocol_number?: string; specialty?: string; recruiting_status?: string;
        description?: string; inclusion_criteria?: string; exclusion_criteria?: string;
    };

    if (!name) { res.status(400).json({ error: 'name is required' }); return; }

    await db.query(
        `INSERT INTO trials (id, site_id, name, protocol_number, specialty, recruiting_status, description, inclusion_criteria, exclusion_criteria)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, req.user.site_id, name, protocol_number || null, specialty || null, recruiting_status, description || null, inclusion_criteria || null, exclusion_criteria || null]
    );

    await auditLog(db, { siteId: req.user.site_id, userId: req.user.id, entityType: 'trial', entityId: id, action: 'CREATE', diff: req.body });

    const trial = (await db.query('SELECT * FROM trials WHERE id = $1', [id])).rows[0];
    res.status(201).json(trial);
});

router.get('/:id', async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const trial = (await db.query(
        'SELECT * FROM trials WHERE id = $1 AND site_id = $2',
        [req.params.id, req.user.site_id]
    )).rows[0];
    if (!trial) { res.status(404).json({ error: 'Trial not found' }); return; }

    const [rules, cases, protocol, visit_templates] = await Promise.all([
        db.query(`SELECT tsr.*, st.name as signal_name, st.label as signal_label, st.unit, st.value_type
                  FROM trial_signal_rules tsr JOIN signal_types st ON tsr.signal_type_id = st.id
                  WHERE tsr.trial_id = $1 AND tsr.site_id = $2 ORDER BY st.label`,
                 [req.params.id, req.user.site_id]),
        db.query(`SELECT sc.*, p.first_name, p.last_name, p.dob, u.name as assigned_user_name
                  FROM screening_cases sc JOIN patients p ON sc.patient_id = p.id
                  LEFT JOIN users u ON sc.assigned_user_id = u.id
                  WHERE sc.trial_id = $1 AND sc.site_id = $2 ORDER BY sc.updated_at DESC`,
                 [req.params.id, req.user.site_id]),
        db.query(`SELECT id, filename, mime_type, file_size, version, uploaded_by_user_id, created_at
                  FROM trial_protocols WHERE trial_id = $1 AND site_id = $2 ORDER BY created_at DESC LIMIT 1`,
                 [req.params.id, req.user.site_id]),
        db.query(`SELECT * FROM visit_templates WHERE trial_id = $1 AND site_id = $2 ORDER BY sort_order, day_offset`,
                 [req.params.id, req.user.site_id]),
    ]);

    res.json({
        ...trial,
        signal_rules: rules.rows,
        screening_cases: cases.rows,
        protocol: protocol.rows[0] || null,
        visit_templates: visit_templates.rows
    });
});

router.patch('/:id', requireRole('MANAGER', 'CRC'), async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const existing = (await db.query(
        'SELECT * FROM trials WHERE id = $1 AND site_id = $2',
        [req.params.id, req.user.site_id]
    )).rows[0];
    if (!existing) { res.status(404).json({ error: 'Trial not found' }); return; }

    const updates: string[] = [];
    const values: unknown[] = [];
    let p = 0;

    const body = req.body as Record<string, unknown>;
    for (const field of ['name', 'protocol_number', 'specialty', 'recruiting_status', 'description', 'inclusion_criteria', 'exclusion_criteria']) {
        if (body[field] !== undefined) { updates.push(`${field} = $${++p}`); values.push(body[field]); }
    }

    if (updates.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }

    updates.push(`updated_at = NOW()`);
    values.push(req.params.id, req.user.site_id);

    await db.query(`UPDATE trials SET ${updates.join(', ')} WHERE id = $${++p} AND site_id = $${++p}`, values);
    await auditLog(db, { siteId: req.user.site_id, userId: req.user.id, entityType: 'trial', entityId: req.params.id, action: 'UPDATE', diff: req.body });

    const trial = (await db.query('SELECT * FROM trials WHERE id = $1', [req.params.id])).rows[0];
    res.json(trial);
});

// --- Protocol Upload (Supabase Storage) ---

router.post('/:id/protocol', requireRole('MANAGER', 'CRC'), upload.single('file'), async (req: Request, res: Response) => {
    try {
        const db = req.app.locals.db;
        const supabase = req.app.locals.supabase;
        const trial = (await db.query(
            'SELECT * FROM trials WHERE id = $1 AND site_id = $2',
            [req.params.id, req.user.site_id]
        )).rows[0];
        if (!trial) { res.status(404).json({ error: 'Trial not found' }); return; }
        if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }

        const id = uuidv4();
        const version = (req.body as { version?: string }).version || null;
        const storagePath = `${req.user.site_id}/trials/${req.params.id}/${id}.pdf`;

        const existing = (await db.query(
            'SELECT storage_path FROM trial_protocols WHERE trial_id = $1 AND site_id = $2',
            [req.params.id, req.user.site_id]
        )).rows[0];
        if (existing) {
            await supabase.storage.from('trial-protocols').remove([existing.storage_path]);
            await db.query('DELETE FROM trial_protocols WHERE trial_id = $1 AND site_id = $2', [req.params.id, req.user.site_id]);
        }

        const { error: uploadError } = await supabase.storage
            .from('trial-protocols')
            .upload(storagePath, req.file.buffer, { contentType: req.file.mimetype, upsert: true });
        if (uploadError) throw uploadError;

        await db.query(
            `INSERT INTO trial_protocols (id, site_id, trial_id, filename, mime_type, file_size, storage_path, version, uploaded_by_user_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [id, req.user.site_id, req.params.id, req.file.originalname, req.file.mimetype, req.file.size, storagePath, version, req.user.id]
        );

        await auditLog(db, { siteId: req.user.site_id, userId: req.user.id, entityType: 'trial_protocol', entityId: id, action: 'CREATE', diff: { filename: req.file.originalname, size: req.file.size } as Record<string, unknown> });

        // Respond immediately — AI extraction runs in background
        res.status(201).json({
            id, filename: req.file.originalname, file_size: req.file.size, version,
            created_at: new Date().toISOString(),
            ai_extraction: 'processing'
        });

        // Background: AI extraction + patient matching
        const fileBuffer = req.file.buffer;
        const trialId = req.params.id;
        const siteId = req.user.site_id;
        const userId = req.user.id;

        (async () => {
            try {
                const pdfData = await pdfParse(fileBuffer);
                const cleanedText = cleanPdfText(pdfData.text);
                const regexExtracted = extractCriteria(cleanedText);

                console.log('[Protocol] Running AI extraction...');
                const aiExtracted = await extractProtocolData(cleanedText);
                console.log('[Protocol] AI extraction complete —', aiExtracted.inclusion_criteria.length, 'inclusion,', aiExtracted.exclusion_criteria.length, 'exclusion criteria found');

                const criteriaUpdates: string[] = [];
                const criteriaVals: unknown[] = [];
                let cp = 0;

                // Always overwrite with AI results (best available data)
                const inclusionText = aiExtracted.raw_inclusion_text || regexExtracted.inclusion;
                const exclusionText = aiExtracted.raw_exclusion_text || regexExtracted.exclusion;

                if (inclusionText) { criteriaUpdates.push(`inclusion_criteria = $${++cp}`); criteriaVals.push(inclusionText); }
                if (exclusionText) { criteriaUpdates.push(`exclusion_criteria = $${++cp}`); criteriaVals.push(exclusionText); }
                if (aiExtracted.specialty) { criteriaUpdates.push(`specialty = $${++cp}`); criteriaVals.push(aiExtracted.specialty); }
                if (aiExtracted.description || aiExtracted.primary_endpoint) {
                    criteriaUpdates.push(`description = $${++cp}`);
                    criteriaVals.push([aiExtracted.indication, aiExtracted.primary_endpoint].filter(Boolean).join(' — '));
                }

                criteriaUpdates.push(`extracted_criteria_json = $${++cp}`);
                criteriaVals.push(JSON.stringify(aiExtracted));

                criteriaVals.push(trialId, siteId);
                await db.query(
                    `UPDATE trials SET ${criteriaUpdates.join(', ')}, updated_at = NOW() WHERE id = $${++cp} AND site_id = $${++cp}`,
                    criteriaVals
                );
                console.log('[Protocol] Trial updated with extracted criteria');

                // Now run patient matching
                console.log('[Protocol] Triggering patient matching job...');
                const { matched, assigned } = await runProtocolMatching(db, siteId, trialId, userId);
                console.log(`[Protocol] Matching done: ${matched} patients evaluated, ${assigned} auto-assigned`);
            } catch (err) {
                console.error('[Protocol] Background extraction error:', err);
            }
        })();
    } catch (err) {
        console.error('[Protocol] Upload error:', err);
        res.status(500).json({ error: 'Upload failed' });
    }
});

router.get('/:id/protocol/download', async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const supabase = req.app.locals.supabase;
    const protocol = (await db.query(
        `SELECT filename, mime_type, storage_path FROM trial_protocols WHERE trial_id = $1 AND site_id = $2 ORDER BY created_at DESC LIMIT 1`,
        [req.params.id, req.user.site_id]
    )).rows[0];
    if (!protocol) { res.status(404).json({ error: 'No protocol uploaded' }); return; }

    const { data, error } = await supabase.storage.from('trial-protocols').createSignedUrl(protocol.storage_path, 3600);
    if (error) { res.status(500).json({ error: 'Could not generate download URL' }); return; }

    res.redirect(data.signedUrl);
});

router.delete('/:id/protocol', requireRole('MANAGER', 'CRC'), async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const supabase = req.app.locals.supabase;
    const protocol = (await db.query(
        'SELECT storage_path FROM trial_protocols WHERE trial_id = $1 AND site_id = $2',
        [req.params.id, req.user.site_id]
    )).rows[0];
    if (!protocol) { res.status(404).json({ error: 'No protocol found' }); return; }

    await supabase.storage.from('trial-protocols').remove([protocol.storage_path]);
    await db.query('DELETE FROM trial_protocols WHERE trial_id = $1 AND site_id = $2', [req.params.id, req.user.site_id]);
    await db.query(
        `UPDATE trials SET inclusion_criteria = NULL, exclusion_criteria = NULL, extracted_criteria_json = NULL, updated_at = NOW()
         WHERE id = $1 AND site_id = $2`,
        [req.params.id, req.user.site_id]
    );
    res.json({ message: 'Protocol deleted' });
});

// --- Signal Rules ---

router.get('/:id/signal-rules', async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const { rows } = await db.query(
        `SELECT tsr.*, st.name as signal_name, st.label as signal_label, st.unit, st.value_type
         FROM trial_signal_rules tsr JOIN signal_types st ON tsr.signal_type_id = st.id
         WHERE tsr.trial_id = $1 AND tsr.site_id = $2`,
        [req.params.id, req.user.site_id]
    );
    res.json(rows);
});

router.post('/:id/signal-rules', requireRole('MANAGER', 'CRC'), async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const id = uuidv4();
    const { signal_type_id, operator, threshold_number, threshold_text, threshold_list } = req.body as {
        signal_type_id?: string; operator?: string; threshold_number?: number;
        threshold_text?: string; threshold_list?: unknown[];
    };

    if (!signal_type_id || !operator) {
        res.status(400).json({ error: 'signal_type_id and operator required' }); return;
    }

    await db.query(
        `INSERT INTO trial_signal_rules (id, site_id, trial_id, signal_type_id, operator, threshold_number, threshold_text, threshold_list, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)`,
        [id, req.user.site_id, req.params.id, signal_type_id, operator,
         threshold_number != null ? threshold_number : null,
         threshold_text || null,
         threshold_list ? JSON.stringify(threshold_list) : null]
    );

    const rule = (await db.query(
        `SELECT tsr.*, st.name as signal_name, st.label as signal_label, st.unit
         FROM trial_signal_rules tsr JOIN signal_types st ON tsr.signal_type_id = st.id
         WHERE tsr.id = $1`,
        [id]
    )).rows[0];
    res.status(201).json(rule);
});

router.patch('/signal-rules/:ruleId', requireRole('MANAGER', 'CRC'), async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const existing = (await db.query(
        'SELECT * FROM trial_signal_rules WHERE id = $1 AND site_id = $2',
        [req.params.ruleId, req.user.site_id]
    )).rows[0];
    if (!existing) { res.status(404).json({ error: 'Rule not found' }); return; }

    const updates: string[] = [];
    const values: unknown[] = [];
    let p = 0;

    const body = req.body as Record<string, unknown>;
    for (const field of ['operator', 'threshold_number', 'threshold_text', 'is_active']) {
        if (body[field] !== undefined) { updates.push(`${field} = $${++p}`); values.push(body[field]); }
    }
    if (body.threshold_list !== undefined) {
        updates.push(`threshold_list = $${++p}`);
        values.push(JSON.stringify(body.threshold_list));
    }

    if (updates.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }

    updates.push(`updated_at = NOW()`);
    values.push(req.params.ruleId, req.user.site_id);

    await db.query(`UPDATE trial_signal_rules SET ${updates.join(', ')} WHERE id = $${++p} AND site_id = $${++p}`, values);
    const rule = (await db.query('SELECT * FROM trial_signal_rules WHERE id = $1', [req.params.ruleId])).rows[0];
    res.json(rule);
});

router.delete('/signal-rules/:ruleId', requireRole('MANAGER', 'CRC'), async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const result = await db.query(
        'DELETE FROM trial_signal_rules WHERE id = $1 AND site_id = $2',
        [req.params.ruleId, req.user.site_id]
    );
    if (result.rowCount === 0) { res.status(404).json({ error: 'Rule not found' }); return; }
    res.json({ message: 'Rule deleted' });
});

export default router;
