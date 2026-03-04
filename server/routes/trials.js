const express = require('express');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { authMiddleware, requireRole, auditLog } = require('../middleware/auth');

// --- Protocol text extraction helpers ---
function extractCriteria(text) {
    const result = { inclusion: null, exclusion: null };
    const normalized = text.replace(/\r\n/g, '\n');

    // Try to find inclusion criteria section
    const inclMatch = normalized.match(/(?:inclusion\s+criteria|eligibility\s+criteria|key\s+inclusion)[:\s]*\n([\s\S]*?)(?=(?:exclusion\s+criteria|key\s+exclusion|study\s+procedures|study\s+design|endpoints|primary\s+endpoint|statistical)|$)/i);
    if (inclMatch && inclMatch[1]) {
        result.inclusion = cleanCriteriaText(inclMatch[1]);
    }

    // Try to find exclusion criteria section
    const exclMatch = normalized.match(/(?:exclusion\s+criteria|key\s+exclusion)[:\s]*\n([\s\S]*?)(?=(?:study\s+procedures|study\s+design|endpoints|primary\s+endpoint|statistical|visit\s+schedule|study\s+assessments)|$)/i);
    if (exclMatch && exclMatch[1]) {
        result.exclusion = cleanCriteriaText(exclMatch[1]);
    }

    return result;
}

function cleanCriteriaText(raw) {
    const lines = raw.split('\n')
        .map(l => l.replace(/^[\s•●○▪\-–—\d.)+]+\s*/, '').trim())
        .filter(l => l.length > 5 && l.length < 500)
        .slice(0, 30); // cap at 30 criteria
    return lines.length > 0 ? lines.join('\n') : null;
}

const router = express.Router();
router.use(authMiddleware);

// Multer config — store in memory for SQLite blob storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are accepted'));
        }
    }
});

// GET /api/trials
router.get('/', (req, res) => {
    const db = req.app.locals.db;
    const { status } = req.query;
    let sql = 'SELECT * FROM trials WHERE site_id = ?';
    const params = [req.user.site_id];

    if (status) {
        sql += ' AND recruiting_status = ?';
        params.push(status);
    }

    sql += ' ORDER BY name';
    const trials = db.prepare(sql).all(...params);

    // Get case counts per trial
    const caseCounts = db.prepare(`
    SELECT trial_id, status, COUNT(*) as cnt 
    FROM screening_cases WHERE site_id = ? 
    GROUP BY trial_id, status
  `).all(req.user.site_id);

    const countMap = {};
    caseCounts.forEach(c => {
        if (!countMap[c.trial_id]) countMap[c.trial_id] = {};
        countMap[c.trial_id][c.status] = c.cnt;
    });

    const trialsWithCounts = trials.map(t => ({
        ...t,
        case_counts: countMap[t.id] || {}
    }));

    res.json(trialsWithCounts);
});

// POST /api/trials
router.post('/', requireRole('MANAGER', 'CRC'), (req, res) => {
    const db = req.app.locals.db;
    const id = uuidv4();
    const { name, protocol_number, specialty, recruiting_status = 'ACTIVE', description, inclusion_criteria, exclusion_criteria } = req.body;

    if (!name) return res.status(400).json({ error: 'name is required' });

    db.prepare(`
    INSERT INTO trials (id, site_id, name, protocol_number, specialty, recruiting_status, description, inclusion_criteria, exclusion_criteria)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.site_id, name, protocol_number || null, specialty || null, recruiting_status, description || null, inclusion_criteria || null, exclusion_criteria || null);

    auditLog(db, { siteId: req.user.site_id, userId: req.user.id, entityType: 'trial', entityId: id, action: 'CREATE', diff: req.body });

    const trial = db.prepare('SELECT * FROM trials WHERE id = ?').get(id);
    res.status(201).json(trial);
});

// GET /api/trials/:id
router.get('/:id', (req, res) => {
    const db = req.app.locals.db;
    const trial = db.prepare('SELECT * FROM trials WHERE id = ? AND site_id = ?').get(req.params.id, req.user.site_id);
    if (!trial) return res.status(404).json({ error: 'Trial not found' });

    // Get signal rules
    const rules = db.prepare(`
    SELECT tsr.*, st.name as signal_name, st.label as signal_label, st.unit, st.value_type
    FROM trial_signal_rules tsr
    JOIN signal_types st ON tsr.signal_type_id = st.id
    WHERE tsr.trial_id = ? AND tsr.site_id = ?
    ORDER BY st.label
  `).all(req.params.id, req.user.site_id);

    // Get screening cases
    const cases = db.prepare(`
    SELECT sc.*, p.first_name, p.last_name, p.dob, u.name as assigned_user_name
    FROM screening_cases sc
    JOIN patients p ON sc.patient_id = p.id
    LEFT JOIN users u ON sc.assigned_user_id = u.id
    WHERE sc.trial_id = ? AND sc.site_id = ?
    ORDER BY sc.updated_at DESC
  `).all(req.params.id, req.user.site_id);

    // Get protocol metadata (without file_data blob)
    const protocol = db.prepare(`
    SELECT id, filename, mime_type, file_size, version, uploaded_by_user_id, created_at
    FROM trial_protocols WHERE trial_id = ? AND site_id = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(req.params.id, req.user.site_id);

    // Get visit templates
    const visit_templates = db.prepare(`
    SELECT * FROM visit_templates WHERE trial_id = ? AND site_id = ?
    ORDER BY sort_order, day_offset
  `).all(req.params.id, req.user.site_id);

    res.json({ ...trial, signal_rules: rules, screening_cases: cases, protocol: protocol || null, visit_templates });
});

// PATCH /api/trials/:id
router.patch('/:id', requireRole('MANAGER', 'CRC'), (req, res) => {
    const db = req.app.locals.db;
    const existing = db.prepare('SELECT * FROM trials WHERE id = ? AND site_id = ?').get(req.params.id, req.user.site_id);
    if (!existing) return res.status(404).json({ error: 'Trial not found' });

    const fields = ['name', 'protocol_number', 'specialty', 'recruiting_status', 'description', 'inclusion_criteria', 'exclusion_criteria'];
    const updates = [];
    const values = [];

    for (const field of fields) {
        if (req.body[field] !== undefined) {
            updates.push(`${field} = ?`);
            values.push(req.body[field]);
        }
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    updates.push("updated_at = datetime('now')");
    values.push(req.params.id, req.user.site_id);

    db.prepare(`UPDATE trials SET ${updates.join(', ')} WHERE id = ? AND site_id = ?`).run(...values);
    auditLog(db, { siteId: req.user.site_id, userId: req.user.id, entityType: 'trial', entityId: req.params.id, action: 'UPDATE', diff: req.body });

    const trial = db.prepare('SELECT * FROM trials WHERE id = ?').get(req.params.id);
    res.json(trial);
});

// --- Protocol Upload ---

// POST /api/trials/:id/protocol — upload PDF + auto-extract I/E criteria
router.post('/:id/protocol', requireRole('MANAGER', 'CRC'), upload.single('file'), async (req, res) => {
    try {
        const db = req.app.locals.db;
        const trial = db.prepare('SELECT * FROM trials WHERE id = ? AND site_id = ?').get(req.params.id, req.user.site_id);
        if (!trial) return res.status(404).json({ error: 'Trial not found' });
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const id = uuidv4();
        const version = req.body.version || null;

        // Delete existing protocol for this trial (replace)
        db.prepare('DELETE FROM trial_protocols WHERE trial_id = ? AND site_id = ?').run(req.params.id, req.user.site_id);

        db.prepare(`
        INSERT INTO trial_protocols (id, site_id, trial_id, filename, mime_type, file_size, file_data, version, uploaded_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, req.user.site_id, req.params.id, req.file.originalname, req.file.mimetype, req.file.size, req.file.buffer, version, req.user.id);

        auditLog(db, { siteId: req.user.site_id, userId: req.user.id, entityType: 'trial_protocol', entityId: id, action: 'CREATE', diff: { filename: req.file.originalname, size: req.file.size } });

        // Auto-extract I/E criteria from PDF text
        let extracted = { inclusion: null, exclusion: null };
        try {
            const pdfData = await pdfParse(req.file.buffer);
            extracted = extractCriteria(pdfData.text);

            // Auto-populate criteria if not already set
            if (extracted.inclusion || extracted.exclusion) {
                const updates = [];
                const vals = [];
                if (extracted.inclusion && !trial.inclusion_criteria) {
                    updates.push('inclusion_criteria = ?');
                    vals.push(extracted.inclusion);
                }
                if (extracted.exclusion && !trial.exclusion_criteria) {
                    updates.push('exclusion_criteria = ?');
                    vals.push(extracted.exclusion);
                }
                if (updates.length > 0) {
                    vals.push(req.params.id, req.user.site_id);
                    db.prepare(`UPDATE trials SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ? AND site_id = ?`).run(...vals);
                }
            }
        } catch (parseErr) {
            console.log('[Protocol] PDF parse warning:', parseErr.message);
        }

        res.status(201).json({
            id, filename: req.file.originalname, file_size: req.file.size, version,
            created_at: new Date().toISOString(),
            auto_extracted: {
                inclusion_criteria: extracted.inclusion ? true : false,
                exclusion_criteria: extracted.exclusion ? true : false
            }
        });
    } catch (err) {
        console.error('[Protocol] Upload error:', err);
        res.status(500).json({ error: 'Upload failed' });
    }
});

// GET /api/trials/:id/protocol/download
router.get('/:id/protocol/download', (req, res) => {
    const db = req.app.locals.db;
    const protocol = db.prepare(`
    SELECT filename, mime_type, file_data FROM trial_protocols
    WHERE trial_id = ? AND site_id = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(req.params.id, req.user.site_id);

    if (!protocol) return res.status(404).json({ error: 'No protocol uploaded' });

    res.setHeader('Content-Type', protocol.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${protocol.filename}"`);
    res.send(protocol.file_data);
});

// DELETE /api/trials/:id/protocol
router.delete('/:id/protocol', requireRole('MANAGER'), (req, res) => {
    const db = req.app.locals.db;
    const result = db.prepare('DELETE FROM trial_protocols WHERE trial_id = ? AND site_id = ?').run(req.params.id, req.user.site_id);
    if (result.changes === 0) return res.status(404).json({ error: 'No protocol found' });
    res.json({ message: 'Protocol deleted' });
});

// --- Trial Signal Rules ---

// GET /api/trials/:id/signal-rules
router.get('/:id/signal-rules', (req, res) => {
    const db = req.app.locals.db;
    const rules = db.prepare(`
    SELECT tsr.*, st.name as signal_name, st.label as signal_label, st.unit, st.value_type
    FROM trial_signal_rules tsr
    JOIN signal_types st ON tsr.signal_type_id = st.id
    WHERE tsr.trial_id = ? AND tsr.site_id = ?
  `).all(req.params.id, req.user.site_id);
    res.json(rules);
});

// POST /api/trials/:id/signal-rules
router.post('/:id/signal-rules', requireRole('MANAGER', 'CRC'), (req, res) => {
    const db = req.app.locals.db;
    const id = uuidv4();
    const { signal_type_id, operator, threshold_number, threshold_text, threshold_list } = req.body;

    if (!signal_type_id || !operator) {
        return res.status(400).json({ error: 'signal_type_id and operator required' });
    }

    db.prepare(`
    INSERT INTO trial_signal_rules (id, site_id, trial_id, signal_type_id, operator, threshold_number, threshold_text, threshold_list, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(id, req.user.site_id, req.params.id, signal_type_id, operator,
        threshold_number != null ? threshold_number : null,
        threshold_text || null,
        threshold_list ? JSON.stringify(threshold_list) : null);

    const rule = db.prepare(`
    SELECT tsr.*, st.name as signal_name, st.label as signal_label, st.unit
    FROM trial_signal_rules tsr
    JOIN signal_types st ON tsr.signal_type_id = st.id
    WHERE tsr.id = ?
  `).get(id);
    res.status(201).json(rule);
});

// PATCH /api/signal-rules/:ruleId
router.patch('/signal-rules/:ruleId', requireRole('MANAGER', 'CRC'), (req, res) => {
    const db = req.app.locals.db;
    const existing = db.prepare('SELECT * FROM trial_signal_rules WHERE id = ? AND site_id = ?').get(req.params.ruleId, req.user.site_id);
    if (!existing) return res.status(404).json({ error: 'Rule not found' });

    const fields = ['operator', 'threshold_number', 'threshold_text', 'is_active'];
    const updates = [];
    const values = [];

    for (const field of fields) {
        if (req.body[field] !== undefined) {
            updates.push(`${field} = ?`);
            values.push(req.body[field]);
        }
    }
    if (req.body.threshold_list !== undefined) {
        updates.push('threshold_list = ?');
        values.push(JSON.stringify(req.body.threshold_list));
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    updates.push("updated_at = datetime('now')");
    values.push(req.params.ruleId, req.user.site_id);

    db.prepare(`UPDATE trial_signal_rules SET ${updates.join(', ')} WHERE id = ? AND site_id = ?`).run(...values);

    const rule = db.prepare('SELECT * FROM trial_signal_rules WHERE id = ?').get(req.params.ruleId);
    res.json(rule);
});

// DELETE /api/signal-rules/:ruleId
router.delete('/signal-rules/:ruleId', requireRole('MANAGER', 'CRC'), (req, res) => {
    const db = req.app.locals.db;
    const result = db.prepare('DELETE FROM trial_signal_rules WHERE id = ? AND site_id = ?').run(req.params.ruleId, req.user.site_id);
    if (result.changes === 0) return res.status(404).json({ error: 'Rule not found' });
    res.json({ message: 'Rule deleted' });
});

module.exports = router;

