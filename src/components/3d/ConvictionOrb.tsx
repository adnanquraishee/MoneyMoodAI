import { useMemo, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { MeshDistortMaterial, Sparkles, Float } from '@react-three/drei';
import * as THREE from 'three';

/**
 * 3D conviction visual: a living energy orb whose color, distortion and spin
 * reflect the stock's conviction score and daily move.
 *   score >= 70  -> emerald (strong)     score < 45 -> rose (weak)
 *   in-between   -> teal (neutral-good)
 * Momentum (1-day %) drives the pulse speed.
 */

function scoreColor(score: number | null): string {
    if (score == null) return '#22d3ee';
    if (score >= 70) return '#34d399';
    if (score >= 45) return '#00e5cf';
    return '#fb7185';
}

function Orb({ score, changePct }: { score: number | null; changePct: number }) {
    const mesh = useRef<THREE.Mesh>(null);
    const ring = useRef<THREE.Mesh>(null);
    const ring2 = useRef<THREE.Mesh>(null);
    const color = useMemo(() => scoreColor(score), [score]);
    const speed = 0.6 + Math.min(2, Math.abs(changePct)) * 0.5;
    const distort = 0.25 + ((score ?? 50) / 100) * 0.2;

    useFrame((state) => {
        const t = state.clock.elapsedTime;
        if (mesh.current) {
            mesh.current.rotation.y = t * 0.25;
            const s = 1 + Math.sin(t * speed) * 0.03;
            mesh.current.scale.setScalar(s);
        }
        if (ring.current) {
            ring.current.rotation.z = t * 0.4;
            ring.current.rotation.x = Math.PI / 2.6 + Math.sin(t * 0.3) * 0.12;
        }
        if (ring2.current) {
            ring2.current.rotation.z = -t * 0.25;
            ring2.current.rotation.x = Math.PI / 1.9 + Math.cos(t * 0.35) * 0.1;
        }
    });

    return (
        <group>
            <Float speed={1.2} rotationIntensity={0.2} floatIntensity={0.4}>
                <mesh ref={mesh}>
                    <icosahedronGeometry args={[1.15, 48]} />
                    <MeshDistortMaterial
                        color={color}
                        emissive={color}
                        emissiveIntensity={0.35}
                        roughness={0.15}
                        metalness={0.75}
                        distort={distort}
                        speed={speed * 1.6}
                    />
                </mesh>
            </Float>
            <mesh ref={ring}>
                <torusGeometry args={[1.75, 0.012, 16, 128]} />
                <meshBasicMaterial color={color} transparent opacity={0.45} />
            </mesh>
            <mesh ref={ring2}>
                <torusGeometry args={[2.05, 0.006, 16, 128]} />
                <meshBasicMaterial color="#8ea6c9" transparent opacity={0.22} />
            </mesh>
            <Sparkles count={45} scale={5} size={1.6} speed={0.35} color={color} opacity={0.55} />
        </group>
    );
}

export function ConvictionOrb({ score, changePct = 0 }: { score: number | null; changePct?: number }) {
    return (
        <div className="w-full h-full min-h-[180px]" aria-label="3D conviction visual">
            <Canvas
                camera={{ position: [0, 0, 5], fov: 42 }}
                dpr={[1, 1.6]}
                gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
                style={{ background: 'transparent' }}
            >
                <ambientLight intensity={0.5} />
                <directionalLight position={[4, 4, 6]} intensity={1.1} />
                <pointLight position={[-4, -2, -4]} intensity={0.5} color="#4361ee" />
                <Suspense fallback={null}>
                    <Orb score={score} changePct={changePct} />
                </Suspense>
            </Canvas>
        </div>
    );
}
