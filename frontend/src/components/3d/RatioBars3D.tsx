import { useMemo, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text, Float, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

export interface RatioBarDatum {
    label: string;
    value: number | null;   // 0..100
}

function barColor(v: number): THREE.Color {
    // rose (0) -> teal (50) -> emerald (100)
    const c = new THREE.Color();
    if (v < 50) c.lerpColors(new THREE.Color('#fb7185'), new THREE.Color('#00e5cf'), v / 50);
    else c.lerpColors(new THREE.Color('#00e5cf'), new THREE.Color('#34d399'), (v - 50) / 50);
    return c;
}

function Bar({ datum, x }: { datum: RatioBarDatum; x: number }) {
    const mesh = useRef<THREE.Mesh>(null);
    const target = Math.max(0.06, ((datum.value ?? 0) / 100) * 2.2);
    const color = useMemo(() => barColor(datum.value ?? 0), [datum.value]);

    useFrame((state) => {
        if (!mesh.current) return;
        // grow-in animation + gentle breathing
        const t = state.clock.elapsedTime;
        const current = mesh.current.scale.y;
        const next = THREE.MathUtils.lerp(current, 1, 0.06);
        mesh.current.scale.y = next;
        mesh.current.position.y = (target * next) / 2;
        (mesh.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
            0.35 + Math.sin(t * 1.4 + x) * 0.12;
    });

    return (
        <group position={[x, 0, 0]}>
            <mesh ref={mesh} scale={[1, 0.01, 1]}>
                <boxGeometry args={[0.55, target, 0.55]} />
                <meshStandardMaterial
                    color={color} emissive={color} emissiveIntensity={0.4}
                    roughness={0.25} metalness={0.55} transparent opacity={0.92}
                />
            </mesh>
            {/* glass pedestal */}
            <mesh position={[0, -0.045, 0]}>
                <boxGeometry args={[0.8, 0.06, 0.8]} />
                <meshStandardMaterial color="#1a2436" roughness={0.4} metalness={0.6} />
            </mesh>
            <Text position={[0, -0.32, 0.28]} fontSize={0.16} color="#8ea6c9"
                anchorX="center" anchorY="middle" maxWidth={1.4} textAlign="center">
                {datum.label}
            </Text>
            <Text position={[0, target + 0.22, 0]} fontSize={0.22} color="#e2e8f0"
                anchorX="center" anchorY="middle" fontWeight={700 as any}>
                {datum.value != null ? datum.value.toFixed(0) : '—'}
            </Text>
        </group>
    );
}

/** Interactive 3D percentile bars — drag to orbit, auto-rotates slowly. */
export function RatioBars3D({ data, height = 260 }: { data: RatioBarDatum[]; height?: number }) {
    const spacing = 1.15;
    const offset = ((data.length - 1) * spacing) / 2;
    return (
        <div style={{ height }} className="w-full cursor-grab active:cursor-grabbing">
            <Canvas
                camera={{ position: [0, 2.3, 5.4], fov: 40 }}
                dpr={[1, 1.6]}
                gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
            >
                <ambientLight intensity={0.55} />
                <directionalLight position={[4, 6, 5]} intensity={1.1} />
                <pointLight position={[-5, 3, -3]} intensity={0.4} color="#4361ee" />
                <Suspense fallback={null}>
                    <Float speed={1} rotationIntensity={0.04} floatIntensity={0.15}>
                        <group position={[0, -0.9, 0]}>
                            {data.map((d, i) => <Bar key={d.label} datum={d} x={i * spacing - offset} />)}
                            {/* floor grid */}
                            <gridHelper args={[9, 18, '#1e293b', '#141c2c']} position={[0, -0.08, 0]} />
                        </group>
                    </Float>
                </Suspense>
                <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.7}
                    minPolarAngle={Math.PI / 3.2} maxPolarAngle={Math.PI / 2.05} />
            </Canvas>
        </div>
    );
}
