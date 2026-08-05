// WaveField — the design team's "FIELD 003" advected point-cloud ocean
// (Gerstner waves + curl/gradient drift, contour lines, twinkling crests,
// click ripples, mist), adapted as the Tidal chapter backdrop.
// Patched (Monsoon):
//   1. Light theme only, on the Monsoon paper palette — the prototype's
//      "printed chart" concept: crests are the darkest ink, troughs settle
//      into the haze. Normal blending (additive is for night water).
//   2. Scoped to its container; pauses off-screen; disposes on unmount.
//   3. Scroll-driven reveal: the sea fades/rises in as the Tidal chapter
//      arrives — crossfading with the UnifiedField's tide streams so the
//      backdrop handoff reads continuous (same trick as hero → Zephyr).
//   4. Calmer clock (0.7×) per the house motion taste; ripples skipped when
//      clicking the chapter's actual content.

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const SNOISE3 = `
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

const SNOISE2 = `
  vec3 permute2(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  float snoise2(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute2(permute2(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
`;

export default function WaveField() {
    const wrapRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const wrap = wrapRef.current;
        if (!wrap) return;

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const isMobile = /Mobi|Android/i.test(navigator.userAgent) || window.innerWidth < 720;

        // "Deeper hour" — Zephyr's blue family, one step further out to sea:
        // Zephyr is the bright surface current, Tidal is open water. Same
        // world, distinct product; the darker crest ink keeps waves defined.
        const PAPER = new THREE.Color('#f3f4f6');
        const DEEP = new THREE.Color('#bcd3e6');   // troughs settle into the haze
        const MID = new THREE.Color('#4b8fc4');    // deeper brand blue
        const CREST = new THREE.Color('#1a5d8f');  // ink — waves pop on paper
        const ACCENT = new THREE.Color('#134766'); // contours + glints

        const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
        renderer.setSize(wrap.clientWidth, wrap.clientHeight);
        renderer.setClearColor(PAPER, 1);
        wrap.appendChild(renderer.domElement);

        const floatType = renderer.capabilities.isWebGL2 ? THREE.FloatType : THREE.HalfFloatType;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(55, wrap.clientWidth / wrap.clientHeight, 0.1, 500);
        const CAM_BASE = new THREE.Vector3(0, 9.5, 26);
        camera.position.copy(CAM_BASE);
        const LOOK_AT = new THREE.Vector3(0, -2.2, -46);

        const SIM = isMobile ? 224 : 384;
        const COUNT = SIM * SIM;
        const WIDTH = 340, DEPTH = 260, Z_CENTER = -85;

        const MAX_RIPPLES = 8;
        const ripples: THREE.Vector4[] = [];
        for (let i = 0; i < MAX_RIPPLES; i++) ripples.push(new THREE.Vector4(0, 0, -1000, 0));
        let rippleIndex = 0;

        // ── Simulation ──
        const initData = new Float32Array(COUNT * 4);
        for (let i = 0; i < COUNT; i++) {
            initData[i * 4] = (Math.random() - 0.5) * WIDTH;
            initData[i * 4 + 1] = (Math.random() - 0.5) * DEPTH + Z_CENTER;
            initData[i * 4 + 2] = Math.random();
            initData[i * 4 + 3] = 0;
        }
        const initTexture = new THREE.DataTexture(initData, SIM, SIM, THREE.RGBAFormat, THREE.FloatType);
        initTexture.minFilter = THREE.NearestFilter;
        initTexture.magFilter = THREE.NearestFilter;
        initTexture.needsUpdate = true;

        const makeTarget = () =>
            new THREE.WebGLRenderTarget(SIM, SIM, {
                minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
                format: THREE.RGBAFormat, type: floatType,
                depthBuffer: false, stencilBuffer: false,
            });
        let targetA = makeTarget();
        let targetB = makeTarget();

        const simUniforms = {
            uState: { value: initTexture as THREE.Texture },
            uTime: { value: 0 },
            uDt: { value: 0.016 },
            uWind: { value: new THREE.Vector2(0.9, 0.2) },
            uRipples: { value: ripples },
        };

        const simMaterial = new THREE.ShaderMaterial({
            uniforms: simUniforms,
            vertexShader: `
              varying vec2 vUv;
              void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
            `,
            fragmentShader: `
              uniform sampler2D uState;
              uniform float uTime, uDt;
              uniform vec2 uWind;
              uniform vec4 uRipples[${MAX_RIPPLES}];
              varying vec2 vUv;
              ${SNOISE3}

              float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

              vec2 curlV(vec2 p, float t){
                float e = 0.6, s = 0.02;
                float dy = snoise(vec3((p + vec2(0.0, e)) * s, t * 0.03))
                         - snoise(vec3((p - vec2(0.0, e)) * s, t * 0.03));
                float dx = snoise(vec3((p + vec2(e, 0.0)) * s, t * 0.03))
                         - snoise(vec3((p - vec2(e, 0.0)) * s, t * 0.03));
                return vec2(dy, -dx) / (2.0 * e);
              }
              vec2 gradV(vec2 p, float t){
                float e = 0.6, s = 0.016;
                vec2 o = vec2(31.7, 8.3);
                float dx = snoise(vec3((p + vec2(e, 0.0)) * s + o.x, t * 0.02))
                         - snoise(vec3((p - vec2(e, 0.0)) * s + o.x, t * 0.02));
                float dy = snoise(vec3((p + vec2(0.0, e)) * s + o.y, t * 0.02))
                         - snoise(vec3((p - vec2(0.0, e)) * s + o.y, t * 0.02));
                return vec2(dx, dy) / (2.0 * e);
              }

              void main(){
                vec4 data = texture2D(uState, vUv);
                vec2 pos = data.xy;
                float life = data.z;

                vec2 vel = curlV(pos, uTime) * 3.2
                         + gradV(pos, uTime) * 2.2
                         + uWind * 0.5;

                for (int i = 0; i < ${MAX_RIPPLES}; i++) {
                  vec4 rp = uRipples[i];
                  float age = uTime - rp.z;
                  if (age > 0.0 && age < 2.0) {
                    vec2 d = pos - rp.xy;
                    float dist2 = dot(d, d);
                    vel += (d / (sqrt(dist2) + 0.001))
                         * exp(-dist2 * 0.02) * exp(-age * 3.0) * rp.w * 14.0;
                  }
                }

                pos += vel * uDt;

                life -= uDt / (8.0 + hash(vUv) * 7.0);
                if (life <= 0.0) {
                  pos = vec2(
                    (hash(vUv + fract(uTime)) - 0.5) * ${WIDTH.toFixed(1)},
                    (hash(vUv.yx + fract(uTime * 0.73)) - 0.5) * ${DEPTH.toFixed(1)} + ${Z_CENTER.toFixed(1)}
                  );
                  life = 1.0;
                }

                pos.x = mod(pos.x + ${(WIDTH / 2).toFixed(1)}, ${WIDTH.toFixed(1)}) - ${(WIDTH / 2).toFixed(1)};
                pos.y = mod(pos.y - (${Z_CENTER.toFixed(1)} - ${(DEPTH / 2).toFixed(1)}), ${DEPTH.toFixed(1)})
                      + (${Z_CENTER.toFixed(1)} - ${(DEPTH / 2).toFixed(1)});

                gl_FragColor = vec4(pos, life, length(vel));
              }
            `,
            depthTest: false, depthWrite: false,
        });

        const simScene = new THREE.Scene();
        const simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        simScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMaterial));

        // ── Point cloud ──
        const refs = new Float32Array(COUNT * 3);
        for (let i = 0; i < COUNT; i++) {
            refs[i * 3] = (i % SIM) / SIM + 0.5 / SIM;
            refs[i * 3 + 1] = Math.floor(i / SIM) / SIM + 0.5 / SIM;
            refs[i * 3 + 2] = Math.random();
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(refs, 3));

        const drawUniforms = {
            uState: { value: null as THREE.Texture | null },
            uTime: { value: 0 },
            uPixelRatio: { value: renderer.getPixelRatio() },
            uSize: { value: isMobile ? 1.8 : 1.5 },
            uMouse: { value: new THREE.Vector3(0, 0, 0) },
            uMouseActive: { value: 0 },
            uRipples: { value: ripples },
            uColorDeep: { value: DEEP },
            uColorMid: { value: MID },
            uColorCrest: { value: CREST },
            uAccent: { value: ACCENT },
            uFogColor: { value: PAPER },
            uReveal: { value: 0 }, // scroll-driven entrance
        };

        const drawMaterial = new THREE.ShaderMaterial({
            uniforms: drawUniforms,
            vertexShader: `
              uniform sampler2D uState;
              uniform float uTime, uPixelRatio, uSize, uMouseActive;
              uniform vec3 uMouse;
              uniform vec4 uRipples[${MAX_RIPPLES}];
              varying float vElevation, vFog, vSeed, vSpeed, vContour, vLife;
              ${SNOISE2}

              vec3 gerstner(vec2 p, vec2 dir, float amp, float wavelength, float speed, float steep, float t) {
                float k = 6.28318 / wavelength;
                float f = k * dot(dir, p) - speed * t;
                float a = steep / k;
                return vec3(dir.x * a * cos(f), amp * sin(f), dir.y * a * cos(f));
              }

              void main() {
                vec4 st = texture2D(uState, position.xy);
                vSeed = position.z;
                vSpeed = st.w;
                vLife = smoothstep(0.0, 0.06, 1.0 - st.z) * smoothstep(0.0, 0.10, st.z);

                vec3 pos = vec3(st.x, 0.0, st.y);
                vec2 p = pos.xz;

                vec3 d = vec3(0.0);
                d += gerstner(p, normalize(vec2( 1.0,  0.35)), 1.05, 46.0, 0.55, 0.5, uTime);
                d += gerstner(p, normalize(vec2( 0.7, -0.60)), 0.55, 24.0, 0.80, 0.4, uTime);
                d += gerstner(p, normalize(vec2(-0.4,  1.00)), 0.28, 12.0, 1.15, 0.3, uTime);
                d.y += snoise2(p * 0.045 + vec2(uTime * 0.05,  uTime * 0.03)) * 0.5;
                d.y += snoise2(p * 0.13  + vec2(-uTime * 0.07, uTime * 0.05)) * 0.2;

                float md = distance(p, uMouse.xz);
                d.y += exp(-md * md * 0.012) * 0.8 * uMouseActive;

                for (int i = 0; i < ${MAX_RIPPLES}; i++) {
                  vec4 rp = uRipples[i];
                  float age = uTime - rp.z;
                  if (age > 0.0 && age < 4.0) {
                    float r = distance(p, rp.xy);
                    d.y += sin(r * 1.4 - age * 5.0)
                         * exp(-r * 0.14) * exp(-age * 1.4)
                         * smoothstep(age * 4.2 + 2.0, age * 4.2 - 2.0, r) * rp.w;
                  }
                }

                pos += d;
                vElevation = d.y;

                float band = fract(d.y * 0.75);
                vContour = smoothstep(0.10, 0.0, min(band, 1.0 - band)) * smoothstep(0.1, 0.9, d.y);

                vec4 mv = modelViewMatrix * vec4(pos, 1.0);
                gl_Position = projectionMatrix * mv;
                float depth = -mv.z;
                vFog = smoothstep(30.0, 210.0, depth);

                float crest = smoothstep(0.2, 1.9, d.y);
                gl_PointSize = uSize * uPixelRatio * (1.0 + crest * 0.8 + vSeed * 0.5) * (52.0 / depth);
              }
            `,
            fragmentShader: `
              uniform vec3 uColorDeep, uColorMid, uColorCrest, uAccent, uFogColor;
              uniform float uTime, uReveal;
              varying float vElevation, vFog, vSeed, vSpeed, vContour, vLife;
              void main() {
                vec2 uv = gl_PointCoord - 0.5;
                float alpha = smoothstep(0.5, 0.12, length(uv));

                float h = smoothstep(-1.5, 2.0, vElevation);
                vec3 col = mix(uColorDeep, uColorMid, smoothstep(0.0, 0.6, h));
                col = mix(col, uColorCrest, smoothstep(0.6, 1.0, h));

                // Light mode: energy runs inkier, not brighter
                col += uColorCrest * 0.25 * smoothstep(2.0, 6.0, vSpeed) * 0.6;

                col = mix(col, uAccent, vContour * 0.30);
                float tw = 0.5 + 0.5 * sin(uTime * (0.8 + vSeed * 2.2) + vSeed * 43.0);
                col = mix(col, uAccent, smoothstep(0.86, 1.0, h) * step(0.965, vSeed) * tw);

                col = mix(col, uFogColor, vFog);

                float alpha1 = (1.0 - vFog * 0.92) * (0.45 + h * 0.55) * vLife * 1.5;
                alpha *= alpha1 * uReveal;

                if (alpha < 0.01) discard;
                gl_FragColor = vec4(col, alpha);
              }
            `,
            transparent: true, depthWrite: false, depthTest: false,
            blending: THREE.NormalBlending,
        });

        const cloud = new THREE.Points(geo, drawMaterial);
        cloud.frustumCulled = false;
        scene.add(cloud);

        // ── Mist ──
        const MIST_COUNT = isMobile ? 250 : 550;
        const mistPos = new Float32Array(MIST_COUNT * 3);
        const mistSeed = new Float32Array(MIST_COUNT);
        for (let i = 0; i < MIST_COUNT; i++) {
            mistPos[i * 3] = (Math.random() - 0.5) * WIDTH;
            mistPos[i * 3 + 1] = 1.5 + Math.random() * 8.0;
            mistPos[i * 3 + 2] = (Math.random() - 0.5) * DEPTH + Z_CENTER;
            mistSeed[i] = Math.random();
        }
        const mistGeo = new THREE.BufferGeometry();
        mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPos, 3));
        mistGeo.setAttribute('aSeed', new THREE.BufferAttribute(mistSeed, 1));
        const mistMat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: drawUniforms.uTime,
                uPixelRatio: drawUniforms.uPixelRatio,
                uWind: simUniforms.uWind,
                uReveal: drawUniforms.uReveal,
            },
            vertexShader: `
              uniform float uTime, uPixelRatio;
              uniform vec2 uWind;
              attribute float aSeed;
              varying float vFade;
              void main() {
                vec3 pos = position;
                pos.x += sin(uTime * 0.12 + aSeed * 20.0) * 3.0 + uTime * uWind.x * 1.2;
                pos.x = mod(pos.x + ${WIDTH / 2}.0, ${WIDTH}.0) - ${WIDTH / 2}.0;
                pos.y += sin(uTime * 0.2 + aSeed * 31.0) * 0.8;
                vec4 mv = modelViewMatrix * vec4(pos, 1.0);
                gl_Position = projectionMatrix * mv;
                float depth = -mv.z;
                vFade = (1.0 - smoothstep(20.0, 170.0, depth)) * (0.35 + 0.65 * aSeed);
                gl_PointSize = (1.0 + aSeed * 2.0) * uPixelRatio * (40.0 / depth);
              }
            `,
            fragmentShader: `
              uniform float uReveal;
              varying float vFade;
              void main() {
                float d = length(gl_PointCoord - 0.5);
                vec3 col = vec3(0.35, 0.47, 0.53);
                float a = smoothstep(0.5, 0.05, d) * vFade * 0.11 * uReveal;
                gl_FragColor = vec4(col, a);
              }
            `,
            transparent: true, depthWrite: false, depthTest: false,
            blending: THREE.NormalBlending,
        });
        const mist = new THREE.Points(mistGeo, mistMat);
        scene.add(mist);

        // ── Pointer: bulge follows cursor, ripples on move/click ──
        const raycaster = new THREE.Raycaster();
        const seaPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const ndc = new THREE.Vector2();
        const hit = new THREE.Vector3();
        const mouseTarget = new THREE.Vector3();
        let mouseActiveTarget = 0;
        let lastRipple = { x: 0, z: 0, t: -10 };
        const parallax = new THREE.Vector2();
        const parallaxTarget = new THREE.Vector2();

        const pointerToSea = (cx: number, cy: number) => {
            const r = wrap.getBoundingClientRect();
            if (cy < r.top || cy > r.bottom) return null;
            ndc.x = ((cx - r.left) / r.width) * 2 - 1;
            ndc.y = -((cy - r.top) / r.height) * 2 + 1;
            raycaster.setFromCamera(ndc, camera);
            return raycaster.ray.intersectPlane(seaPlane, hit);
        };
        const spawnRipple = (x: number, z: number, strength: number) => {
            ripples[rippleIndex].set(x, z, drawUniforms.uTime.value, strength);
            rippleIndex = (rippleIndex + 1) % MAX_RIPPLES;
        };

        const onPointerMove = (e: PointerEvent) => {
            parallaxTarget.set(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5);
            if (!pointerToSea(e.clientX, e.clientY)) { mouseActiveTarget = 0; return; }
            mouseTarget.copy(hit);
            mouseActiveTarget = 1;
            const t = drawUniforms.uTime.value;
            const dx = hit.x - lastRipple.x, dz = hit.z - lastRipple.z;
            if (!reduceMotion && (dx * dx + dz * dz > 30) && t - lastRipple.t > 0.22) {
                spawnRipple(hit.x, hit.z, 0.3);
                lastRipple = { x: hit.x, z: hit.z, t };
            }
        };
        window.addEventListener('pointermove', onPointerMove, { passive: true });

        const onPointerDown = (e: PointerEvent) => {
            // Content clicks (steps, buttons, the demo panel) shouldn't splash
            const target = e.target as HTMLElement;
            if (target.closest && target.closest('button, a, .chapter-panel')) return;
            if (pointerToSea(e.clientX, e.clientY) && !reduceMotion) spawnRipple(hit.x, hit.z, 1.0);
        };
        window.addEventListener('pointerdown', onPointerDown);
        const onLeave = () => { mouseActiveTarget = 0; };
        document.addEventListener('mouseleave', onLeave);

        // ── Scroll: the waterline. A feathered horizontal line sweeps up the
        // viewport as the Tidal chapter arrives — the sea is only visible
        // BELOW it, the streams only ABOVE it (masks in index.css share the
        // --monsoon-wl variable). Regions never overlap: the tide comes in.
        let revealTarget = 0;
        let lineP = 0;
        const readScroll = () => {
            const vh = window.innerHeight;
            const sy = window.scrollY;
            const tidal = document.getElementById('tidal');
            if (!tidal) return;
            const top = tidal.getBoundingClientRect().top + sy;
            lineP = Math.min(1, Math.max(0, (sy - (top - vh * 0.95)) / (vh * 0.95)));
            // 112% (below the viewport) → -12% (above it)
            document.documentElement.style.setProperty('--monsoon-wl', `${112 - lineP * 124}%`);
            // Full strength under the line; ebbs away at the chapter's end so
            // the About section sits on quiet paper
            const bottom = top + tidal.offsetHeight;
            const exitP = Math.min(1, Math.max(0, (sy - (bottom - vh * 1.25)) / (vh * 0.6)));
            revealTarget = Math.min(1, lineP * 2.5) * (1 - exitP);
        };
        readScroll();
        drawUniforms.uReveal.value = revealTarget;
        window.addEventListener('scroll', readScroll, { passive: true });

        // ── Resize / visibility ──
        const ro = new ResizeObserver(() => {
            if (!wrap.clientWidth || !wrap.clientHeight) return;
            camera.aspect = wrap.clientWidth / wrap.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(wrap.clientWidth, wrap.clientHeight);
            drawUniforms.uPixelRatio.value = renderer.getPixelRatio();
        });
        ro.observe(wrap);

        let inView = true;
        const io = new IntersectionObserver(entries => { inView = entries[0]?.isIntersecting ?? true; });
        io.observe(document.getElementById('tidal') ?? wrap);

        let running = true;
        const onVis = () => { running = !document.hidden; if (running) clock.getDelta(); };
        document.addEventListener('visibilitychange', onVis);

        // ── Loop ──
        const clock = new THREE.Clock();
        const timeScale = reduceMotion ? 0.12 : 0.7; // calmer than the prototype
        let first = true;
        let raf = 0;

        const frame = () => {
            raf = requestAnimationFrame(frame);
            if (!running || ((!inView || lineP <= 0 || (revealTarget <= 0.01 && drawUniforms.uReveal.value <= 0.02)) && !first)) return;

            const rawDt = Math.min(clock.getDelta(), 0.05);
            const dt = rawDt * timeScale;
            const t = (simUniforms.uTime.value += dt);
            drawUniforms.uTime.value = t;
            simUniforms.uDt.value = dt;

            drawUniforms.uReveal.value += (revealTarget - drawUniforms.uReveal.value) * 0.08;

            const wa = 0.35 + Math.sin(t * 0.011) * 0.5;
            const wm = 0.7 + Math.sin(t * 0.017) * 0.35;
            simUniforms.uWind.value.set(Math.cos(wa) * wm, Math.sin(wa) * wm);

            drawUniforms.uMouse.value.lerp(mouseTarget, 0.08);
            drawUniforms.uMouseActive.value += (mouseActiveTarget - drawUniforms.uMouseActive.value) * 0.05;

            simUniforms.uState.value = first ? initTexture : targetA.texture;
            renderer.setRenderTarget(targetB);
            renderer.render(simScene, simCamera);

            drawUniforms.uState.value = targetB.texture;
            renderer.setRenderTarget(null);

            parallax.lerp(parallaxTarget, 0.03);
            const breathe = reduceMotion ? 0 : 1;
            camera.position.x = CAM_BASE.x + Math.sin(t * 0.05) * 1.6 * breathe + parallax.x * 2.2;
            camera.position.y = CAM_BASE.y + Math.sin(t * 0.11) * 0.45 * breathe - parallax.y * 1.1;
            camera.position.z = CAM_BASE.z + Math.sin(t * 0.033) * 1.0 * breathe;
            camera.lookAt(LOOK_AT);

            renderer.render(scene, camera);

            const tmp = targetA; targetA = targetB; targetB = tmp;
            first = false;
        };
        frame();

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('scroll', readScroll);
            document.removeEventListener('mouseleave', onLeave);
            document.removeEventListener('visibilitychange', onVis);
            ro.disconnect();
            io.disconnect();
            targetA.dispose();
            targetB.dispose();
            initTexture.dispose();
            geo.dispose();
            mistGeo.dispose();
            drawMaterial.dispose();
            mistMat.dispose();
            simMaterial.dispose();
            renderer.dispose();
            wrap.removeChild(renderer.domElement);
        };
    }, []);

    return <div ref={wrapRef} className="wave-field" aria-hidden="true" />;
}
