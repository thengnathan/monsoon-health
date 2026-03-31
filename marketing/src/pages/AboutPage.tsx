import { useState, useEffect, useRef } from 'react';

type DropdownKey = 'products' | 'company' | null;
import '../landing.css';

export default function AboutPage() {
    const [scrolled, setScrolled] = useState(false);
    const [openDropdown, setOpenDropdown] = useState<DropdownKey>(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
            { threshold: 0.15 }
        );

        document.querySelectorAll('.scroll-animate').forEach((el) => observer.observe(el));
        return () => observer.disconnect();
    }, []);

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
                    <button className="landing-nav-cta landing-nav-cta-desktop" onClick={() => window.location.href = '/contact'}>Schedule a Demo</button>
                    <button className="landing-nav-hamburger" onClick={() => setMobileMenuOpen(o => !o)} aria-label="Menu">
                        <span className={`hamburger-bar ${mobileMenuOpen ? 'open' : ''}`} />
                        <span className={`hamburger-bar ${mobileMenuOpen ? 'open' : ''}`} />
                        <span className={`hamburger-bar ${mobileMenuOpen ? 'open' : ''}`} />
                    </button>
                </div>
            </nav>

            {/* Mobile Menu Drawer */}
            {mobileMenuOpen && (
                <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}>
                    <div className="mobile-menu" onClick={e => e.stopPropagation()}>
                        <div className="mobile-menu-section">
                            <div className="mobile-menu-label">Products</div>
                            <a className="mobile-menu-item" href="/products/zephyr">
                                <span className="mobile-menu-item-name">Zephyr</span>
                                <span className="mobile-menu-item-desc">Clinical Research Patient Monitoring</span>
                            </a>
                            <a className="mobile-menu-item" href="/products/rainfall">
                                <span className="mobile-menu-item-name">Rainfall</span>
                                <span className="mobile-menu-item-desc">Agentic EDC</span>
                            </a>
                        </div>
                        <div className="mobile-menu-section">
                            <div className="mobile-menu-label">Company</div>
                            <a className="mobile-menu-item" href="/about">
                                <span className="mobile-menu-item-name">About</span>
                                <span className="mobile-menu-item-desc">Our mission and team</span>
                            </a>
                        </div>
                        <button className="landing-btn-primary mobile-menu-cta" onClick={() => window.location.href = '/contact'}>
                            Schedule a Demo
                        </button>
                    </div>
                </div>
            )}

            {/* ── About Hero ── */}
            <section className="about-hero">
                <img
                    className="about-hero-img"
                    src="/images/Company_Background.png"
                    alt="Monsoon Health team"
                />
                <div className="about-hero-fade" />
                <div className="about-hero-people-text">
                    <h1 className="product-hero-title">Born in the Research Site</h1>
                    <p className="product-hero-sub">Former clinical research coordinators building what they once needed</p>
                </div>
                <div className={`scroll-indicator ${scrolled ? 'scroll-indicator-hidden' : ''}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M6 9l6 6 6-6" />
                    </svg>
                </div>
            </section>

            {/* ── Editorial Block ── */}
            <section className="about-editorial">
                <h2 className="editorial-headline scroll-animate scroll-fade-up">
                    Clinical trials still lose patients to paperwork
                </h2>
                <div className="editorial-body scroll-animate scroll-fade-up" style={{ transitionDelay: '0.1s' }}>
                    <p>Every year, 80% of clinical trials fail to meet enrollment deadlines. Sites drown in spreadsheets, fax machines, and disconnected systems. Patients who need experimental treatments the most, those in rural and underserved communities, fall through the cracks before screening even begins.</p>
                    <p>The problem is structural. Clinical research sites run on fragmented workflows built for a different era. Coordinators spend more time on data entry than on patient care. The result are slower trials, higher costs, and entire populations left out of medical progress.</p>
                </div>
                <div className="editorial-mission scroll-animate scroll-fade-up" style={{ transitionDelay: '0.2s' }}>
                    <p>Monsoon Health exists to fix clinical trial operations from the ground up. We believe trial access is a systems problem, not a patient problem. Our platform handles compliant screening, onboarding, and lifecycle management for research sites, CROs, and Sponsors, so clinical research teams spend their time where it matters, with patients.</p>
                </div>
                <p className="editorial-tagline scroll-animate scroll-fade-up" style={{ transitionDelay: '0.3s' }}>
                    Trial infrastructure is mission-critical,<br />but shouldn't consume your site's bandwidth. That's why it's ours.
                </p>
            </section>

            {/* ── Divider ── */}
            <div className="landing-divider" style={{ marginTop: '0', marginBottom: '4rem' }} />

            {/* ── Team Section ── */}
            <section className="landing-team">
                <h2 className="team-heading scroll-animate scroll-fade-up">Our Team</h2>
                <p className="team-subtitle scroll-animate scroll-fade-up" style={{ transitionDelay: '0.1s' }}>Ashman, Nathan, and Amin met while working together as clinical research coordinators on hepatology and liver cirrhosis clinical trials, where they developed deep expertise in clinical operations and health technology. Together, they bring strong experience at the intersection of research execution and digital health innovation.</p>
                <div className="team-cards">
                    {/* Founder 1 */}
                    <div className="founder-card scroll-animate scroll-fade-up" style={{ transitionDelay: '0s' }}>
                        <div className="founder-card-top">
                            <img className="founder-photo" src="/images/Ashman.png" alt="Ashman Dosanjh" />
                        </div>
                        <div className="founder-card-info">
                            <p className="founder-name">Ashman Dosanjh</p>
                            <p className="founder-title">Co-Founder</p>
                        </div>
                    </div>

                    {/* Founder 2 */}
                    <div className="founder-card scroll-animate scroll-fade-up" style={{ transitionDelay: '0.15s' }}>
                        <div className="founder-card-top">
                            <img className="founder-photo" src="/images/Nathan.png" alt="Nathan Theng" />
                        </div>
                        <div className="founder-card-info">
                            <p className="founder-name">Nathan Theng</p>
                            <p className="founder-title">Co-Founder</p>
                        </div>
                    </div>

                    {/* Founder 3 */}
                    <div className="founder-card scroll-animate scroll-fade-up" style={{ transitionDelay: '0.3s' }}>
                        <div className="founder-card-top">
                            <img className="founder-photo" src="/images/Amin.png" alt="Amin Joseph" />
                        </div>
                        <div className="founder-card-info">
                            <p className="founder-name">Amin Joseph</p>
                            <p className="founder-title">Co-Founder</p>
                        </div>
                    </div>
                </div>
            </section>


        </div>
    );
}
