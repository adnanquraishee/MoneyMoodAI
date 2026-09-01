import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface Props {
  scrollProgress: number;
}

// Camera path keyframes: [progress, position, lookAt]
const KEYFRAMES = [
  { t: 0.00, pos: [0, 0.5, 9] as [number, number, number],  look: [0, 0, 0] as [number, number, number] },
  { t: 0.40, pos: [0, 0.2, 1.8] as [number, number, number], look: [0, 0, 0] as [number, number, number] }, // zoom through
  { t: 0.70, pos: [2.5, 1, 7] as [number, number, number],  look: [0, 0, 0] as [number, number, number] }, // pull back + rotate
  { t: 1.00, pos: [0, -0.5, 10] as [number, number, number], look: [0, 0, 0] as [number, number, number] }, // settle
];

function smoothstep(t: number) {
  return t * t * (3 - 2 * t);
}

function lerpKeyframes(progress: number) {
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    const a = KEYFRAMES[i];
    const b = KEYFRAMES[i + 1];
    if (progress >= a.t && progress <= b.t) {
      const localT = (progress - a.t) / (b.t - a.t);
      const st = smoothstep(localT);
      return {
        pos: a.pos.map((v, j) => v + (b.pos[j] - v) * st) as [number, number, number],
        look: a.look.map((v, j) => v + (b.look[j] - v) * st) as [number, number, number],
      };
    }
  }
  const last = KEYFRAMES[KEYFRAMES.length - 1];
  return { pos: last.pos, look: last.look };
}

export function CameraRig({ scrollProgress }: Props) {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3(0, 0.5, 9));
  const targetLook = useRef(new THREE.Vector3(0, 0, 0));

  useFrame(() => {
    const { pos, look } = lerpKeyframes(scrollProgress);
    targetPos.current.lerp(new THREE.Vector3(...pos), 0.04); // high-inertia: slow lerp
    targetLook.current.lerp(new THREE.Vector3(...look), 0.04);

    camera.position.copy(targetPos.current);
    camera.lookAt(targetLook.current);
  });

  return null;
}
