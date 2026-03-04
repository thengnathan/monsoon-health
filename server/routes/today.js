const express = require('express');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/today — Dashboard aggregation
router.get('/', (req, res) => {
    const db = req.app.locals.db;
    const siteId = req.user.site_id;
    const userId = req.user.id;

    // 1. Revisit due cases
    const revisitDue = db.prepare(`
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
    WHERE sc.site_id = ?
      AND sc.revisit_date IS NOT NULL 
      AND sc.revisit_date <= date('now', '+7 days')
      AND sc.status IN ('FUTURE_CANDIDATE', 'SCREEN_FAILED')
    ORDER BY sc.revisit_date ASC
    LIMIT 20
  `).all(siteId);

    // 2. Pending items due soon or recently completed
    const pendingItemsDue = db.prepare(`
    SELECT pi.*, 
      sc.patient_id, sc.trial_id, sc.status as case_status,
      p.first_name, p.last_name,
      t.name as trial_name
    FROM pending_items pi
    JOIN screening_cases sc ON pi.screening_case_id = sc.id
    JOIN patients p ON sc.patient_id = p.id
    JOIN trials t ON sc.trial_id = t.id
    WHERE pi.site_id = ?
      AND pi.status = 'OPEN'
      AND (pi.due_date IS NULL OR pi.due_date <= date('now', '+7 days'))
    ORDER BY pi.due_date ASC
    LIMIT 20
  `).all(siteId);

    const recentlyCompleted = db.prepare(`
    SELECT pi.*, 
      sc.patient_id, sc.trial_id,
      p.first_name, p.last_name,
      t.name as trial_name
    FROM pending_items pi
    JOIN screening_cases sc ON pi.screening_case_id = sc.id
    JOIN patients p ON sc.patient_id = p.id
    JOIN trials t ON sc.trial_id = t.id
    WHERE pi.site_id = ?
      AND pi.status = 'COMPLETED'
      AND pi.completed_at >= datetime('now', '-3 days')
    ORDER BY pi.completed_at DESC
    LIMIT 10
  `).all(siteId);

    // 3. Recent notification events (unprocessed or recent)
    const recentAlerts = db.prepare(`
    SELECT ne.*,
      p.first_name, p.last_name,
      sc.trial_id,
      t.name as trial_name
    FROM notification_events ne
    LEFT JOIN patients p ON ne.patient_id = p.id
    LEFT JOIN screening_cases sc ON ne.screening_case_id = sc.id
    LEFT JOIN trials t ON sc.trial_id = t.id
    WHERE ne.site_id = ?
      AND ne.created_at >= datetime('now', '-7 days')
    ORDER BY ne.created_at DESC
    LIMIT 20
  `).all(siteId);

    // 4. Active cases needing attention (NEW or PENDING_INFO)
    const activeCases = db.prepare(`
    SELECT sc.*,
      p.first_name, p.last_name, p.dob,
      t.name as trial_name, t.protocol_number,
      u.name as assigned_user_name
    FROM screening_cases sc
    JOIN patients p ON sc.patient_id = p.id
    JOIN trials t ON sc.trial_id = t.id
    LEFT JOIN users u ON sc.assigned_user_id = u.id
    WHERE sc.site_id = ?
      AND sc.status IN ('NEW', 'IN_REVIEW', 'PENDING_INFO')
    ORDER BY sc.last_touched_at ASC
    LIMIT 20
  `).all(siteId);

    // 5. Summary stats
    const stats = {
        total_active_cases: db.prepare(`
      SELECT COUNT(*) as cnt FROM screening_cases WHERE site_id = ? AND status IN ('NEW', 'IN_REVIEW', 'PENDING_INFO', 'LIKELY_ELIGIBLE')
    `).get(siteId).cnt,
        total_patients: db.prepare('SELECT COUNT(*) as cnt FROM patients WHERE site_id = ?').get(siteId).cnt,
        active_trials: db.prepare("SELECT COUNT(*) as cnt FROM trials WHERE site_id = ? AND recruiting_status = 'ACTIVE'").get(siteId).cnt,
        pending_items_open: db.prepare("SELECT COUNT(*) as cnt FROM pending_items WHERE site_id = ? AND status = 'OPEN'").get(siteId).cnt,
        cases_enrolled: db.prepare("SELECT COUNT(*) as cnt FROM screening_cases WHERE site_id = ? AND status = 'ENROLLED'").get(siteId).cnt,
    };

    res.json({
        revisit_due: revisitDue,
        pending_items_due: pendingItemsDue,
        recently_completed: recentlyCompleted,
        recent_alerts: recentAlerts,
        active_cases: activeCases,
        stats
    });
});

module.exports = router;
