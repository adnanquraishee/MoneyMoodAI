import { useEffect, useRef, useState } from 'react';

interface ScrollState {
  progress: number;   // 0 → 1
  velocity: number;   // px/frame, clamped
}

export function useScrollProgress(): ScrollState {
  const [state, setState] = useState<ScrollState>({ progress: 0, velocity: 0 });
  const lastScrollY = useRef(0);
  const rafId = useRef<number>(0);

  useEffect(() => {
    const update = () => {
      const scrollY = window.scrollY;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const progress = maxScroll > 0 ? Math.min(scrollY / maxScroll, 1) : 0;
      const velocity = Math.abs(scrollY - lastScrollY.current);
      lastScrollY.current = scrollY;
      setState({ progress, velocity: Math.min(velocity, 60) });
      rafId.current = requestAnimationFrame(update);
    };

    rafId.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId.current);
  }, []);

  return state;
}
