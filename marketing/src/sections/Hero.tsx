// Hero — copy over the UnifiedField dot grid (see animations/UnifiedField).
// Config is the one the design team collected, verbatim (enableGradient is
// intentionally not passed — the component defaults it off, giving the
// single-color dot field). Copy follows the original marketing positioning.

import DemoCTA from './DemoCTA';
import { goToSection } from '../scroll';
// Alternative backdrop (fine-line blueprint grid) — kept for section use later:
// import { FineLineGrid } from '../animations/FineLineGrid';

export default function Hero() {
    return (
        <header className="hero">
            {/* Backdrop lives in the page-wide UnifiedField — the same
                particles that hold this grid become the Zephyr currents */}

            {/* ── Headline stack ── */}
            <div className="hero-content">
                <a className="hero-pill" href="#zephyr" onClick={e => goToSection(e, '#zephyr')}>
                    <span className="hero-pill-dot" /> Zephyr is in early access <span className="hero-pill-arrow">→</span>
                </a>
                <h1>
                    The Operating System<br />for <em className="hero-serif">Clinical Trials</em>
                </h1>
                <p className="hero-sub">
                    Protocols become screening pipelines in minutes: extracted criteria,
                    matched patients, tracked visit windows — one platform from referral to enrollment.
                </p>
                <div className="hero-actions">
                    <DemoCTA layoutId="demo-cta-hero" labelClassName="demo-cta-label-lg" />
                    <a className="btn btn-ghost btn-lg" href="#zephyr" onClick={e => goToSection(e, '#zephyr')}>Explore Zephyr →</a>
                </div>
            </div>

            <div className="hero-scroll-hint" aria-hidden="true">
                <span />
            </div>
        </header>
    );
}
