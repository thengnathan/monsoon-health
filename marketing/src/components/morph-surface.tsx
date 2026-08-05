// cult-ui MorphSurface, landing adaptation — the Tidal chapter's
// "In development" badge morphs into a waitlist email form.
// Patched (Monsoon):
//   1. `cn`/Tailwind removed; styled via msl-* classes on the landing tokens
//   2. Email variant: single email input + "Notify me" (the original's
//      feedback textarea/⌘Enter is the platform's quick-note version)
//   3. Layout-participating expansion: the root animates its own height with
//      the same spring as the surface, so content below is pushed down
//      smoothly — the form never covers existing text
//   4. Same signature moves kept: spring morph, layoutId dot travel,
//      success check flash, click-outside + Esc to close

import React, { useEffect, useRef, useState, type RefObject } from 'react';
import { AnimatePresence, motion } from 'motion/react';

const SPEED = 1;

interface WaitlistSurfaceProps {
    surfaceLabel?: string;
    triggerLabel?: string;
    placeholder?: string;
    submitLabel?: string;
    collapsedWidth?: number;
    collapsedHeight?: number;
    expandedWidth?: number;
    expandedHeight?: number;
    animationSpeed?: number;
    onSubmit?: (email: string) => void | Promise<void>;
}

export function WaitlistSurface({
    surfaceLabel = 'In development',
    triggerLabel = 'Join the waitlist',
    placeholder = 'you@researchsite.com',
    submitLabel = 'Notify me',
    collapsedWidth = 296,
    collapsedHeight = 42,
    expandedWidth = 360,
    expandedHeight = 156,
    animationSpeed = SPEED,
    onSubmit,
}: WaitlistSurfaceProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [open, setOpen] = useState(false);
    const [success, setSuccess] = useState(false);
    const [busy, setBusy] = useState(false);

    const close = () => {
        setOpen(false);
        inputRef.current?.blur();
    };
    const openSurface = () => {
        setOpen(true);
        // Focus after the morph has mostly settled — focusing mid-spring
        // causes a visible hitch
        setTimeout(() => inputRef.current?.focus(), 260);
    };

    useClickOutside(containerRef, close, open);

    // Soft, heavy springs — the surface should breathe open, not snap
    const surfaceSpring = {
        type: 'spring' as const,
        stiffness: 280 / animationSpeed,
        damping: 32,
        mass: 0.85,
        delay: open ? 0 : 0.06,
    };
    const logoSpring = {
        type: 'spring' as const,
        stiffness: 300 / animationSpeed,
        damping: 30,
    };
    const checkSpring = {
        type: 'spring' as const,
        stiffness: 500 / animationSpeed,
        damping: 22,
    };

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (busy) return;
        const email = String(new FormData(e.currentTarget).get('email') ?? '').trim();
        if (!email) return;
        setBusy(true);
        try {
            await onSubmit?.(email);
            close();
            setSuccess(true);
            setTimeout(() => setSuccess(false), 1600);
        } catch (err) {
            console.error('Waitlist submit failed:', err);
        } finally {
            setBusy(false);
        }
    }

    return (
        <motion.div
            className="msl-root"
            style={{ width: collapsedWidth }}
            initial={false}
            animate={{ height: open ? expandedHeight : collapsedHeight }}
            transition={surfaceSpring}
        >
            <motion.div
                ref={containerRef}
                onClick={() => { if (!open) openSurface(); }}
                className={`msl-surface${open ? '' : ' msl-surface-closed'}`}
                initial={false}
                animate={{
                    width: open ? expandedWidth : collapsedWidth,
                    height: open ? expandedHeight : collapsedHeight,
                    borderRadius: open ? 14 : 21,
                }}
                transition={surfaceSpring}
            >
                {/* Dock (collapsed pill row) */}
                <footer className="msl-dock" style={{ height: collapsedHeight }}>
                    <div className="msl-dock-brand">
                        {open ? (
                            <div className="msl-dot-ghost" />
                        ) : (
                            <motion.div className="msl-dot" layoutId="msl-waitlist-dot" transition={logoSpring}>
                                <AnimatePresence>
                                    {success && (
                                        <motion.div
                                            key="check"
                                            initial={{ opacity: 0, scale: 0.5 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.5 }}
                                            transition={{ ...checkSpring, delay: success ? 0.3 : 0 }}
                                            className="msl-dot-check"
                                        >
                                            <IconCheck />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )}
                        <span className="msl-dock-text">{surfaceLabel}</span>
                    </div>
                    <button
                        type="button"
                        className={`msl-trigger${open ? ' msl-trigger-close' : ''}`}
                        onClick={e => { e.stopPropagation(); open ? close() : openSurface(); }}
                        aria-label={open ? 'Close' : triggerLabel}
                    >
                        {open ? 'Close ✕' : success ? 'You’re on the list' : triggerLabel}
                    </button>
                </footer>

                {/* Expanded form */}
                <form
                    onSubmit={handleSubmit}
                    className="msl-form"
                    style={{
                        width: expandedWidth,
                        height: expandedHeight,
                        pointerEvents: open ? 'all' : 'none',
                    }}
                >
                    <AnimatePresence>
                        {open && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, transition: { duration: 0.12 } }}
                                transition={{ delay: 0.16, duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
                                className="msl-content"
                            >
                                <p className="msl-form-label">Be first to know when Tidal launches.</p>
                                <input
                                    ref={inputRef}
                                    className="msl-input"
                                    type="email"
                                    name="email"
                                    placeholder={placeholder}
                                    required
                                    autoComplete="email"
                                    spellCheck={false}
                                    onKeyDown={e => { if (e.key === 'Escape') close(); }}
                                />
                                <button type="submit" className="msl-submit" disabled={busy}>
                                    {busy ? 'Adding…' : submitLabel}
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    {open && (
                        <motion.div
                            layoutId="msl-waitlist-dot"
                            className="msl-dot-mini"
                            transition={logoSpring}
                        />
                    )}
                </form>
            </motion.div>
        </motion.div>
    );
}

function IconCheck() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" color="white">
            <path d="M5 13L9 17L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function useClickOutside<T extends HTMLElement = HTMLElement>(
    ref: RefObject<T | null>,
    handler: (event: MouseEvent | TouchEvent | PointerEvent) => void,
    isOpen: boolean
) {
    useEffect(() => {
        let startedOutsideWhileOpen = false;

        const isOutside = (event: Event) => {
            const el = ref?.current;
            return !!el && !el.contains((event?.target as Node) || null);
        };

        const handlePointerStart = (event: PointerEvent) => {
            startedOutsideWhileOpen = isOpen && isOutside(event);
        };
        const handleClick = (event: MouseEvent) => {
            if (startedOutsideWhileOpen && isOpen && isOutside(event)) handler(event);
            startedOutsideWhileOpen = false;
        };
        const handleTouchEnd = (event: TouchEvent) => {
            if (startedOutsideWhileOpen && isOpen && isOutside(event)) handler(event);
            startedOutsideWhileOpen = false;
        };

        document.addEventListener('pointerdown', handlePointerStart);
        document.addEventListener('click', handleClick);
        document.addEventListener('touchend', handleTouchEnd);
        return () => {
            document.removeEventListener('pointerdown', handlePointerStart);
            document.removeEventListener('click', handleClick);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [ref, handler, isOpen]);
}
