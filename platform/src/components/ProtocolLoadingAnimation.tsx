import { useRef, useEffect, useState } from 'react';

interface ProtocolLoadingAnimationProps {
    statusMessage?: string;
    activeSections?: string[];
    width?: number;
    height?: number;
}

const TASKS = [
    'Scanning document structure…',
    'Extracting text layers…',
    'Identifying protocol sections…',
    'Parsing inclusion criteria…',
    'Parsing exclusion criteria…',
    'Mapping Schedule of Activities…',
    'Resolving visit windows…',
    'Extracting lab panels…',
    'Detecting primary endpoints…',
    'Building relational graph…',
    'Cross-linking criteria to visits…',
    'Finalising protocol model…',
];

const SECTION_KEYS = ['inclusion', 'exclusion', 'schedule', 'endpoints', 'labs', 'visits'];
const SECTION_LABELS = ['Inclusion', 'Exclusion', 'Schedule', 'Endpoints', 'Labs', 'Visits'];

type ClusterDef = {
    label: string;
    cx: number;
    cy: number;
    color: { r: number; g: number; b: number };
    nodes: NodeDef[];
};

type NodeDef = {
    x: number; y: number;
    targetX: number; targetY: number;
    size: number;
    appeared: boolean;
    appearTime: number;
    alpha: number;
    drift: number;
    driftSpeed: number;
    driftAmp: number;
};

type CrossLink = { ci: number; ni: number; cj: number; nj: number };

function buildScene(W: number, H: number): { clusters: ClusterDef[]; crossLinks: CrossLink[]; allNodes: { node: NodeDef; ci: number; ni: number }[] } {
    const sx = W / 600;
    const sy = H / 500;

    const clusters: ClusterDef[] = [
        { label: 'Inclusion', cx: 150 * sx, cy: 140 * sy, color: { r: 59, g: 125, b: 216 }, nodes: [] },
        { label: 'Exclusion', cx: 430 * sx, cy: 130 * sy, color: { r: 220, g: 80, b: 80 }, nodes: [] },
        { label: 'Schedule',  cx: 300 * sx, cy: 250 * sy, color: { r: 78, g: 205, b: 196 }, nodes: [] },
        { label: 'Endpoints', cx: 130 * sx, cy: 370 * sy, color: { r: 180, g: 140, b: 255 }, nodes: [] },
        { label: 'Labs',      cx: 470 * sx, cy: 350 * sy, color: { r: 255, g: 180, b: 80 }, nodes: [] },
        { label: 'Visits',    cx: 300 * sx, cy: 420 * sy, color: { r: 108, g: 204, b: 140 }, nodes: [] },
    ];

    clusters.forEach(cl => {
        const count = 6 + Math.floor(Math.random() * 5);
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
            const dist = (25 + Math.random() * 45) * Math.min(sx, sy);
            cl.nodes.push({
                x: cl.cx + Math.cos(angle) * dist,
                y: cl.cy + Math.sin(angle) * dist,
                targetX: cl.cx + Math.cos(angle) * dist,
                targetY: cl.cy + Math.sin(angle) * dist,
                size: 2 + Math.random() * 2.5,
                appeared: false,
                appearTime: 0,
                alpha: 0,
                drift: Math.random() * Math.PI * 2,
                driftSpeed: 0.003 + Math.random() * 0.005,
                driftAmp: 2 + Math.random() * 4,
            });
        }
    });

    const crossLinks: CrossLink[] = [];
    for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
            if (Math.random() < 0.6) {
                crossLinks.push({
                    ci: i, ni: Math.floor(Math.random() * clusters[i].nodes.length),
                    cj: j, nj: Math.floor(Math.random() * clusters[j].nodes.length),
                });
            }
        }
    }

    const allNodes = clusters.flatMap((cl, ci) => cl.nodes.map((node, ni) => ({ node, ci, ni })));
    for (let i = allNodes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allNodes[i], allNodes[j]] = [allNodes[j], allNodes[i]];
    }

    return { clusters, crossLinks, allNodes };
}

export default function ProtocolLoadingAnimation({
    statusMessage,
    activeSections,
    width = 600,
    height = 500,
}: ProtocolLoadingAnimationProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const sceneRef = useRef<ReturnType<typeof buildScene> | null>(null);
    const tRef = useRef(0);
    const rafRef = useRef<number | null>(null);

    const [taskIndex, setTaskIndex] = useState(0);
    const [taskVisible, setTaskVisible] = useState(true);
    const [litSections, setLitSections] = useState<Set<string>>(new Set());

    // Build scene once
    useEffect(() => {
        sceneRef.current = buildScene(width, height);
    }, [width, height]);

    // Cycle status text
    useEffect(() => {
        if (statusMessage) return;
        const interval = setInterval(() => {
            setTaskVisible(false);
            setTimeout(() => {
                setTaskIndex(i => (i + 1) % TASKS.length);
                setTaskVisible(true);
            }, 400);
        }, 3000);
        return () => clearInterval(interval);
    }, [statusMessage]);

    // Light up sections progressively (if no override)
    useEffect(() => {
        if (activeSections) {
            setLitSections(new Set(activeSections));
            return;
        }
        const timers: ReturnType<typeof setTimeout>[] = [];
        SECTION_KEYS.forEach((key, i) => {
            timers.push(setTimeout(() => {
                setLitSections(prev => new Set([...prev, key]));
            }, 2000 + i * 2500));
        });
        return () => timers.forEach(clearTimeout);
    }, [activeSections]);

    // Canvas animation loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const W = width;
        const H = height;
        const CX = W / 2;
        const CY = H / 2;
        const REVEAL_INTERVAL = 0.06;
        const CYCLE_DURATION = 18;

        const loop = () => {
            const scene = sceneRef.current;
            if (!scene) { rafRef.current = requestAnimationFrame(loop); return; }

            tRef.current += 0.016;
            const t = tRef.current;
            const cycleT = t % CYCLE_DURATION;

            // Reset at cycle boundary
            if (cycleT < 0.02) {
                scene.allNodes.forEach(an => { an.node.appeared = false; an.node.alpha = 0; });
            }

            // Reveal nodes
            const revealCount = Math.min(Math.floor(cycleT / REVEAL_INTERVAL), scene.allNodes.length);
            for (let i = 0; i < revealCount; i++) {
                if (!scene.allNodes[i].node.appeared) {
                    scene.allNodes[i].node.appeared = true;
                    scene.allNodes[i].node.appearTime = t;
                }
            }

            const fadeOut = cycleT > CYCLE_DURATION - 2 ? 1 - (CYCLE_DURATION - cycleT) / 2 : 0;
            const globalAlpha = 1 - fadeOut;

            ctx.clearRect(0, 0, W, H);

            // Background radial
            const bg = ctx.createRadialGradient(CX, CY, 0, CX, CY, 350);
            bg.addColorStop(0, 'rgba(30, 40, 70, 0.06)');
            bg.addColorStop(1, 'transparent');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, W, H);

            // Intra-cluster connections
            scene.clusters.forEach(cl => {
                for (let i = 0; i < cl.nodes.length; i++) {
                    for (let j = i + 1; j < cl.nodes.length; j++) {
                        const a = cl.nodes[i], b = cl.nodes[j];
                        if (!a.appeared || !b.appeared) continue;
                        const dx = a.x - b.x, dy = a.y - b.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist > 80) continue;
                        const lineAlpha = (1 - dist / 80) * 0.25 * Math.min(a.alpha, b.alpha) * globalAlpha;
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.strokeStyle = `rgba(${cl.color.r},${cl.color.g},${cl.color.b},${lineAlpha})`;
                        ctx.lineWidth = 0.7;
                        ctx.stroke();
                    }
                }
            });

            // Cross-cluster connections
            for (const link of scene.crossLinks) {
                const na = scene.clusters[link.ci].nodes[link.ni];
                const nb = scene.clusters[link.cj].nodes[link.nj];
                if (!na.appeared || !nb.appeared) continue;
                const linkAlpha = Math.min(na.alpha, nb.alpha) * 0.1 * globalAlpha;
                if (linkAlpha < 0.01) continue;
                ctx.beginPath();
                ctx.moveTo(na.x, na.y);
                ctx.lineTo(nb.x, nb.y);
                ctx.strokeStyle = `rgba(140,160,200,${linkAlpha})`;
                ctx.lineWidth = 0.4;
                ctx.setLineDash([4, 6]);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // Nodes
            scene.clusters.forEach(cl => {
                cl.nodes.forEach(n => {
                    if (!n.appeared) return;
                    const age = t - n.appearTime;
                    n.alpha = Math.min(age / 0.5, 1);
                    n.drift += n.driftSpeed;
                    n.x = n.targetX + Math.cos(n.drift) * n.driftAmp;
                    n.y = n.targetY + Math.sin(n.drift * 0.7) * n.driftAmp;

                    const a = n.alpha * globalAlpha;

                    // Glow
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, n.size * 4, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(${cl.color.r},${cl.color.g},${cl.color.b},${a * 0.06})`;
                    ctx.fill();

                    // Core
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, n.size, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(${cl.color.r},${cl.color.g},${cl.color.b},${a * 0.85})`;
                    ctx.fill();

                    // Bright center
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, n.size * 0.4, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(255,255,255,${a * 0.5})`;
                    ctx.fill();

                    // Pop ring on appear
                    if (age < 0.3) {
                        const ring = age / 0.3;
                        ctx.beginPath();
                        ctx.arc(n.x, n.y, n.size + ring * 15, 0, Math.PI * 2);
                        ctx.strokeStyle = `rgba(${cl.color.r},${cl.color.g},${cl.color.b},${(1 - ring) * 0.3})`;
                        ctx.lineWidth = 1;
                        ctx.stroke();
                    }
                });

                // Cluster label
                const anyVisible = cl.nodes.some(n => n.appeared);
                if (anyVisible) {
                    const labelAlpha = Math.min(...cl.nodes.filter(n => n.appeared).map(n => n.alpha)) * globalAlpha;
                    if (labelAlpha > 0.1) {
                        ctx.font = '500 10px "Space Grotesk", sans-serif';
                        ctx.fillStyle = `rgba(${cl.color.r},${cl.color.g},${cl.color.b},${labelAlpha * 0.5})`;
                        ctx.textAlign = 'center';
                        ctx.fillText(cl.label.toUpperCase(), cl.cx, cl.cy - 55);
                    }
                }
            });

            // Scanning beam
            const beamAngle = (cycleT * 0.5) % (Math.PI * 2);
            const beamX = CX + Math.cos(beamAngle) * 320;
            const beamY = CY + Math.sin(beamAngle) * 260;
            const beam = ctx.createRadialGradient(beamX, beamY, 0, beamX, beamY, 120);
            beam.addColorStop(0, `rgba(59,125,216,${0.04 * globalAlpha})`);
            beam.addColorStop(1, 'transparent');
            ctx.fillStyle = beam;
            ctx.fillRect(0, 0, W, H);

            rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [width, height]);

    const displayText = statusMessage ?? TASKS[taskIndex];

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0,
            userSelect: 'none',
        }}>
            <canvas
                ref={canvasRef}
                width={width}
                height={height}
                style={{ display: 'block', maxWidth: '100%' }}
            />

            <div style={{ textAlign: 'center', marginTop: 8 }}>
                <div style={{
                    fontSize: 11,
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.14em',
                    color: '#8890a6',
                    marginBottom: 8,
                }}>
                    Zephyr Protocol Engine
                </div>

                <div style={{
                    fontSize: 14,
                    fontWeight: 400,
                    letterSpacing: '0.04em',
                    color: '#6c8ccc',
                    minHeight: 20,
                    transition: 'opacity 0.4s',
                    opacity: taskVisible ? 1 : 0,
                }}>
                    {displayText}
                </div>

                <div style={{
                    display: 'flex',
                    gap: 6,
                    justifyContent: 'center',
                    flexWrap: 'wrap',
                    marginTop: 16,
                }}>
                    {SECTION_KEYS.map((key, i) => {
                        const isLit = (activeSections ?? [...litSections]).includes(key);
                        return (
                            <span key={key} style={{
                                fontSize: 10,
                                fontWeight: 500,
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                                padding: '3px 10px',
                                borderRadius: 99,
                                transition: 'all 0.4s',
                                background: isLit ? 'rgba(59,125,216,0.15)' : '#2a2f3d',
                                color: isLit ? '#5a9ef5' : '#4a5168',
                                boxShadow: isLit ? '0 0 12px rgba(59,125,216,0.1)' : 'none',
                            }}>
                                {SECTION_LABELS[i]}
                            </span>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
