const { v4: uuidv4 } = require('uuid');

/**
 * Evaluate trial signal rules against a newly recorded signal.
 * Creates THRESHOLD_CROSSED notification events when thresholds are met.
 */
function evaluateThresholds(db, { siteId, patientId, signalTypeId, value, signalType }) {
    const alerts = [];

    // Find active trial rules that reference this signal type
    const rules = db.prepare(`
    SELECT tsr.*, t.name as trial_name, t.id as trial_id, t.recruiting_status
    FROM trial_signal_rules tsr
    JOIN trials t ON tsr.trial_id = t.id
    WHERE tsr.signal_type_id = ? 
      AND tsr.site_id = ? 
      AND tsr.is_active = 1
      AND t.recruiting_status = 'ACTIVE'
  `).all(signalTypeId, siteId);

    for (const rule of rules) {
        const matches = evaluateRule(rule, value, signalType);
        if (!matches) continue;

        // Check if there's already an active screening case for this patient-trial
        const existingCase = db.prepare(`
      SELECT id, status FROM screening_cases 
      WHERE patient_id = ? AND trial_id = ? AND site_id = ?
      AND status NOT IN ('SCREEN_FAILED', 'DECLINED', 'LOST_TO_FOLLOWUP')
    `).get(patientId, rule.trial_id, siteId);

        // Only alert if no active case, or if case is in a relevant state
        if (existingCase && existingCase.status === 'ENROLLED') continue;

        const dedupKey = `threshold:${patientId}:${rule.trial_id}:${signalTypeId}:${new Date().toISOString().split('T')[0]}`;

        try {
            const eventId = uuidv4();
            db.prepare(`
        INSERT INTO notification_events (id, site_id, type, patient_id, screening_case_id, payload, dedup_key)
        VALUES (?, ?, 'THRESHOLD_CROSSED', ?, ?, ?, ?)
      `).run(
                eventId, siteId, patientId,
                existingCase?.id || null,
                JSON.stringify({
                    signal_type: signalType.name,
                    signal_label: signalType.label,
                    value: value,
                    trial_id: rule.trial_id,
                    trial_name: rule.trial_name,
                    operator: rule.operator,
                    threshold: rule.threshold_number || rule.threshold_text || rule.threshold_list,
                    has_existing_case: !!existingCase
                }),
                dedupKey
            );

            alerts.push({
                event_id: eventId,
                trial_name: rule.trial_name,
                trial_id: rule.trial_id,
                signal: signalType.label,
                value,
                threshold: rule.threshold_number || rule.threshold_text,
                operator: rule.operator
            });
        } catch (e) {
            // Dedup key conflict — alert already exists for today
            if (!e.message.includes('UNIQUE')) throw e;
        }
    }

    return alerts;
}

function evaluateRule(rule, value, signalType) {
    if (signalType.value_type === 'NUMBER') {
        const numVal = Number(value);
        switch (rule.operator) {
            case 'GTE': return numVal >= rule.threshold_number;
            case 'LTE': return numVal <= rule.threshold_number;
            case 'EQ': return numVal === rule.threshold_number;
            default: return false;
        }
    } else {
        // STRING or ENUM
        const strVal = String(value);
        switch (rule.operator) {
            case 'EQ': return strVal === rule.threshold_text;
            case 'IN': {
                try {
                    const list = JSON.parse(rule.threshold_list || '[]');
                    return list.includes(strVal);
                } catch { return false; }
            }
            default: return false;
        }
    }
}

module.exports = { evaluateThresholds };
