const express = require('express');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
    const db = req.app.locals.db;
    const siteId = req.user.site_id;

    const [revisitDue, pendingItemsDue, recentlyCompleted, recentAlerts, activeCases, statsRows] = await Promise.all([
        db.query(`
            SELECT sc.*,
              p.first_name, p.last_name, p.dob,
              t.name as trial_name, t.protocol_number,
              u.name as assigned_user_name,
              sfr.label as fail_reason_label
            FROM screening_cases sc
            JOIN patients p ON sc.patient_id = p.id
            JOIN trials t ON sc.trial_id = t.id
            LEFT JOIN users u ON sc.assigned_user_id = u.id
            LEFT JOIN screen_fail_reasons sfr ON sc.fail_reason_id = sfr.id
            WHERE sc.site_id = $1
              AND sc.revisit_date IS NOT NULL
              AND sc.revisit_date <= (CURRENT_DATE + INTERVAL '7 days')::text
              AND sc.status IN ('FUTURE_CANDIDATE', 'SCREEN_FAILED')
            ORDER BY sc.revisit_date ASC
            LIMIT 20
        `, [siteId]),

        db.query(`
            SELECT pi.*,
              sc.patient_id, sc.trial_id, sc.status as case_status,
              p.first_name, p.last_name,
              t.name as trial_name
            FROM pending_items pi
            JOIN screening_cases sc ON pi.screening_case_id = sc.id
            JOIN patients p ON sc.patient_id = p.id
            JOIN trials t ON sc.trial_id = t.id
            WHERE pi.site_id = $1
              AND pi.status = 'OPEN'
              AND (pi.due_date IS NULL OR pi.due_date <= (CURRENT_DATE + INTERVAL '7 days')::text)
            ORDER BY pi.due_date ASC
            LIMIT 20
        `, [siteId]),

        db.query(`
            SELECT pi.*,
              sc.patient_id, sc.trial_id,
              p.first_name, p.last_name,
              t.name as trial_name
            FROM pending_items pi
            JOIN screening_cases sc ON pi.screening_case_id = sc.id
            JOIN patients p ON sc.patient_id = p.id
            JOIN trials t ON sc.trial_id = t.id
            WHERE pi.site_id = $1
              AND pi.status = 'COMPLETED'
              AND pi.completed_at >= NOW() - INTERVAL '3 days'
            ORDER BY pi.completed_at DESC
            LIMIT 10
        `, [siteId]),

        db.query(`
            SELECT ne.*,
              p.first_name, p.last_name,
              sc.trial_id,
              t.name as trial_name
            FROM notification_events ne
            LEFT JOIN patients p ON ne.patient_id = p.id
            LEFT JOIN screening_cases sc ON ne.screening_case_id = sc.id
            LEFT JOIN trials t ON sc.trial_id = t.id
            WHERE ne.site_id = $1
              AND ne.created_at >= NOW() - INTERVAL '7 days'
            ORDER BY ne.created_at DESC
            LIMIT 20
        `, [siteId]),

        db.query(`
            SELECT sc.*,
              p.first_name, p.last_name, p.dob,
              t.name as trial_name, t.protocol_number,
              u.name as assigned_user_name
            FROM screening_cases sc
            JOIN patients p ON sc.patient_id = p.id
            JOIN trials t ON sc.trial_id = t.id
            LEFT JOIN users u ON sc.assigned_user_id = u.id
            WHERE sc.site_id = $1
              AND sc.status IN ('NEW', 'IN_REVIEW', 'PENDING_INFO')
            ORDER BY sc.last_touched_at ASC
            LIMIT 20
        `, [siteId]),

        Promise.all([
            db.query(`SELECT COUNT(*) as cnt FROM screening_cases WHERE site_id = $1 AND status IN ('NEW', 'IN_REVIEW', 'PENDING_INFO', 'LIKELY_ELIGIBLE')`, [siteId]),
            db.query(`SELECT COUNT(*) as cnt FROM patients WHERE site_id = $1`, [siteId]),
            db.query(`SELECT COUNT(*) as cnt FROM trials WHERE site_id = $1 AND recruiting_status = 'ACTIVE'`, [siteId]),
            db.query(`SELECT COUNT(*) as cnt FROM pending_items WHERE site_id = $1 AND status = 'OPEN'`, [siteId]),
            db.query(`SELECT COUNT(*) as cnt FROM screening_cases WHERE site_id = $1 AND status = 'ENROLLED'`, [siteId]),
        ]),
    ]);

    const [activeCnt, patientCnt, trialCnt, pendingCnt, enrolledCnt] = statsRows;

    res.json({
        revisit_due: revisitDue.rows,
        pending_items_due: pendingItemsDue.rows,
        recently_completed: recentlyCompleted.rows,
        recent_alerts: recentAlerts.rows,
        active_cases: activeCases.rows,
        stats: {
            total_active_cases: Number(activeCnt.rows[0].cnt),
            total_patients: Number(patientCnt.rows[0].cnt),
            active_trials: Number(trialCnt.rows[0].cnt),
            pending_items_open: Number(pendingCnt.rows[0].cnt),
            cases_enrolled: Number(enrolledCnt.rows[0].cnt),
        }
    });
});

module.exports = router;
