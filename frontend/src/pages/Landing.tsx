import { HUDNav } from '../components/ui/HUDNav';
import { ScrollSections } from '../components/ui/ScrollSections';
import { PostFX } from '../components/effects/PostFX';
import { useScrollProgress } from '../hooks/useScrollProgress';
import { Scene } from '../components/3d/Scene';
import { Disclaimer } from '../components/ui/Disclaimer';

export function Landing() {
  const { progress, velocity } = useScrollProgress();

  return (
    <>
    <div style={{ position: 'relative', height: '400vh', background: 'var(--obsidian)' }}>
      {/* 3D Scene */}
      <Scene scrollProgress={progress} />



      {/* CSS postprocessing: vignette + chromatic aberration */}
      <PostFX scrollVelocity={velocity} />

      {/* Fixed glassmorphism nav */}
      <HUDNav />

      {/* Scroll-linked HTML sections */}
      <ScrollSections scrollProgress={progress} />

      {/* Always on screen: the disclaimer must not depend on scrolling to find it. */}
      <div
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
          pointerEvents: 'auto',
          background: 'rgba(18,16,10,0.92)',
          backdropFilter: 'blur(8px)',
          borderTop: '1px solid rgba(251,191,36,0.25)',
        }}
      >
        <p style={{
          margin: 0, padding: '0.7rem 1.25rem', textAlign: 'center',
          fontSize: '0.72rem', lineHeight: 1.6, color: '#cbd5e1',
        }}>
          <strong style={{ color: '#fcd34d' }}>Not investment advice.</strong>{' '}
          MoneyMood.ai is an educational tool. We are not a SEBI-registered adviser and we do not
          endorse or recommend any stock.{' '}
          <a href="#disclaimer" style={{ color: '#fcd34d', textDecoration: 'underline' }}>Read the full disclaimer</a>
        </p>
      </div>
    </div>

    {/* Legal disclaimer, in normal flow so it is unmissable at the foot of the page.
        Extra bottom padding keeps the fixed strip from covering its last lines. */}
    <div style={{ background: '#12100a', paddingBottom: '3.5rem' }}>
      <Disclaimer />
    </div>
    </>
  );
}
