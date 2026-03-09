"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startScheduler = startScheduler;
const node_cron_1 = __importDefault(require("node-cron"));
const uuid_1 = require("uuid");
function startScheduler(db) {
    // Job 1: Revisit Due Scanner — runs daily at 7 AM
    node_cron_1.default.schedule('0 7 * * *', () => {
        console.log('[Scheduler] Running revisit-due scan...');
        scanRevisitDue(db);
    });
    // Job 2: Notification Dispatcher — runs every 5 minutes
    node_cron_1.default.schedule('*/5 * * * *', () => {
        processNotifications(db);
    });
    // Job 3: Visit Reminder Scanner — runs daily at 7:05 AM
    node_cron_1.default.schedule('5 7 * * *', () => {
        console.log('[Scheduler] Running visit reminder scan...');
        scanVisitReminders(db);
    });
    // Run initial scans on startup
    setTimeout(() => {
        scanRevisitDue(db);
        scanVisitReminders(db);
    }, 2000);
    console.log('[Scheduler] Background jobs started');
}
async function scanRevisitDue(db) {
    try {
        const { rows: dueCases } = await db.query(`
            SELECT sc.*, p.first_name, p.last_name, t.name as trial_name
            FROM screening_cases sc
            JOIN patients p ON sc.patient_id = p.id
            JOIN trials t ON sc.trial_id = t.id
            WHERE sc.revisit_date IS NOT NULL
              AND sc.revisit_date <= (CURRENT_DATE + INTERVAL '3 days')::text
              AND sc.status IN ('FUTURE_CANDIDATE', 'SCREEN_FAILED')
        `);
        for (const sc of dueCases) {
            const dedupKey = `revisit_due:${sc.id}:${sc.revisit_date}`;
            try {
                await db.query(`INSERT INTO notification_events (id, site_id, type, patient_id, screening_case_id, payload, dedup_key)
                     VALUES ($1, $2, 'REVISIT_DUE', $3, $4, $5, $6)`, [(0, uuid_1.v4)(), sc.site_id, sc.patient_id, sc.id,
                    JSON.stringify({
                        patient_name: `${sc.first_name} ${sc.last_name}`,
                        trial_name: sc.trial_name,
                        revisit_date: sc.revisit_date,
                        status: sc.status
                    }),
                    dedupKey]);
            }
            catch (_e) {
                // Dedup — already created
            }
        }
        if (dueCases.length > 0) {
            console.log(`[Scheduler] Created ${dueCases.length} revisit-due events`);
        }
    }
    catch (e) {
        const err = e;
        console.error('[Scheduler] Revisit scan error:', err.message);
    }
}
async function processNotifications(db) {
    try {
        const { rows: unprocessed } = await db.query(`SELECT * FROM notification_events WHERE processed_at IS NULL ORDER BY created_at ASC LIMIT 50`);
        if (unprocessed.length === 0)
            return;
        for (const event of unprocessed) {
            let recipients = [];
            if (event.screening_case_id) {
                const sc = (await db.query('SELECT assigned_user_id FROM screening_cases WHERE id = $1', [event.screening_case_id])).rows[0];
                if (sc?.assigned_user_id) {
                    const user = (await db.query('SELECT id, email, name FROM users WHERE id = $1 AND is_active = true', [sc.assigned_user_id])).rows[0];
                    if (user)
                        recipients = [user];
                }
            }
            // Fallback: all active CRCs and managers at site
            if (recipients.length === 0) {
                const { rows } = await db.query(`SELECT id, email, name FROM users WHERE site_id = $1 AND is_active = true AND role IN ('CRC', 'MANAGER')`, [event.site_id]);
                recipients = rows;
            }
            const payload = JSON.parse(event.payload || '{}');
            const { subject, body } = generateEmailContent(event.type, payload);
            for (const recipient of recipients) {
                await db.query(`INSERT INTO email_logs (id, site_id, user_id, event_id, to_email, subject, body_preview, status, sent_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, 'SENT', NOW())`, [(0, uuid_1.v4)(), event.site_id, recipient.id, event.id, recipient.email, subject, body]);
            }
            await db.query(`UPDATE notification_events SET processed_at = NOW() WHERE id = $1`, [event.id]);
        }
        console.log(`[Scheduler] Processed ${unprocessed.length} notifications`);
    }
    catch (e) {
        const err = e;
        console.error('[Scheduler] Notification processing error:', err.message);
    }
}
function generateEmailContent(type, payload) {
    switch (type) {
        case 'REVISIT_DUE':
            return {
                subject: `Re-screen due: ${payload.patient_name} — ${payload.trial_name}`,
                body: `Revisit date ${payload.revisit_date} has been reached for ${payload.patient_name}.\nTrial: ${payload.trial_name}\nPrevious status: ${payload.status}\n\nPlease review and determine next steps.`
            };
        case 'THRESHOLD_CROSSED':
            return {
                subject: `Signal alert: Patient may qualify for ${payload.trial_name}`,
                body: `${payload.signal_label}: ${payload.value} ${payload.operator} ${payload.threshold}\nTrial: ${payload.trial_name}\n\nPlease review eligibility and create a screening case if appropriate.`
            };
        case 'PENDING_ITEM_COMPLETED':
            return {
                subject: `Screening update: ${payload.item_name} received`,
                body: `Pending item "${payload.item_name}" (${payload.item_type}) has been marked complete.\n\nPlease review and update the screening case.`
            };
        case 'VISIT_REMINDER':
            return {
                subject: `Visit reminder: ${payload.patient_name} — ${payload.visit_name}`,
                body: `Upcoming visit for ${payload.patient_name}:\n\nVisit: ${payload.visit_name}\nTrial: ${payload.trial_name}\nScheduled: ${payload.scheduled_date}\n\nPlease confirm the appointment and prepare accordingly.`
            };
        default:
            return { subject: 'Notification', body: JSON.stringify(payload) };
    }
}
async function scanVisitReminders(db) {
    try {
        const { rows: visits } = await db.query(`
            SELECT pv.*, vt.visit_name, vt.reminder_days_before,
                   sc.id as case_id, sc.patient_id, sc.site_id as sc_site_id,
                   p.first_name, p.last_name,
                   t.name as trial_name
            FROM patient_visits pv
            JOIN visit_templates vt ON pv.visit_template_id = vt.id
            JOIN screening_cases sc ON pv.screening_case_id = sc.id
            JOIN patients p ON sc.patient_id = p.id
            JOIN trials t ON sc.trial_id = t.id
            WHERE pv.status = 'SCHEDULED'
              AND pv.reminder_sent = false
              AND (pv.scheduled_date::date - vt.reminder_days_before * INTERVAL '1 day')::date <= CURRENT_DATE
        `);
        for (const visit of visits) {
            const dedupKey = `visit_reminder:${visit.id}:${visit.scheduled_date}`;
            try {
                await db.query(`INSERT INTO notification_events (id, site_id, type, patient_id, screening_case_id, payload, dedup_key)
                     VALUES ($1, $2, 'VISIT_REMINDER', $3, $4, $5, $6)`, [(0, uuid_1.v4)(), visit.site_id, visit.patient_id, visit.case_id,
                    JSON.stringify({
                        patient_name: `${visit.first_name} ${visit.last_name}`,
                        trial_name: visit.trial_name,
                        visit_name: visit.visit_name,
                        scheduled_date: visit.scheduled_date
                    }),
                    dedupKey]);
                await db.query('UPDATE patient_visits SET reminder_sent = true WHERE id = $1', [visit.id]);
            }
            catch (_e) {
                // Dedup — already created
            }
        }
        if (visits.length > 0) {
            console.log(`[Scheduler] Created ${visits.length} visit reminder events`);
        }
    }
    catch (e) {
        const err = e;
        console.error('[Scheduler] Visit reminder scan error:', err.message);
    }
}
