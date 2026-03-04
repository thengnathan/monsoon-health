const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');

function startScheduler(db) {
    // Job 1: Revisit Due Scanner — runs daily at 7 AM
    cron.schedule('0 7 * * *', () => {
        console.log('[Scheduler] Running revisit-due scan...');
        scanRevisitDue(db);
    });

    // Job 2: Notification Dispatcher — runs every 5 minutes
    cron.schedule('*/5 * * * *', () => {
        processNotifications(db);
    });

    // Job 3: Visit Reminder Scanner — runs daily at 7:05 AM
    cron.schedule('5 7 * * *', () => {
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

function scanRevisitDue(db) {
    try {
        const dueCase = db.prepare(`
      SELECT sc.*, p.first_name, p.last_name, t.name as trial_name
      FROM screening_cases sc
      JOIN patients p ON sc.patient_id = p.id
      JOIN trials t ON sc.trial_id = t.id
      WHERE sc.revisit_date IS NOT NULL
        AND sc.revisit_date <= date('now', '+3 days')
        AND sc.status IN ('FUTURE_CANDIDATE', 'SCREEN_FAILED')
    `).all();

        for (const sc of dueCase) {
            const dedupKey = `revisit_due:${sc.id}:${sc.revisit_date}`;
            try {
                db.prepare(`
          INSERT INTO notification_events (id, site_id, type, patient_id, screening_case_id, payload, dedup_key)
          VALUES (?, ?, 'REVISIT_DUE', ?, ?, ?, ?)
        `).run(
                    uuidv4(), sc.site_id, sc.patient_id, sc.id,
                    JSON.stringify({
                        patient_name: `${sc.first_name} ${sc.last_name}`,
                        trial_name: sc.trial_name,
                        revisit_date: sc.revisit_date,
                        status: sc.status
                    }),
                    dedupKey
                );
            } catch (e) {
                // Dedup — already created
            }
        }

        if (dueCase.length > 0) {
            console.log(`[Scheduler] Created ${dueCase.length} revisit-due events`);
        }
    } catch (e) {
        console.error('[Scheduler] Revisit scan error:', e.message);
    }
}

function processNotifications(db) {
    try {
        const unprocessed = db.prepare(`
      SELECT * FROM notification_events WHERE processed_at IS NULL ORDER BY created_at ASC LIMIT 50
    `).all();

        if (unprocessed.length === 0) return;

        for (const event of unprocessed) {
            // Determine recipients
            let recipients;
            if (event.screening_case_id) {
                const sc = db.prepare('SELECT assigned_user_id FROM screening_cases WHERE id = ?').get(event.screening_case_id);
                if (sc?.assigned_user_id) {
                    const user = db.prepare('SELECT id, email, name FROM users WHERE id = ? AND is_active = 1').get(sc.assigned_user_id);
                    recipients = user ? [user] : [];
                }
            }

            // Fallback: all active CRCs and managers at site
            if (!recipients || recipients.length === 0) {
                recipients = db.prepare(`
          SELECT id, email, name FROM users 
          WHERE site_id = ? AND is_active = 1 AND role IN ('CRC', 'MANAGER')
        `).all(event.site_id);
            }

            const payload = JSON.parse(event.payload || '{}');

            // Generate email content
            const { subject, body } = generateEmailContent(event.type, payload);

            // Create email log entries (simulated — no actual send in V1)
            for (const recipient of recipients) {
                db.prepare(`
          INSERT INTO email_logs (id, site_id, user_id, event_id, to_email, subject, body_preview, status, sent_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'SENT', datetime('now'))
        `).run(uuidv4(), event.site_id, recipient.id, event.id, recipient.email, subject, body,);
            }

            // Mark processed
            db.prepare("UPDATE notification_events SET processed_at = datetime('now') WHERE id = ?").run(event.id);
        }

        console.log(`[Scheduler] Processed ${unprocessed.length} notifications`);
    } catch (e) {
        console.error('[Scheduler] Notification processing error:', e.message);
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

function scanVisitReminders(db) {
    try {
        const visits = db.prepare(`
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
        AND pv.reminder_sent = 0
        AND date(pv.scheduled_date, '-' || CAST(vt.reminder_days_before AS TEXT) || ' days') <= date('now')
    `).all();

        for (const visit of visits) {
            const dedupKey = `visit_reminder:${visit.id}:${visit.scheduled_date}`;
            try {
                db.prepare(`
          INSERT INTO notification_events (id, site_id, type, patient_id, screening_case_id, payload, dedup_key)
          VALUES (?, ?, 'VISIT_REMINDER', ?, ?, ?, ?)
        `).run(
                    uuidv4(), visit.site_id, visit.patient_id, visit.case_id,
                    JSON.stringify({
                        patient_name: `${visit.first_name} ${visit.last_name}`,
                        trial_name: visit.trial_name,
                        visit_name: visit.visit_name,
                        scheduled_date: visit.scheduled_date
                    }),
                    dedupKey
                );

                // Mark reminder as sent
                db.prepare('UPDATE patient_visits SET reminder_sent = 1 WHERE id = ?').run(visit.id);
            } catch (e) {
                // Dedup — already created
            }
        }

        if (visits.length > 0) {
            console.log(`[Scheduler] Created ${visits.length} visit reminder events`);
        }
    } catch (e) {
        console.error('[Scheduler] Visit reminder scan error:', e.message);
    }
}

module.exports = { startScheduler, scanRevisitDue, processNotifications, scanVisitReminders };
