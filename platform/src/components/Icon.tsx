// Custom SVG icon set — Lucide-style stroke icons, no dependency. Replaces all
// emoji and unicode glyphs across the app so icons render identically on every
// OS and match the sidebar nav icons (NavIcons.tsx) and the design system's
// stroke weight. Inherit color via currentColor.

import type { ReactNode, CSSProperties } from 'react';

const PATHS: Record<string, ReactNode> = {
    // Documents & data
    clipboard: (
        <>
            <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <path d="M12 11h4" />
            <path d="M12 16h4" />
            <path d="M8 11h.01" />
            <path d="M8 16h.01" />
        </>
    ),
    file: (
        <>
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
            <path d="M14 2v4a2 2 0 0 0 2 2h4" />
            <path d="M10 9H8" />
            <path d="M16 13H8" />
            <path d="M16 17H8" />
        </>
    ),
    chart: (
        <>
            <line x1="12" x2="12" y1="20" y2="10" />
            <line x1="18" x2="18" y1="20" y2="4" />
            <line x1="6" x2="6" y1="20" y2="16" />
        </>
    ),
    calendar: (
        <>
            <path d="M8 2v4" />
            <path d="M16 2v4" />
            <rect width="18" height="18" x="3" y="4" rx="2" />
            <path d="M3 10h18" />
        </>
    ),
    // Status & actions
    bolt: <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />,
    check: <path d="M20 6 9 17l-5-5" />,
    x: (
        <>
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
        </>
    ),
    'check-circle': (
        <>
            <path d="M21.801 10A10 10 0 1 1 17 3.335" />
            <path d="m9 11 3 3L22 4" />
        </>
    ),
    'x-circle': (
        <>
            <circle cx="12" cy="12" r="10" />
            <path d="m15 9-6 6" />
            <path d="m9 9 6 6" />
        </>
    ),
    refresh: (
        <>
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
        </>
    ),
    alert: (
        <>
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
        </>
    ),
    lock: (
        <>
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </>
    ),
    link: (
        <>
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </>
    ),
    // Arrows & chevrons
    'arrow-right': (
        <>
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
        </>
    ),
    'arrow-left': (
        <>
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
        </>
    ),
    'arrow-up': (
        <>
            <path d="m5 12 7-7 7 7" />
            <path d="M12 19V5" />
        </>
    ),
    'chevron-down': <path d="m6 9 6 6 6-6" />,
    'chevron-up': <path d="m18 15-6-6-6 6" />,
    'chevron-right': <path d="m9 18 6-6-6-6" />,
    'move-horizontal': (
        <>
            <path d="m18 8 4 4-4 4" />
            <path d="M2 12h20" />
            <path d="m6 8-4 4 4 4" />
        </>
    ),
    'external-link': (
        <>
            <path d="M15 3h6v6" />
            <path d="M10 14 21 3" />
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        </>
    ),
    // Shapes & misc
    circle: <circle cx="12" cy="12" r="9" />,
    dot: <circle cx="12" cy="12" r="6" fill="currentColor" stroke="none" />,
    target: (
        <>
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" />
        </>
    ),
    diamond: <path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41L13.41 2.7a2.41 2.41 0 0 0-3.41 0Z" />,
    menu: (
        <>
            <line x1="4" x2="20" y1="12" y2="12" />
            <line x1="4" x2="20" y1="6" y2="6" />
            <line x1="4" x2="20" y1="18" y2="18" />
        </>
    ),
    command: <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />,
    search: (
        <>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
        </>
    ),
    minus: <path d="M5 12h14" />,
};

export type IconName = keyof typeof PATHS;

interface IconProps {
    name: IconName | string;
    size?: number;
    strokeWidth?: number;
    className?: string;
    style?: CSSProperties;
}

export function Icon({ name, size = 16, strokeWidth = 2, className, style }: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            style={style}
            aria-hidden="true"
        >
            {PATHS[name] ?? null}
        </svg>
    );
}
