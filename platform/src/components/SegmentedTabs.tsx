// Premium segmented-control tab bar — a rounded container where the active tab
// is a raised, shadowed segment. Reused across Settings and detail pages so all
// section navigation looks consistent. Generic over the tab key type.

import type { CSSProperties } from 'react';

interface SegmentedTabsProps<T extends string> {
    tabs: { key: T; label: string }[];
    active: T;
    onChange: (key: T) => void;
    style?: CSSProperties;
}

export function SegmentedTabs<T extends string>({ tabs, active, onChange, style }: SegmentedTabsProps<T>) {
    return (
        <div className="segmented" role="tablist" style={style}>
            {tabs.map(t => (
                <button
                    key={t.key}
                    role="tab"
                    aria-selected={active === t.key}
                    className={`segmented-item ${active === t.key ? 'active' : ''}`}
                    onClick={() => onChange(t.key)}
                >
                    {t.label}
                </button>
            ))}
        </div>
    );
}
