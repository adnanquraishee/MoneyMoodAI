import { useRef, useState, useEffect } from 'react';

/** Glass card that tilts toward the cursor with a moving glow hotspot. */
export function TiltCard({ children, className = '', maxTilt = 6 }: {
    children: React.ReactNode; className?: string; maxTilt?: number;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [style, setStyle] = useState<React.CSSProperties>({});
    const [glow, setGlow] = useState({ x: 50, y: 50, on: false });

    const onMove = (e: React.MouseEvent) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        setStyle({
            transform: `perspective(900px) rotateY(${(px - 0.5) * maxTilt * 2}deg) rotateX(${(0.5 - py) * maxTilt * 2}deg) translateY(-4px)`,
        });
        setGlow({ x: px * 100, y: py * 100, on: true });
    };
    const onLeave = () => {
        setStyle({ transform: 'perspective(900px) rotateY(0deg) rotateX(0deg) translateY(0)' });
        setGlow(g => ({ ...g, on: false }));
    };

    return (
        <div
            ref={ref}
            onMouseMove={onMove}
            onMouseLeave={onLeave}
            style={{ ...style, transition: 'transform 0.18s ease-out' }}
            className={`relative rounded-2xl border border-white/10 overflow-hidden
                        bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl
                        shadow-[0_10px_40px_-12px_rgba(0,0,0,0.7)]
                        hover:border-[var(--teal)]/35 hover:shadow-[0_18px_50px_-12px_rgba(0,229,255,0.18)]
                        ${className}`}
        >
            <div
                className="pointer-events-none absolute inset-0 transition-opacity duration-300"
                style={{
                    opacity: glow.on ? 1 : 0,
                    background: `radial-gradient(320px circle at ${glow.x}% ${glow.y}%, rgba(0,229,255,0.10), transparent 55%)`,
                }}
            />
            {children}
        </div>
    );
}

/** Animated count-up for premium number reveals. */
export function useCountUp(target: number | null | undefined, duration = 900): number | null {
    const [value, setValue] = useState<number | null>(null);
    useEffect(() => {
        if (target == null) { setValue(null); return; }
        let raf = 0;
        const start = performance.now();
        const tick = (now: number) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            setValue(target * eased);
            if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [target, duration]);
    return value;
}
