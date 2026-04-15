import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface SelectOption {
    value: string;
    label: string;
    disabled?: boolean;
}

interface SelectProps {
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    className?: string;
    style?: React.CSSProperties;
}

export function Select({ value, onChange, options, placeholder = 'Select…', disabled, className, style }: SelectProps) {
    const [open, setOpen] = useState(false);
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
    const triggerRef = useRef<HTMLButtonElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(o => o.value === value);

    const openDropdown = useCallback(() => {
        if (disabled) return;
        const rect = triggerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const spaceBelow = window.innerHeight - rect.bottom;
        const dropUp = spaceBelow < 220 && rect.top > 220;

        setDropdownStyle({
            position: 'fixed',
            left: rect.left,
            width: rect.width,
            zIndex: 99999,
            ...(dropUp
                ? { bottom: window.innerHeight - rect.top + 4 }
                : { top: rect.bottom + 4 }),
        });
        setOpen(true);
    }, [disabled]);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (
                !triggerRef.current?.contains(e.target as Node) &&
                !listRef.current?.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // Close on Escape, scroll (but not when scrolling inside the dropdown itself)
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        const onScroll = (e: Event) => {
            if (listRef.current?.contains(e.target as Node)) return;
            setOpen(false);
        };
        document.addEventListener('keydown', onKey);
        window.addEventListener('scroll', onScroll, true);
        return () => {
            document.removeEventListener('keydown', onKey);
            window.removeEventListener('scroll', onScroll, true);
        };
    }, [open]);

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                className={`custom-select-trigger ${className ?? 'form-input'}`}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    textAlign: 'left',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.5 : 1,
                    userSelect: 'none',
                    ...style,
                }}
                onClick={() => (open ? setOpen(false) : openDropdown())}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <span style={{
                    color: selectedOption ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                }}>
                    {selectedOption?.label ?? placeholder}
                </span>
                <svg
                    width="12" height="12" viewBox="0 0 12 12"
                    fill="none" stroke="currentColor" strokeWidth="1.8"
                    style={{
                        flexShrink: 0,
                        marginLeft: 8,
                        color: 'var(--text-tertiary)',
                        transition: 'transform 0.15s ease',
                        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                >
                    <path d="M2 4.5l4 3.5 4-3.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>

            {open && createPortal(
                <div
                    ref={listRef}
                    role="listbox"
                    style={{
                        ...dropdownStyle,
                        background: 'var(--surface-secondary, var(--bg-surface))',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)',
                        padding: '4px',
                        maxHeight: 240,
                        overflowY: 'auto',
                    }}
                    className="custom-select-dropdown"
                >
                    {options.map(opt => {
                        const isSelected = opt.value === value;
                        return (
                            <div
                                key={opt.value}
                                role="option"
                                aria-selected={isSelected}
                                className="custom-select-option"
                                style={{
                                    padding: '7px 10px',
                                    borderRadius: 'var(--radius-sm)',
                                    cursor: opt.disabled ? 'not-allowed' : 'pointer',
                                    fontSize: 'var(--font-sm)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 8,
                                    color: opt.disabled
                                        ? 'var(--text-tertiary)'
                                        : isSelected
                                            ? 'var(--accent-sea-blue, var(--accent))'
                                            : 'var(--text-primary)',
                                    background: isSelected
                                        ? 'var(--accent-sea-blue-subtle, var(--accent-muted))'
                                        : 'transparent',
                                    opacity: opt.disabled ? 0.5 : 1,
                                }}
                                onMouseEnter={e => {
                                    if (!opt.disabled)
                                        (e.currentTarget as HTMLElement).style.background =
                                            isSelected
                                                ? 'var(--accent-sea-blue-subtle, var(--accent-muted))'
                                                : 'var(--surface-tertiary, var(--bg-surface-hover))';
                                }}
                                onMouseLeave={e => {
                                    (e.currentTarget as HTMLElement).style.background = isSelected
                                        ? 'var(--accent-sea-blue-subtle, var(--accent-muted))'
                                        : 'transparent';
                                }}
                                onMouseDown={e => {
                                    e.preventDefault();
                                    if (!opt.disabled) {
                                        onChange(opt.value);
                                        setOpen(false);
                                    }
                                }}
                            >
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {opt.label}
                                </span>
                                {isSelected && (
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                                        <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                )}
                            </div>
                        );
                    })}
                </div>,
                document.body
            )}
        </>
    );
}
