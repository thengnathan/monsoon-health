// Nav — split pills, full-bleed:
//   [ ◈ monsoon ]        ( Zephyr · Rainfall · About )        [ Schedule a demo ]
//   brand at far-left edge      links pill dead-center      CTA at far-right edge
// Three independent liquid-glass pieces hugging the viewport edges —
// no connecting bar, so there's no empty tray between them.

import { useEffect, useState } from 'react';
import DemoCTA from './DemoCTA';
import { goToSection } from '../scroll';

const LINKS = [
    { label: 'Zephyr', href: '#zephyr' },
    { label: 'Tidal', href: '#tidal' },
    { label: 'About', href: '#about' },
];

export default function Nav() {
    const [open, setOpen] = useState(false);
    // Mobile: hide on scroll-down, reveal on scroll-up — frees vertical space
    // in the pinned chapters and stops headings scrolling through the pills.
    // (CSS only acts on .nav-hidden under 760px; desktop nav never moves.)
    const [hidden, setHidden] = useState(false);
    useEffect(() => {
        let last = window.scrollY;
        const onScroll = () => {
            const y = window.scrollY;
            if (y < 90) setHidden(false);
            else if (y > last + 4) setHidden(true);
            else if (y < last - 4) setHidden(false);
            last = y;
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <>
            <div className={`nav-split${hidden && !open ? ' nav-hidden' : ''}`}>
                <a href="/" className="nav-pill nav-pill-brand" aria-label="Monsoon Health">
                    <img src="/images/monsoon-braid-wordmark.svg" alt="Monsoon Health" />
                </a>

                <div className="nav-pill nav-pill-links">
                    {LINKS.map(l => (
                        <a key={l.label} href={l.href} className="nav-link" onClick={e => goToSection(e, l.href)}>{l.label}</a>
                    ))}
                </div>

                <DemoCTA layoutId="demo-cta-nav" triggerClassName="nav-split-cta" labelClassName="demo-cta-label-nav" />

                <button
                    className={`nav-burger ${open ? 'nav-burger-open' : ''}`}
                    onClick={() => setOpen(o => !o)}
                    aria-label="Menu"
                    aria-expanded={open}
                >
                    <span /><span />
                </button>
            </div>

            {/* Mobile sheet */}
            {open && (
                <div className="nav-sheet" onClick={() => setOpen(false)}>
                    {LINKS.map(l => (
                        <a key={l.label} href={l.href} className="nav-sheet-link" onClick={e => { goToSection(e, l.href); setOpen(false); }}>{l.label}</a>
                    ))}
                    {/* stopPropagation: closing the sheet would unmount the
                        DemoCTA (and its portaled card) mid-morph */}
                    <div className="nav-sheet-cta" onClick={e => e.stopPropagation()}>
                        <DemoCTA layoutId="demo-cta-sheet" />
                    </div>
                </div>
            )}
        </>
    );
}
