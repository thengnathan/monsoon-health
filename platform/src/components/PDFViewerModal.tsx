import { useState, useEffect } from 'react';

interface PDFViewerModalProps {
    url: string;         // signed URL or redirect URL
    filename: string;
    onClose: () => void;
}

export default function PDFViewerModal({ url, filename, onClose }: PDFViewerModalProps) {
    const [loading, setLoading] = useState(true);
    const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
    const [error, setError] = useState(false);

    // The backend returns a 302 redirect to the signed Supabase URL.
    // iframes follow redirects automatically, but we fetch the final URL
    // so we can also offer a direct download link.
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(false);

        fetch(url, { redirect: 'follow' })
            .then(res => {
                if (!res.ok) throw new Error('Failed to load');
                return res.url; // final URL after redirect
            })
            .then(finalUrl => {
                if (!cancelled) {
                    setResolvedUrl(finalUrl);
                    setLoading(false);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    // Fall back to original URL — let the iframe handle the redirect
                    setResolvedUrl(url);
                    setLoading(false);
                }
            });

        return () => { cancelled = true; };
    }, [url]);

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    return (
        <div
            className="modal-overlay"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
            style={{ alignItems: 'stretch', padding: 16 }}
        >
            <div style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-lg)',
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                maxWidth: 1100,
                margin: '0 auto',
                height: '100%',
                overflow: 'hidden',
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border-default)',
                    flexShrink: 0,
                }}>
                    <span style={{ fontSize: 16 }}>📄</span>
                    <span style={{
                        flex: 1,
                        fontWeight: 500,
                        fontSize: 'var(--font-base)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}>
                        {filename}
                    </span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                        {resolvedUrl && (
                            <a
                                href={resolvedUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-sm btn-ghost"
                                style={{ fontSize: 12, padding: '3px 10px' }}
                            >
                                Open in new tab ↗
                            </a>
                        )}
                        <button
                            className="modal-close"
                            onClick={onClose}
                            style={{ marginLeft: 4 }}
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#1a1a1a' }}>
                    {loading && (
                        <div style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'var(--bg-elevated)',
                            zIndex: 10,
                        }}>
                            <div style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
                                <div className="skeleton" style={{ width: 48, height: 48, borderRadius: '50%', margin: '0 auto 12px' }} />
                                <div style={{ fontSize: 'var(--font-sm)' }}>Loading document…</div>
                            </div>
                        </div>
                    )}
                    {error && (
                        <div style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 12,
                            color: 'var(--text-tertiary)',
                        }}>
                            <span style={{ fontSize: 32 }}>⚠️</span>
                            <div style={{ fontSize: 'var(--font-sm)' }}>Could not load document.</div>
                            {resolvedUrl && (
                                <a href={resolvedUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary">
                                    Open in new tab
                                </a>
                            )}
                        </div>
                    )}
                    {resolvedUrl && !error && (
                        <iframe
                            src={resolvedUrl}
                            title={filename}
                            style={{ width: '100%', height: '100%', border: 'none', display: loading ? 'none' : 'block' }}
                            onLoad={() => setLoading(false)}
                            onError={() => { setLoading(false); setError(true); }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
