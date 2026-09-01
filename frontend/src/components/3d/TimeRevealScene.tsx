import { useRef, Suspense, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { MeshDistortMaterial, Sparkles, Float, Html } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';

/**
 * The "travel to today" and reveal visual for Try Trade in Time.
 *
 * phase 'travel'  — a sealed, fast-spinning orb: years are passing.
 * phase 'reveal'  — the orb settles and takes the outcome's colour; the
 *                   company name and today's price rise out of it.
 *
 * Colour is lerped every frame rather than switched, so the moment of
 * reveal reads as the orb "deciding" rather than a cut.
 */

const TEAL = new THREE.Color('#00e5cf');
const GREEN = new THREE.Color('#34d399');
const RED = new THREE.Color('#fb7185');
const SEAL = new THREE.Color('#8ea6c9');

function Orb({ phase, positive }: { phase: 'travel' | 'reveal'; positive: boolean | null }) {
    const mesh = useRef<THREE.Mesh>(null);
    const mat = useRef<any>(null);
    const ring = useRef<THREE.Mesh>(null);
    const ring2 = useRef<THREE.Mesh>(null);
    const target = useMemo(() => {
        if (phase === 'travel') return SEAL;
        if (positive === null) return TEAL;
        return positive ? GREEN : RED;
    }, [phase, positive]);
    const cur = useRef(new THREE.Color(SEAL));

    useFrame((state, dt) => {
        const t = state.clock.elapsedTime;
        const travelling = phase === 'travel';
        cur.current.lerp(target, Math.min(1, dt * (travelling ? 1.5 : 2.5)));
        if (mat.current) {
            mat.current.color.copy(cur.current);
            mat.current.emissive.copy(cur.current);
            mat.current.emissiveIntensity = travelling ? 0.25 : 0.55;
            mat.current.distort = travelling ? 0.55 : 0.28;
            mat.current.speed = travelling ? 6 : 1.6;
        }
        if (mesh.current) {
            mesh.current.rotation.y += dt * (travelling ? 3.2 : 0.3);
            mesh.current.rotation.x += dt * (travelling ? 1.1 : 0.05);
            const pulse = travelling ? 1 + Math.sin(t * 9) * 0.05 : 1.12 + Math.sin(t * 1.4) * 0.03;
            mesh.current.scale.setScalar(THREE.MathUtils.lerp(mesh.current.scale.x, pulse, 0.1));
        }
        if (ring.current) {
            ring.current.rotation.z += dt * (travelling ? 4 : 0.4);
            ring.current.rotation.x = Math.PI / 2.6 + Math.sin(t * 0.3) * 0.12;
        }
        if (ring2.current) {
            ring2.current.rotation.z -= dt * (travelling ? 2.5 : 0.25);
            ring2.current.rotation.x = Math.PI / 1.9 + Math.cos(t * 0.35) * 0.1;
        }
    });

    return (
        <group>
            <Float speed={phase === 'travel' ? 4 : 1.2} rotationIntensity={0.2} floatIntensity={0.4}>
                <mesh ref={mesh}>
                    <icosahedronGeometry args={[1.15, 48]} />
                    <MeshDistortMaterial
                        ref={mat}
                        color="#8ea6c9"
                        emissive="#8ea6c9"
                        emissiveIntensity={0.25}
                        roughness={0.15}
                        metalness={0.75}
                        distort={0.5}
                        speed={5}
                    />
                </mesh>
            </Float>
            <mesh ref={ring}>
                <torusGeometry args={[1.75, 0.012, 16, 128]} />
                <meshBasicMaterial color="#8ea6c9" transparent opacity={0.45} />
            </mesh>
            <mesh ref={ring2}>
                <torusGeometry args={[2.05, 0.006, 16, 128]} />
                <meshBasicMaterial color="#8ea6c9" transparent opacity={0.22} />
            </mesh>
            <Sparkles
                count={phase === 'travel' ? 120 : 50}
                scale={6}
                size={phase === 'travel' ? 2.4 : 1.6}
                speed={phase === 'travel' ? 3 : 0.35}
                color={phase === 'travel' ? '#8ea6c9' : positive ? '#34d399' : '#fb7185'}
                opacity={0.6}
            />
        </group>
    );
}

export function TimeRevealScene({
    phase, positive, name, priceNow, pct, yearsLabel,
}: {
    phase: 'travel' | 'reveal';
    positive: boolean | null;
    name?: string;
    priceNow?: string;
    pct?: string;
    yearsLabel?: string;
}) {
    return (
        <div className="relative w-full h-[340px] md:h-[400px]" aria-label="Time travel reveal">
            <Canvas
                camera={{ position: [0, 0, 5.2], fov: 42 }}
                dpr={[1, 1.6]}
                gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
                style={{ background: 'transparent' }}
            >
                <ambientLight intensity={0.5} />
                <directionalLight position={[4, 4, 6]} intensity={1.1} />
                <pointLight position={[-4, -2, -4]} intensity={0.5} color="#4361ee" />
                <Suspense fallback={null}>
                    <Orb phase={phase} positive={positive} />
                    <Html center position={[0, -2.35, 0]} style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}>
                        <AnimatePresence mode="wait">
                            {phase === 'travel' ? (
                                <motion.div
                                    key="travel"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="text-center"
                                >
                                    <p className="text-[10px] uppercase tracking-[0.35em] text-gray-400">Travelling</p>
                                    <p className="text-sm text-gray-300 mt-1">{yearsLabel ?? 'to today'}</p>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="reveal"
                                    initial={{ opacity: 0, y: 24, scale: 0.9 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.35 }}
                                    className="text-center"
                                >
                                    <p className="text-[10px] uppercase tracking-[0.35em] text-gray-400">It was</p>
                                    <p className="text-2xl md:text-3xl font-bold text-white mt-1 drop-shadow-[0_0_18px_rgba(0,0,0,0.9)]">{name}</p>
                                    <p className={`text-lg font-bold mt-1 tabular-nums ${positive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {priceNow} today · {pct}
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </Html>
                </Suspense>
            </Canvas>
        </div>
    );
}
