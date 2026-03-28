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
                    <img src="/images/monsoon-braid-wordmark-white.svg" className="landing-nav-wordmark" alt="Monsoon Health" />
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
                                <span className="landing-dropdown-col-header">Products</span>
                                <div className="landing-dropdown-item">
                                    <span className="landing-dropdown-name">Zephyr</span>
                                    <span className="landing-dropdown-desc">Clinical Site Patient Tracker</span>
                                    <span className="landing-dropdown-coming-soon">Coming Soon</span>
                                </div>
                                <div className="landing-dropdown-item">
                                    <span className="landing-dropdown-name">Rainfall</span>
                                    <span className="landing-dropdown-desc">Agentic EDC</span>
                                    <span className="landing-dropdown-coming-soon">Coming Soon</span>
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
                    <div className="macos-window">
                        <div className="macos-window-titlebar">
                            <span className="macos-dot macos-dot-red" />
                            <span className="macos-dot macos-dot-yellow" />
                            <span className="macos-dot macos-dot-green" />
                        </div>
                        <div className="macos-window-body">
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
                    </div>
                </div>
            </section>

        </div>
    );
}
