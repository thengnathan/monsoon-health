// UnifiedField — ONE particle system for the hero and the Zephyr chapter.
// Every particle has a "home" on the hero's dot grid, held by a spring. As
// the visitor scrolls past the hero, a release ramp (driven by scroll
// position) lets go of the springs and hands the particles to the curl-noise
// flow field — the dots literally become the currents.
//
// Density trick: the hero grid needs ~2.5k dots but the flow wants ~65k
// particles. Each grid cell owns many particles (ranks); only rank 0 is
// visible while gridded, and the hidden siblings fan out from the dot as it
// releases — every dot dissolves into a stream.
//
// Replaces CanvasFractalGrid (hero) + FlowField (Zephyr chapter). The canvas
// is position:fixed behind the page. Three states, all scroll-morphed:
//   grid (hero) → curl currents (Zephyr) → horizontal tide streams (Tidal).
// It fades to paper at the end of the Tidal chapter and stops rendering.

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const NOISE_GLSL = `
  vec4 permute(vec4 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
  vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 1.0/7.0;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
`;

// Shared between sim + draw: per-texel release threshold so particles let go
// of the grid at slightly different scroll moments (organic dissolve).
const RELEASE_GLSL = `
  float hash12(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float localRelease(vec2 uv, float globalRelease) {
    float h = hash12(uv * 7.31) * 0.55;
    return smoothstep(h, h + 0.35, globalRelease);
  }
`;

export default function UnifiedField() {
    const wrapRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const wrap = wrapRef.current;
        if (!wrap) return;

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const isMobile = /Mobi|Android/i.test(navigator.userAgent) || window.innerWidth < 720;

        const PAPER = new THREE.Color('#f3f4f6');
        const DOT_SPACING_PX = 24; // hero grid spacing (locked hero config)

        const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
        renderer.setSize(wrap.clientWidth, wrap.clientHeight);
        renderer.setClearColor(PAPER, 1);
        renderer.autoClear = false;
        wrap.appendChild(renderer.domElement);

        const isWebGL2 = renderer.capabilities.isWebGL2;
        const floatType = isWebGL2 ? THREE.FloatType : THREE.HalfFloatType;

        const SIM = isMobile ? 160 : 256;
        const COUNT = SIM * SIM;
        let aspect = wrap.clientWidth / wrap.clientHeight;

        const gridDims = () => {
            const gw = Math.max(8, Math.round(wrap.clientWidth / DOT_SPACING_PX));
            const gh = Math.max(8, Math.round(wrap.clientHeight / DOT_SPACING_PX));
            return { gw, gh };
        };
        let { gw, gh } = gridDims();

        // Start every particle AT its home so the hero grid is crisp on load
        const homeOf = (i: number) => {
            const cells = gw * gh;
            const cell = i % cells;
            return {
                x: ((cell % gw) + 0.5) / gw * 2 * aspect - aspect,
                y: (Math.floor(cell / gw) + 0.5) / gh * 2 - 1,
            };
        };
        const initData = new Float32Array(COUNT * 4);
        for (let i = 0; i < COUNT; i++) {
            const h = homeOf(i);
            initData[i * 4] = h.x;
            initData[i * 4 + 1] = h.y;
            initData[i * 4 + 2] = Math.random();
            initData[i * 4 + 3] = 0;
        }
        const initTexture = new THREE.DataTexture(initData, SIM, SIM, THREE.RGBAFormat, THREE.FloatType);
        initTexture.minFilter = THREE.NearestFilter;
        initTexture.magFilter = THREE.NearestFilter;
        initTexture.needsUpdate = true;

        const makeTarget = () =>
            new THREE.WebGLRenderTarget(SIM, SIM, {
                minFilter: THREE.NearestFilter,
                magFilter: THREE.NearestFilter,
                format: THREE.RGBAFormat,
                type: floatType,
                depthBuffer: false,
                stencilBuffer: false,
            });
        let targetA = makeTarget();
        let targetB = makeTarget();

        // ── Simulation ──
        const simUniforms = {
            uPositions: { value: initTexture as THREE.Texture },
            uTime: { value: 0 },
            uDt: { value: 0.016 },
            uAspect: { value: aspect },
            uMouse: { value: new THREE.Vector2(10, 10) },
            uMouseVel: { value: new THREE.Vector2(0, 0) },
            uMouseActive: { value: 0 },
            uRelease: { value: 0 }, // 0 = hero grid · 1 = full flow
            uSnap: { value: 0 },    // 1 for one frame: teleport gridded particles home
            uWaveR: { value: 300 / (wrap.clientHeight / 2) }, // wave radius in NDC (300px, locked config)
            uPx: { value: wrap.clientHeight / 2 },            // pixels per NDC unit
            uTide: { value: 0 }, // 0 = curl currents (Zephyr) · 1 = tide streams (Tidal)
            uSim: { value: SIM },
            uGridW: { value: gw },
            uGridH: { value: gh },
        };

        const simMaterial = new THREE.ShaderMaterial({
            uniforms: simUniforms,
            vertexShader: `
              varying vec2 vUv;
              void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
            `,
            fragmentShader: `
              uniform sampler2D uPositions;
              uniform float uTime, uDt, uAspect, uMouseActive, uRelease, uSnap, uSim, uGridW, uGridH, uWaveR, uPx, uTide;
              uniform vec2 uMouse, uMouseVel;
              varying vec2 vUv;
              ${NOISE_GLSL}
              ${RELEASE_GLSL}

              float psi(vec2 p, float t) {
                vec2 drift = vec2(t * 0.012, sin(t * 0.02) * 0.15);
                float s = 0.0;
                s += snoise(vec3((p + drift) * 0.85, t * 0.045)) * 1.00;
                s += snoise(vec3((p - drift) * 2.40 + 13.7, t * 0.09)) * 0.32;
                return s;
              }
              vec2 curl(vec2 p, float t) {
                float e = 0.018;
                float dy = psi(p + vec2(0.0, e), t) - psi(p - vec2(0.0, e), t);
                float dx = psi(p + vec2(e, 0.0), t) - psi(p - vec2(e, 0.0), t);
                return vec2(dy, -dx) / (2.0 * e);
              }

              void main() {
                vec4 data = texture2D(uPositions, vUv);
                vec2 pos = data.xy;
                float life = data.z;

                // Home on the hero grid (rank > 0 homes carry a tiny jitter so
                // sibling particles diverge in the flow instead of clumping)
                float idx = floor(vUv.y * uSim) * uSim + floor(vUv.x * uSim);
                float cells = uGridW * uGridH;
                float cell = mod(idx, cells);
                float rank = floor(idx / cells);
                vec2 home = vec2(
                  (mod(cell, uGridW) + 0.5) / uGridW * 2.0 * uAspect - uAspect,
                  (floor(cell / uGridW) + 0.5) / uGridH * 2.0 - 1.0
                );
                home += (vec2(hash12(vUv * 3.7), hash12(vUv * 9.1)) - 0.5) * 0.006 * step(0.5, rank);

                float rel = localRelease(vUv, uRelease);

                // Grid state: dots spring toward a wave-displaced target — a
                // sine ripple traveling outward from the cursor with distance
                // falloff (the original fractal grid's rain-on-water feel),
                // not a simple push. Spring speed stays capped so scroll-up
                // re-capture glides instead of slingshotting.
                vec2 dm = pos - uMouse;
                float d2 = dot(dm, dm);
                vec2 toM = home - uMouse;
                float mDist = length(toM);
                // Original fractal-grid math: quadratic falloff inside a hard
                // 300px radius, wavelength ~126px (sin of pixel distance * 0.05)
                float ws = pow(max(0.0, 1.0 - mDist / uWaveR), 2.0) * uMouseActive;
                float ripple = sin(mDist * uPx * 0.05 - uTime * 7.5);
                vec2 waveTarget = home + (toM / max(mDist, 1e-4)) * ripple * ws * (30.0 / uPx);
                vec2 springVel = (waveTarget - pos) * 9.0;
                float springLen = length(springVel);
                springVel *= min(1.0, 1.1 / max(springLen, 1e-5));
                vec2 waveVel = vec2(0.0);

                // Flow state: curl currents + cursor vortex/drag
                float infl = exp(-d2 * 14.0) * uMouseActive;
                vec2 flowVel = curl(pos, uTime) * 0.12
                             + vec2(-dm.y, dm.x) * infl * 0.45
                             + uMouseVel * infl * 0.8;

                // Tide state (Tidal chapter): the turbulence organizes into
                // horizontal streams — banded speeds, gentle swell. Order out
                // of the currents.
                float band = sin(pos.y * 12.0 + uTime * 0.5);
                float band2 = sin(pos.y * 5.0 - uTime * 0.3 + 2.0);
                vec2 tideVel = vec2(
                    0.20 + 0.10 * band + 0.05 * band2,
                    0.015 * sin(pos.x * 3.0 + uTime * 0.4) + 0.012 * band
                );
                tideVel += vec2(-dm.y, dm.x) * infl * 0.25; // soft cursor stir

                vec2 vel = mix(springVel + waveVel, mix(flowVel, tideVel, uTide), rel);
                pos += vel * uDt;

                // Tide streams wrap horizontally instead of respawning — the
                // rivers run continuously across the screen
                if (uTide > 0.5 && abs(pos.x) > uAspect * 1.04) {
                    pos.x = -sign(pos.x) * uAspect * 1.02;
                }

                // Life/respawn only matters once released; gridded dots are immortal
                life -= (uDt / (7.0 + hash12(vUv) * 7.0)) * step(0.05, rel);
                if (life <= 0.0 || abs(pos.x) > uAspect * 1.04 || abs(pos.y) > 1.04) {
                  if (rel > 0.5) {
                    pos = vec2(
                      (hash12(vUv + fract(uTime)) - 0.5) * 2.0 * uAspect,
                      (hash12(vUv.yx + fract(uTime * 0.73)) - 0.5) * 2.0
                    );
                  } else {
                    pos = home;
                  }
                  life = 1.0;
                }

                // Veiled re-grid: while the field is invisible, gridded
                // particles teleport straight home (no visible churn)
                pos = mix(pos, home, uSnap * (1.0 - rel));

                gl_FragColor = vec4(pos, life, length(vel));
              }
            `,
            depthTest: false,
            depthWrite: false,
        });

        const simScene = new THREE.Scene();
        const simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        simScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMaterial));

        // ── Draw ──
        const drawScene = new THREE.Scene();
        const drawCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        const fadeMat = new THREE.MeshBasicMaterial({
            color: PAPER,
            transparent: true,
            opacity: reduceMotion ? 0.2 : 0.09,
            depthTest: false,
            depthWrite: false,
        });
        const fadeQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fadeMat);
        fadeQuad.renderOrder = 0;
        drawScene.add(fadeQuad);

        // position = (texelU, texelV, rank)
        const refs = new Float32Array(COUNT * 3);
        for (let i = 0; i < COUNT; i++) {
            refs[i * 3] = (i % SIM) / SIM + 0.5 / SIM;
            refs[i * 3 + 1] = Math.floor(i / SIM) / SIM + 0.5 / SIM;
            refs[i * 3 + 2] = Math.floor(i / (gw * gh));
        }
        const particleGeo = new THREE.BufferGeometry();
        particleGeo.setAttribute('position', new THREE.BufferAttribute(refs, 3));

        const drawUniforms = {
            uPositions: { value: null as THREE.Texture | null },
            uAspect: { value: aspect },
            uPixelRatio: { value: renderer.getPixelRatio() },
            uRelease: { value: 0 },
            uGlobalFade: { value: 1 },
            uVeil: { value: 1 }, // scroll-up re-grid: fade out → snap → fade in
            uMouse: { value: new THREE.Vector2(10, 10) },
            uMouseActive: { value: 0 },
            uWaveR: { value: 300 / (wrap.clientHeight / 2) },
            uHeroMask: { value: 1 }, // strength of the headline clear-zone
            // Hero dot look: brand blue, slightly deepened for presence on paper
            uColorDot: { value: new THREE.Color('#2f8cc9') },
            // Flow ramp: light blue → brand blue by speed
            uColorSlow: { value: new THREE.Color('#a4c9e8') },
            uColorMid: { value: new THREE.Color('#5fa3d6') },
            uColorFast: { value: new THREE.Color('#2477af') },
        };

        const particleMat = new THREE.ShaderMaterial({
            uniforms: drawUniforms,
            vertexShader: `
              uniform sampler2D uPositions;
              uniform float uAspect, uPixelRatio, uRelease, uMouseActive, uWaveR;
              uniform vec2 uMouse;
              varying float vSpeed, vFade, vRel, vRank, vWave;
              varying vec2 vPos;
              ${RELEASE_GLSL}
              void main() {
                vec4 d = texture2D(uPositions, position.xy);
                vSpeed = d.w;
                vRank = position.z;
                vRel = localRelease(position.xy, uRelease);
                vFade = smoothstep(0.0, 0.10, d.z) * smoothstep(1.0, 0.94, d.z);
                vPos = d.xy;
                gl_Position = vec4(d.x / uAspect, d.y, 0.0, 1.0);
                // Glow swell (original: glowRadius = dotSize * (1 + waveStrength)):
                // proximity to the cursor grows the dot; because the ripple moves
                // dots toward/away, the swell breathes in and out as waves pass
                float md = length(d.xy - uMouse);
                vWave = pow(max(0.0, 1.0 - md / uWaveR), 2.0) * uMouseActive * (1.0 - vRel);
                float gridSize = 3.8 * (1.0 + vWave);
                float flowSize = 1.5 + smoothstep(0.10, 0.8, vSpeed) * 1.4;
                gl_PointSize = uPixelRatio * mix(gridSize, flowSize, vRel);
              }
            `,
            fragmentShader: `
              uniform float uAspect, uHeroMask, uGlobalFade, uVeil;
              uniform vec3 uColorDot, uColorSlow, uColorMid, uColorFast;
              varying float vSpeed, vFade, vRel, vRank, vWave;
              varying vec2 vPos;
              void main() {
                float d = length(gl_PointCoord - 0.5);
                // Swollen dots render as a soft halo (the original's radial
                // gradient glow) instead of a hard disc
                float mask = mix(smoothstep(0.5, 0.15, d), smoothstep(0.5, 0.02, d), min(vWave, 1.0));

                // Flow coloring: speed ramp, one hue
                float s = smoothstep(0.03, 0.8, vSpeed);
                vec3 flowCol = mix(uColorSlow, uColorMid, smoothstep(0.0, 0.55, s));
                flowCol = mix(flowCol, uColorFast, smoothstep(0.55, 1.0, s));
                float flowAlpha = 0.24 + s * 0.5;

                // Grid coloring: present at rest; the cursor wave brightens and
                // deepens dots toward the glow blue (original glowColor behavior)
                float g = smoothstep(0.02, 0.5, vSpeed);
                vec3 gridCol = mix(uColorDot, uColorFast, min(vWave * 0.8, 1.0));
                float gridAlpha = (0.34 + g * 0.35) * (1.0 + vWave * 0.9);

                vec3 col = mix(gridCol, flowCol, vRel);
                float alpha = mask * mix(gridAlpha, flowAlpha * vFade, vRel);

                // Hidden siblings: only rank 0 draws while gridded; the rest
                // fade in as their dot releases into the stream
                alpha *= mix(step(vRank, 0.5), 1.0, vRel);

                // Headline clear-zone (hero mask), fades away with release
                vec2 e = vec2((vPos.x - 0.0) / (0.92 * uAspect), (vPos.y - 0.24) / 0.52);
                float ed = length(e);
                float clearZone = smoothstep(0.30, 0.90, ed);
                alpha *= mix(1.0, clearZone, uHeroMask * (1.0 - vRel));

                alpha *= uGlobalFade * uVeil;
                if (alpha < 0.005) discard;
                gl_FragColor = vec4(col, alpha);
              }
            `,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            blending: THREE.NormalBlending,
        });

        const particles = new THREE.Points(particleGeo, particleMat);
        particles.frustumCulled = false;
        particles.renderOrder = 1;
        drawScene.add(particles);

        // ── Pointer (viewport-relative; the canvas IS the viewport) ──
        const mouse = new THREE.Vector2(10, 10);
        const mouseVel = new THREE.Vector2(0, 0);
        let mouseActiveTarget = 0;
        let lastMouse: { x: number; y: number } | null = null;

        const onPointerMove = (e: PointerEvent) => {
            const x = (e.clientX / window.innerWidth * 2 - 1) * aspect;
            const y = -(e.clientY / window.innerHeight * 2 - 1);
            if (lastMouse) {
                mouseVel.x = mouseVel.x * 0.8 + (x - lastMouse.x) * 6.0;
                mouseVel.y = mouseVel.y * 0.8 + (y - lastMouse.y) * 6.0;
            }
            lastMouse = { x, y };
            mouse.set(x, y);
            mouseActiveTarget = reduceMotion ? 0 : 1;
        };
        window.addEventListener('pointermove', onPointerMove, { passive: true });
        const onLeave = () => { mouseActiveTarget = 0; lastMouse = null; };
        document.addEventListener('mouseleave', onLeave);

        // ── Scroll → release / global fade ──
        // Release ramps across the hero exit; the whole field fades out at the
        // end of the Zephyr chapter and rendering stops beyond it.
        let releaseTarget = 0;
        let tideTarget = 0;
        let fadeTarget = 1;
        let pastField = false;

        const readScroll = () => {
            const vh = window.innerHeight;
            const sy = window.scrollY;
            const t0 = vh * 0.22;
            const t1 = vh * 0.88;
            releaseTarget = Math.min(1, Math.max(0, (sy - t0) / (t1 - t0)));

            // Zephyr → Tidal: the currents organize into tide streams during
            // Zephyr's final beat. The visual handoff to the sea is the rising
            // waterline (mask, shared --monsoon-wl var) — the alpha fade here
            // only cleans up after the line has passed the top of the screen,
            // then rendering stops entirely.
            const zephyr = document.getElementById('zephyr');
            if (zephyr) {
                const zBottom = zephyr.getBoundingClientRect().top + window.scrollY + zephyr.offsetHeight;
                tideTarget = Math.min(1, Math.max(0, (sy - (zBottom - vh * 1.6)) / (vh * 0.9)));

                const fadeStart = zBottom + vh * 0.05;
                const fadeEnd = zBottom + vh * 0.35;
                fadeTarget = 1 - Math.min(1, Math.max(0, (sy - fadeStart) / (fadeEnd - fadeStart)));
                pastField = sy > fadeEnd + vh * 0.2;
            }
        };
        readScroll();
        // Seed current values so a mid-page refresh doesn't animate from zero
        simUniforms.uRelease.value = releaseTarget;
        drawUniforms.uRelease.value = releaseTarget;
        drawUniforms.uGlobalFade.value = fadeTarget;
        window.addEventListener('scroll', readScroll, { passive: true });

        // ── Resize / visibility ──
        let needsClear = true;
        const ro = new ResizeObserver(() => {
            if (!wrap.clientWidth || !wrap.clientHeight) return;
            aspect = wrap.clientWidth / wrap.clientHeight;
            renderer.setSize(wrap.clientWidth, wrap.clientHeight);
            ({ gw, gh } = gridDims());
            simUniforms.uAspect.value = aspect;
            simUniforms.uGridW.value = gw;
            simUniforms.uGridH.value = gh;
            drawUniforms.uAspect.value = aspect;
            drawUniforms.uPixelRatio.value = renderer.getPixelRatio();
            simUniforms.uWaveR.value = 300 / (wrap.clientHeight / 2);
            simUniforms.uPx.value = wrap.clientHeight / 2;
            drawUniforms.uWaveR.value = simUniforms.uWaveR.value;
            const cells = gw * gh;
            const pos = particleGeo.getAttribute('position') as THREE.BufferAttribute;
            for (let i = 0; i < COUNT; i++) pos.setZ(i, Math.floor(i / cells));
            pos.needsUpdate = true;
            readScroll();
            needsClear = true;
        });
        ro.observe(wrap);

        let running = true;
        const onVis = () => { running = !document.hidden; if (running) clock.getDelta(); };
        document.addEventListener('visibilitychange', onVis);

        // ── Loop ──
        const clock = new THREE.Clock();
        const timeScale = reduceMotion ? 0.1 : 0.45;
        let first = true;
        let raf = 0;
        // Scroll-up re-grid: instead of showing thousands of particles racing
        // back to their rows (hectic), the field fades out, snaps home while
        // invisible, and fades back in already formed.
        let phase: 'live' | 'vanish' | 'reappear' = 'live';
        let veil = 1;

        const frame = () => {
            raf = requestAnimationFrame(frame);
            if (!running || (pastField && !first)) return;

            const rawDt = Math.min(clock.getDelta(), 0.05);
            const dt = rawDt * timeScale;
            simUniforms.uTime.value += dt;
            simUniforms.uDt.value = dt;

            simUniforms.uMouse.value.lerp(mouse, 0.2);
            simUniforms.uMouseActive.value += (mouseActiveTarget - simUniforms.uMouseActive.value) * 0.06;
            (drawUniforms.uMouse.value as THREE.Vector2).copy(simUniforms.uMouse.value);
            drawUniforms.uMouseActive.value = simUniforms.uMouseActive.value;
            mouseVel.multiplyScalar(0.92);
            simUniforms.uMouseVel.value.copy(mouseVel);

            // Release ramp + veiled re-grid state machine
            const cur = simUniforms.uRelease.value;
            simUniforms.uSnap.value = 0;
            if (phase === 'live') {
                if (releaseTarget < cur - 0.12) {
                    phase = 'vanish'; // scroll-up crossing: veil instead of churning
                } else {
                    const k = releaseTarget > cur ? 0.07 : 0.08;
                    simUniforms.uRelease.value = cur + (releaseTarget - cur) * k;
                }
            } else if (phase === 'vanish') {
                if (releaseTarget > cur) {
                    phase = 'live'; // user reversed mid-fade — carry on flowing
                } else {
                    veil = Math.max(0, veil - rawDt * 5.0);
                    if (veil <= 0.02) {
                        simUniforms.uRelease.value = releaseTarget;
                        simUniforms.uSnap.value = 1; // teleport home this frame
                        phase = 'reappear';
                    }
                }
            } else {
                // Reappear: track the scroll DIRECTLY. The snap already placed
                // gridded particles home, so any further drop just lets more
                // particles glide in at the capped spring speed — and no gap
                // is left behind to re-trigger the veil. (A lagging lerp here
                // caused repeated partial blinks on long scroll-ups — the
                // "chaotic" re-grid.)
                simUniforms.uRelease.value = releaseTarget;
                veil = Math.min(1, veil + rawDt * 2.4);
                if (veil >= 1) phase = 'live';
            }
            if (phase === 'live' && veil < 1) veil = Math.min(1, veil + rawDt * 2.4);
            drawUniforms.uVeil.value = veil;
            drawUniforms.uRelease.value = simUniforms.uRelease.value;
            simUniforms.uTide.value += (tideTarget - simUniforms.uTide.value) * 0.06;
            drawUniforms.uGlobalFade.value += (fadeTarget - drawUniforms.uGlobalFade.value) * 0.1;
            drawUniforms.uHeroMask.value = 1.0 - simUniforms.uRelease.value;

            simUniforms.uPositions.value = first ? initTexture : targetA.texture;
            renderer.setRenderTarget(targetB);
            renderer.render(simScene, simCamera);

            drawUniforms.uPositions.value = targetB.texture;
            renderer.setRenderTarget(null);
            if (needsClear || first) { renderer.clear(); needsClear = false; }
            renderer.render(drawScene, drawCamera);

            const tmp = targetA; targetA = targetB; targetB = tmp;
            first = false;
        };
        frame();

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('scroll', readScroll);
            document.removeEventListener('mouseleave', onLeave);
            document.removeEventListener('visibilitychange', onVis);
            ro.disconnect();
            targetA.dispose();
            targetB.dispose();
            initTexture.dispose();
            particleGeo.dispose();
            particleMat.dispose();
            simMaterial.dispose();
            fadeMat.dispose();
            renderer.dispose();
            wrap.removeChild(renderer.domElement);
        };
    }, []);

    return <div ref={wrapRef} className="unified-field" aria-hidden="true" />;
}
