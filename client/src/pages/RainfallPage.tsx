import { useState, useEffect, useRef } from 'react';

type DropdownKey = 'products' | 'company' | null;
import '../landing.css';

export default function RainfallPage() {
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [openDropdown, setOpenDropdown] = useState<DropdownKey>(null);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const openMenu = (key: DropdownKey) => {
        if (closeTimer.current) clearTimeout(closeTimer.current);
        setOpenDropdown(key);
    };

    const scheduleClose = () => {
        closeTimer.current = setTimeout(() => setOpenDropdown(null), 150);
    };

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 60);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('scroll-visible');
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.12 }
        );

        document.querySelectorAll('.scroll-animate').forEach((el) => observer.observe(el));
        return () => observer.disconnect();
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (email) setSubmitted(true);
    };

    return (
        <div className="landing-page">
            {/* ── Navbar ── */}
            <nav className="landing-nav">
                <a href="/landing" className="landing-nav-brand" style={{ textDecoration: 'none' }}>
                    <img src="/images/monsoon-braid-wordmark-white.svg" className="landing-nav-wordmark" alt="Monsoon Health" />
                </a>
                <div className="landing-nav-center">
                    <div className="landing-nav-dropdown" onMouseEnter={() => openMenu('products')} onMouseLeave={scheduleClose}>
                        <button className={`landing-nav-link ${openDropdown === 'products' ? 'active' : ''}`}>Products</button>
                        <div className={`landing-dropdown-menu ${openDropdown === 'products' ? 'open' : ''}`} onMouseEnter={() => openMenu('products')} onMouseLeave={scheduleClose}>
                            <div className="landing-dropdown-col">
                                <span className="landing-dropdown-col-header">Products</span>
                                <div className="landing-dropdown-item" onClick={() => window.location.href = '/products/zephyr'}>
                                    <span className="landing-dropdown-name">Zephyr</span>
                                    <span className="landing-dropdown-desc">Clinical Site Patient Tracker</span>
                                    <span className="landing-dropdown-coming-soon">Coming Soon</span>
                                </div>
                                <div className="landing-dropdown-item" onClick={() => window.location.href = '/products/rainfall'}>
                                    <span className="landing-dropdown-name">Rainfall</span>
                                    <span className="landing-dropdown-desc">Agentic EDC</span>
                                    <span className="landing-dropdown-coming-soon">Coming Soon</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="landing-nav-dropdown" onMouseEnter={() => openMenu('company')} onMouseLeave={scheduleClose}>
                        <button className={`landing-nav-link ${openDropdown === 'company' ? 'active' : ''}`}>Company</button>
                        <div className={`landing-dropdown-menu ${openDropdown === 'company' ? 'open' : ''}`} onMouseEnter={() => openMenu('company')} onMouseLeave={scheduleClose}>
                            <div className="landing-dropdown-col">
                                <a href="/about" className="landing-dropdown-item" style={{ textDecoration: 'none' }}>
                                    <span className="landing-dropdown-name">About</span>
                                    <span className="landing-dropdown-desc">Our mission and team</span>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="landing-nav-links">
                    <button className="landing-nav-cta">Schedule a Demo</button>
                </div>
            </nav>

            {/* ── Hero ── */}
            <section className="product-hero product-hero-full">
                <img className="product-hero-img" src="/images/Rainfall_Background.png" alt="Rainfall" />
                <div className="product-hero-fade product-hero-fade-full" />
                <div className={`scroll-indicator ${scrolled ? 'scroll-indicator-hidden' : ''}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M6 9l6 6 6-6" />
                    </svg>
                </div>
                <div className="product-hero-center">
                    <h1 className="product-hero-title">Rainfall</h1>
                    <p className="product-hero-sub">Agentic EDC</p>
                    <span className="product-coming-soon-badge">Coming Soon</span>
                </div>
            </section>

            {/* ── Feature Section ── */}
            <section className="zephyr-features-section scroll-animate scroll-fade-up">
                <div className="zephyr-features-header">
                    <p className="zephyr-features-kicker">Clean data from day one means database lock in days, not months.</p>
                    <h2 className="zephyr-features-headline">Data capture that works as fast as your team</h2>
                    <p className="zephyr-features-desc">
                        Rainfall is an agentic electronic data capture system that dramatically reduces the manual burden of clinical data entry. AI agents review, validate, and reconcile data in real time — before it becomes a query — so sponsors get to submission faster.
                    </p>
                </div>
                <div className="zephyr-feature-cards">
                    <div className="zephyr-feature-card">
                        <div className="zephyr-feature-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <span className="zephyr-feature-title">Agentic Validation</span>
                        <p className="zephyr-feature-desc">AI agents catch discrepancies and resolve queries before they accumulate.</p>
                    </div>
                    <div className="zephyr-feature-card">
                        <div className="zephyr-feature-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <span className="zephyr-feature-title">Source-to-EDC</span>
                        <p className="zephyr-feature-desc">Direct integration from source records eliminates manual transcription entirely.</p>
                    </div>
                    <div className="zephyr-feature-card">
                        <div className="zephyr-feature-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <span className="zephyr-feature-title">Faster Lock</span>
                        <p className="zephyr-feature-desc">Clean data from day one means database lock in days, not months.</p>
                    </div>
                </div>
            </section>

            {/* ── CTA ── */}
            <section className="zephyr-cta-section scroll-animate scroll-fade-up">
                <h2 className="zephyr-cta-headline">Request Early Access</h2>
                <p className="zephyr-cta-sub">Rainfall is currently in development. Join the waitlist and be first to know when we launch.</p>
                {submitted ? (
                    <p className="zephyr-cta-confirm">You're on the list — we'll be in touch.</p>
                ) : (
                    <form className="zephyr-cta-form" onSubmit={handleSubmit}>
                        <input
                            className="zephyr-cta-input"
                            type="email"
                            placeholder="your@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                        <button className="landing-btn-primary" type="submit">Join Waitlist</button>
                    </form>
                )}
            </section>

        </div>
    );
}
