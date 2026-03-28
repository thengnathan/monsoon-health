import { useState, useEffect, useRef } from 'react';

type DropdownKey = 'products' | 'company' | null;
import '../landing.css';

export default function ZephyrPage() {
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
                <img className="product-hero-img" src="/images/Zephyr_Background.png" alt="Zephyr" />
                <div className="product-hero-fade product-hero-fade-full" />
                <div className={`scroll-indicator ${scrolled ? 'scroll-indicator-hidden' : ''}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M6 9l6 6 6-6" />
                    </svg>
                </div>
                <div className="product-hero-center">
                    <h1 className="product-hero-title">Zephyr</h1>
                    <p className="product-hero-sub">Clinical Site Patient Tracker</p>
                    <span className="product-coming-soon-badge">Coming Soon</span>
                </div>
            </section>

            {/* ── Feature Section ── */}
            <section className="zephyr-features-section scroll-animate scroll-fade-up">
                <div className="zephyr-features-header">
                    <p className="zephyr-features-kicker">Designed around how coordinators actually work, not how regulators wish they did.</p>
                    <h2 className="zephyr-features-headline">Every patient, every site, always in view</h2>
                    <p className="zephyr-features-desc">
                        Zephyr gives clinical research coordinators a single, real-time view of every patient across every active trial. From screening through follow-up, nothing slips through the cracks — visit schedules, protocol deviations, and outstanding tasks surface automatically.
                    </p>
                </div>
                <div className="zephyr-feature-cards">
                    <div className="zephyr-feature-card">
                        <div className="zephyr-feature-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                        <span className="zephyr-feature-title">Real-Time Tracking</span>
                        <p className="zephyr-feature-desc">Live status on every enrolled patient across all active protocols. No spreadsheets, no lag.</p>
                    </div>
                    <div className="zephyr-feature-card">
                        <div className="zephyr-feature-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <span className="zephyr-feature-title">Visit Management</span>
                        <p className="zephyr-feature-desc">Automated visit scheduling, reminders, and compliance flags so nothing falls through.</p>
                    </div>
                    <div className="zephyr-feature-card">
                        <div className="zephyr-feature-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                        <span className="zephyr-feature-title">Site-Ready</span>
                        <p className="zephyr-feature-desc">Built for how sites actually operate — not retrofitted from a sponsor or CRO tool.</p>
                    </div>
                </div>
            </section>

            {/* ── CTA ── */}
            <section className="zephyr-cta-section scroll-animate scroll-fade-up">
                <h2 className="zephyr-cta-headline">Request Early Access</h2>
                <p className="zephyr-cta-sub">Zephyr is currently in development. Join the waitlist and be first to know when we launch.</p>
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
