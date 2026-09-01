// CSS-based Chromatic Aberration + Vignette overlay
// Replaces @react-three/postprocessing (incompatible with Three.js r165+)
import { useEffect, useRef } from 'react';

interface Props {
  scrollVelocity: number; // 0–60 range
}

export function PostFX({ scrollVelocity }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Vignette
      const vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.9);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.72)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);

      animId = requestAnimationFrame(draw);
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // Chromatic aberration: CSS mix-blend-mode overlay strength via opacity
  const aberrationStrength = Math.min(scrollVelocity / 60, 1);
  const aberrationOpacity = 0.02 + aberrationStrength * 0.18;

  return (
    <>
      {/* Vignette canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 5,
        }}
      />

      {/* Chromatic aberration: red channel offset */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: `-${aberrationStrength * 3}px`,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 6,
          background: 'radial-gradient(ellipse at 0% 50%, rgba(255,0,60,0.06) 0%, transparent 60%), radial-gradient(ellipse at 100% 50%, rgba(0,255,200,0.06) 0%, transparent 60%)',
          opacity: aberrationOpacity,
          mixBlendMode: 'screen',
        }}
      />

      {/* Cyan channel offset */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: `${aberrationStrength * 3}px`,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 6,
          background: 'radial-gradient(ellipse at 100% 50%, rgba(0,120,255,0.06) 0%, transparent 60%)',
          opacity: aberrationOpacity,
          mixBlendMode: 'screen',
        }}
      />
    </>
  );
}

