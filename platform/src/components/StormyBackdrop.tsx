import { useEffect, useRef, useState } from "react";

/*
 * Stormy Morning animated wave backdrop.
 * Adapted from Lake Suwa dial backdrop — recolored to Monsoon Health palette.
 * (#384959, #6A89A7, #88BDDF, #BDDDFC)
 */

export default function StormyBackdrop() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animRef = useRef<number | null>(null);
    const [size, setSize] = useState({ w: 0, h: 0 });

    useEffect(() => {
        const resize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
        resize();
        window.addEventListener("resize", resize);
        return () => window.removeEventListener("resize", resize);
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || size.w === 0) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = size.w * dpr;
        canvas.height = size.h * dpr;
        ctx.scale(dpr, dpr);

        const W = size.w;
        const H = size.h;

        interface WaveLayer {
            count: number;
            ampBase: number;
            freqX: number;
            speedX: number;
            opacity: number;
            lineWidth: number;
            hueShift: number;
            lightShift: number;
            ySpacing?: number;
        }

        const waveLayers: WaveLayer[] = [
            { count: 35, ampBase: 6, freqX: 0.003, speedX: 0.08, opacity: 0.09, lineWidth: 1.8, hueShift: -8, lightShift: -6 },
            { count: 45, ampBase: 4, freqX: 0.005, speedX: 0.12, opacity: 0.07, lineWidth: 1.2, hueShift: 0, lightShift: 0 },
            { count: 60, ampBase: 2.5, freqX: 0.008, speedX: 0.18, opacity: 0.055, lineWidth: 0.7, hueShift: 5, lightShift: 4 },
            { count: 80, ampBase: 1.5, freqX: 0.012, speedX: 0.22, opacity: 0.035, lineWidth: 0.4, hueShift: 8, lightShift: 6 },
        ];

        waveLayers.forEach((layer) => {
            layer.ySpacing = H / (layer.count + 1);
        });

        function drawFrame(timestamp: number) {
            const t = timestamp * 0.001;

            ctx!.fillStyle = "#141e28";
            ctx!.fillRect(0, 0, W, H);

            const bgGrad = ctx!.createLinearGradient(0, 0, 0, H);
            bgGrad.addColorStop(0, "rgba(56, 73, 89, 0.35)");
            bgGrad.addColorStop(0.3, "rgba(26, 37, 48, 0.25)");
            bgGrad.addColorStop(0.7, "rgba(33, 47, 59, 0.3)");
            bgGrad.addColorStop(1, "rgba(20, 30, 40, 0.5)");
            ctx!.fillStyle = bgGrad;
            ctx!.fillRect(0, 0, W, H);

            waveLayers.forEach((layer) => {
                for (let i = 0; i < layer.count; i++) {
                    const baseY = (i + 1) * (layer.ySpacing ?? 1);
                    const waveIndex = i / layer.count;

                    const amp =
                        layer.ampBase *
                        (0.6 + 0.8 * Math.sin(waveIndex * Math.PI)) *
                        (1 + 0.3 * Math.sin(t * 0.1 + i * 0.5));

                    const phaseOffset = i * 1.7 + t * layer.speedX;
                    const phaseOffset2 = i * 2.3 - t * layer.speedX * 0.7;
                    const phaseOffset3 = i * 0.9 + t * layer.speedX * 0.4;

                    const hue = 206 + layer.hueShift + Math.sin(t * 0.08 + i * 0.3) * 6;
                    const sat = 35 + Math.sin(t * 0.12 + i * 0.2) * 8;
                    const light =
                        35 +
                        layer.lightShift +
                        Math.sin(t * 0.1 + i * 0.15) * 5 +
                        8 * Math.sin(waveIndex * Math.PI);

                    const alpha =
                        layer.opacity *
                        (0.7 + 0.3 * Math.sin(t * 0.15 + i * 0.4)) *
                        (0.5 + 0.5 * Math.sin(waveIndex * Math.PI));

                    ctx!.beginPath();
                    ctx!.strokeStyle = `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`;
                    ctx!.lineWidth = layer.lineWidth * (0.7 + 0.3 * Math.sin(waveIndex * Math.PI));

                    const step = 3;
                    for (let x = -10; x <= W + 10; x += step) {
                        const xNorm = x / W;

                        const y1 = Math.sin(x * layer.freqX + phaseOffset) * amp;
                        const y2 = Math.sin(x * layer.freqX * 1.8 + phaseOffset2) * amp * 0.5;
                        const y3 = Math.sin(x * layer.freqX * 3.2 + phaseOffset3) * amp * 0.25;
                        const y4 = Math.sin(x * layer.freqX * 0.5 + t * 0.05 + i * 0.8) * amp * 0.8;

                        const yDrift = Math.sin(t * 0.06 + i * 0.3) * 3;
                        const envelope = Math.sin(xNorm * Math.PI) * 0.3 + 0.7;
                        const finalY = baseY + (y1 + y2 + y3 + y4) * envelope + yDrift;

                        if (x === -10) ctx!.moveTo(x, finalY);
                        else ctx!.lineTo(x, finalY);
                    }
                    ctx!.stroke();
                }
            });

            for (let i = 0; i < 3; i++) {
                const refX = W * (0.2 + 0.3 * i) + Math.sin(t * 0.04 + i * 2) * W * 0.15;
                const refY = H * 0.3 + Math.sin(t * 0.05 + i * 1.5) * H * 0.2;
                const refAlpha = 0.025 + 0.015 * Math.sin(t * 0.12 + i * 1.8);
                const refSize = 250 + 100 * Math.sin(t * 0.08 + i);

                const rg = ctx!.createRadialGradient(refX, refY, 0, refX, refY, refSize);
                rg.addColorStop(0, `rgba(136, 189, 223, ${refAlpha})`);
                rg.addColorStop(0.5, `rgba(106, 137, 167, ${refAlpha * 0.4})`);
                rg.addColorStop(1, "rgba(56, 73, 89, 0)");
                ctx!.fillStyle = rg;
                ctx!.fillRect(refX - refSize, refY - refSize, refSize * 2, refSize * 2);
            }

            ctx!.save();
            ctx!.globalCompositeOperation = "screen";
            for (let i = 0; i < 12; i++) {
                const sy = H * 0.1 + (H * 0.8 * i) / 12 + Math.sin(t * 0.07 + i * 1.1) * 20;
                const sx = W * 0.1 + Math.sin(t * 0.05 + i * 0.9) * W * 0.1;
                const sw = W * 0.3 + Math.sin(t * 0.09 + i * 0.6) * W * 0.15;
                const sa = 0.008 + 0.006 * Math.sin(t * 0.15 + i * 2.1);

                const sg = ctx!.createLinearGradient(sx, sy, sx + sw, sy);
                sg.addColorStop(0, "rgba(136, 189, 223, 0)");
                sg.addColorStop(0.3, `rgba(189, 221, 252, ${sa})`);
                sg.addColorStop(0.7, `rgba(189, 221, 252, ${sa})`);
                sg.addColorStop(1, "rgba(136, 189, 223, 0)");

                ctx!.fillStyle = sg;
                ctx!.fillRect(sx, sy - 15, sw, 30);
            }
            ctx!.restore();

            animRef.current = requestAnimationFrame(drawFrame);
        }

        animRef.current = requestAnimationFrame(drawFrame);
        return () => {
            if (animRef.current) cancelAnimationFrame(animRef.current);
        };
    }, [size]);

    return (
        <>
            <canvas
                ref={canvasRef}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                }}
            />

            {/* Vignette */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    background:
                        "radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(20, 30, 40, 0.5) 100%)",
                    pointerEvents: "none",
                }}
            />

            {/* Subtle grain texture */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    opacity: 0.035,
                    pointerEvents: "none",
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                    backgroundSize: "256px 256px",
                }}
            />
        </>
    );
}
