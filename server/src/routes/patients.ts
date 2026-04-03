import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import * as XLSX from 'xlsx';
import { authMiddleware, requireRole, auditLog } from '../middleware/auth';
import { extractPatientDocument } from '../services/aiIngestion';
import { mergePatientDocument } from '../services/patientClinicalData';

const router = Router();
router.use(authMiddleware);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Only PDF and image files are accepted'));
    }
});

const batchUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ext = file.originalname.split('.').pop()?.toLowerCase();
        if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') cb(null, true);
        else cb(new Error('Only Excel (.xlsx, .xls) and CSV files are accepted'));
    }
});

interface ExtractedInfo {
    first_name?: string;
    last_name?: string;
    dob?: string;
    internal_identifier?: string;
    fibroscan_kpa?: number;
    alt?: number;
    ast?: number;
    platelets?: number;
    bmi?: number;
    [key: string]: string | number | undefined;
}

function extractPatientInfo(text: string): ExtractedInfo {
    const info: ExtractedInfo = {};
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

router.get('/', async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const { query, dob, internal_identifier, limit = '50', offset = '0' } = req.query as Record<string, string>;
    const siteId = req.user.site_id;

    let sql = `SELECT p.*, rs.name as referral_source_name FROM patients p LEFT JOIN referral_sources rs ON p.referral_source_id = rs.id WHERE p.site_id = $1`;
    const params: unknown[] = [siteId];
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
    const countParams: unknown[] = [siteId];
    let cp = 1;
    if (query) { countSql += ` AND (p.first_name ILIKE $${++cp} OR p.last_name ILIKE $${cp} OR p.internal_identifier ILIKE $${cp})`; countParams.push(`%${query}%`); }
    if (dob) { countSql += ` AND p.dob = $${++cp}`; countParams.push(dob); }
    if (internal_identifier) { countSql += ` AND p.internal_identifier = $${++cp}`; countParams.push(internal_identifier); }

    const { rows: [{ total }] } = await db.query(countSql, countParams);
    res.json({ patients, total: Number(total) });
});

router.post('/', async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const id = uuidv4();
    const { first_name, last_name, dob, internal_identifier, referral_source_id, referral_date, notes } = req.body as Record<string, string>;

    if (!first_name || !last_name || !dob) {
        res.status(400).json({ error: 'first_name, last_name, and dob are required' }); return;
    }

    await db.query(
        `INSERT INTO patients (id, site_id, first_name, last_name, dob, internal_identifier, referral_source_id, referral_date, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, req.user.site_id, first_name, last_name, dob, internal_identifier || null, referral_source_id || null, referral_date || null, notes || null]
    );

    await auditLog(db, { siteId: req.user.site_id, userId: req.user.id, entityType: 'patient', entityId: id, action: 'CREATE', diff: { fields: Object.keys(req.body) } });

    const patient = (await db.query('SELECT * FROM patients WHERE id = $1', [id])).rows[0];
    res.status(201).json(patient);
});

router.post('/batch-import', batchUpload.single('file'), async (req: Request, res: Response) => {
    try {
        const db = req.app.locals.db;
        if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }

        let rows: Record<string, string>[] = [];

        const ext = req.file.originalname.split('.').pop()?.toLowerCase();
        if (ext === 'csv') {
            const text = req.file.buffer.toString('utf-8');
            const lines = text.split(/\r?\n/).filter(l => l.trim());
            if (lines.length < 2) { res.status(400).json({ error: 'CSV has no data rows' }); return; }
            const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase().replace(/\s+/g, '_'));
            rows = lines.slice(1).map(line => {
                const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                const row: Record<string, string> = {};
                headers.forEach((h, i) => { row[h] = vals[i] || ''; });
                return row;
            }).filter(r => Object.values(r).some(v => v));
        } else {
            const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
            rows = rawRows.map(r => {
                const norm: Record<string, string> = {};
                for (const [k, v] of Object.entries(r)) {
                    const key = k.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                    norm[key] = v instanceof Date
                        ? v.toISOString().split('T')[0]
                        : String(v ?? '').trim();
                }
                return norm;
            });
        }

        const colAliases: Record<string, string[]> = {
            first_name: ['first_name', 'firstname', 'first'],
            last_name: ['last_name', 'lastname', 'last', 'surname'],
            dob: ['dob', 'date_of_birth', 'dateofbirth', 'birth_date', 'birthdate'],
            internal_identifier: ['internal_identifier', 'mrn', 'id', 'patient_id', 'patientid', 'internal_id'],
            referral_date: ['referral_date', 'referraldate'],
            notes: ['notes', 'note', 'comments'],
        };

        const resolveField = (row: Record<string, string>, field: string): string => {
            for (const alias of (colAliases[field] || [field])) {
                if (row[alias] !== undefined && row[alias] !== '') return row[alias];
            }
            return '';
        };

        const created: { id: string; first_name: string; last_name: string }[] = [];
        const skipped: { row: number; reason: string }[] = [];
        const errors: { row: number; error: string }[] = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 2;
            const firstName = resolveField(row, 'first_name');
            const lastName = resolveField(row, 'last_name');
            const dob = resolveField(row, 'dob');
            const internalId = resolveField(row, 'internal_identifier');

            if (!firstName || !lastName) {
                errors.push({ row: rowNum, error: 'Missing first_name or last_name' });
                continue;
            }

            // Check for duplicate by MRN
            if (internalId) {
                const existing = (await db.query(
                    'SELECT id FROM patients WHERE site_id = $1 AND internal_identifier = $2',
                    [req.user.site_id, internalId]
                )).rows[0];
                if (existing) {
                    skipped.push({ row: rowNum, reason: `Patient with MRN "${internalId}" already exists` });
                    continue;
                }
            }

            // Parse dob - try common date formats
            let parsedDob = dob || null;
            if (dob) {
                const d = new Date(dob);
                if (!isNaN(d.getTime())) {
                    parsedDob = d.toISOString().split('T')[0];
                }
            }

            const id = uuidv4();
            try {
                await db.query(
                    `INSERT INTO patients (id, site_id, first_name, last_name, dob, internal_identifier, referral_date, notes)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [id, req.user.site_id, firstName, lastName,
                     parsedDob || null, internalId || null,
                     resolveField(row, 'referral_date') || null,
                     resolveField(row, 'notes') || null]
                );
                created.push({ id, first_name: firstName, last_name: lastName });
                await auditLog(db, { siteId: req.user.site_id, userId: req.user.id, entityType: 'patient', entityId: id, action: 'CREATE', diff: { source: 'batch_import', row: rowNum } as Record<string, unknown> });
            } catch (e) {
                errors.push({ row: rowNum, error: (e as Error).message });
            }
        }

        res.status(201).json({ created: created.length, skipped: skipped.length, errors, created_patients: created, skipped_rows: skipped });
    } catch (err) {
        console.error('[Batch Import] Error:', err);
        res.status(500).json({ error: 'Batch import failed' });
    }
});

router.post('/upload-document', upload.single('file'), async (req: Request, res: Response) => {
    try {
        const db = req.app.locals.db;
        const supabase = req.app.locals.supabase;
        if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }

        const patientId = (req.body as { patient_id?: string }).patient_id || null;
        const documentType = (req.body as { document_type?: string }).document_type || 'OTHER';
        let extracted: ExtractedInfo = {};

        let structuredData: Record<string, unknown> | null = null;

        if (req.file.mimetype === 'application/pdf') {
            try {
                const pdfData = await pdfParse(req.file.buffer);
                // Regex fallback for basic fields
                extracted = extractPatientInfo(pdfData.text);
                // AI full extraction
                console.log('[Document] Running AI extraction...');
                const aiExtracted = await extractPatientDocument(pdfData.text);
                structuredData = aiExtracted as Record<string, unknown>;
                // Merge AI demographics into extracted (AI takes precedence)
                if (aiExtracted.first_name) extracted.first_name = aiExtracted.first_name;
                if (aiExtracted.last_name) extracted.last_name = aiExtracted.last_name;
                if (aiExtracted.dob) extracted.dob = aiExtracted.dob;
                if (aiExtracted.mrn) extracted.internal_identifier = aiExtracted.mrn;
                // Pull key values for legacy signal creation
                const fibro = aiExtracted.imaging?.find(i => /fibroscan/i.test(i.type));
                if (fibro?.value) extracted.fibroscan_kpa = fibro.value;
                const alt = aiExtracted.labs?.find(l => /^alt$/i.test(l.name));
                if (alt?.value !== undefined) extracted.alt = Number(alt.value);
                const ast = aiExtracted.labs?.find(l => /^ast$/i.test(l.name));
                if (ast?.value !== undefined) extracted.ast = Number(ast.value);
                const plt = aiExtracted.labs?.find(l => /platelet|plt/i.test(l.name));
                if (plt?.value !== undefined) extracted.platelets = Number(plt.value);
                const bmi = aiExtracted.vitals?.find(v => /bmi/i.test(v.name));
                if (bmi?.value !== undefined) extracted.bmi = Number(bmi.value);
                console.log('[Document] AI extraction complete');
            } catch (e) {
                const err = e as Error;
                console.log('[Document] PDF parse warning:', err.message);
            }
        }

        let finalPatientId: string | null = patientId;
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
                await auditLog(db, { siteId: req.user.site_id, userId: req.user.id, entityType: 'patient', entityId: finalPatientId, action: 'CREATE', diff: { source: 'document_upload', fields: Object.keys(extracted) } as Record<string, unknown> });
            }
        }

        if (!finalPatientId) {
            res.status(400).json({ error: 'Could not determine patient. Please provide patient_id or upload a document with patient name.', extracted }); return;
        }

        const ext = req.file.originalname.split('.').pop();
        const docId = uuidv4();
        const storagePath = `${req.user.site_id}/patients/${finalPatientId}/${docId}.${ext}`;

        const { error: uploadError } = await supabase.storage
            .from('patient-documents')
            .upload(storagePath, req.file.buffer, { contentType: req.file.mimetype });
        if (uploadError) throw uploadError;

        await db.query(
            `INSERT INTO patient_documents (id, site_id, patient_id, filename, mime_type, file_size, storage_path, document_type, uploaded_by_user_id, structured_data)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [docId, req.user.site_id, finalPatientId, req.file.originalname, req.file.mimetype, req.file.size, storagePath, documentType, req.user.id,
             structuredData ? JSON.stringify(structuredData) : null]
        );

        // Merge structured data into unified patient clinical profile
        if (structuredData) {
            mergePatientDocument(db, req.user.site_id, finalPatientId, docId, structuredData as Parameters<typeof mergePatientDocument>[4])
                .catch(mergeErr => console.error('[Document] Clinical data merge failed:', mergeErr));
        }

        const signalMap: Record<string, string> = { fibroscan_kpa: 'sig-001', alt: 'sig-004', ast: 'sig-005', platelets: 'sig-003', bmi: 'sig-009' };
        const signalsCreated: string[] = [];
        for (const [key, sigId] of Object.entries(signalMap)) {
            if (extracted[key] !== undefined) {
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

router.get('/:id/documents', async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const { rows } = await db.query(
        `SELECT id, filename, mime_type, file_size, document_type, notes, created_at
         FROM patient_documents WHERE patient_id = $1 AND site_id = $2 ORDER BY created_at DESC`,
        [req.params.id, req.user.site_id]
    );
    res.json(rows);
});

router.get('/:id/documents/:docId/download', async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const supabase = req.app.locals.supabase;
    const doc = (await db.query(
        `SELECT filename, mime_type, storage_path FROM patient_documents WHERE id = $1 AND patient_id = $2 AND site_id = $3`,
        [req.params.docId, req.params.id, req.user.site_id]
    )).rows[0];
    if (!doc) { res.status(404).json({ error: 'Document not found' }); return; }

    const { data, error } = await supabase.storage.from('patient-documents').createSignedUrl(doc.storage_path, 3600);
    if (error) { res.status(500).json({ error: 'Could not generate download URL' }); return; }

    res.redirect(data.signedUrl);
});

router.delete('/:id/documents/:docId', async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const supabase = req.app.locals.supabase;
    const doc = (await db.query(
        'SELECT storage_path FROM patient_documents WHERE id = $1 AND patient_id = $2 AND site_id = $3',
        [req.params.docId, req.params.id, req.user.site_id]
    )).rows[0];
    if (!doc) { res.status(404).json({ error: 'Document not found' }); return; }

    await supabase.storage.from('patient-documents').remove([doc.storage_path]);
    await db.query('DELETE FROM patient_documents WHERE id = $1', [req.params.docId]);
    res.json({ message: 'Document deleted' });
});

router.get('/:id/clinical-data', async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const row = (await db.query(
        'SELECT * FROM patient_clinical_data WHERE patient_id = $1 AND site_id = $2',
        [req.params.id, req.user.site_id]
    )).rows[0];
    if (!row) { res.status(404).json({ error: 'No clinical data found' }); return; }

    const parseJsonb = (v: unknown) => {
        if (!v) return v;
        if (typeof v === 'string') { try { return JSON.parse(v); } catch { return v; } }
        return v;
    };

    res.json({
        ...row,
        diagnoses: parseJsonb(row.diagnoses),
        medical_history: parseJsonb(row.medical_history),
        surgical_history: parseJsonb(row.surgical_history),
        medications: parseJsonb(row.medications),
        allergies: parseJsonb(row.allergies),
        family_history: parseJsonb(row.family_history),
        labs_latest: parseJsonb(row.labs_latest),
        vitals_latest: parseJsonb(row.vitals_latest),
        imaging_latest: parseJsonb(row.imaging_latest),
        labs_timeline: parseJsonb(row.labs_timeline),
        vitals_timeline: parseJsonb(row.vitals_timeline),
        imaging_timeline: parseJsonb(row.imaging_timeline),
    });
});

router.get('/:id/protocol-signals', async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const { rows } = await db.query(
        `SELECT pps.*, t.name as trial_name, t.protocol_number, t.indication, t.specialty
         FROM patient_protocol_signals pps
         JOIN trials t ON pps.trial_id = t.id
         WHERE pps.patient_id = $1 AND pps.site_id = $2
         ORDER BY pps.last_evaluated_at DESC`,
        [req.params.id, req.user.site_id]
    );
    res.json(rows.map(r => ({
        ...r,
        criteria_breakdown: JSON.parse((r.criteria_breakdown as string) || '[]'),
        missing_data: JSON.parse((r.missing_data as string) || '[]'),
    })));
});

router.get('/:id', async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const patient = (await db.query(
        `SELECT p.*, rs.name as referral_source_name FROM patients p
         LEFT JOIN referral_sources rs ON p.referral_source_id = rs.id
         WHERE p.id = $1 AND p.site_id = $2`,
        [req.params.id, req.user.site_id]
    )).rows[0];
    if (!patient) { res.status(404).json({ error: 'Patient not found' }); return; }

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

router.patch('/:id', async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const existing = (await db.query(
        'SELECT * FROM patients WHERE id = $1 AND site_id = $2',
        [req.params.id, req.user.site_id]
    )).rows[0];
    if (!existing) { res.status(404).json({ error: 'Patient not found' }); return; }

    const updates: string[] = [];
    const values: unknown[] = [];
    let p = 0;

    const body = req.body as Record<string, unknown>;
    for (const field of ['first_name', 'last_name', 'dob', 'internal_identifier', 'referral_source_id', 'referral_date', 'notes']) {
        if (body[field] !== undefined) { updates.push(`${field} = $${++p}`); values.push(body[field]); }
    }

    if (updates.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }

    updates.push(`updated_at = NOW()`);
    values.push(req.params.id, req.user.site_id);

    await db.query(`UPDATE patients SET ${updates.join(', ')} WHERE id = $${++p} AND site_id = $${++p}`, values);
    await auditLog(db, { siteId: req.user.site_id, userId: req.user.id, entityType: 'patient', entityId: req.params.id, action: 'UPDATE', diff: { fields: Object.keys(req.body) } });

    const patient = (await db.query('SELECT * FROM patients WHERE id = $1', [req.params.id])).rows[0];
    res.json(patient);
});

// DELETE single patient
router.delete('/:id', requireRole('MANAGER', 'CRC'), async (req: Request, res: Response) => {
    try {
        const db = req.app.locals.db;
        const result = await db.query(
            'DELETE FROM patients WHERE id = $1 AND site_id = $2',
            [req.params.id, req.user.site_id]
        );
        if (result.rowCount === 0) { res.status(404).json({ error: 'Patient not found' }); return; }
        await auditLog(db, { siteId: req.user.site_id, userId: req.user.id, entityType: 'patient', entityId: req.params.id, action: 'DELETE', diff: {} });
        res.json({ message: 'Patient deleted' });
    } catch (err) {
        console.error('[Patients] DELETE error:', err);
        res.status(500).json({ error: 'Failed to delete patient' });
    }
});

// POST /bulk-delete — must be defined before /:id routes to avoid param collision
router.post('/bulk-delete', requireRole('MANAGER', 'CRC'), async (req: Request, res: Response) => {
    try {
        const db = req.app.locals.db;
        const { ids } = req.body as { ids?: string[] };
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            res.status(400).json({ error: 'ids array is required' }); return;
        }
        const result = await db.query(
            'DELETE FROM patients WHERE id = ANY($1) AND site_id = $2',
            [ids, req.user.site_id]
        );
        await auditLog(db, { siteId: req.user.site_id, userId: req.user.id, entityType: 'patient', entityId: 'bulk', action: 'DELETE', diff: { ids, count: result.rowCount } });
        res.json({ deleted: result.rowCount });
    } catch (err) {
        console.error('[Patients] Bulk delete error:', err);
        res.status(500).json({ error: 'Failed to delete patients' });
    }
});

export default router;
