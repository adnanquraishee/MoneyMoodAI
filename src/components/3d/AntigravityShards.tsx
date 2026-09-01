import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';

interface Props {
  scrollProgress: number;
}

// Pre-computed "F" letter vertex positions for convergence
const F_POSITIONS: [number, number, number][] = [
  [-0.6,  1.2, 0], [-0.1,  1.2, 0], [0.5,  1.2, 0],
  [-0.6,  0.7, 0], [-0.1,  0.7, 0], [0.3,  0.7, 0],
  [-0.6,  0.2, 0], [-0.6, -0.3, 0], [-0.6, -0.8, 0],
  [-0.6, -1.2, 0], [0.0, -1.2, 0],  [0.0,   0.2, 0],
];

const FLOAT_CONFIGS = [
  { speed: 1.2, rotationIntensity: 0.8, floatIntensity: 0.6, color: '#00f5d4' },
  { speed: 0.9, rotationIntensity: 1.2, floatIntensity: 0.4, color: '#00c4aa' },
  { speed: 1.6, rotationIntensity: 0.5, floatIntensity: 0.9, color: '#00f5d4' },
  { speed: 0.7, rotationIntensity: 1.0, floatIntensity: 0.7, color: '#80d4cd' },
  { speed: 1.4, rotationIntensity: 0.7, floatIntensity: 0.5, color: '#00f5d4' },
  { speed: 1.1, rotationIntensity: 1.4, floatIntensity: 0.3, color: '#00e0c8' },
  { speed: 0.8, rotationIntensity: 0.6, floatIntensity: 1.0, color: '#00f5d4' },
  { speed: 1.3, rotationIntensity: 0.9, floatIntensity: 0.6, color: '#60c4be' },
  { speed: 1.0, rotationIntensity: 1.1, floatIntensity: 0.8, color: '#00f5d4' },
  { speed: 0.6, rotationIntensity: 0.8, floatIntensity: 0.4, color: '#00d4bf' },
  { speed: 1.5, rotationIntensity: 0.5, floatIntensity: 0.7, color: '#00f5d4' },
  { speed: 1.2, rotationIntensity: 1.2, floatIntensity: 0.5, color: '#40c8c0' },
];

const INITIAL_POSITIONS: [number, number, number][] = [
  [-2.5,  1.5, -1.0], [ 1.8,  2.0, -0.5], [ 3.0,  0.5,  0.5],
  [-1.0,  2.5,  0.0], [ 2.5, -1.0, -1.2], [-3.0, -0.5,  0.8],
  [ 0.5,  3.0,  0.3], [-2.0, -2.0, -0.5], [ 1.5, -2.5,  0.7],
  [-1.5,  0.0,  1.5], [ 3.5,  1.5,  0.0], [-0.5, -3.0, -0.8],
];

// Pre-convert to Vector3 once at module level — avoids per-frame `new THREE.Vector3(...)` calls
const INITIAL_VEC3 = INITIAL_POSITIONS.map(p => new THREE.Vector3(...p));
const F_VEC3       = F_POSITIONS.map(p => new THREE.Vector3(...p));

function Shard({ index, scrollProgress, cursorPos }: {
  index: number;
  scrollProgress: number;
  cursorPos: THREE.Vector2;
}) {
  const meshRef   = useRef<THREE.Mesh>(null);
  const targetPos = useRef(new THREE.Vector3(...INITIAL_POSITIONS[index]));
  const cfg       = FLOAT_CONFIGS[index];

  // Scratch vectors — allocated once per Shard, reused every frame (no GC pressure)
  const _exploded = useRef(new THREE.Vector3());
  const _dest     = useRef(new THREE.Vector3());
  const _attract  = useRef(new THREE.Vector3());

  const geometry = useMemo(() => {
    // Only instantiate the one geometry variant this shard needs
    const geo = [
      new THREE.IcosahedronGeometry(0.25, 0),
      new THREE.TetrahedronGeometry(0.3, 0),
      new THREE.OctahedronGeometry(0.22, 0),
    ][index % 3];

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(
        i,
        pos.getX(i) * (0.8 + Math.random() * 0.4),
        pos.getY(i) * (0.8 + Math.random() * 0.4),
        pos.getZ(i) * (0.8 + Math.random() * 0.4),
      );
    }
    geo.computeVertexNormals();
    return geo;
  }, [index]);

  useFrame((_state, delta) => {
    if (!meshRef.current) return;

    const convergeT      = Math.max(0, (scrollProgress - 0.75) / 0.25);
    const convergeSmooth = convergeT * convergeT * (3 - 2 * convergeT);

    const explodeT = scrollProgress < 0.35 ? 0
      : scrollProgress < 0.7  ? (scrollProgress - 0.35) / 0.35
      : scrollProgress < 0.75 ? 1
      : 1 - convergeSmooth;

    // Reuse scratch vectors — no allocations per frame
    _exploded.current.copy(INITIAL_VEC3[index]).multiplyScalar(1 + explodeT * 0.8);
    _dest.current.lerpVectors(_exploded.current, F_VEC3[index], convergeSmooth);

    if (convergeSmooth < 0.5) {
      _attract.current.set(cursorPos.x * 3, cursorPos.y * 2, 0);
      _dest.current.lerp(_attract.current, 0.04 * (1 - convergeSmooth));
    }

    targetPos.current.lerp(_dest.current, 0.06);
    meshRef.current.position.copy(targetPos.current);

    if (convergeSmooth < 0.8) {
      meshRef.current.rotation.x += delta * 0.2 * cfg.speed;
      meshRef.current.rotation.y += delta * 0.3 * cfg.speed;
    }
  });

  return (
    <Float speed={cfg.speed} rotationIntensity={cfg.rotationIntensity} floatIntensity={cfg.floatIntensity}>
      <mesh ref={meshRef} geometry={geometry} castShadow>
        <meshPhysicalMaterial
          color={cfg.color}
          transmission={0.85}
          roughness={0.05}
          metalness={0.15}
          thickness={0.5}
          ior={1.5}
          envMapIntensity={2}
          emissive={cfg.color}
          emissiveIntensity={0.12}
        />
      </mesh>
    </Float>
  );
}

export function AntigravityShards({ scrollProgress }: Props) {
  const cursorPos = useRef(new THREE.Vector2(0, 0));

  useFrame(({ pointer }) => {
    cursorPos.current.lerp(pointer, 0.05);
  });

  return (
    <group>
      {Array.from({ length: 12 }, (_, i) => (
        <Shard
          key={i}
          index={i}
          scrollProgress={scrollProgress}
          cursorPos={cursorPos.current}
        />
      ))}
    </group>
  );
}
