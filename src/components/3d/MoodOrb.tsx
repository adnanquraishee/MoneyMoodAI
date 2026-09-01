import { useMemo, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { MeshDistortMaterial, Sparkles, Float } from '@react-three/drei';
import * as THREE from 'three';

/**
 * The market's mood as a living 3D organism.
 *   color      <- mood label (bullish emerald / neutral azure / bearish rose)
 *   distortion <- India VIX (fear literally makes the surface churn)
 *   pulse      <- average market move of the day
 * Rendered transparent so it floats inside the sentiment card.
 */

const MOOD_COLORS: Record<string, string> = {
    bullish: '#00FF9D',
    neutral: '#29B6FF',
    bearish: '#FF4D6D',
};

function Core({ score, vix, avgChange }: { score: number; vix: number | null; avgChange: number }) {
    const mesh = useRef<THREE.Mesh>(null);
    const halo = useRef<THREE.Mesh>(null);
    const label = score >= 60 ? 'bullish' : score <= 40 ? 'bearish' : 'neutral';
    const color = MOOD_COLORS[label];
    // VIX 10 (calm) -> 0.15 distortion, VIX 30+ (panic) -> 0.55
    const distort = useMemo(() => {
        const v = vix ?? 15;
        return Math.min(0.55, 0.15 + Math.max(0, v - 10) * 0.02);
    }, [vix]);
    const speed = 0.8 + Math.min(2.5, Math.abs(avgChange)) * 0.7;

    useFrame((state) => {
        const t = state.clock.elapsedTime;
        if (mesh.current) {
            mesh.current.rotation.y = t * 0.22;
            mesh.current.rotation.z = Math.sin(t * 0.15) * 0.1;
            mesh.current.scale.setScalar(1 + Math.sin(t * speed) * 0.04);
        }
        if (halo.current) {
            halo.current.rotation.x = Math.PI / 2.4 + Math.sin(t * 0.25) * 0.18;
            halo.current.rotation.z = t * 0.35;
        }
    });

    return (
        <group>
            <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.5}>
                <mesh ref={mesh}>
                    <icosahedronGeometry args={[1.05, 48]} />
                    <MeshDistortMaterial
                        color={color}
                        emissive={color}
                        emissiveIntensity={0.4}
                        roughness={0.12}
                        metalness={0.7}
                        distort={distort}
                        speed={speed * 1.8}
                    />
                </mesh>
            </Float>
            <mesh ref={halo}>
                <torusGeometry args={[1.6, 0.01, 16, 128]} />
                <meshBasicMaterial color={color} transparent opacity={0.4} />
            </mesh>
            <Sparkles count={40} scale={4.5} size={1.5} speed={0.4} color={color} opacity={0.5} />
        </group>
    );
}

export function MoodOrb({ score, vix, avgChange = 0 }: {
    score: number; vix: number | null; avgChange?: number;
}) {
    return (
        <div className="w-full h-full min-h-[150px]" aria-label="3D market mood visual">
            <Canvas
                camera={{ position: [0, 0, 4.6], fov: 42 }}
                dpr={[1, 1.6]}
                gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
                style={{ background: 'transparent' }}
            >
                <ambientLight intensity={0.5} />
                <directionalLight position={[4, 4, 6]} intensity={1.1} />
                <pointLight position={[-4, -2, -4]} intensity={0.5} color="#4361ee" />
                <Suspense fallback={null}>
                    <Core score={score} vix={vix} avgChange={avgChange} />
                </Suspense>
            </Canvas>
        </div>
    );
}
