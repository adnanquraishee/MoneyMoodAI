import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export function HUDNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 2.5rem',
        height: '68px',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        background: scrolled
          ? 'rgba(10, 11, 16, 0.72)'
          : 'rgba(10, 11, 16, 0.25)',
        borderBottom: '1px solid rgba(0, 245, 212, 0.12)',
        transition: 'background 0.4s ease',
      }}
    >
      {/* Logo */}
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: '1.35rem',
          letterSpacing: '0.12em',
          color: 'var(--teal)',
          textTransform: 'uppercase',
        }}
      >
        MoneyMood.ai
      </span>

      {/* Links removed from home screen for immersion */}
      <div style={{ display: 'flex', gap: '2.5rem', alignItems: 'center' }}>


        {/* CTA pill */}
        <Link
          to="/app"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.8rem',
            fontWeight: 600,
            letterSpacing: '0.08em',
            color: 'var(--teal)',
            textDecoration: 'none',
            textTransform: 'uppercase',
            padding: '0.5rem 1.25rem',
            border: '1px solid rgba(0, 245, 212, 0.5)',
            borderRadius: '9999px',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            background: 'rgba(0, 245, 212, 0.05)',
            transition: 'all 0.25s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0, 245, 212, 0.12)';
            e.currentTarget.style.boxShadow = '0 0 18px rgba(0, 245, 212, 0.25)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(0, 245, 212, 0.05)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          Enter Platform →
        </Link>
      </div>
    </nav>
  );
}
