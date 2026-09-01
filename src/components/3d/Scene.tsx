import { Canvas } from '@react-three/fiber';
import { Preload } from '@react-three/drei';
import { Suspense } from 'react';
import { AntigravityShards } from './AntigravityShards';
import { CameraRig } from './CameraRig';

interface Props {
  scrollProgress: number;
}

export function Scene({ scrollProgress }: Props) {
  return (
    <div className="landing-canvas">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0.5, 9], fov: 55 }}
        gl={{ 
          antialias: true, 
          alpha: false,
          powerPreference: "high-performance"
        }}
        style={{ background: '#0a0b10' }}
      >
        <color attach="background" args={['#0a0b10']} />
        
        {/* Lights */}
        <ambientLight intensity={0.2} />
        <spotLight 
          position={[0, 10, 5]} 
          intensity={1.5} 
          color="#00f5d4" 
          angle={0.3} 
          penumbra={1} 
        />
        <pointLight position={[-10, -10, -10]} color="#2d4bb8" intensity={0.5} />

        <Suspense fallback={null}>
          <AntigravityShards scrollProgress={scrollProgress} />
          <CameraRig scrollProgress={scrollProgress} />
          <Preload all />
        </Suspense>
      </Canvas>
    </div>
  );
}
