const API_BASE = '/api';

async function request(path, options = {}) {
    const token = localStorage.getItem('monsoon_clerk_token');
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        },
        ...options,
    };

    if (config.body && typeof config.body === 'object') {
        config.body = JSON.stringify(config.body);
    }

    const res = await fetch(`${API_BASE}${path}`, config);

    if (res.status === 401) {
        // Clerk will handle re-authentication via its provider
        throw new Error('Session expired');
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
}

export const api = {
    // Auth
    me: () => request('/auth/me'),

    // Patients
    getPatients: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/patients?${qs}`);
    },
    getPatient: (id) => request(`/patients/${id}`),
    createPatient: (data) => request('/patients', { method: 'POST', body: data }),
    updatePatient: (id, data) => request(`/patients/${id}`, { method: 'PATCH', body: data }),

    // Trials
    getTrials: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/trials?${qs}`);
    },
    getTrial: (id) => request(`/trials/${id}`),
    createTrial: (data) => request('/trials', { method: 'POST', body: data }),
    updateTrial: (id, data) => request(`/trials/${id}`, { method: 'PATCH', body: data }),

    // Trial Signal Rules
    getTrialRules: (trialId) => request(`/trials/${trialId}/signal-rules`),
    createTrialRule: (trialId, data) => request(`/trials/${trialId}/signal-rules`, { method: 'POST', body: data }),
    deleteTrialRule: (ruleId) => request(`/trials/signal-rules/${ruleId}`, { method: 'DELETE' }),

    // Signal Types
    getSignalTypes: () => request('/signal-types'),
    createSignalType: (data) => request('/signal-types', { method: 'POST', body: data }),

    // Patient Signals
    getPatientSignals: (patientId, params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/signals/patient/${patientId}?${qs}`);
    },
    addPatientSignal: (patientId, data) => request(`/signals/patient/${patientId}`, { method: 'POST', body: data }),

    // Screening Cases
    getScreeningCases: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/screening-cases?${qs}`);
    },
    getScreeningCase: (id) => request(`/screening-cases/${id}`),
    createScreeningCase: (data) => request('/screening-cases', { method: 'POST', body: data }),
    updateScreeningCase: (id, data) => request(`/screening-cases/${id}`, { method: 'PATCH', body: data }),

    // Screen Fail Reasons
    getScreenFailReasons: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/screen-fail-reasons?${qs}`);
    },

    // Pending Items
    getPendingItems: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/pending-items?${qs}`);
    },
    createPendingItem: (data) => request('/pending-items', { method: 'POST', body: data }),
    updatePendingItem: (id, data) => request(`/pending-items/${id}`, { method: 'PATCH', body: data }),
    deletePendingItem: (id) => request(`/pending-items/${id}`, { method: 'DELETE' }),

    // Referral Sources
    getReferralSources: () => request('/referral-sources'),
    createReferralSource: (data) => request('/referral-sources', { method: 'POST', body: data }),

    // Today
    getToday: () => request('/today'),

    // Users
    getUsers: () => request('/users'),

    // Notifications
    getNotifications: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/notifications?${qs}`);
    },

    // Protocol Upload
    uploadProtocol: async (trialId, file, version) => {
        const token = localStorage.getItem('monsoon_clerk_token');
        const formData = new FormData();
        formData.append('file', file);
        if (version) formData.append('version', version);

        const res = await fetch(`${API_BASE}/trials/${trialId}/protocol`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        return data;
    },
    getProtocolUrl: (trialId) => `${API_BASE}/trials/${trialId}/protocol/download`,
    deleteProtocol: (trialId) => request(`/trials/${trialId}/protocol`, { method: 'DELETE' }),

    // Visit Templates
    getVisitTemplates: (trialId) => request(`/trials/${trialId}/visit-templates`),
    createVisitTemplate: (trialId, data) => request(`/trials/${trialId}/visit-templates`, { method: 'POST', body: data }),
    updateVisitTemplate: (id, data) => request(`/visit-templates/${id}`, { method: 'PATCH', body: data }),
    deleteVisitTemplate: (id) => request(`/visit-templates/${id}`, { method: 'DELETE' }),

    // Enrollment & Patient Visits
    enrollPatient: (caseId, data) => request(`/screening-cases/${caseId}/enroll`, { method: 'POST', body: data }),
    getCaseVisits: (caseId) => request(`/screening-cases/${caseId}/visits`),
    updatePatientVisit: (id, data) => request(`/patient-visits/${id}`, { method: 'PATCH', body: data }),
    getUpcomingVisits: () => request('/upcoming-visits'),

    // Patient Documents
    uploadPatientDocument: async (file, { patient_id, document_type } = {}) => {
        const token = localStorage.getItem('monsoon_clerk_token');
        const formData = new FormData();
        formData.append('file', file);
        if (patient_id) formData.append('patient_id', patient_id);
        if (document_type) formData.append('document_type', document_type);

        const res = await fetch(`${API_BASE}/patients/upload-document`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        return data;
    },
    getPatientDocuments: (patientId) => request(`/patients/${patientId}/documents`),
    getDocumentUrl: (patientId, docId) => `${API_BASE}/patients/${patientId}/documents/${docId}/download`,
    deletePatientDocument: (patientId, docId) => request(`/patients/${patientId}/documents/${docId}`, { method: 'DELETE' }),

    // Notes
    getNotes: () => request('/notes'),
    createNote: (data) => request('/notes', { method: 'POST', body: data }),
    updateNote: (id, data) => request(`/notes/${id}`, { method: 'PATCH', body: data }),
    deleteNote: (id) => request(`/notes/${id}`, { method: 'DELETE' }),
};
