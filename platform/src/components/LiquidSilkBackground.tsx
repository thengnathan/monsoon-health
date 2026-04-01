import { useEffect, useRef } from "react";
import * as THREE from "three";

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

const fragmentShader = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec3  uColor;
uniform float uSpeed;
uniform float uScale;
uniform float uRotation;
uniform float uNoiseIntensity;

float noise(vec2 texCoord) {
  vec2 r = (2.71828 * sin(2.71828 * texCoord));
  return fract(r.x * r.y * (1.0 + texCoord.x));
}

vec2 rotateUvs(vec2 uv, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c) * uv;
}

void main() {
  float rnd = noise(gl_FragCoord.xy);
  vec2 uv = rotateUvs(vUv, uRotation);
  vec2 tex = uv * uScale;
  float tOffset = uSpeed * uTime;

  tex.y += 0.03 * sin(6.0 * tex.x - tOffset);
  tex.x += 0.015 * sin(4.0 * tex.y + tOffset * 0.5);

  float pattern = 0.6 + 0.4 * sin(
    5.0 * (tex.x + tex.y + cos(3.0 * tex.x + 5.0 * tex.y) + 0.02 * tOffset)
    + sin(20.0 * (tex.x + tex.y - 0.1 * tOffset))
  );

  vec3 baseColor = uColor * pattern;
  baseColor -= (rnd / 15.0) * uNoiseIntensity;

  gl_FragColor = vec4(baseColor, 1.0);
}
`;

interface LiquidSilkBackgroundProps {
    color?: string;
    speed?: number;
    scale?: number;
    noiseIntensity?: number;
    rotation?: number;
}

export default function LiquidSilkBackground({
    color = "#0d1f2d",
    speed = 1.4,
    scale = 1,
    noiseIntensity = 0.4,
    rotation = 1.2,
}: LiquidSilkBackgroundProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const geometry = new THREE.PlaneGeometry(2, 2);

        const safeColor = new THREE.Color(color).convertSRGBToLinear();

        const uniforms = {
            uTime: { value: 0 },
            uSpeed: { value: speed },
            uScale: { value: scale },
            uColor: { value: safeColor },
            uNoiseIntensity: { value: noiseIntensity },
            uRotation: { value: rotation },
        };

        const material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms,
            depthWrite: false,
            depthTest: false,
        });

        scene.add(new THREE.Mesh(geometry, material));

        const clock = new THREE.Clock();
        let animFrame = 0;

        const handleResize = () => {
            renderer.setSize(window.innerWidth, window.innerHeight, false);
        };

        handleResize();
        window.addEventListener("resize", handleResize);

        const render = () => {
            uniforms.uTime.value = clock.getElapsedTime();
            renderer.render(scene, camera);
            animFrame = requestAnimationFrame(render);
        };

        render();

        return () => {
            cancelAnimationFrame(animFrame);
            window.removeEventListener("resize", handleResize);
            renderer.dispose();
            geometry.dispose();
            material.dispose();
        };
    }, [color, speed, scale, noiseIntensity, rotation]);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                zIndex: 0,
                pointerEvents: "none",
            }}
        />
    );
}
