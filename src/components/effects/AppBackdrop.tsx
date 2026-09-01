import { Canvas, useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { useRef, Suspense } from 'react';
import * as THREE from 'three';

function DriftingStars() {
    const group = useRef<THREE.Group>(null);
    useFrame((state) => {
        const t = state.clock.elapsedTime;
        if (group.current) {
            group.current.rotation.y = t * 0.008;
            group.current.rotation.x = Math.sin(t * 0.02) * 0.04;
        }
    });
    return (
        <group ref={group}>
            <Stars radius={90} depth={40} count={2200} factor={3.2} saturation={0} fade speed={0.6} />
        </group>
    );
}

/**
 * Site-wide animated backdrop: a slow 3D starfield plus drifting aurora
 * glows. Sits fixed behind all content; pointer-events disabled.
 */
export function AppBackdrop() {
    return (
        <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
            {/* Aurora glows (pure CSS, GPU-cheap) */}
            <div className="absolute -top-40 -left-40 w-[560px] h-[560px] rounded-full opacity-[0.13] blur-[120px] animate-[aurora1_24s_ease-in-out_infinite]"
                style={{ background: 'radial-gradient(circle, hsl(178,100%,45%), transparent 65%)' }} />
            <div className="absolute -bottom-52 -right-32 w-[640px] h-[640px] rounded-full opacity-[0.10] blur-[130px] animate-[aurora2_30s_ease-in-out_infinite]"
                style={{ background: 'radial-gradient(circle, #4361ee, transparent 65%)' }} />
            <div className="absolute top-1/3 left-1/2 w-[420px] h-[420px] rounded-full opacity-[0.06] blur-[110px] animate-[aurora1_36s_ease-in-out_infinite_reverse]"
                style={{ background: 'radial-gradient(circle, #c084fc, transparent 65%)' }} />
            {/* 3D starfield */}
            <Canvas
                camera={{ position: [0, 0, 1] }}
                dpr={[1, 1.5]}
                gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
            >
                <Suspense fallback={null}>
                    <DriftingStars />
                </Suspense>
            </Canvas>
            <style>{`
                @keyframes aurora1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(80px,60px) scale(1.15); } }
                @keyframes aurora2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-70px,-50px) scale(1.1); } }
            `}</style>
        </div>
    );
}
