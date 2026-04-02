import type {
    DbUser, Patient, PatientDetail, Trial, TrialDetail,
    ScreeningCase, ScreeningCaseRow, ScreeningCaseDetail,
    SignalType, ScreenFailReason, ReferralSource, Note,
    PatientVisit, TodayData, UpcomingVisit, UploadResult,
    EnrollResult, AddSignalResult, PendingItem, BatchImportResult,
} from './types';

const API_BASE = '/api';

interface ApiOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
}

async function request<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
    const token = localStorage.getItem('monsoon_clerk_token');
    const config: RequestInit = {
        method: options.method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers || {}),
        },
    };

    if (options.body !== undefined) {
        config.body = JSON.stringify(options.body);
    }

    const res = await fetch(`${API_BASE}${path}`, config);

    if (res.status === 401) {
        throw new Error('Session expired');
    }

    const data = await res.json();
    if (!res.ok) throw new Error((data as { error?: string }).error || 'Request failed');
    return data as T;
}

export const api = {
    // Auth
    me: () => request<DbUser>('/auth/me'),

    // Patients
    getPatients: (params: Record<string, string> = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request<{ patients: Patient[] }>(`/patients?${qs}`);
    },
    getPatient: (id: string) => request<PatientDetail>(`/patients/${id}`),
    createPatient: (data: Record<string, unknown>) => request<Patient>('/patients', { method: 'POST', body: data }),
    updatePatient: (id: string, data: Record<string, unknown>) => request<Patient>(`/patients/${id}`, { method: 'PATCH', body: data }),

    // Trials
    getTrials: (params: Record<string, string> = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request<Trial[]>(`/trials?${qs}`);
    },
    getTrial: (id: string) => request<TrialDetail>(`/trials/${id}`),
    createTrial: (data: Record<string, unknown>) => request<Trial>('/trials', { method: 'POST', body: data }),
    updateTrial: (id: string, data: Record<string, unknown>) => request<Trial>(`/trials/${id}`, { method: 'PATCH', body: data }),

    // Trial Signal Rules
    getTrialRules: (trialId: string) => request(`/trials/${trialId}/signal-rules`),
    createTrialRule: (trialId: string, data: Record<string, unknown>) => request(`/trials/${trialId}/signal-rules`, { method: 'POST', body: data }),
    updateTrialRule: (ruleId: string, data: Record<string, unknown>) => request(`/trials/signal-rules/${ruleId}`, { method: 'PATCH', body: data }),
    deleteTrialRule: (ruleId: string) => request(`/trials/signal-rules/${ruleId}`, { method: 'DELETE' }),

    // Signal Types
    getSignalTypes: () => request<SignalType[]>('/signal-types'),
    createSignalType: (data: Record<string, unknown>) => request<SignalType>('/signal-types', { method: 'POST', body: data }),

    // Patient Signals
    getPatientSignals: (patientId: string, params: Record<string, string> = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/signals/patient/${patientId}?${qs}`);
    },
    addPatientSignal: (patientId: string, data: Record<string, unknown>) =>
        request<AddSignalResult>(`/signals/patient/${patientId}`, { method: 'POST', body: data }),

    // Screening Cases
    getScreeningCases: (params: Record<string, string> = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request<{ cases: ScreeningCaseRow[] }>(`/screening-cases?${qs}`);
    },
    getScreeningCase: (id: string) => request<ScreeningCaseDetail>(`/screening-cases/${id}`),
    createScreeningCase: (data: Record<string, unknown>) => request<ScreeningCase>('/screening-cases', { method: 'POST', body: data }),
    updateScreeningCase: (id: string, data: Record<string, unknown>) => request<ScreeningCase>(`/screening-cases/${id}`, { method: 'PATCH', body: data }),

    // Screen Fail Reasons
    getScreenFailReasons: (params: Record<string, string> = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request<ScreenFailReason[]>(`/screen-fail-reasons?${qs}`);
    },

    // Pending Items
    getPendingItems: (params: Record<string, string> = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request<PendingItem[]>(`/pending-items?${qs}`);
    },
    createPendingItem: (data: Record<string, unknown>) => request<PendingItem>('/pending-items', { method: 'POST', body: data }),
    updatePendingItem: (id: string, data: Record<string, unknown>) => request<PendingItem>(`/pending-items/${id}`, { method: 'PATCH', body: data }),
    deletePendingItem: (id: string) => request(`/pending-items/${id}`, { method: 'DELETE' }),

    // Referral Sources
    getReferralSources: () => request<ReferralSource[]>('/referral-sources'),
    createReferralSource: (data: Record<string, unknown>) => request<ReferralSource>('/referral-sources', { method: 'POST', body: data }),

    // Today
    getToday: () => request<TodayData>('/today'),

    // Users
    getUsers: () => request<DbUser[]>('/users'),

    // Notifications
    getNotifications: (params: Record<string, string> = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/notifications?${qs}`);
    },

    // Protocol Upload
    uploadProtocol: async (trialId: string, file: File, version?: string) => {
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
        if (!res.ok) throw new Error((data as { error?: string }).error || 'Upload failed');
        return data as { auto_extracted?: { inclusion_criteria?: string; exclusion_criteria?: string } };
    },
    getProtocolUrl: (trialId: string) => `${API_BASE}/trials/${trialId}/protocol/download`,
    deleteProtocol: (trialId: string) => request(`/trials/${trialId}/protocol`, { method: 'DELETE' }),
    reextractProtocol: (trialId: string) => request(`/trials/${trialId}/protocol/reextract`, { method: 'POST' }),

    // Visit Templates
    getVisitTemplates: (trialId: string) => request(`/trials/${trialId}/visit-templates`),
    createVisitTemplate: (trialId: string, data: Record<string, unknown>) =>
        request(`/trials/${trialId}/visit-templates`, { method: 'POST', body: data }),
    updateVisitTemplate: (id: string, data: Record<string, unknown>) =>
        request(`/visit-templates/${id}`, { method: 'PATCH', body: data }),
    deleteVisitTemplate: (id: string) => request(`/visit-templates/${id}`, { method: 'DELETE' }),

    // Enrollment & Patient Visits
    enrollPatient: (caseId: string, data: Record<string, unknown>) =>
        request<EnrollResult>(`/screening-cases/${caseId}/enroll`, { method: 'POST', body: data }),
    getCaseVisits: (caseId: string) => request<PatientVisit[]>(`/screening-cases/${caseId}/visits`),
    updatePatientVisit: (id: string, data: Record<string, unknown>) =>
        request<PatientVisit>(`/patient-visits/${id}`, { method: 'PATCH', body: data }),
    getUpcomingVisits: () => request<UpcomingVisit[]>('/upcoming-visits'),

    // Patient Batch Import
    batchImportPatients: async (file: File) => {
        const token = localStorage.getItem('monsoon_clerk_token');
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`${API_BASE}/patients/batch-import`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error((data as { error?: string }).error || 'Batch import failed');
        return data as BatchImportResult;
    },

    // Patient Documents
    uploadPatientDocument: async (file: File, { patient_id, document_type }: { patient_id?: string; document_type?: string } = {}) => {
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
        if (!res.ok) throw new Error((data as { error?: string }).error || 'Upload failed');
        return data as UploadResult;
    },
    getPatientDocuments: (patientId: string) => request(`/patients/${patientId}/documents`),
    getDocumentUrl: (patientId: string, docId: string) => `${API_BASE}/patients/${patientId}/documents/${docId}/download`,
    deletePatientDocument: (patientId: string, docId: string) => request(`/patients/${patientId}/documents/${docId}`, { method: 'DELETE' }),

    // Notes
    getNotes: () => request<Note[]>('/notes'),
    createNote: (data: Record<string, unknown>) => request<Note>('/notes', { method: 'POST', body: data }),
    updateNote: (id: string, data: Record<string, unknown>) => request<Note>(`/notes/${id}`, { method: 'PATCH', body: data }),
    deleteNote: (id: string) => request(`/notes/${id}`, { method: 'DELETE' }),

    // Intake Submissions
    getIntakeSubmissions: (status = 'PENDING') =>
        request<Record<string, unknown>[]>(`/intake/submissions?status=${status}`),
    getIntakeSubmission: (id: string) =>
        request<Record<string, unknown>>(`/intake/submissions/${id}`),
    convertIntakeSubmission: (id: string, overrides: Record<string, string> = {}) =>
        request<{ patient: Patient; submission_id: string }>(`/intake/submissions/${id}/convert`, { method: 'POST', body: overrides }),
    archiveIntakeSubmission: (id: string) =>
        request(`/intake/submissions/${id}/archive`, { method: 'PATCH' }),
};
