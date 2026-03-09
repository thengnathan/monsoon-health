import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useToast } from '../contexts/ToastContext';
import { formatDate } from '../utils';
import type { Patient, ReferralSource, UploadResult } from '../types';

interface PatientForm {
    first_name: string;
    last_name: string;
    dob: string;
    internal_identifier: string;
    referral_source_id: string;
    referral_date: string;
    notes: string;
}

export default function PatientsPage() {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showUploadResult, setShowUploadResult] = useState<UploadResult | null>(null);
    const [referralSources, setReferralSources] = useState<ReferralSource[]>([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();
    const { addToast } = useToast();

    const emptyForm: PatientForm = { first_name: '', last_name: '', dob: '', internal_identifier: '', referral_source_id: '', referral_date: '', notes: '' };
    const [form, setForm] = useState<PatientForm>(emptyForm);

    const loadPatients = (query = '') => {
        setLoading(true);
        api.getPatients({ query }).then(d => setPatients(d.patients)).catch(console.error).finally(() => setLoading(false));
    };

    useEffect(() => {
        loadPatients();
        api.getReferralSources().then(setReferralSources).catch(() => {});
    }, []);

    useEffect(() => {
        const t = setTimeout(() => loadPatients(search), 300);
        return () => clearTimeout(t);
    }, [search]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const p = await api.createPatient(form as unknown as Record<string, unknown>);
            addToast('Patient created', 'success');
            setShowModal(false);
            setForm(emptyForm);
            navigate(`/patients/${p.id}`);
        } catch (err) {
            addToast((err as Error).message, 'error');
        }
    };

    const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const result = await api.uploadPatientDocument(file, { document_type: 'FIBROSCAN' });
            setShowUploadResult(result);
            loadPatients(search);
            if (result.patient_created) {
                addToast(`Patient "${result.patient.first_name} ${result.patient.last_name}" auto-created from document!`, 'success');
            } else {
                addToast('Document uploaded and attached to patient', 'success');
            }
        } catch (err) {
            addToast((err as Error).message, 'error');
        }
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                    <h1>Patients</h1>
                    <p>Search and manage your patient registry</p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                        {uploading ? (
                            <><span className="spinner" style={{ width: 14, height: 14 }} /> Processing…</>
                        ) : (
                            <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6, verticalAlign: -2 }}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><polyline points="9 15 12 12 15 15" /></svg>Upload Document</>
                        )}
                    </button>
                    <button id="add-patient-btn" className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Patient</button>
                </div>
                <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.tiff" onChange={handleDocumentUpload} style={{ display: 'none' }} />
            </div>

            <div className="search-bar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <input
                    id="patient-search"
                    placeholder="Search by name, MRN, or identifier…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    autoFocus
                />
            </div>

            {loading ? (
                <div className="loading-spinner"><div className="spinner" /></div>
            ) : patients.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">◇</div>
                    <h3>{search ? 'No patients found' : 'No patients yet'}</h3>
                    <p style={{ marginTop: 'var(--space-3)' }}>
                        {search ? 'Try a different search term' : 'Upload a document (e.g. FibroScan report) to auto-create a patient, or add one manually.'}
                    </p>
                    {!search && (
                        <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-5)', justifyContent: 'center' }}>
                            <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6, verticalAlign: -2 }}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><polyline points="9 15 12 12 15 15" /></svg>Upload Document
                            </button>
                            <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Manually</button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Patient</th>
                                <th>DOB</th>
                                <th>ID</th>
                                <th>Referral Source</th>
                                <th>Added</th>
                            </tr>
                        </thead>
                        <tbody>
                            {patients.map(p => (
                                <tr key={p.id} onClick={() => navigate(`/patients/${p.id}`)}>
                                    <td className="patient-name">{p.last_name}, {p.first_name}</td>
                                    <td>{formatDate(p.dob)}</td>
                                    <td className="meta">{p.internal_identifier || '—'}</td>
                                    <td className="meta">{p.referral_source_name || '—'}</td>
                                    <td className="meta">{formatDate(p.created_at)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Upload Result Modal */}
            {showUploadResult && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowUploadResult(null)}>
                    <div className="modal">
                        <div className="modal-header">
                            <h3 className="modal-title">
                                {showUploadResult.patient_created ? '✅ Patient Created from Document' : '✅ Document Uploaded'}
                            </h3>
                            <button className="modal-close" onClick={() => setShowUploadResult(null)}>✕</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                            <div className="card" style={{ padding: 'var(--space-4)' }}>
                                <div style={{ fontWeight: 600, fontSize: 'var(--font-md)', marginBottom: 'var(--space-2)' }}>
                                    {showUploadResult.patient.first_name} {showUploadResult.patient.last_name}
                                </div>
                                <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                                    {showUploadResult.patient.dob && showUploadResult.patient.dob !== '1900-01-01' && (
                                        <span>DOB: {formatDate(showUploadResult.patient.dob)}</span>
                                    )}
                                    {showUploadResult.patient.internal_identifier && (
                                        <span>MRN: {showUploadResult.patient.internal_identifier}</span>
                                    )}
                                </div>
                            </div>

                            {Object.keys(showUploadResult.extracted).length > 0 && (
                                <div>
                                    <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-2)' }}>
                                        Auto-Extracted from PDF
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                                        {Object.entries(showUploadResult.extracted).map(([key, val]) => (
                                            <div key={key} className="card" style={{ padding: 'var(--space-2) var(--space-3)' }}>
                                                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>{key.replace(/_/g, ' ')}</div>
                                                <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>{String(val)}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {showUploadResult.signals_created.length > 0 && (
                                <p style={{ fontSize: 'var(--font-xs)', color: 'var(--accent)' }}>
                                    ✓ Signal values recorded: {showUploadResult.signals_created.join(', ')}
                                </p>
                            )}

                            {showUploadResult.patient_created && (
                                <p style={{ fontSize: 'var(--font-xs)', color: 'var(--warning)' }}>
                                    ⚠ Please review and update any missing patient details.
                                </p>
                            )}
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setShowUploadResult(null)}>Close</button>
                            <button className="btn btn-primary" onClick={() => { setShowUploadResult(null); navigate(`/patients/${showUploadResult.patient.id}`); }}>
                                View Patient →
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Patient Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
                    <div className="modal">
                        <div className="modal-header">
                            <h3 className="modal-title">Add Patient</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleCreate}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">First Name *</label>
                                    <input className="form-input" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Last Name *</label>
                                    <input className="form-input" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} required />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Date of Birth *</label>
                                    <input className="form-input" type="date" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Internal ID</label>
                                    <input className="form-input" value={form.internal_identifier} onChange={e => setForm({ ...form, internal_identifier: e.target.value })} placeholder="MRN or site ID" />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Referral Source</label>
                                    <select className="form-select" value={form.referral_source_id} onChange={e => setForm({ ...form, referral_source_id: e.target.value })}>
                                        <option value="">None</option>
                                        {referralSources.map(rs => <option key={rs.id} value={rs.id}>{rs.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Referral Date</label>
                                    <input className="form-input" type="date" value={form.referral_date} onChange={e => setForm({ ...form, referral_date: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Notes</label>
                                <textarea className="form-textarea" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Brief notes (avoid unnecessary PHI)" rows={2} />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Add Patient</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
