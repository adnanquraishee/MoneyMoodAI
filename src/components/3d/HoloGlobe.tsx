import { useMemo, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';

/** Holographic Earth: Fibonacci point-sphere, orbital rings, light pulses. */

function pointsOnSphere(n: number, radius: number): Float32Array {
    const pts = new Float32Array(n * 3);
    const phi = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
        const y = 1 - (i / (n - 1)) * 2;
        const r = Math.sqrt(1 - y * y);
        const theta = phi * i;
        pts[i * 3] = Math.cos(theta) * r * radius;
        pts[i * 3 + 1] = y * radius;
        pts[i * 3 + 2] = Math.sin(theta) * r * radius;
    }
    return pts;
}

function Globe() {
    const group = useRef<THREE.Group>(null);
    const ringA = useRef<THREE.Mesh>(null);
    const ringB = useRef<THREE.Mesh>(null);
    const pulse = useRef<THREE.Mesh>(null);

    const dots = useMemo(() => pointsOnSphere(2600, 1.6), []);
    const halo = useMemo(() => pointsOnSphere(400, 2.35), []);

    useFrame((state) => {
        const t = state.clock.elapsedTime;
        if (group.current) group.current.rotation.y = t * 0.08;
        if (ringA.current) { ringA.current.rotation.z = t * 0.18; }
        if (ringB.current) { ringB.current.rotation.z = -t * 0.12; }
        if (pulse.current) {
            const k = (t % 4) / 4;                       // light pulse every 4s
            pulse.current.scale.setScalar(1.6 + k * 1.2);
            (pulse.current.material as THREE.MeshBasicMaterial).opacity = 0.25 * (1 - k);
        }
    });

    return (
        <group>
            <group ref={group}>
                <points>
                    <bufferGeometry>
                        <bufferAttribute attach="attributes-position" args={[dots, 3]} />
                    </bufferGeometry>
                    <pointsMaterial size={0.022} color="#00e5ff" transparent opacity={0.85}
                        sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
                </points>
                <points>
                    <bufferGeometry>
                        <bufferAttribute attach="attributes-position" args={[halo, 3]} />
                    </bufferGeometry>
                    <pointsMaterial size={0.014} color="#29B6FF" transparent opacity={0.35}
                        sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
                </points>
                {/* inner glow sphere */}
                <mesh>
                    <sphereGeometry args={[1.52, 48, 48]} />
                    <meshBasicMaterial color="#062c3e" transparent opacity={0.55} />
                </mesh>
            </group>

            {/* orbital rings */}
            <mesh ref={ringA} rotation={[Math.PI / 2.4, 0.3, 0]}>
                <torusGeometry args={[2.15, 0.008, 16, 160]} />
                <meshBasicMaterial color="#00e5ff" transparent opacity={0.4} />
            </mesh>
            <mesh ref={ringB} rotation={[Math.PI / 1.8, -0.4, 0]}>
                <torusGeometry args={[2.5, 0.005, 16, 160]} />
                <meshBasicMaterial color="#29B6FF" transparent opacity={0.25} />
            </mesh>

            {/* expanding light pulse */}
            <mesh ref={pulse}>
                <sphereGeometry args={[1, 32, 32]} />
                <meshBasicMaterial color="#00e5ff" transparent opacity={0.2}
                    blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>

            <Sparkles count={70} scale={7} size={1.8} speed={0.3} color="#7ee8ff" opacity={0.5} />
        </group>
    );
}

export function HoloGlobe() {
    return (
        <div className="w-full h-full" aria-label="Holographic Earth">
            <Canvas
                camera={{ position: [0, 0.4, 5.2], fov: 45 }}
                dpr={[1, 1.6]}
                gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
            >
                <ambientLight intensity={0.4} />
                <pointLight position={[5, 3, 5]} intensity={0.6} color="#00e5ff" />
                <Suspense fallback={null}>
                    <Globe />
                </Suspense>
            </Canvas>
        </div>
    );
}
