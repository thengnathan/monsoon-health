// FlowField — GPGPU curl-noise particle flow (ported from the design team's
// "FIELD 002" prototype, adapted for Monsoon's light theme).
// Patched (Monsoon):
//   1. Dark → light inversion: the original composited additive glow over
//      near-black; on paper we clear to the page color, fade trails with a
//      translucent paper quad, and draw ink-on-paper particles with normal
//      alpha blending (additive is invisible on white).
//   2. Single-hue colorway: pale blue → brand blue by particle speed; the
//      sunrise-warm cast is removed (one color, per the house rule).
//   3. Calmer: global time scale 0.45, weaker advection and cursor forces,
//      longer particle lives.
//   4. Runs scoped to its container (not the window) and pauses via
//      IntersectionObserver when the chapter is off-screen.

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

export default function FlowField() {
    const wrapRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const wrap = wrapRef.current;
        if (!wrap) return;

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const isMobile = /Mobi|Android/i.test(navigator.userAgent) || window.innerWidth < 720;

        const PAPER = new THREE.Color('#f3f4f6');

        // ── Renderer, scoped to the container ──
        const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
        renderer.setSize(wrap.clientWidth, wrap.clientHeight);
        renderer.setClearColor(PAPER, 1);
        renderer.autoClear = false;
        wrap.appendChild(renderer.domElement);

        const isWebGL2 = renderer.capabilities.isWebGL2;
        const floatType = isWebGL2 ? THREE.FloatType : THREE.HalfFloatType;

        // ── Simulation state texture: (x, y, life, speed) per texel ──
        const SIM = isMobile ? 192 : 320;
        const COUNT = SIM * SIM;
        let aspect = wrap.clientWidth / wrap.clientHeight;

        const initData = new Float32Array(COUNT * 4);
        for (let i = 0; i < COUNT; i++) {
            initData[i * 4] = (Math.random() * 2 - 1) * aspect;
            initData[i * 4 + 1] = Math.random() * 2 - 1;
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

        // ── Simulation pass ──
        const simUniforms = {
            uPositions: { value: initTexture as THREE.Texture },
            uTime: { value: 0 },
            uDt: { value: 0.016 },
            uAspect: { value: aspect },
            uMouse: { value: new THREE.Vector2(10, 10) },
            uMouseVel: { value: new THREE.Vector2(0, 0) },
            uMouseActive: { value: 0 },
        };

        const simMaterial = new THREE.ShaderMaterial({
            uniforms: simUniforms,
            vertexShader: `
              varying vec2 vUv;
              void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
            `,
            fragmentShader: `
              uniform sampler2D uPositions;
              uniform float uTime, uDt, uAspect, uMouseActive;
              uniform vec2 uMouse, uMouseVel;
              varying vec2 vUv;
              ${NOISE_GLSL}

              float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
              }

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

                // Patched (Monsoon): weaker advection — calm currents
                vec2 vel = curl(pos, uTime) * 0.12;

                vec2 dm = pos - uMouse;
                float infl = exp(-dot(dm, dm) * 14.0) * uMouseActive;
                vel += vec2(-dm.y, dm.x) * infl * 0.45;
                vel += uMouseVel * infl * 0.8;

                pos += vel * uDt;
                // Patched (Monsoon): longer lives, gentler churn
                life -= uDt / (7.0 + hash(vUv) * 7.0);

                if (life <= 0.0 || abs(pos.x) > uAspect * 1.04 || abs(pos.y) > 1.04) {
                  pos = vec2(
                    (hash(vUv + fract(uTime)) - 0.5) * 2.0 * uAspect,
                    (hash(vUv.yx + fract(uTime * 0.73)) - 0.5) * 2.0
                  );
                  life = 1.0;
                }

                gl_FragColor = vec4(pos, life, length(vel));
              }
            `,
            depthTest: false,
            depthWrite: false,
        });

        const simScene = new THREE.Scene();
        const simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        simScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMaterial));

        // ── Draw pass ──
        const drawScene = new THREE.Scene();
        const drawCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        // Patched (Monsoon): trails fade toward PAPER, not toward black
        const fadeMat = new THREE.MeshBasicMaterial({
            color: PAPER,
            transparent: true,
            opacity: reduceMotion ? 0.14 : 0.06,
            depthTest: false,
            depthWrite: false,
        });
        const fadeQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fadeMat);
        fadeQuad.renderOrder = 0;
        drawScene.add(fadeQuad);

        const refs = new Float32Array(COUNT * 3);
        for (let i = 0; i < COUNT; i++) {
            refs[i * 3] = (i % SIM) / SIM + 0.5 / SIM;
            refs[i * 3 + 1] = Math.floor(i / SIM) / SIM + 0.5 / SIM;
        }
        const particleGeo = new THREE.BufferGeometry();
        particleGeo.setAttribute('position', new THREE.BufferAttribute(refs, 3));

        const drawUniforms = {
            uPositions: { value: null as THREE.Texture | null },
            uAspect: { value: aspect },
            uPixelRatio: { value: renderer.getPixelRatio() },
            // Patched (Monsoon): one hue — light blue → brand blue by speed
            uColorSlow: { value: new THREE.Color('#a4c9e8') },
            uColorMid: { value: new THREE.Color('#5fa3d6') },
            uColorFast: { value: new THREE.Color('#2477af') },
        };

        const particleMat = new THREE.ShaderMaterial({
            uniforms: drawUniforms,
            vertexShader: `
              uniform sampler2D uPositions;
              uniform float uAspect, uPixelRatio;
              varying float vSpeed;
              varying float vFade;
              void main() {
                vec4 d = texture2D(uPositions, position.xy);
                vSpeed = d.w;
                vFade = smoothstep(0.0, 0.10, d.z) * smoothstep(1.0, 0.94, d.z);
                gl_Position = vec4(d.x / uAspect, d.y, 0.0, 1.0);
                gl_PointSize = uPixelRatio * (1.5 + smoothstep(0.10, 0.8, vSpeed) * 1.4);
              }
            `,
            fragmentShader: `
              uniform vec3 uColorSlow, uColorMid, uColorFast;
              varying float vSpeed, vFade;
              void main() {
                float d = length(gl_PointCoord - 0.5);
                float mask = smoothstep(0.5, 0.15, d);

                // Slow water is pale; fast filaments deepen to brand blue
                float s = smoothstep(0.03, 0.8, vSpeed);
                vec3 col = mix(uColorSlow, uColorMid, smoothstep(0.0, 0.55, s));
                col = mix(col, uColorFast, smoothstep(0.55, 1.0, s));

                float alpha = mask * vFade * (0.24 + s * 0.5);
                if (alpha < 0.005) discard;
                gl_FragColor = vec4(col, alpha);
              }
            `,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            // Patched (Monsoon): normal blending — additive is invisible on paper
            blending: THREE.NormalBlending,
        });

        const particles = new THREE.Points(particleGeo, particleMat);
        particles.frustumCulled = false;
        particles.renderOrder = 1;
        drawScene.add(particles);

        // ── Pointer, relative to the container ──
        const mouse = new THREE.Vector2(10, 10);
        const mouseVel = new THREE.Vector2(0, 0);
        let mouseActiveTarget = 0;
        let lastMouse: { x: number; y: number } | null = null;

        const onPointerMove = (e: PointerEvent) => {
            const r = wrap.getBoundingClientRect();
            if (e.clientY < r.top || e.clientY > r.bottom) { mouseActiveTarget = 0; lastMouse = null; return; }
            const x = ((e.clientX - r.left) / r.width * 2 - 1) * aspect;
            const y = -((e.clientY - r.top) / r.height * 2 - 1);
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

        // ── Resize / visibility ──
        let needsClear = true;
        const ro = new ResizeObserver(() => {
            if (!wrap.clientWidth || !wrap.clientHeight) return;
            aspect = wrap.clientWidth / wrap.clientHeight;
            renderer.setSize(wrap.clientWidth, wrap.clientHeight);
            simUniforms.uAspect.value = aspect;
            drawUniforms.uAspect.value = aspect;
            drawUniforms.uPixelRatio.value = renderer.getPixelRatio();
            needsClear = true;
        });
        ro.observe(wrap);

        let inView = true;
        const io = new IntersectionObserver(entries => { inView = entries[0]?.isIntersecting ?? true; });
        io.observe(wrap);

        let running = true;
        const onVis = () => { running = !document.hidden; if (running) clock.getDelta(); };
        document.addEventListener('visibilitychange', onVis);

        // ── Loop ──
        const clock = new THREE.Clock();
        // Patched (Monsoon): global calm — slightly less than half speed
        const timeScale = reduceMotion ? 0.1 : 0.45;
        let first = true;
        let raf = 0;

        const frame = () => {
            raf = requestAnimationFrame(frame);
            if (!running || !inView) return;

            const dt = Math.min(clock.getDelta(), 0.05) * timeScale;
            simUniforms.uTime.value += dt;
            simUniforms.uDt.value = dt;

            simUniforms.uMouse.value.lerp(mouse, 0.2);
            simUniforms.uMouseActive.value += (mouseActiveTarget - simUniforms.uMouseActive.value) * 0.06;
            mouseVel.multiplyScalar(0.92);
            simUniforms.uMouseVel.value.copy(mouseVel);

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
            document.removeEventListener('mouseleave', onLeave);
            document.removeEventListener('visibilitychange', onVis);
            ro.disconnect();
            io.disconnect();
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

    return <div ref={wrapRef} className="flow-field" aria-hidden="true" />;
}
