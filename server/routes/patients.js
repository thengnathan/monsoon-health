const express = require('express');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { authMiddleware, auditLog } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Only PDF and image files are accepted'));
    }
});

function extractPatientInfo(text) {
    const info = {};
    const normalized = text.replace(/\r\n/g, '\n');

    const namePatterns = [
        /(?:patient\s*(?:name)?|name)\s*[:\-]\s*([A-Za-z\-']+)[,\s]+([A-Za-z\-']+)/i,
        /(?:patient|pt)\s*[:\-]\s*([A-Za-z\-']+)\s+([A-Za-z\-']+)/i,
        /(?:name)\s*[:\-]\s*([A-Za-z\-']+)\s+([A-Za-z\-']+)/i,
    ];
    for (const pat of namePatterns) {
        const m = normalized.match(pat);
        if (m) {
            if (normalized.match(/name\s*[:\-]\s*[A-Za-z\-']+,/i)) {
                info.last_name = m[1].trim(); info.first_name = m[2].trim();
            } else {
                info.first_name = m[1].trim(); info.last_name = m[2].trim();
            }
            break;
        }
    }

    const dobMatch = normalized.match(/(?:dob|date\s*of\s*birth|birth\s*date|d\.o\.b\.?)\s*[:\-]\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i);
    if (dobMatch) {
        const parts = dobMatch[1].split(/[\/-]/);
        if (parts.length === 3) {
            let [m, d, y] = parts;
            if (y.length === 2) y = (parseInt(y) > 50 ? '19' : '20') + y;
            info.dob = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
    }

    const mrnMatch = normalized.match(/(?:mrn|medical\s*record|patient\s*id|id\s*#?)\s*[:\-#]\s*([A-Z0-9\-]+)/i);
    if (mrnMatch) info.internal_identifier = mrnMatch[1].trim();

    const fibroMatch = normalized.match(/(?:fibroscan|liver\s*stiffness|elastography|te\s*result|median)\s*[:\-]?\s*([\d.]+)\s*(?:kpa|kPa)/i);
    if (fibroMatch) info.fibroscan_kpa = parseFloat(fibroMatch[1]);

    const altMatch = normalized.match(/\bALT\b\s*[:\-]?\s*([\d.]+)\s*(?:U\/L|IU\/L)?/i);
    if (altMatch) info.alt = parseFloat(altMatch[1]);

    const astMatch = normalized.match(/\bAST\b\s*[:\-]?\s*([\d.]+)\s*(?:U\/L|IU\/L)?/i);
    if (astMatch) info.ast = parseFloat(astMatch[1]);

    const platMatch = normalized.match(/(?:platelet|plt)\s*(?:count)?\s*[:\-]?\s*([\d.]+)/i);
    if (platMatch) info.platelets = parseFloat(platMatch[1]);

    const bmiMatch = normalized.match(/\bBMI\b\s*[:\-]?\s*([\d.]+)/i);
    if (bmiMatch) info.bmi = parseFloat(bmiMatch[1]);

    return info;
}

router.get('/', async (req, res) => {
    const db = req.app.locals.db;
    const { query, dob, internal_identifier, limit = 50, offset = 0 } = req.query;
    const siteId = req.user.site_id;

    let sql = `SELECT p.*, rs.name as referral_source_name FROM patients p LEFT JOIN referral_sources rs ON p.referral_source_id = rs.id WHERE p.site_id = $1`;
    const params = [siteId];
    let p = 1;

    if (query) {
        sql += ` AND (p.first_name ILIKE $${++p} OR p.last_name ILIKE $${p} OR p.internal_identifier ILIKE $${p})`;
        params.push(`%${query}%`);
    }
    if (dob) { sql += ` AND p.dob = $${++p}`; params.push(dob); }
    if (internal_identifier) { sql += ` AND p.internal_identifier = $${++p}`; params.push(internal_identifier); }

    sql += ` ORDER BY p.last_name, p.first_name LIMIT $${++p} OFFSET $${++p}`;
    params.push(Number(limit), Number(offset));

    const { rows: patients } = await db.query(sql, params);

    let countSql = `SELECT COUNT(*) as total FROM patients p WHERE p.site_id = $1`;
    const countParams = [siteId];
    let cp = 1;
    if (query) { countSql += ` AND (p.first_name ILIKE $${++cp} OR p.last_name ILIKE $${cp} OR p.internal_identifier ILIKE $${cp})`; countParams.push(`%${query}%`); }
    if (dob) { countSql += ` AND p.dob = $${++cp}`; countParams.push(dob); }
    if (internal_identifier) { countSql += ` AND p.internal_identifier = $${++cp}`; countParams.push(internal_identifier); }

    const { rows: [{ total }] } = await db.query(countSql, countParams);
    res.json({ patients, total: Number(total) });
});

router.post('/', async (req, res) => {
    const db = req.app.locals.db;
    const id = uuidv4();
    const { first_name, last_name, dob, internal_identifier, referral_source_id, referral_date, notes } = req.body;

    if (!first_name || !last_name || !dob) {
        return res.status(400).json({ error: 'first_name, last_name, and dob are required' });
    }

    await db.query(
        `INSERT INTO patients (id, site_id, first_name, last_name, dob, internal_identifier, referral_source_id, referral_date, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, req.user.site_id, first_name, last_name, dob, internal_identifier || null, referral_source_id || null, referral_date || null, notes || null]
    );

    await auditLog(db, { siteId: req.user.site_id, userId: req.user.id, entityType: 'patient', entityId: id, action: 'CREATE', diff: req.body });

    const patient = (await db.query('SELECT * FROM patients WHERE id = $1', [id])).rows[0];
    res.status(201).json(patient);
});

router.post('/upload-document', upload.single('file'), async (req, res) => {
    try {
        const db = req.app.locals.db;
        const supabase = req.app.locals.supabase;
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const patientId = req.body.patient_id || null;
        const documentType = req.body.document_type || 'OTHER';
        let extracted = {};

        if (req.file.mimetype === 'application/pdf') {
            try {
                const pdfData = await pdfParse(req.file.buffer);
                extracted = extractPatientInfo(pdfData.text);
            } catch (e) {
                console.log('[Document] PDF parse warning:', e.message);
            }
        }

        let finalPatientId = patientId;
        let patientCreated = false;

        if (!finalPatientId && (extracted.first_name || extracted.internal_identifier)) {
            if (extracted.internal_identifier) {
                const existing = (await db.query(
                    'SELECT id FROM patients WHERE site_id = $1 AND internal_identifier = $2',
                    [req.user.site_id, extracted.internal_identifier]
                )).rows[0];
                if (existing) finalPatientId = existing.id;
            }

            if (!finalPatientId && extracted.first_name && extracted.last_name) {
                finalPatientId = uuidv4();
                await db.query(
                    `INSERT INTO patients (id, site_id, first_name, last_name, dob, internal_identifier, notes)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [finalPatientId, req.user.site_id, extracted.first_name, extracted.last_name,
                     extracted.dob || '1900-01-01', extracted.internal_identifier || null,
                     'Auto-created from document upload. Please review and update.']
                );
                patientCreated = true;
                await auditLog(db, { siteId: req.user.site_id, userId: req.user.id, entityType: 'patient', entityId: finalPatientId, action: 'CREATE', diff: { source: 'document_upload', extracted } });
            }
        }

        if (!finalPatientId) {
            return res.status(400).json({ error: 'Could not determine patient. Please provide patient_id or upload a document with patient name.', extracted });
        }

        // Upload file to Supabase Storage
        const ext = req.file.originalname.split('.').pop();
        const docId = uuidv4();
        const storagePath = `${req.user.site_id}/patients/${finalPatientId}/${docId}.${ext}`;

        const { error: uploadError } = await supabase.storage
            .from('patient-documents')
            .upload(storagePath, req.file.buffer, { contentType: req.file.mimetype });
        if (uploadError) throw uploadError;

        await db.query(
            `INSERT INTO patient_documents (id, site_id, patient_id, filename, mime_type, file_size, storage_path, document_type, uploaded_by_user_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [docId, req.user.site_id, finalPatientId, req.file.originalname, req.file.mimetype, req.file.size, storagePath, documentType, req.user.id]
        );

        // Auto-create signal values if extracted
        const signalMap = { fibroscan_kpa: 'sig-001', alt: 'sig-004', ast: 'sig-005', platelets: 'sig-003', bmi: 'sig-009' };
        const signalsCreated = [];
        for (const [key, sigId] of Object.entries(signalMap)) {
            if (extracted[key]) {
                const sigExists = (await db.query('SELECT id FROM signal_types WHERE id = $1 AND site_id = $2', [sigId, req.user.site_id])).rows[0];
                if (sigExists) {
                    const psId = uuidv4();
                    await db.query(
                        `INSERT INTO patient_signals (id, site_id, patient_id, signal_type_id, value_number, collected_at, source, entered_by_user_id)
                         VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)`,
                        [psId, req.user.site_id, finalPatientId, sigId, extracted[key], `Document: ${req.file.originalname}`, req.user.id]
                    );
                    signalsCreated.push(key);
                }
            }
        }

        const patient = (await db.query('SELECT * FROM patients WHERE id = $1', [finalPatientId])).rows[0];
        res.status(201).json({ document_id: docId, patient, patient_created: patientCreated, extracted, signals_created: signalsCreated });
    } catch (err) {
        console.error('[Document] Upload error:', err);
        res.status(500).json({ error: 'Upload failed' });
    }
});

router.get('/:id/documents', async (req, res) => {
    const db = req.app.locals.db;
    const { rows } = await db.query(
        `SELECT id, filename, mime_type, file_size, document_type, notes, created_at
         FROM patient_documents WHERE patient_id = $1 AND site_id = $2 ORDER BY created_at DESC`,
        [req.params.id, req.user.site_id]
    );
    res.json(rows);
});

router.get('/:id/documents/:docId/download', async (req, res) => {
    const db = req.app.locals.db;
    const supabase = req.app.locals.supabase;
    const doc = (await db.query(
        `SELECT filename, mime_type, storage_path FROM patient_documents WHERE id = $1 AND patient_id = $2 AND site_id = $3`,
        [req.params.docId, req.params.id, req.user.site_id]
    )).rows[0];
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const { data, error } = await supabase.storage.from('patient-documents').createSignedUrl(doc.storage_path, 3600);
    if (error) return res.status(500).json({ error: 'Could not generate download URL' });

    res.redirect(data.signedUrl);
});

router.delete('/:id/documents/:docId', async (req, res) => {
    const db = req.app.locals.db;
    const supabase = req.app.locals.supabase;
    const doc = (await db.query(
        'SELECT storage_path FROM patient_documents WHERE id = $1 AND patient_id = $2 AND site_id = $3',
        [req.params.docId, req.params.id, req.user.site_id]
    )).rows[0];
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    await supabase.storage.from('patient-documents').remove([doc.storage_path]);
    await db.query('DELETE FROM patient_documents WHERE id = $1', [req.params.docId]);
    res.json({ message: 'Document deleted' });
});

router.get('/:id', async (req, res) => {
    const db = req.app.locals.db;
    const patient = (await db.query(
        `SELECT p.*, rs.name as referral_source_name FROM patients p
         LEFT JOIN referral_sources rs ON p.referral_source_id = rs.id
         WHERE p.id = $1 AND p.site_id = $2`,
        [req.params.id, req.user.site_id]
    )).rows[0];
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const [cases, signals, documents] = await Promise.all([
        db.query(`SELECT sc.*, t.name as trial_name, t.protocol_number, u.name as assigned_user_name
                  FROM screening_cases sc JOIN trials t ON sc.trial_id = t.id
                  LEFT JOIN users u ON sc.assigned_user_id = u.id
                  WHERE sc.patient_id = $1 AND sc.site_id = $2 ORDER BY sc.created_at DESC`,
                 [req.params.id, req.user.site_id]),
        db.query(`SELECT ps.*, st.name as signal_name, st.label as signal_label, st.unit, st.value_type
                  FROM patient_signals ps JOIN signal_types st ON ps.signal_type_id = st.id
                  WHERE ps.patient_id = $1 AND ps.site_id = $2 ORDER BY ps.collected_at DESC LIMIT 50`,
                 [req.params.id, req.user.site_id]),
        db.query(`SELECT id, filename, mime_type, file_size, document_type, notes, created_at
                  FROM patient_documents WHERE patient_id = $1 AND site_id = $2 ORDER BY created_at DESC`,
                 [req.params.id, req.user.site_id]),
    ]);

    res.json({ ...patient, screening_cases: cases.rows, signals: signals.rows, documents: documents.rows });
});

router.patch('/:id', async (req, res) => {
    const db = req.app.locals.db;
    const existing = (await db.query(
        'SELECT * FROM patients WHERE id = $1 AND site_id = $2',
        [req.params.id, req.user.site_id]
    )).rows[0];
    if (!existing) return res.status(404).json({ error: 'Patient not found' });

    const updates = [];
    const values = [];
    let p = 0;

    for (const field of ['first_name', 'last_name', 'dob', 'internal_identifier', 'referral_source_id', 'referral_date', 'notes']) {
        if (req.body[field] !== undefined) { updates.push(`${field} = $${++p}`); values.push(req.body[field]); }
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    updates.push(`updated_at = NOW()`);
    values.push(req.params.id, req.user.site_id);

    await db.query(`UPDATE patients SET ${updates.join(', ')} WHERE id = $${++p} AND site_id = $${++p}`, values);
    await auditLog(db, { siteId: req.user.site_id, userId: req.user.id, entityType: 'patient', entityId: req.params.id, action: 'UPDATE', diff: req.body });

    const patient = (await db.query('SELECT * FROM patients WHERE id = $1', [req.params.id])).rows[0];
    res.json(patient);
});

module.exports = router;
