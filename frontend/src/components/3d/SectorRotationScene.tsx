import { useMemo, useRef, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, Text, Html, OrbitControls, Float } from '@react-three/drei';
import * as THREE from 'three';
import type { SectorRotationItem } from '../../lib/types';

/**
 * RRG quadrant as a 3D holo-plane. Each sector is a glowing sphere positioned
 * by (relative strength vs NIFTY, RS momentum), sized by market cap, dragging
 * a fading weekly motion trail behind it. Drag to orbit, hover for details.
 */

export const QUADRANT_COLORS = {
    leading: '#00FF9D',
    improving: '#29B6FF',
    weakening: '#FFC24D',
    lagging: '#FF4D6D',
} as const;

const SPAN = 4.2;          // half-width of the plane in world units
const DEV = 6;             // RS-ratio/momentum deviation (±) mapped to SPAN

function toXY(x: number, y: number): [number, number] {
    const cl = (v: number) => Math.max(-DEV, Math.min(DEV, v - 100)) / DEV * SPAN * 0.92;
    return [cl(x), cl(y)];
}

function QuadrantPlane() {
    const quads: { color: string; pos: [number, number]; label: string }[] = [
        { color: QUADRANT_COLORS.leading, pos: [SPAN / 2, SPAN / 2], label: 'LEADING' },
        { color: QUADRANT_COLORS.improving, pos: [-SPAN / 2, SPAN / 2], label: 'IMPROVING' },
        { color: QUADRANT_COLORS.weakening, pos: [SPAN / 2, -SPAN / 2], label: 'WEAKENING' },
        { color: QUADRANT_COLORS.lagging, pos: [-SPAN / 2, -SPAN / 2], label: 'LAGGING' },
    ];
    const grid = useMemo(() => {
        const lines: [number, number, number][][] = [];
        const n = 8;
        for (let i = 0; i <= n; i++) {
            const p = -SPAN + (2 * SPAN * i) / n;
            lines.push([[p, -SPAN, 0], [p, SPAN, 0]]);
            lines.push([[-SPAN, p, 0], [SPAN, p, 0]]);
        }
        return lines;
    }, []);
    return (
        <group>
            {quads.map(q => (
                <group key={q.label}>
                    <mesh position={[q.pos[0], q.pos[1], -0.03]}>
                        <planeGeometry args={[SPAN, SPAN]} />
                        <meshBasicMaterial color={q.color} transparent opacity={0.045} />
                    </mesh>
                    <Text
                        position={[q.pos[0], q.pos[1] + (q.pos[1] > 0 ? SPAN / 2 - 0.35 : -SPAN / 2 + 0.35), 0.01]}
                        fontSize={0.22} color={q.color} fillOpacity={0.5}
                        letterSpacing={0.25} anchorX="center" anchorY="middle">
                        {q.label}
                    </Text>
                </group>
            ))}
            {grid.map((pts, i) => (
                <Line key={i} points={pts} color="#8ea6c9" transparent opacity={0.08} lineWidth={0.5} />
            ))}
            {/* axes through 100/100 */}
            <Line points={[[-SPAN, 0, 0], [SPAN, 0, 0]]} color="#8ea6c9" transparent opacity={0.35} lineWidth={1.2} />
            <Line points={[[0, -SPAN, 0], [0, SPAN, 0]]} color="#8ea6c9" transparent opacity={0.35} lineWidth={1.2} />
            <Text position={[SPAN - 0.1, -0.28, 0]} fontSize={0.16} color="#8ea6c9" fillOpacity={0.6} anchorX="right">
                relative strength →
            </Text>
            <Text position={[0.28, SPAN - 0.15, 0]} fontSize={0.16} color="#8ea6c9" fillOpacity={0.6}
                anchorX="left" rotation={[0, 0, -Math.PI / 2]}>
                ← momentum
            </Text>
        </group>
    );
}

function SectorNode({ s, maxMcap, dim, onHover }: {
    s: SectorRotationItem;
    maxMcap: number;
    dim: boolean;
    onHover: (name: string | null) => void;
}) {
    const [hovered, setHovered] = useState(false);
    const mesh = useRef<THREE.Mesh>(null);
    const color = QUADRANT_COLORS[s.quadrant];
    const [x, y] = toXY(s.rs_ratio, s.rs_momentum);
    const r = 0.14 + Math.sqrt((s.market_cap || 1) / (maxMcap || 1)) * 0.24;
    const trailPts = useMemo(
        () => s.trail.map((p, i) => {
            const [tx, ty] = toXY(p.x, p.y);
            return new THREE.Vector3(tx, ty, -0.02 - (s.trail.length - i) * 0.004);
        }),
        [s.trail],
    );
    const phase = useMemo(() => Math.random() * Math.PI * 2, []);

    useFrame((state) => {
        if (!mesh.current) return;
        const t = state.clock.elapsedTime;
        mesh.current.position.z = 0.12 + Math.sin(t * 0.9 + phase) * 0.05;
        const target = hovered ? 1.45 : 1;
        mesh.current.scale.lerp(new THREE.Vector3(target, target, target), 0.12);
    });

    const opacity = dim && !hovered ? 0.25 : 1;
    return (
        <group>
            {trailPts.length > 1 && (
                <Line points={trailPts} color={color} transparent opacity={0.3 * opacity} lineWidth={1.5} />
            )}
            {trailPts.map((p, i) => (
                <mesh key={i} position={p}>
                    <sphereGeometry args={[0.035, 12, 12]} />
                    <meshBasicMaterial color={color} transparent
                        opacity={(0.12 + (i / trailPts.length) * 0.3) * opacity} />
                </mesh>
            ))}
            <Float speed={1.1} rotationIntensity={0} floatIntensity={0.15}>
                <mesh
                    ref={mesh}
                    position={[x, y, 0.12]}
                    onPointerOver={(e) => { e.stopPropagation(); setHovered(true); onHover(s.sector); }}
                    onPointerOut={() => { setHovered(false); onHover(null); }}
                >
                    <sphereGeometry args={[r, 32, 32]} />
                    <meshStandardMaterial
                        color={color} emissive={color}
                        emissiveIntensity={hovered ? 0.9 : 0.45}
                        roughness={0.2} metalness={0.6}
                        transparent opacity={opacity}
                    />
                    {hovered && (
                        <Html distanceFactor={7} position={[0, r + 0.25, 0]} center style={{ pointerEvents: 'none' }}>
                            <div className="px-3 py-2 rounded-xl border border-white/15 bg-[#0a0f1d]/90
                                            backdrop-blur-xl text-white whitespace-nowrap shadow-2xl">
                                <p className="text-[13px] font-bold">{s.sector}</p>
                                <p className="text-[10px] text-gray-400 tabular-nums">
                                    RS {s.rs_ratio.toFixed(1)} · Mom {s.rs_momentum.toFixed(1)} · {s.members} stocks
                                </p>
                                {s.avg_change_pct != null && (
                                    <p className="text-[10px] tabular-nums font-bold"
                                        style={{ color: s.avg_change_pct >= 0 ? '#00FF9D' : '#FF4D6D' }}>
                                        today {s.avg_change_pct >= 0 ? '+' : ''}{s.avg_change_pct}%
                                    </p>
                                )}
                            </div>
                        </Html>
                    )}
                </mesh>
            </Float>
            <Text position={[x, y - r - 0.18, 0.12]} fontSize={0.14} color="#e5eefc"
                fillOpacity={0.85 * opacity} anchorX="center" anchorY="top" maxWidth={2.2}>
                {s.sector}
            </Text>
        </group>
    );
}

export function SectorRotationScene({ sectors, highlight, onHover }: {
    sectors: SectorRotationItem[];
    highlight: string | null;
    onHover: (name: string | null) => void;
}) {
    const maxMcap = Math.max(...sectors.map(s => s.market_cap || 0), 1);
    return (
        <Canvas
            camera={{ position: [0, -1.4, 10.2], fov: 45 }}
            dpr={[1, 1.6]}
            gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
            style={{ background: 'transparent' }}
        >
            <ambientLight intensity={0.55} />
            <directionalLight position={[4, 6, 8]} intensity={1.0} />
            <pointLight position={[-6, -4, 4]} intensity={0.4} color="#4361ee" />
            <Suspense fallback={null}>
                <group rotation={[-0.12, 0, 0]}>
                    <QuadrantPlane />
                    {sectors.map(s => (
                        <SectorNode key={s.sector} s={s} maxMcap={maxMcap}
                            dim={highlight != null && highlight !== s.sector}
                            onHover={onHover} />
                    ))}
                </group>
            </Suspense>
            <OrbitControls
                enablePan={false}
                minDistance={5.5} maxDistance={12}
                minPolarAngle={Math.PI * 0.25} maxPolarAngle={Math.PI * 0.65}
                minAzimuthAngle={-Math.PI / 5} maxAzimuthAngle={Math.PI / 5}
                rotateSpeed={0.5} zoomSpeed={0.6}
            />
        </Canvas>
    );
}
