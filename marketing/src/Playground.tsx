// CanvasFractalGrid playground — live-tune the backdrop, then Copy Config and
// paste the result back into the chat / Hero.tsx. Reachable at /#playground.
// Rebuilt from the library's ConfigurableCanvasFractalGrid with native controls
// (no shadcn/Tailwind dependency).

import { useState } from 'react';
import { CanvasFractalGrid } from './animations/canvas-fractal-grid';

type FractalGradient = {
    stops: { color: string; position: number }[];
    centerX: number;
    centerY: number;
};

const initialConfig = {
    dotSize: 5,
    dotSpacing: 25,
    dotOpacity: 0.8,
    gradientAnimationDuration: 5,
    waveIntensity: 40,
    waveRadius: 250,
    dotColor: 'rgba(100, 200, 255, 0.2)',
    glowColor: 'rgba(100, 200, 255, 1)',
    enableNoise: true,
    noiseOpacity: 0.05,
    enableMouseGlow: false,
    initialPerformance: 'high' as 'low' | 'medium' | 'high',
    // Off by default in the real component — the colorful wash is opt-in
    enableGradient: false,
    gradients: [
        {
            stops: [
                { color: '#3498DB', position: 0 },
                { color: '#2980B9', position: 25 },
                { color: '#1ABC9C', position: 50 },
                { color: 'transparent', position: 75 },
            ],
            centerX: 30,
            centerY: 70,
        },
        {
            stops: [
                { color: '#16A085', position: 0 },
                { color: '#2980B9', position: 25 },
                { color: '#3498DB', position: 50 },
                { color: 'transparent', position: 75 },
            ],
            centerX: 70,
            centerY: 30,
        },
    ] as FractalGradient[],
};

type Config = typeof initialConfig;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="pg-row">
            <span>{label}</span>
            {children}
        </label>
    );
}

function SliderRow({ label, value, min, max, step, onChange }: {
    label: string; value: number; min: number; max: number; step: number;
    onChange: (v: number) => void;
}) {
    return (
        <Row label={`${label} — ${value}`}>
            <input type="range" min={min} max={max} step={step} value={value}
                onChange={e => onChange(parseFloat(e.target.value))} />
        </Row>
    );
}

export default function Playground() {
    const [config, setConfig] = useState<Config>(initialConfig);
    const [copied, setCopied] = useState(false);

    const set = <K extends keyof Config>(key: K, value: Config[K]) =>
        setConfig(prev => ({ ...prev, [key]: value }));

    const setGradient = (i: number, g: FractalGradient) => {
        const gradients = [...config.gradients];
        gradients[i] = g;
        set('gradients', gradients);
    };

    const copyConfig = () => {
        const s = `<CanvasFractalGrid
    dotSize={${config.dotSize}}
    dotSpacing={${config.dotSpacing}}
    dotOpacity={${config.dotOpacity}}
    gradientAnimationDuration={${config.gradientAnimationDuration}}
    waveIntensity={${config.waveIntensity}}
    waveRadius={${config.waveRadius}}
    dotColor="${config.dotColor}"
    glowColor="${config.glowColor}"
    enableNoise={${config.enableNoise}}
    noiseOpacity={${config.noiseOpacity}}
    enableMouseGlow={${config.enableMouseGlow}}
    initialPerformance="${config.initialPerformance}"
    enableGradient={${config.enableGradient}}
    gradients={${JSON.stringify(config.gradients, null, 2)}}
/>`;
        navigator.clipboard.writeText(s).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="pg">
            <header className="pg-header">
                <h1>Backdrop playground</h1>
                <div className="pg-header-actions">
                    <button className="btn btn-ghost" onClick={() => setConfig(initialConfig)}>Reset</button>
                    <button className="btn btn-primary" onClick={copyConfig}>{copied ? '✓ Copied!' : 'Copy Config'}</button>
                    <a className="btn btn-ghost" href="/#" onClick={() => setTimeout(() => location.reload(), 0)}>← Back to hero</a>
                </div>
            </header>

            {/* Live preview — remounts on every config change */}
            <div className="pg-preview">
                <CanvasFractalGrid key={JSON.stringify(config)} {...config} />
            </div>

            <div className="pg-panels">
                <section className="pg-panel">
                    <h2>Dots</h2>
                    <SliderRow label="Dot size" value={config.dotSize} min={1} max={20} step={1} onChange={v => set('dotSize', v)} />
                    <SliderRow label="Dot spacing" value={config.dotSpacing} min={10} max={50} step={1} onChange={v => set('dotSpacing', v)} />
                    <SliderRow label="Dot opacity" value={config.dotOpacity} min={0} max={1} step={0.1} onChange={v => set('dotOpacity', v)} />
                    <Row label="Dot color (any CSS color)">
                        <input type="text" value={config.dotColor} onChange={e => set('dotColor', e.target.value)} />
                    </Row>
                    <Row label="Glow color (any CSS color)">
                        <input type="text" value={config.glowColor} onChange={e => set('glowColor', e.target.value)} />
                    </Row>
                </section>

                <section className="pg-panel">
                    <h2>Waves & effects</h2>
                    <SliderRow label="Wave intensity" value={config.waveIntensity} min={0} max={100} step={1} onChange={v => set('waveIntensity', v)} />
                    <SliderRow label="Wave radius" value={config.waveRadius} min={50} max={500} step={10} onChange={v => set('waveRadius', v)} />
                    <SliderRow label="Gradient drift (s)" value={config.gradientAnimationDuration} min={5} max={30} step={1} onChange={v => set('gradientAnimationDuration', v)} />
                    <SliderRow label="Noise opacity" value={config.noiseOpacity} min={0} max={0.3} step={0.01} onChange={v => set('noiseOpacity', v)} />
                    <Row label="Enable noise">
                        <input type="checkbox" checked={config.enableNoise} onChange={e => set('enableNoise', e.target.checked)} />
                    </Row>
                    <Row label="Mouse glow">
                        <input type="checkbox" checked={config.enableMouseGlow} onChange={e => set('enableMouseGlow', e.target.checked)} />
                    </Row>
                    <Row label="Gradient wash (colorful background)">
                        <input type="checkbox" checked={config.enableGradient} onChange={e => set('enableGradient', e.target.checked)} />
                    </Row>
                    <Row label="Performance">
                        <select value={config.initialPerformance} onChange={e => set('initialPerformance', e.target.value as Config['initialPerformance'])}>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                        </select>
                    </Row>
                </section>

                <section className="pg-panel pg-panel-wide">
                    <h2>Gradients</h2>
                    {config.gradients.map((g, i) => (
                        <div key={i} className="pg-gradient">
                            <div className="pg-gradient-head">
                                <strong>Gradient {i + 1}</strong>
                                <button className="pg-mini" onClick={() => set('gradients', config.gradients.filter((_, gi) => gi !== i))}>Remove</button>
                            </div>
                            <SliderRow label="Center X %" value={g.centerX} min={0} max={100} step={1}
                                onChange={v => setGradient(i, { ...g, centerX: v })} />
                            <SliderRow label="Center Y %" value={g.centerY} min={0} max={100} step={1}
                                onChange={v => setGradient(i, { ...g, centerY: v })} />
                            {g.stops.map((stop, si) => (
                                <div key={si} className="pg-stop">
                                    <input type="text" value={stop.color} title="Color (hex / rgba / transparent)"
                                        onChange={e => {
                                            const stops = [...g.stops];
                                            stops[si] = { ...stop, color: e.target.value };
                                            setGradient(i, { ...g, stops });
                                        }} />
                                    <input type="range" min={0} max={100} step={1} value={stop.position}
                                        onChange={e => {
                                            const stops = [...g.stops];
                                            stops[si] = { ...stop, position: parseInt(e.target.value) };
                                            setGradient(i, { ...g, stops });
                                        }} />
                                    <span className="pg-stop-pos">{stop.position}%</span>
                                    <button className="pg-mini" onClick={() => setGradient(i, { ...g, stops: g.stops.filter((_, x) => x !== si) })}>−</button>
                                </div>
                            ))}
                            <button className="pg-mini" onClick={() => setGradient(i, { ...g, stops: [...g.stops, { color: '#3498DB', position: 100 }] })}>+ Add stop</button>
                        </div>
                    ))}
                    <button className="btn btn-ghost" onClick={() => set('gradients', [...config.gradients, {
                        stops: [{ color: '#3498DB', position: 0 }, { color: 'transparent', position: 75 }],
                        centerX: 50, centerY: 50,
                    }])}>+ Add gradient</button>
                </section>
            </div>
        </div>
    );
}
