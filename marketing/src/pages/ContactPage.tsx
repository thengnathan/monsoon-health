import { useState, useRef } from 'react';

type DropdownKey = 'products' | 'company' | null;
import '../landing.css';

export default function ContactPage() {
    const [openDropdown, setOpenDropdown] = useState<DropdownKey>(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [form, setForm] = useState({ name: '', email: '', org: '', message: '' });
    const [submitted, setSubmitted] = useState(false);

    const openMenu = (key: DropdownKey) => {
        if (closeTimer.current) clearTimeout(closeTimer.current);
        setOpenDropdown(key);
    };

    const scheduleClose = () => {
        closeTimer.current = setTimeout(() => setOpenDropdown(null), 150);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name || !form.email) return;
        try {
            const res = await fetch('http://localhost:3001/api/email/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            if (res.ok) setSubmitted(true);
        } catch (err) {
            console.error('Contact form error:', err);
        }
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

            {/* ── Hero + Form ── */}
            <section className="contact-hero">
                <img className="contact-hero-img" src="/images/Contact_Us Page.png" alt="Contact Monsoon Health" />
                <div className="contact-hero-fade" />

                <div className="contact-hero-content">
                    <div className="contact-left">
                        <h1 className="contact-title">Let's Talk</h1>
                        <p className="contact-subtitle">See how Monsoon Health can transform your clinical trial operations. Schedule a demo or reach out. We'd love to connect.</p>
                    </div>

                    <div className="contact-form-card">
                        {submitted ? (
                            <div className="contact-success">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40">
                                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <h3>We'll be in touch soon.</h3>
                                <p style={{ color: '#ffffff' }}>Thanks for reaching out — our team will contact you within three business days.</p>
                            </div>
                        ) : (
                            <form className="contact-form" onSubmit={handleSubmit}>
                                <h2 className="contact-form-title">Schedule a Demo</h2>
                                <div className="contact-form-row">
                                    <div className="contact-form-group">
                                        <label className="contact-form-label">Name</label>
                                        <input
                                            className="contact-form-input"
                                            type="text"
                                            name="name"
                                            placeholder="Jane Smith"
                                            value={form.name}
                                            onChange={handleChange}
                                            required
                                        />
                                    </div>
                                    <div className="contact-form-group">
                                        <label className="contact-form-label">Email</label>
                                        <input
                                            className="contact-form-input"
                                            type="email"
                                            name="email"
                                            placeholder="jane@site.com"
                                            value={form.email}
                                            onChange={handleChange}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="contact-form-group">
                                    <label className="contact-form-label">Organization</label>
                                    <input
                                        className="contact-form-input"
                                        type="text"
                                        name="org"
                                        placeholder="Research site, CRO, or Sponsor"
                                        value={form.org}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="contact-form-group">
                                    <label className="contact-form-label">Message</label>
                                    <textarea
                                        className="contact-form-input contact-form-textarea"
                                        name="message"
                                        placeholder="Tell us about your trials and what you're looking for..."
                                        value={form.message}
                                        onChange={handleChange}
                                        rows={4}
                                    />
                                </div>
                                <button className="landing-btn-primary contact-form-submit" type="submit">
                                    Send Message
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}
