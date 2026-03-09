const { v4: uuidv4 } = require('uuid');

async function evaluateThresholds(db, { siteId, patientId, signalTypeId, value, signalType }) {
    const alerts = [];

    const { rows: rules } = await db.query(
        `SELECT tsr.*, t.name as trial_name, t.id as trial_id, t.recruiting_status
         FROM trial_signal_rules tsr
         JOIN trials t ON tsr.trial_id = t.id
         WHERE tsr.signal_type_id = $1
           AND tsr.site_id = $2
           AND tsr.is_active = true
           AND t.recruiting_status = 'ACTIVE'`,
        [signalTypeId, siteId]
    );

    for (const rule of rules) {
        if (!evaluateRule(rule, value, signalType)) continue;

        const existingCase = (await db.query(
            `SELECT id, status FROM screening_cases
             WHERE patient_id = $1 AND trial_id = $2 AND site_id = $3
             AND status NOT IN ('SCREEN_FAILED', 'DECLINED', 'LOST_TO_FOLLOWUP')`,
            [patientId, rule.trial_id, siteId]
        )).rows[0];

        if (existingCase && existingCase.status === 'ENROLLED') continue;

        const dedupKey = `threshold:${patientId}:${rule.trial_id}:${signalTypeId}:${new Date().toISOString().split('T')[0]}`;

        try {
            const eventId = uuidv4();
            await db.query(
                `INSERT INTO notification_events (id, site_id, type, patient_id, screening_case_id, payload, dedup_key)
                 VALUES ($1, $2, 'THRESHOLD_CROSSED', $3, $4, $5, $6)`,
                [eventId, siteId, patientId,
                 existingCase?.id || null,
                 JSON.stringify({
                     signal_type: signalType.name,
                     signal_label: signalType.label,
                     value,
                     trial_id: rule.trial_id,
                     trial_name: rule.trial_name,
                     operator: rule.operator,
                     threshold: rule.threshold_number || rule.threshold_text || rule.threshold_list,
                     has_existing_case: !!existingCase
                 }),
                 dedupKey]
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
            if (e.code !== '23505') throw e; // ignore dedup violations
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
