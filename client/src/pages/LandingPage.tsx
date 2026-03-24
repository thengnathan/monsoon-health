import { useState, useEffect, useRef } from 'react';
import '../landing.css';

type DropdownKey = 'products' | 'company' | null;

export default function LandingPage() {
    const phrases = [
        'The Operating System for Clinical Trials',
        'An AI-native Unified Platform for Sites, CROs, and Sponsors',
    ];
    const [displayText, setDisplayText] = useState('');
    const showCursor = true;

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
        let cancelled = false;

        const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

        const typeText = async (text: string) => {
            for (let i = 0; i <= text.length; i++) {
                if (cancelled) return;
                setDisplayText(text.slice(0, i));
                await delay(55);
            }
        };

        const backspaceText = async (text: string) => {
            for (let i = text.length; i >= 0; i--) {
                if (cancelled) return;
                setDisplayText(text.slice(0, i));
                await delay(35);
            }
        };

        const runAnimation = async () => {
            while (!cancelled) {
                for (const phrase of phrases) {
                    if (cancelled) return;
                    await typeText(phrase);
                    await delay(2500);
                    if (cancelled) return;
                    await backspaceText(phrase);
                    await delay(400);
                }
            }
        };

        runAnimation();
        return () => { cancelled = true; };
    }, []);

    return (
        <div className="landing-page">
            {/* ── Navbar ── */}
            <nav className="landing-nav">
                <div className="landing-nav-brand">
                    <svg className="landing-nav-logo" viewBox="0 0 32 32" fill="none">
                        <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" />
                        <path d="M16 6 C16 6, 10 16, 10 20 C10 23.3 12.7 26 16 26 C19.3 26 22 23.3 22 20 C22 16 16 6 16 6Z" fill="currentColor" opacity="0.7" />
                        <path d="M16 10 C16 10, 12 17, 12 19.5 C12 22 13.8 24 16 24 C18.2 24 20 22 20 19.5 C20 17 16 10 16 10Z" fill="currentColor" opacity="0.4" />
                    </svg>
                    <span>Monsoon Health</span>
                </div>

                <div className="landing-nav-center">
                    <div
                        className="landing-nav-dropdown"
                        onMouseEnter={() => openMenu('products')}
                        onMouseLeave={scheduleClose}
                    >
                        <button className={`landing-nav-link ${openDropdown === 'products' ? 'active' : ''}`}>
                            Products
                        </button>
                        <div
                            className={`landing-dropdown-menu ${openDropdown === 'products' ? 'open' : ''}`}
                            onMouseEnter={() => openMenu('products')}
                            onMouseLeave={scheduleClose}
                        >
                            <div className="landing-dropdown-col">
                                <span className="landing-dropdown-col-header">Product</span>
                                <div className="landing-dropdown-item">
                                    <span className="landing-dropdown-name">Zephyr</span>
                                    <span className="landing-dropdown-desc">Clinical Site Patient Tracker</span>
                                </div>
                                <div className="landing-dropdown-item">
                                    <span className="landing-dropdown-name">Rainfall</span>
                                    <span className="landing-dropdown-desc">Agentic EDC</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div
                        className="landing-nav-dropdown"
                        onMouseEnter={() => openMenu('company')}
                        onMouseLeave={scheduleClose}
                    >
                        <button className={`landing-nav-link ${openDropdown === 'company' ? 'active' : ''}`}>
                            Company
                        </button>
                        <div
                            className={`landing-dropdown-menu ${openDropdown === 'company' ? 'open' : ''}`}
                            onMouseEnter={() => openMenu('company')}
                            onMouseLeave={scheduleClose}
                        >
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
            <section className="landing-hero" id="hero">
                <div className="landing-hero-bg">
                    <video
                        className="landing-hero-video"
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload="auto"
                    >
                        <source src="/images/waves-clouds-bg.mp4" type="video/mp4" />
                    </video>
                    <div className="landing-hero-overlay" />
                </div>

                <div className="landing-hero-content">
                    <h1 className="glitch" data-text="Monsoon Health">
                        <span className="glitch-text">Monsoon Health</span>
                    </h1>
                    <p className="landing-hero-sub">
                        {displayText}
                        <span className={`typing-cursor ${showCursor ? '' : 'typing-cursor-hidden'}`}>|</span>
                    </p>
                    <div className="landing-hero-actions">
                        <button className="landing-btn-primary">
                            Get Started
                        </button>
                    </div>
                </div>
            </section>

        </div>
    );
}
