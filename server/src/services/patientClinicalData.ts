import { v4 as uuidv4 } from 'uuid';
import type {
    StructuredPatientDocument,
    LabValue,
    VitalValue,
    ImagingResult,
    Diagnosis,
    HistoryItem,
    SurgicalItem,
    Medication,
} from '../types/clinicalSchemas';

type Db = { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> };

// Pick the entry with the more recent date (incoming wins on tie or if existing has no date)
function pickLatest<T extends { date?: string }>(existing: T | undefined, incoming: T): T {
    if (!existing) return incoming;
    if (!incoming.date) return existing;
    if (!existing.date) return incoming;
    return incoming.date >= existing.date ? incoming : existing;
}

function dedupeStrings(existing: string[], incoming: string[]): string[] {
    const seen = new Set(existing.map(s => s.toLowerCase().trim()));
    const result = [...existing];
    for (const item of incoming) {
        const key = item.toLowerCase().trim();
        if (!seen.has(key)) { result.push(item); seen.add(key); }
    }
    return result;
}

function dedupeDiagnoses(existing: Diagnosis[], incoming: Diagnosis[]): Diagnosis[] {
    const seen = new Map(existing.map(d => [d.name.toLowerCase().trim(), existing.indexOf(d)]));
    const result = [...existing];
    for (const d of incoming) {
        const key = d.name.toLowerCase().trim();
        if (!seen.has(key)) {
            result.push(d);
            seen.set(key, result.length - 1);
        } else {
            // Upgrade status if incoming has more info
            const idx = seen.get(key)!;
            if (d.status && !result[idx].status) result[idx] = { ...result[idx], ...d };
        }
    }
    return result;
}

function dedupeNamed<T>(existing: T[], incoming: T[], keyField: keyof T): T[] {
    const seen = new Set(existing.map(d => String(d[keyField] ?? '').toLowerCase().trim()));
    const result = [...existing];
    for (const item of incoming) {
        const key = String(item[keyField] ?? '').toLowerCase().trim();
        if (!seen.has(key)) { result.push(item); seen.add(key); }
    }
    return result;
}

function parseJson<T>(value: unknown, fallback: T): T {
    if (!value) return fallback;
    if (typeof value === 'object') return value as T;
    try { return JSON.parse(value as string) as T; } catch { return fallback; }
}

export async function mergePatientDocument(
    db: Db,
    siteId: string,
    patientId: string,
    documentId: string,
    doc: StructuredPatientDocument
): Promise<void> {
    const existing = (await db.query(
        'SELECT * FROM patient_clinical_data WHERE patient_id = $1',
        [patientId]
    )).rows[0];

    const incomingLabs = doc.labs || [];
    const incomingVitals = doc.vitals || [];
    const incomingImaging = doc.imaging || [];

    if (!existing) {
        const labsLatest: Record<string, LabValue> = {};
        const vitalsLatest: Record<string, VitalValue> = {};
        const imagingLatest: Record<string, ImagingResult> = {};

        for (const lab of incomingLabs) labsLatest[lab.name] = pickLatest(labsLatest[lab.name], lab);
        for (const v of incomingVitals) vitalsLatest[v.name] = pickLatest(vitalsLatest[v.name], v);
        for (const img of incomingImaging) imagingLatest[img.type] = pickLatest(imagingLatest[img.type] as ImagingResult | undefined, img) as ImagingResult;

        await db.query(
            `INSERT INTO patient_clinical_data
             (id, site_id, patient_id, diagnoses, medical_history, surgical_history, medications,
              allergies, family_history, labs_latest, vitals_latest, imaging_latest,
              labs_timeline, vitals_timeline, imaging_timeline,
              smoking_status, alcohol_use, last_document_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
            [
                uuidv4(), siteId, patientId,
                JSON.stringify(doc.diagnoses || []),
                JSON.stringify(doc.medical_history || []),
                JSON.stringify(doc.surgical_history || []),
                JSON.stringify(doc.medications || []),
                JSON.stringify(doc.allergies || []),
                JSON.stringify(doc.family_history || []),
                JSON.stringify(labsLatest),
                JSON.stringify(vitalsLatest),
                JSON.stringify(imagingLatest),
                JSON.stringify(incomingLabs.map(l => ({ ...l, document_id: documentId }))),
                JSON.stringify(incomingVitals.map(v => ({ ...v, document_id: documentId }))),
                JSON.stringify(incomingImaging.map(i => ({ ...i, document_id: documentId }))),
                doc.smoking_status || null,
                doc.alcohol_use || null,
                documentId,
            ]
        );
        console.log(`[ClinicalData] Created clinical profile for patient ${patientId}`);
        return;
    }

    // Merge into existing record
    const exDiagnoses = parseJson<Diagnosis[]>(existing.diagnoses, []);
    const exMedHistory = parseJson<HistoryItem[]>(existing.medical_history, []);
    const exSurgHistory = parseJson<SurgicalItem[]>(existing.surgical_history, []);
    const exMedications = parseJson<Medication[]>(existing.medications, []);
    const exAllergies = parseJson<string[]>(existing.allergies, []);
    const exFamilyHistory = parseJson<string[]>(existing.family_history, []);
    const exLabsLatest = parseJson<Record<string, LabValue>>(existing.labs_latest, {});
    const exVitalsLatest = parseJson<Record<string, VitalValue>>(existing.vitals_latest, {});
    const exImagingLatest = parseJson<Record<string, ImagingResult>>(existing.imaging_latest, {});
    const exLabsTimeline = parseJson<LabValue[]>(existing.labs_timeline, []);
    const exVitalsTimeline = parseJson<VitalValue[]>(existing.vitals_timeline, []);
    const exImagingTimeline = parseJson<ImagingResult[]>(existing.imaging_timeline, []);

    // Merge latest (newer date wins)
    const labsLatest = { ...exLabsLatest };
    for (const lab of incomingLabs) labsLatest[lab.name] = pickLatest(labsLatest[lab.name], lab);

    const vitalsLatest = { ...exVitalsLatest };
    for (const v of incomingVitals) vitalsLatest[v.name] = pickLatest(vitalsLatest[v.name], v);

    const imagingLatest = { ...exImagingLatest };
    for (const img of incomingImaging) imagingLatest[img.type] = pickLatest(imagingLatest[img.type] as ImagingResult | undefined, img) as ImagingResult;

    // Append to timelines, sorted by date
    const labsTimeline = [
        ...exLabsTimeline,
        ...incomingLabs.map(l => ({ ...l, document_id: documentId })),
    ].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    const vitalsTimeline = [
        ...exVitalsTimeline,
        ...incomingVitals.map(v => ({ ...v, document_id: documentId })),
    ].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    const imagingTimeline = [
        ...exImagingTimeline,
        ...incomingImaging.map(i => ({ ...i, document_id: documentId })),
    ].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    await db.query(
        `UPDATE patient_clinical_data SET
         diagnoses        = $1,
         medical_history  = $2,
         surgical_history = $3,
         medications      = $4,
         allergies        = $5,
         family_history   = $6,
         labs_latest      = $7,
         vitals_latest    = $8,
         imaging_latest   = $9,
         labs_timeline    = $10,
         vitals_timeline  = $11,
         imaging_timeline = $12,
         smoking_status   = COALESCE($13, smoking_status),
         alcohol_use      = COALESCE($14, alcohol_use),
         last_document_id = $15,
         updated_at       = NOW()
         WHERE patient_id = $16`,
        [
            JSON.stringify(dedupeDiagnoses(exDiagnoses, doc.diagnoses || [])),
            JSON.stringify(dedupeNamed<HistoryItem>(exMedHistory, doc.medical_history || [], 'condition')),
            JSON.stringify(dedupeNamed<SurgicalItem>(exSurgHistory, doc.surgical_history || [], 'procedure')),
            JSON.stringify(dedupeNamed<Medication>(exMedications, doc.medications || [], 'name')),
            JSON.stringify(dedupeStrings(exAllergies, doc.allergies || [])),
            JSON.stringify(dedupeStrings(exFamilyHistory, doc.family_history || [])),
            JSON.stringify(labsLatest),
            JSON.stringify(vitalsLatest),
            JSON.stringify(imagingLatest),
            JSON.stringify(labsTimeline),
            JSON.stringify(vitalsTimeline),
            JSON.stringify(imagingTimeline),
            doc.smoking_status || null,
            doc.alcohol_use || null,
            documentId,
            patientId,
        ]
    );
    console.log(`[ClinicalData] Updated clinical profile for patient ${patientId}`);
}
