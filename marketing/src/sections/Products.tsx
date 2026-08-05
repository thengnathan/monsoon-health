// Products — scroll-pinned chapters for Zephyr and Tidal.
// Each chapter pins a live demo panel while the visitor scrolls through its
// story: the demo is built from real UI primitives that animate themselves
// (documents arrive, values extract, agents validate) — no video, no
// screenshots. Step column advances with scroll; the panel reacts.

import { useRef, useState, useEffect } from 'react';
import {
    useScroll,
    useMotionValueEvent,
    motion,
    AnimatePresence,
    animate,
} from 'motion/react';
import WaveField from '../animations/WaveField';
import { WaitlistSurface } from '../components/morph-surface';

// Same endpoint the original marketing site uses for its waitlist.
// Production sets VITE_API_URL (Vercel env var) to the deployed API origin.
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

async function joinTidalWaitlist(email: string) {
    const res = await fetch(`${API_BASE}/api/email/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, product: 'Tidal' }),
    });
    if (!res.ok) throw new Error(`waitlist: ${res.status}`);
}

// ── Scroll chapter scaffolding ────────────────────────────────────────────────

interface Step {
    title: string;
    body: string;
}

function Chapter({
    id,
    kicker,
    heading,
    sub,
    badge,
    steps,
    flip,
    backdrop,
    children,
}: {
    id?: string;
    kicker: string;
    heading: React.ReactNode;
    sub: string;
    badge?: React.ReactNode;
    steps: Step[];
    flip?: boolean;
    backdrop?: React.ReactNode;
    children: (step: number) => React.ReactNode;
}) {
    const ref = useRef<HTMLDivElement | null>(null);
    const [step, setStep] = useState(0);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ['start start', 'end end'],
    });

    useMotionValueEvent(scrollYProgress, 'change', v => {
        const raw = v * steps.length;
        const s = Math.max(0, Math.min(steps.length - 1, Math.floor(raw)));
        setStep(s);
        // Fractional progress within the active step — drives the mobile
        // chips' fill (CSS var, no re-render)
        ref.current?.style.setProperty('--step-progress', Math.max(0, Math.min(1, raw - s)).toFixed(3));
    });

    return (
        <div ref={ref} className="chapter" id={id}>
            <div className="chapter-sticky">
                {backdrop && <div className="chapter-backdrop" aria-hidden="true">{backdrop}</div>}
                {/* Clear-zone: the field fades to paper under the story column
                    (no card, no edge) — same language as the hero's headline
                    clearing. Flip-aware: covers whichever side the text is on. */}
                <div className={`chapter-clearzone${flip ? ' chapter-clearzone-flip' : ''}`} aria-hidden="true" />
                <div className={`chapter-grid${flip ? ' chapter-grid-flip' : ''}`}>
                    {/* Story column */}
                    <div className="chapter-story">
                        <div className="chapter-kicker">{kicker}</div>
                        <h2 className="chapter-heading">{heading}</h2>
                        <p className="chapter-sub">{sub}</p>
                        {badge && (typeof badge === 'string'
                            ? <span className="chapter-badge">{badge}</span>
                            : <div className="chapter-badge-slot">{badge}</div>)}

                        <div className="chapter-steps">
                            {steps.map((s, i) => (
                                <button
                                    key={s.title}
                                    type="button"
                                    className={`chapter-step${i === step ? ' active' : ''}${i < step ? ' done' : ''}`}
                                    onClick={() => {
                                        // Jump the scroll position to this step's slice of the chapter.
                                        // Document position via rect + scrollY (offsetTop is relative
                                        // to the positioned .products ancestor, not the page).
                                        const el = ref.current;
                                        if (!el) return;
                                        const chapterTop = el.getBoundingClientRect().top + window.scrollY;
                                        const top = chapterTop + (el.offsetHeight - window.innerHeight) * ((i + 0.5) / steps.length);
                                        window.scrollTo({ top, behavior: 'smooth' });
                                    }}
                                >
                                    <span className="chapter-step-rail">
                                        <span className="chapter-step-dot" />
                                    </span>
                                    <span className="chapter-step-text">
                                        <span className="chapter-step-title">{s.title}</span>
                                        <span className="chapter-step-body">{s.body}</span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Pinned demo panel */}
                    <div className="chapter-panel-wrap">
                        <div className="chapter-panel">
                            <div className="chapter-panel-chrome">
                                <span className="chrome-dot" />
                                <span className="chrome-dot" />
                                <span className="chrome-dot" />
                                <span className="chapter-panel-title">{kicker.split('·')[1]?.trim()}</span>
                            </div>
                            <div className="chapter-panel-body">{children(step)}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Shared demo atoms ─────────────────────────────────────────────────────────

const rise = {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
};

function Tick({ delay = 0 }: { delay?: number }) {
    return (
        <motion.svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="#1ABC9C" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay, type: 'spring', stiffness: 400, damping: 20 }}
        >
            <path d="M20 6L9 17l-5-5" />
        </motion.svg>
    );
}

// Count-up number driven by motion's animate()
function CountUp({ to, duration = 1.1, suffix = '' }: { to: number; duration?: number; suffix?: string }) {
    const ref = useRef<HTMLSpanElement | null>(null);
    useEffect(() => {
        const controls = animate(0, to, {
            duration,
            ease: [0.22, 1, 0.36, 1],
            onUpdate: v => { if (ref.current) ref.current.textContent = `${Math.round(v)}${suffix}`; },
        });
        return () => controls.stop();
    }, [to, duration, suffix]);
    return <span ref={ref}>0{suffix}</span>;
}

// ── Zephyr demo ───────────────────────────────────────────────────────────────

const ZEPHYR_EXTRACTIONS = [
    { name: 'ALT', value: '64', unit: 'U/L', flag: true },
    { name: 'FibroScan (LSM)', value: '11.2', unit: 'kPa', flag: true },
    { name: 'Platelets', value: '214', unit: 'x10³/µL', flag: false },
    { name: 'HbA1c', value: '6.4', unit: '%', flag: false },
];

const ZEPHYR_CRITERIA = [
    'Age 18–75 years',
    'ALT above 1.5× ULN',
    'LSM 8.0–15.0 kPa (F2–F3)',
    'No hepatic decompensation',
];

function ZephyrDemo({ step }: { step: number }) {
    return (
        <div className="zdemo">
            <AnimatePresence mode="wait">
                {step === 0 && (
                    <motion.div key="inbox" className="zdemo-stage" {...rise} transition={{ duration: 0.35 }}>
                        <div className="zdemo-label">Screening inbox</div>
                        <motion.div
                            className="zdemo-doc arriving"
                            initial={{ opacity: 0, y: -26, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.25 }}
                        >
                            <span className="zdemo-doc-icon">
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                                    <path d="M14 2v6h6" />
                                </svg>
                            </span>
                            <span className="zdemo-doc-meta">
                                <span className="zdemo-doc-name">alvarez-hepatic-panel.pdf</span>
                                <span className="zdemo-doc-src">LabCore Diagnostics · referral packet</span>
                            </span>
                            <motion.span
                                className="zdemo-chip-new"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.55, type: 'spring', stiffness: 400, damping: 18 }}
                            >
                                New
                            </motion.span>
                        </motion.div>
                        <div className="zdemo-doc settled">
                            <span className="zdemo-doc-icon dim" />
                            <span className="zdemo-doc-meta">
                                <span className="zdemo-doc-name dim">tran-fibroscan.pdf</span>
                                <span className="zdemo-doc-src">Processed · 2 signals</span>
                            </span>
                        </div>
                        <div className="zdemo-doc settled">
                            <span className="zdemo-doc-icon dim" />
                            <span className="zdemo-doc-meta">
                                <span className="zdemo-doc-name dim">kim-week4-labs.pdf</span>
                                <span className="zdemo-doc-src">Processed · 5 signals</span>
                            </span>
                        </div>
                    </motion.div>
                )}

                {step === 1 && (
                    <motion.div key="extract" className="zdemo-stage" {...rise} transition={{ duration: 0.35 }}>
                        <div className="zdemo-label">Extracting — alvarez-hepatic-panel.pdf</div>
                        {ZEPHYR_EXTRACTIONS.map((x, i) => (
                            <motion.div
                                key={x.name}
                                className="zdemo-extract-row"
                                initial={{ opacity: 0, x: -16 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2 + i * 0.28, duration: 0.3 }}
                            >
                                <span className="zdemo-extract-name">{x.name}</span>
                                <span className={`zdemo-extract-value${x.flag ? ' flagged' : ''}`}>
                                    {x.value}<em>{x.unit}</em>
                                </span>
                                <span className="zdemo-extract-verify">
                                    <Tick delay={0.42 + i * 0.28} />
                                    <motion.em
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.5 + i * 0.28 }}
                                    >
                                        verified
                                    </motion.em>
                                </span>
                            </motion.div>
                        ))}
                        <motion.div
                            className="zdemo-footnote"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1.5 }}
                        >
                            Every value checked against the source PDF — nothing keyed by hand.
                        </motion.div>
                    </motion.div>
                )}

                {step >= 2 && (
                    <motion.div key="match" className="zdemo-stage" {...rise} transition={{ duration: 0.35 }}>
                        <div className="zdemo-label">Protocol ACME-NASH-201 · eligibility</div>
                        <div className="zdemo-match">
                            <div className="zdemo-criteria">
                                {ZEPHYR_CRITERIA.map((c, i) => (
                                    <motion.div
                                        key={c}
                                        className="zdemo-criterion"
                                        initial={{ opacity: 0, x: -12 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.15 + i * 0.22 }}
                                    >
                                        <Tick delay={0.3 + i * 0.22} />
                                        <span>{c}</span>
                                    </motion.div>
                                ))}
                            </div>
                            <div className="zdemo-score">
                                <svg viewBox="0 0 120 120" className="zdemo-ring">
                                    <circle cx="60" cy="60" r="52" className="zdemo-ring-track" />
                                    <motion.circle
                                        cx="60" cy="60" r="52"
                                        className="zdemo-ring-fill"
                                        initial={{ pathLength: 0 }}
                                        animate={{ pathLength: 0.92 }}
                                        transition={{ delay: 0.9, duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                                    />
                                </svg>
                                <div className="zdemo-score-num">
                                    <CountUp to={92} suffix="%" />
                                    <span>match</span>
                                </div>
                            </div>
                        </div>
                        <motion.span
                            className="zdemo-eligible"
                            initial={{ scale: 0.7, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 1.9, type: 'spring', stiffness: 300, damping: 18 }}
                        >
                            Likely eligible — screening case opened
                        </motion.span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ── Tidal demo ─────────────────────────────────────────────────────────────

const RAINFALL_ROWS = [
    { field: 'ALT', value: '47 U/L', ok: true },
    { field: 'Weight', value: '84.2 kg', ok: true },
    { field: 'Systolic BP', value: '128 mmHg', ok: true },
    // The classic EDC catch: source reports g/L, the field expects g/dL —
    // same measurement, wrong unit, tenfold error if it slips through.
    { field: 'Albumin', value: '42 g/L', ok: false, fixed: '4.2 g/dL' },
    { field: 'Visit date', value: '2026-07-01', ok: true },
];

function RainfallDemo({ step }: { step: number }) {
    // The agent never edits data on its own — at step 2 it presents the
    // suggested fix and the demo plays a CRC approving it, then the value
    // updates. Human in the loop, on purpose.
    const [approved, setApproved] = useState(false);
    useEffect(() => {
        if (step >= 2) {
            const t = setTimeout(() => setApproved(true), 1400);
            return () => clearTimeout(t);
        }
        setApproved(false);
    }, [step]);

    return (
        <div className="rdemo">
            <div className="rdemo-header">
                <span>Visit 2 · Week 4</span>
                <AnimatePresence mode="wait">
                    {approved ? (
                        <motion.span key="zero" className="rdemo-queries done" {...rise}>
                            Open queries: <strong>0</strong>
                        </motion.span>
                    ) : step >= 1 ? (
                        <motion.span key="review" className="rdemo-queries" {...rise}>
                            1 for review
                        </motion.span>
                    ) : (
                        <motion.span key="pending" className="rdemo-queries" {...rise}>
                            Receiving…
                        </motion.span>
                    )}
                </AnimatePresence>
            </div>

            <div className="rdemo-grid">
                {RAINFALL_ROWS.map((r, i) => {
                    const isProblem = !r.ok;
                    const showFlag = isProblem && step >= 1 && !approved;
                    const showFixed = isProblem && approved;
                    return (
                        <motion.div
                            key={r.field}
                            className={`rdemo-row${showFlag ? ' flagged' : ''}${showFixed ? ' resolved' : ''}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.12 + i * 0.13 }}
                        >
                            <span className="rdemo-field">{r.field}</span>
                            <span className="rdemo-value rdemo-value-swap">
                                {/* Single node — the text swaps in place and the
                                    new value settles in with a blur pulse. One
                                    element can't overlay itself, so this is
                                    immune to presence/exit glitches no matter
                                    how the scroll scrubs the step boundary. */}
                                <motion.span
                                    animate={
                                        showFixed
                                            ? { opacity: [0, 1], filter: ['blur(6px)', 'blur(0px)'] }
                                            : { opacity: 1, filter: 'blur(0px)' }
                                    }
                                    transition={{ duration: 0.4, ease: 'easeOut' }}
                                >
                                    {showFixed ? r.fixed : r.value}
                                </motion.span>
                            </span>
                            <span className="rdemo-state">
                                {step >= 1 && r.ok && <Tick delay={0.3 + i * 0.18} />}
                                <AnimatePresence>
                                    {showFlag && (
                                        <motion.span
                                            key="flag"
                                            className="rdemo-flag"
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            exit={{ scale: 0.6, opacity: 0 }}
                                            transition={{ delay: step === 1 ? 0.9 : 0, type: 'spring', stiffness: 350, damping: 16 }}
                                        >
                                            unit mismatch
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                                {showFixed && <Tick delay={0.4} />}
                            </span>
                        </motion.div>
                    );
                })}
            </div>

            <AnimatePresence mode="wait">
                {step === 1 && (
                    <motion.div className="rdemo-agent" {...rise} transition={{ delay: 1.15 }} key="agent">
                        <span className="rdemo-agent-pulse" />
                        <span>
                            Agent: “42 g/L” looks like a unit slip — the source lab PDF reads{' '}
                            <strong>4.2 g/dL</strong>. Suggested fix ready for your review.
                        </span>
                    </motion.div>
                )}
                {step >= 2 && (
                    <motion.div className="rdemo-agent review" {...rise} transition={{ delay: 0.35 }} key="review">
                        <div className="rdemo-suggest">
                            <span className="rdemo-suggest-text">
                                Suggested: Albumin <strong>4.2 g/dL</strong>
                                <em>source: lab PDF, p.2</em>
                            </span>
                            <motion.span
                                className={`rdemo-approve${approved ? ' ok' : ''}`}
                                animate={approved ? { scale: [1, 0.92, 1] } : {}}
                                transition={{ duration: 0.3 }}
                            >
                                {approved ? '✓ Applied' : 'Approve'}
                            </motion.span>
                        </div>
                        <AnimatePresence>
                            {approved && (
                                <motion.div
                                    className="rdemo-audit"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    transition={{ delay: 0.25 }}
                                >
                                    Approved by J. Rivera, CRC · full audit trail · no query raised
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ── Section ───────────────────────────────────────────────────────────────────

export default function Products() {
    return (
        <section className="products" id="products">
            <Chapter
                id="zephyr"
                kicker="01 · Zephyr"
                heading={<>Every patient, every trial, one <span className="hero-serif">living</span> view.</>}
                sub="Zephyr gives research sites a real-time picture of every patient across every active protocol — from the moment a referral PDF arrives to the moment a screening case opens."
                badge="In early access"
                steps={[
                    { title: 'A referral arrives', body: 'Drop in the paperwork you already have — referral letters, lab panels, elastography reports.' },
                    { title: 'Zephyr reads it', body: 'Clinical values extract themselves, each one verified against the source document.' },
                    { title: 'The match surfaces', body: 'Eligibility criteria check automatically against every active protocol at your site.' },
                ]}
            >
                {step => <ZephyrDemo step={step} />}
            </Chapter>

            <Chapter
                id="tidal"
                backdrop={<WaveField />}
                flip
                kicker="02 · Tidal"
                heading={<>Data that cleans itself <span className="hero-serif">before</span> it becomes a query.</>}
                sub="Tidal is agentic data capture built for CRCs and CROs. AI agents review and validate visit data in real time, then hand your coordinator a suggested fix with the source evidence — the human stays in control of every change."
                badge={<WaitlistSurface onSubmit={joinTidalWaitlist} />}
                steps={[
                    { title: 'Data flows in', body: 'Visit data lands directly from source systems and documents.' },
                    { title: 'Agents flag, CRCs decide', body: 'Every value is checked against protocol ranges and source records. Discrepancies surface with the evidence — never a silent change.' },
                    { title: 'One click, zero queries', body: 'Your CRC approves the fix; Tidal applies it with a full audit trail. Sponsors see clean data before a query ever exists.' },
                ]}
            >
                {step => <RainfallDemo step={step} />}
            </Chapter>
        </section>
    );
}
