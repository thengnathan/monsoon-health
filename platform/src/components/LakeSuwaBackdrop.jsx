import { useEffect, useRef, useState } from "react";

/*
 * Grand Seiko SLGA021 "Lake Suwa" dial backdrop.
 * Horizontal flowing wave texture like wind across a lake surface.
 */

function LakeSuwaBackdrop() {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
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
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    ctx.scale(dpr, dpr);

    const W = size.w;
    const H = size.h;

    // Wave layer config — each layer is a horizontal wave band system
    const waveLayers = [
      // Deep background waves (large, slow)
      { count: 35, ampBase: 6, freqX: 0.003, speedX: 0.08, opacity: 0.09, lineWidth: 1.8, hueShift: -8, lightShift: -6 },
      // Mid waves
      { count: 45, ampBase: 4, freqX: 0.005, speedX: 0.12, opacity: 0.07, lineWidth: 1.2, hueShift: 0, lightShift: 0 },
      // Surface detail waves (small, faster)
      { count: 60, ampBase: 2.5, freqX: 0.008, speedX: 0.18, opacity: 0.055, lineWidth: 0.7, hueShift: 5, lightShift: 4 },
      // Fine shimmer waves
      { count: 80, ampBase: 1.5, freqX: 0.012, speedX: 0.22, opacity: 0.035, lineWidth: 0.4, hueShift: 8, lightShift: 6 },
    ];

    // Precompute Y spacing for each layer
    waveLayers.forEach((layer) => {
      layer.ySpacing = H / (layer.count + 1);
    });

    function drawFrame(timestamp) {
      const t = timestamp * 0.001;

      // Deep blue base
      ctx.fillStyle = "#0a1628";
      ctx.fillRect(0, 0, W, H);

      // Subtle depth gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, "rgba(15, 35, 70, 0.4)");
      bgGrad.addColorStop(0.3, "rgba(10, 22, 50, 0.2)");
      bgGrad.addColorStop(0.7, "rgba(8, 18, 40, 0.3)");
      bgGrad.addColorStop(1, "rgba(5, 12, 30, 0.5)");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Draw each wave layer
      waveLayers.forEach((layer) => {
        for (let i = 0; i < layer.count; i++) {
          const baseY = (i + 1) * layer.ySpacing;
          const waveIndex = i / layer.count;

          // Vary amplitude per wave line
          const amp =
            layer.ampBase *
            (0.6 + 0.8 * Math.sin(waveIndex * Math.PI)) *
            (1 + 0.3 * Math.sin(t * 0.1 + i * 0.5));

          const phaseOffset = i * 1.7 + t * layer.speedX;
          const phaseOffset2 = i * 2.3 - t * layer.speedX * 0.7;
          const phaseOffset3 = i * 0.9 + t * layer.speedX * 0.4;

          // Color variation per line
          const hue = 212 + layer.hueShift + Math.sin(t * 0.08 + i * 0.3) * 6;
          const sat = 50 + Math.sin(t * 0.12 + i * 0.2) * 8;
          const light =
            32 +
            layer.lightShift +
            Math.sin(t * 0.1 + i * 0.15) * 5 +
            8 * Math.sin(waveIndex * Math.PI);

          // Opacity breathing
          const alpha =
            layer.opacity *
            (0.7 + 0.3 * Math.sin(t * 0.15 + i * 0.4)) *
            (0.5 + 0.5 * Math.sin(waveIndex * Math.PI));

          ctx.beginPath();
          ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`;
          ctx.lineWidth = layer.lineWidth * (0.7 + 0.3 * Math.sin(waveIndex * Math.PI));

          const step = 3;
          for (let x = -10; x <= W + 10; x += step) {
            const xNorm = x / W;

            // Layer multiple sine waves for organic water movement
            const y1 = Math.sin(x * layer.freqX + phaseOffset) * amp;
            const y2 = Math.sin(x * layer.freqX * 1.8 + phaseOffset2) * amp * 0.5;
            const y3 = Math.sin(x * layer.freqX * 3.2 + phaseOffset3) * amp * 0.25;
            const y4 = Math.sin(x * layer.freqX * 0.5 + t * 0.05 + i * 0.8) * amp * 0.8;

            // Gentle vertical drift
            const yDrift = Math.sin(t * 0.06 + i * 0.3) * 3;

            // Horizontal envelope for natural edge falloff
            const envelope = Math.sin(xNorm * Math.PI) * 0.3 + 0.7;

            const finalY = baseY + (y1 + y2 + y3 + y4) * envelope + yDrift;

            if (x === -10) ctx.moveTo(x, finalY);
            else ctx.lineTo(x, finalY);
          }
          ctx.stroke();
        }
      });

      // Broad light reflections drifting across surface
      for (let i = 0; i < 3; i++) {
        const refX = W * (0.2 + 0.3 * i) + Math.sin(t * 0.04 + i * 2) * W * 0.15;
        const refY = H * 0.3 + Math.sin(t * 0.05 + i * 1.5) * H * 0.2;
        const refAlpha = 0.025 + 0.015 * Math.sin(t * 0.12 + i * 1.8);
        const refSize = 250 + 100 * Math.sin(t * 0.08 + i);

        const rg = ctx.createRadialGradient(refX, refY, 0, refX, refY, refSize);
        rg.addColorStop(0, `rgba(130, 170, 220, ${refAlpha})`);
        rg.addColorStop(0.5, `rgba(100, 145, 200, ${refAlpha * 0.4})`);
        rg.addColorStop(1, "rgba(80, 120, 180, 0)");
        ctx.fillStyle = rg;
        ctx.fillRect(refX - refSize, refY - refSize, refSize * 2, refSize * 2);
      }

      // Highlight streaks — horizontal light catching wave crests
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (let i = 0; i < 12; i++) {
        const sy = H * 0.1 + (H * 0.8 * i) / 12 + Math.sin(t * 0.07 + i * 1.1) * 20;
        const sx = W * 0.1 + Math.sin(t * 0.05 + i * 0.9) * W * 0.1;
        const sw = W * 0.3 + Math.sin(t * 0.09 + i * 0.6) * W * 0.15;
        const sa = 0.008 + 0.006 * Math.sin(t * 0.15 + i * 2.1);

        const sg = ctx.createLinearGradient(sx, sy, sx + sw, sy);
        sg.addColorStop(0, "rgba(120, 165, 215, 0)");
        sg.addColorStop(0.3, `rgba(140, 180, 225, ${sa})`);
        sg.addColorStop(0.7, `rgba(140, 180, 225, ${sa})`);
        sg.addColorStop(1, "rgba(120, 165, 215, 0)");

        ctx.fillStyle = sg;
        ctx.fillRect(sx, sy - 15, sw, 30);
      }
      ctx.restore();

      animRef.current = requestAnimationFrame(drawFrame);
    }

    animRef.current = requestAnimationFrame(drawFrame);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [size]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        background: "#0a1628",
      }}
    >
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
            "radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(4, 8, 18, 0.45) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Grain for metallic dial texture */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.04,
          pointerEvents: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "256px 256px",
        }}
      />

      {/* Demo login */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
        }}
      >
        <div
          style={{
            width: 380,
            padding: "48px 40px",
            borderRadius: 16,
            background: "rgba(10, 18, 35, 0.55)",
            backdropFilter: "blur(40px)",
            WebkitBackdropFilter: "blur(40px)",
            border: "1px solid rgba(80, 120, 180, 0.1)",
            boxShadow: "0 32px 80px rgba(0, 0, 0, 0.35)",
          }}
        >
          <h2
            style={{
              margin: "0 0 8px 0",
              fontSize: 24,
              fontWeight: 300,
              color: "rgba(200, 215, 235, 0.9)",
              letterSpacing: "0.04em",
              fontFamily: "'SF Pro Display', 'Helvetica Neue', -apple-system, sans-serif",
            }}
          >
            Welcome back
          </h2>
          <p
            style={{
              margin: "0 0 32px 0",
              fontSize: 14,
              color: "rgba(140, 165, 200, 0.55)",
              fontFamily: "'SF Pro Text', 'Helvetica Neue', -apple-system, sans-serif",
            }}
          >
            Sign in to continue
          </p>

          {[{ type: "email", ph: "Email" }, { type: "password", ph: "Password" }].map(
            (field, idx) => (
              <div key={field.type} style={{ marginBottom: idx === 0 ? 16 : 24 }}>
                <input
                  type={field.type}
                  placeholder={field.ph}
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    borderRadius: 10,
                    border: "1px solid rgba(80, 120, 180, 0.12)",
                    background: "rgba(12, 20, 40, 0.5)",
                    color: "rgba(200, 215, 235, 0.9)",
                    fontSize: 15,
                    outline: "none",
                    fontFamily: "'SF Pro Text', 'Helvetica Neue', -apple-system, sans-serif",
                    boxSizing: "border-box",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "rgba(80, 130, 200, 0.3)")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(80, 120, 180, 0.12)")}
                />
              </div>
            )
          )}

          <button
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: 10,
              border: "none",
              background: "linear-gradient(135deg, rgba(45, 85, 145, 0.7), rgba(30, 60, 115, 0.8))",
              color: "rgba(200, 215, 235, 0.95)",
              fontSize: 15,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "'SF Pro Text', 'Helvetica Neue', -apple-system, sans-serif",
              letterSpacing: "0.02em",
              transition: "opacity 0.2s",
            }}
            onMouseEnter={(e) => (e.target.style.opacity = "0.85")}
            onMouseLeave={(e) => (e.target.style.opacity = "1")}
          >
            Sign in
          </button>

          <p
            style={{
              margin: "20px 0 0 0",
              fontSize: 13,
              color: "rgba(120, 150, 190, 0.45)",
              textAlign: "center",
              fontFamily: "'SF Pro Text', 'Helvetica Neue', -apple-system, sans-serif",
            }}
          >
            Forgot password?
          </p>
        </div>
      </div>
    </div>
  );
}

export default LakeSuwaBackdrop;
