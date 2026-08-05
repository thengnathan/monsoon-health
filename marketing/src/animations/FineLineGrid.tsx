// FineLineGrid — hairline graph-paper backdrop with a cursor spotlight.
// The grid rests almost invisible; a soft radial spotlight (following the
// pointer, or drifting on its own before first interaction) brightens the
// lines and marks nearby intersections with fine + ticks. Engineering-paper
// aesthetic — the deliberate opposite of a dot pattern.

import { useEffect, useRef } from 'react';

export interface FineLineGridProps {
    /** Grid cell size in px */
    cellSize?: number;
    /** Every Nth line is a slightly stronger "major" line (graph paper) */
    majorEvery?: number;
    /** Base line color (barely visible at rest) */
    lineColor?: string;
    /** Spotlight-brightened line color */
    highlightColor?: string;
    /** Spotlight radius in px */
    spotlightRadius?: number;
    /** 0–1 — how strongly the spotlight brightens lines */
    spotlightStrength?: number;
    className?: string;
    style?: React.CSSProperties;
}

export function FineLineGrid({
    cellSize = 56,
    majorEvery = 4,
    lineColor = 'rgba(41, 128, 185, 0.08)',
    highlightColor = 'rgba(41, 128, 185, 0.45)',
    spotlightRadius = 280,
    spotlightStrength = 1,
    className,
    style,
}: FineLineGridProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        let width = 0, height = 0;
        let raf = 0;
        let running = true;
        let hasPointer = false;
        const mouse = { x: 0, y: 0 };
        const spot = { x: 0, y: 0 };

        const resize = () => {
            const rect = canvas.parentElement?.getBoundingClientRect();
            width = rect?.width ?? window.innerWidth;
            height = rect?.height ?? window.innerHeight;
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            if (!hasPointer) { spot.x = width * 0.5; spot.y = height * 0.4; }
        };

        const onPointerMove = (e: PointerEvent) => {
            const rect = canvas.getBoundingClientRect();
            mouse.x = e.clientX - rect.left;
            mouse.y = e.clientY - rect.top;
            hasPointer = true;
        };

        const drawGrid = (stroke: string | CanvasGradient) => {
            ctx.strokeStyle = stroke;
            ctx.beginPath();
            for (let x = 0.5; x <= width + 1; x += cellSize) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
            }
            for (let y = 0.5; y <= height + 1; y += cellSize) {
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
            }
            ctx.stroke();
        };

        const drawMajors = (stroke: string | CanvasGradient) => {
            const step = cellSize * majorEvery;
            ctx.strokeStyle = stroke;
            ctx.beginPath();
            for (let x = 0.5; x <= width + 1; x += step) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
            }
            for (let y = 0.5; y <= height + 1; y += step) {
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
            }
            ctx.stroke();
        };

        const draw = (now: number) => {
            const t = now / 1000;
            ctx.clearRect(0, 0, width, height);
            ctx.lineWidth = 1;

            // Before first interaction the spotlight drifts on a slow lissajous
            // path, so the page feels alive on load.
            const target = hasPointer
                ? mouse
                : {
                    x: width * (0.5 + 0.28 * Math.sin(t * 0.23)),
                    y: height * (0.42 + 0.2 * Math.sin(t * 0.31 + 1.7)),
                };
            spot.x += (target.x - spot.x) * 0.1;
            spot.y += (target.y - spot.y) * 0.1;

            // Pass 1 — resting grid (hairlines + slightly stronger majors)
            drawGrid(lineColor);
            drawMajors(lineColor);

            if (!reduced && spotlightStrength > 0) {
                // Pass 2 — the same grid drawn through a radial spotlight falloff
                const g = ctx.createRadialGradient(spot.x, spot.y, 0, spot.x, spot.y, spotlightRadius);
                g.addColorStop(0, highlightColor);
                g.addColorStop(1, 'rgba(0,0,0,0)');
                drawGrid(g);
                drawMajors(g);

                // Fine + ticks on intersections near the spotlight center
                const tick = 3;
                ctx.strokeStyle = highlightColor;
                ctx.beginPath();
                const x0 = Math.max(0, Math.floor((spot.x - spotlightRadius * 0.6) / cellSize) * cellSize);
                const y0 = Math.max(0, Math.floor((spot.y - spotlightRadius * 0.6) / cellSize) * cellSize);
                for (let x = x0 + 0.5; x <= Math.min(width, spot.x + spotlightRadius * 0.6); x += cellSize) {
                    for (let y = y0 + 0.5; y <= Math.min(height, spot.y + spotlightRadius * 0.6); y += cellSize) {
                        const d = Math.hypot(x - spot.x, y - spot.y);
                        if (d < spotlightRadius * 0.55) {
                            ctx.moveTo(x - tick, y); ctx.lineTo(x + tick, y);
                            ctx.moveTo(x, y - tick); ctx.lineTo(x, y + tick);
                        }
                    }
                }
                ctx.stroke();
            }

            if (running && !reduced) raf = requestAnimationFrame(draw);
        };

        resize();
        window.addEventListener('resize', resize);
        canvas.parentElement?.addEventListener('pointermove', onPointerMove);

        const io = new IntersectionObserver(([entry]) => {
            running = entry.isIntersecting;
            cancelAnimationFrame(raf);
            if (running) raf = requestAnimationFrame(draw);
        });
        io.observe(canvas);

        raf = requestAnimationFrame(draw); // reduced-motion renders one static frame

        return () => {
            running = false;
            cancelAnimationFrame(raf);
            io.disconnect();
            window.removeEventListener('resize', resize);
            canvas.parentElement?.removeEventListener('pointermove', onPointerMove);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className={className}
            style={{ position: 'absolute', inset: 0, display: 'block', ...style }}
            aria-hidden="true"
        />
    );
}
