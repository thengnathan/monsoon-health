// Smooth-scroll to an in-page section, shared by the nav tabs and the hero links.

import type { MouseEvent } from 'react';

export function goToSection(e: MouseEvent<HTMLAnchorElement>, href: string) {
    if (!href.startsWith('#')) return;
    e.preventDefault();
    const el = document.getElementById(href.slice(1));
    // getBoundingClientRect + scrollY gives the true document position —
    // offsetTop would be relative to the positioned .products section
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: 'smooth' });
}
