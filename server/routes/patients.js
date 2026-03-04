const express = require('express');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { authMiddleware, auditLog } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// Multer config for document uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Only PDF and image files are accepted'));
    }
});

// --- PDF text extraction helpers ---
function extractPatientInfo(text) {
    const info = {};
    const normalized = text.replace(/\r\n/g, '\n');

    // Patient name patterns
    const namePatterns = [
        /(?:patient\s*(?:name)?|name)\s*[:\-]\s*([A-Za-z\-']+)[,\s]+([A-Za-z\-']+)/i,
        /(?:patient|pt)\s*[:\-]\s*([A-Za-z\-']+)\s+([A-Za-z\-']+)/i,
        /(?:name)\s*[:\-]\s*([A-Za-z\-']+)\s+([A-Za-z\-']+)/i,
    ];
    for (const pat of namePatterns) {
        const m = normalized.match(pat);
        if (m) {
            // Check if first match is last name (Last, First format)
            if (normalized.match(/name\s*[:\-]\s*[A-Za-z\-']+,/i)) {
                info.last_name = m[1].trim();
                info.first_name = m[2].trim();
            } else {
                info.first_name = m[1].trim();
                info.last_name = m[2].trim();
            }
            break;
        }
    }

    // DOB patterns
    const dobMatch = normalized.match(/(?:dob|date\s*of\s*birth|birth\s*date|d\.o\.b\.?)\s*[:\-]\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i);
    if (dobMatch) {
        const parts = dobMatch[1].split(/[\/-]/);
        if (parts.length === 3) {
            let [m, d, y] = parts;
            if (y.length === 2) y = (parseInt(y) > 50 ? '19' : '20') + y;
            info.dob = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
    }

    // MRN patterns
    const mrnMatch = normalized.match(/(?:mrn|medical\s*record|patient\s*id|id\s*#?)\s*[:\-#]\s*([A-Z0-9\-]+)/i);
    if (mrnMatch) info.internal_identifier = mrnMatch[1].trim();

    // FibroScan value
    const fibroMatch = normalized.match(/(?:fibroscan|liver\s*stiffness|elastography|te\s*result|median)\s*[:\-]?\s*([\d.]+)\s*(?:kpa|kPa)/i);
    if (fibroMatch) info.fibroscan_kpa = parseFloat(fibroMatch[1]);

    // Common lab values
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

// GET /api/patients — search
router.get('/', (req, res) => {
    const db = req.app.locals.db;
    const { query, dob, internal_identifier, limit = 50, offset = 0 } = req.query;
    const siteId = req.user.site_id;

    let sql = `SELECT p.*, rs.name as referral_source_name FROM patients p LEFT JOIN referral_sources rs ON p.referral_source_id = rs.id WHERE p.site_id = ?`;
    const params = [siteId];

    if (query) {
        sql += ` AND (p.first_name LIKE ? OR p.last_name LIKE ? OR p.internal_identifier LIKE ?)`;
        const q = `%${query}%`;
        params.push(q, q, q);
    }
    if (dob) {
        sql += ` AND p.dob = ?`;
        params.push(dob);
    }
    if (internal_identifier) {
        sql += ` AND p.internal_identifier = ?`;
        params.push(internal_identifier);
    }

    sql += ` ORDER BY p.last_name, p.first_name LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const patients = db.prepare(sql).all(...params);

    // Get count
    let countSql = `SELECT COUNT(*) as total FROM patients p WHERE p.site_id = ?`;
    const countParams = [siteId];
    if (query) {
        countSql += ` AND (p.first_name LIKE ? OR p.last_name LIKE ? OR p.internal_identifier LIKE ?)`;
        const q = `%${query}%`;
        countParams.push(q, q, q);
    }
    if (dob) { countSql += ` AND p.dob = ?`; countParams.push(dob); }
    if (internal_identifier) { countSql += ` AND p.internal_identifier = ?`; countParams.push(internal_identifier); }
    const { total } = db.prepare(countSql).get(...countParams);

    res.json({ patients, total });
});

// POST /api/patients
router.post('/', (req, res) => {
    const db = req.app.locals.db;
    const id = uuidv4();
    const { first_name, last_name, dob, internal_identifier, referral_source_id, referral_date, notes } = req.body;

    if (!first_name || !last_name || !dob) {
        return res.status(400).json({ error: 'first_name, last_name, and dob are required' });
    }

    db.prepare(`
    INSERT INTO patients (id, site_id, first_name, last_name, dob, internal_identifier, referral_source_id, referral_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.site_id, first_name, last_name, dob, internal_identifier || null, referral_source_id || null, referral_date || null, notes || null);

    auditLog(db, { siteId: req.user.site_id, userId: req.user.id, entityType: 'patient', entityId: id, action: 'CREATE', diff: req.body });

    const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
    res.status(201).json(patient);
});

// POST /api/patients/upload-document — upload doc + auto-create patient if info extracted
router.post('/upload-document', upload.single('file'), async (req, res) => {
    try {
        const db = req.app.locals.db;
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const patientId = req.body.patient_id || null;
        const documentType = req.body.document_type || 'OTHER';
        let extracted = {};

        // Extract text from PDF
        if (req.file.mimetype === 'application/pdf') {
            try {
                const pdfData = await pdfParse(req.file.buffer);
                extracted = extractPatientInfo(pdfData.text);
            } catch (e) {
                console.log('[Document] PDF parse warning:', e.message);
            }
        }

        // If no patient_id provided, try to find or create patient
        let finalPatientId = patientId;
        let patientCreated = false;

        if (!finalPatientId && (extracted.first_name || extracted.internal_identifier)) {
            // Try to find existing patient by MRN
            if (extracted.internal_identifier) {
                const existing = db.prepare(
                    'SELECT id FROM patients WHERE site_id = ? AND internal_identifier = ?'
                ).get(req.user.site_id, extracted.internal_identifier);
                if (existing) finalPatientId = existing.id;
            }

            // If not found, create new patient
            if (!finalPatientId && extracted.first_name && extracted.last_name) {
                finalPatientId = uuidv4();
                db.prepare(`
                    INSERT INTO patients (id, site_id, first_name, last_name, dob, internal_identifier, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(
                    finalPatientId, req.user.site_id,
                    extracted.first_name, extracted.last_name,
                    extracted.dob || '1900-01-01',
                    extracted.internal_identifier || null,
                    'Auto-created from document upload. Please review and update.'
                );
                patientCreated = true;
                auditLog(db, { siteId: req.user.site_id, userId: req.user.id, entityType: 'patient', entityId: finalPatientId, action: 'CREATE', diff: { source: 'document_upload', extracted } });
            }
        }

        if (!finalPatientId) {
            return res.status(400).json({
                error: 'Could not determine patient. Please provide patient_id or upload a document with patient name.',
                extracted
            });
        }

        // Store the document
        const docId = uuidv4();
        db.prepare(`
            INSERT INTO patient_documents (id, site_id, patient_id, filename, mime_type, file_size, file_data, document_type, uploaded_by_user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(docId, req.user.site_id, finalPatientId, req.file.originalname, req.file.mimetype, req.file.size, req.file.buffer, documentType, req.user.id);

        // Auto-create signal values if extracted
        const signalMap = {
            fibroscan_kpa: 'sig-001',
            alt: 'sig-004',
            ast: 'sig-005',
            platelets: 'sig-003',
            bmi: 'sig-009',
        };

        const signalsCreated = [];
        for (const [key, sigId] of Object.entries(signalMap)) {
            if (extracted[key]) {
                const sigExists = db.prepare('SELECT id FROM signal_types WHERE id = ? AND site_id = ?').get(sigId, req.user.site_id);
                if (sigExists) {
                    const psId = uuidv4();
                    db.prepare(`
                        INSERT INTO patient_signals (id, site_id, patient_id, signal_type_id, value_number, collected_at, source, entered_by_user_id)
                        VALUES (?, ?, ?, ?, ?, datetime('now'), ?, ?)
                    `).run(psId, req.user.site_id, finalPatientId, sigId, extracted[key], `Document: ${req.file.originalname}`, req.user.id);
                    signalsCreated.push(key);
                }
            }
        }

        const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(finalPatientId);

        res.status(201).json({
            document_id: docId,
            patient,
            patient_created: patientCreated,
            extracted,
            signals_created: signalsCreated
        });
    } catch (err) {
        console.error('[Document] Upload error:', err);
        res.status(500).json({ error: 'Upload failed' });
    }
});

// GET /api/patients/:id/documents
router.get('/:id/documents', (req, res) => {
    const db = req.app.locals.db;
    const docs = db.prepare(`
        SELECT id, filename, mime_type, file_size, document_type, notes, created_at
        FROM patient_documents
        WHERE patient_id = ? AND site_id = ?
        ORDER BY created_at DESC
    `).all(req.params.id, req.user.site_id);
    res.json(docs);
});

// GET /api/patients/:id/documents/:docId/download
router.get('/:id/documents/:docId/download', (req, res) => {
    const db = req.app.locals.db;
    const doc = db.prepare(`
        SELECT filename, mime_type, file_data
        FROM patient_documents
        WHERE id = ? AND patient_id = ? AND site_id = ?
    `).get(req.params.docId, req.params.id, req.user.site_id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    res.setHeader('Content-Type', doc.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${doc.filename}"`);
    res.send(doc.file_data);
});

// DELETE /api/patients/:id/documents/:docId
router.delete('/:id/documents/:docId', (req, res) => {
    const db = req.app.locals.db;
    const result = db.prepare(
        'DELETE FROM patient_documents WHERE id = ? AND patient_id = ? AND site_id = ?'
    ).run(req.params.docId, req.params.id, req.user.site_id);
    if (result.changes === 0) return res.status(404).json({ error: 'Document not found' });
    res.json({ message: 'Document deleted' });
});

// GET /api/patients/:id
router.get('/:id', (req, res) => {
    const db = req.app.locals.db;
    const patient = db.prepare(`
    SELECT p.*, rs.name as referral_source_name 
    FROM patients p 
    LEFT JOIN referral_sources rs ON p.referral_source_id = rs.id 
    WHERE p.id = ? AND p.site_id = ?
  `).get(req.params.id, req.user.site_id);

    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    // Get screening cases
    const cases = db.prepare(`
    SELECT sc.*, t.name as trial_name, t.protocol_number, u.name as assigned_user_name
    FROM screening_cases sc
    JOIN trials t ON sc.trial_id = t.id
    LEFT JOIN users u ON sc.assigned_user_id = u.id
    WHERE sc.patient_id = ? AND sc.site_id = ?
    ORDER BY sc.created_at DESC
  `).all(req.params.id, req.user.site_id);

    // Get recent signals
    const signals = db.prepare(`
    SELECT ps.*, st.name as signal_name, st.label as signal_label, st.unit, st.value_type
    FROM patient_signals ps
    JOIN signal_types st ON ps.signal_type_id = st.id
    WHERE ps.patient_id = ? AND ps.site_id = ?
    ORDER BY ps.collected_at DESC
    LIMIT 50
  `).all(req.params.id, req.user.site_id);

    // Get documents (metadata only)
    const documents = db.prepare(`
    SELECT id, filename, mime_type, file_size, document_type, notes, created_at
    FROM patient_documents
    WHERE patient_id = ? AND site_id = ?
    ORDER BY created_at DESC
  `).all(req.params.id, req.user.site_id);

    res.json({ ...patient, screening_cases: cases, signals, documents });
});

// PATCH /api/patients/:id
router.patch('/:id', (req, res) => {
    const db = req.app.locals.db;
    const existing = db.prepare('SELECT * FROM patients WHERE id = ? AND site_id = ?').get(req.params.id, req.user.site_id);
    if (!existing) return res.status(404).json({ error: 'Patient not found' });

    const fields = ['first_name', 'last_name', 'dob', 'internal_identifier', 'referral_source_id', 'referral_date', 'notes'];
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

    db.prepare(`UPDATE patients SET ${updates.join(', ')} WHERE id = ? AND site_id = ?`).run(...values);
    auditLog(db, { siteId: req.user.site_id, userId: req.user.id, entityType: 'patient', entityId: req.params.id, action: 'UPDATE', diff: req.body });

    const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
    res.json(patient);
});

module.exports = router;
