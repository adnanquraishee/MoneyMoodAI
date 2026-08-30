import { Link } from 'react-router-dom';
import { motion, Variants } from 'framer-motion';

const STATS = [
  { label: 'NIFTY 50',  value: '+1.24%', sub: '22,847.35' },
  { label: 'SENSEX',    value: '+0.87%', sub: '75,403.11' },
  { label: 'NASDAQ',    value: '+2.14%', sub: '18,245.08' },
  { label: 'S&P 500',   value: '+1.03%', sub: '5,211.49'  },
  { label: 'GOLD',      value: '-0.32%', sub: '2,038.50'  },
  { label: 'BTC/USD',   value: '+3.67%', sub: '68,421.00' },
];

const FEATURES = [
  {
    icon: '⬡',
    title: 'AI Forecast Engine',
    desc: 'Multi-horizon predictions using transformer models trained on 12 years of market data.',
  },
  {
    icon: '◈',
    title: 'Real-Time Intelligence',
    desc: 'Live data ribbons, tick-level aggregation, and sub-second latency across global exchanges.',
  },
  {
    icon: '◇',
    title: 'Risk Analytics',
    desc: 'Portfolio stress-testing, VaR computation, and correlation matrices at institutional grade.',
  },
];

interface Props {
  scrollProgress: number;
}

// Helper: apply parallax translateY using scroll progress
function parallaxY(scrollProgress: number, factor: number) {
  return `translateY(${scrollProgress * factor}px)`;
}

// Framer Motion Variants for Staggered Spring Reveals
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { 
      type: 'spring', 
      stiffness: 120, 
      damping: 14 
    } 
  },
};

export function ScrollSections({ scrollProgress }: Props) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        zIndex: 10,
        pointerEvents: 'none',
      }}
    >
      {/* ── SECTION 1: Hero ─────────────────────────────── */}
      <section
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '0 1.5rem',
          willChange: 'transform',
          transform: parallaxY(scrollProgress, -80),
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: Math.max(0, 1 - scrollProgress * 5) }}
        >
          {/* Eyebrow */}
          <div style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.72rem',
            fontWeight: 600,
            letterSpacing: '0.35em',
            color: 'var(--teal)',
            textTransform: 'uppercase',
            marginBottom: '1.4rem',
          }}>
            AI · Financial Intelligence · Real-Time
          </div>

          {/* H1 */}
          <motion.h1 
            initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
            style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 'clamp(3rem, 9vw, 7.5rem)',
            lineHeight: 1.0,
            letterSpacing: '-0.03em',
            color: '#f0f4f8',
            margin: 0,
          }}>
            Intelligence
            <br />
            <span 
              className="animate-gradient-x"
              style={{
              background: 'linear-gradient(90deg, var(--teal), #0073a8, var(--teal))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              in Motion.
            </span>
          </motion.h1>

          {/* Subhead */}
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.7 }}
            style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 300,
            fontSize: 'clamp(1rem, 2vw, 1.3rem)',
            color: 'var(--silver-dim)',
            maxWidth: '540px',
            lineHeight: 1.7,
            marginTop: '1.8rem',
          }}>
            MoneyMood.ai fuses real-time market intelligence with machine learning to give you an institutional edge — in your browser.
          </motion.p>

          {/* CTA group */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.9, type: 'spring' }}
            style={{
            display: 'flex',
            gap: '1rem',
            marginTop: '2.8rem',
            pointerEvents: 'auto',
          }}>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link to="/app" style={{
                display: 'block',
                fontFamily: 'var(--font-display)',
                fontSize: '0.85rem',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textDecoration: 'none',
                color: '#0a0b10',
                background: 'var(--teal)',
                padding: '0.85rem 2rem',
                borderRadius: '9999px',
                textTransform: 'uppercase',
                transition: 'box-shadow 0.3s ease',
                boxShadow: '0 0 30px rgba(0, 245, 212, 0.35)',
              }}>
                Launch Platform
              </Link>
            </motion.div>
            
            <motion.a 
              href="#features" 
              whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.05)' }}
              whileTap={{ scale: 0.95 }}
              style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.85rem',
              fontWeight: 500,
              letterSpacing: '0.08em',
              textDecoration: 'none',
              color: 'var(--silver)',
              padding: '0.85rem 2rem',
              borderRadius: '9999px',
              textTransform: 'uppercase',
              border: '1px solid rgba(210, 230, 228, 0.25)',
              transition: 'background-color 0.3s ease',
            }}>
              Explore ↓
            </motion.a>
          </motion.div>
        </motion.div>
      </section>

      {/* ── SECTION 2: Data Ribbons / Ticker ─────────────── */}
      <section
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 1.5rem',
          willChange: 'transform',
          transform: parallaxY(scrollProgress, -40),
          opacity: Math.max(0, Math.min(1, (scrollProgress - 0.2) * 5)) *
                   Math.max(0, 1 - (scrollProgress - 0.5) * 5),
        }}
      >
        <motion.div
           initial="hidden"
           whileInView="visible"
           viewport={{ once: false, amount: 0.4 }}
           variants={containerVariants}
           style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          <motion.div variants={itemVariants} style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.72rem',
            fontWeight: 600,
            letterSpacing: '0.3em',
            color: 'var(--teal)',
            textTransform: 'uppercase',
            marginBottom: '1rem',
          }}>
            Live Market Pulse
          </motion.div>
          <motion.h2 variants={itemVariants} style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 'clamp(2rem, 5vw, 4rem)',
            color: '#f0f4f8',
            marginBottom: '3rem',
            letterSpacing: '-0.02em',
          }}>
            Markets Never Sleep
          </motion.h2>

          <motion.div variants={containerVariants} style={{
            display: 'flex',
            gap: '1.2rem',
            flexWrap: 'wrap',
            justifyContent: 'center',
            maxWidth: '900px',
            pointerEvents: 'auto',
          }}>
            {STATS.map((s) => (
              <motion.div 
                variants={itemVariants}
                whileHover={{ 
                  scale: 1.05, 
                  y: -5, 
                  boxShadow: '0 15px 40px rgba(0, 245, 212, 0.15)',
                  borderColor: 'rgba(0, 245, 212, 0.4)' 
                }}
                key={s.label} 
                style={{
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                background: 'rgba(13, 20, 35, 0.7)',
                border: '1px solid rgba(0, 245, 212, 0.15)',
                borderRadius: '16px',
                padding: '1.2rem 1.8rem',
                minWidth: '130px',
                textAlign: 'center',
                boxShadow: '0 4px 30px rgba(0,0,0,0.3)',
                transition: 'border-color 0.3s ease',
                cursor: 'pointer',
              }}>
                <div style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.72rem',
                  letterSpacing: '0.18em',
                  color: 'var(--silver-dim)',
                  marginBottom: '0.4rem',
                  textTransform: 'uppercase',
                }}>{s.label}</div>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.6rem',
                  fontWeight: 700,
                  color: s.value.startsWith('+') ? '#00f5d4' : '#ff6b6b',
                }}>{s.value}</div>
                <div style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.8rem',
                  color: 'var(--silver-dim)',
                  marginTop: '0.2rem',
                }}>{s.sub}</div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ── SECTION 3: Features ─────────────────────────── */}
      <section
        id="features"
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 1.5rem',
          opacity: Math.max(0, Math.min(1, (scrollProgress - 0.5) * 5)) *
                   Math.max(0, 1 - (scrollProgress - 0.78) * 5),
        }}
      >
        <motion.div
           initial="hidden"
           whileInView="visible"
           viewport={{ once: false, amount: 0.4 }}
           variants={containerVariants}
           style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          <motion.div variants={itemVariants} style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.72rem',
            fontWeight: 600,
            letterSpacing: '0.3em',
            color: 'var(--teal)',
            textTransform: 'uppercase',
            marginBottom: '1rem',
          }}>
            Why MoneyMood.ai
          </motion.div>
          
          <motion.h2 variants={itemVariants} style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 'clamp(2rem, 5vw, 4rem)',
            color: '#f0f4f8',
            marginBottom: '3rem',
            letterSpacing: '-0.02em',
            textAlign: 'center',
          }}>
            Institutional Tools.<br />Zero Barriers.
          </motion.h2>

          <motion.div variants={containerVariants} style={{
            display: 'flex',
            gap: '1.5rem',
            flexWrap: 'wrap',
            justifyContent: 'center',
            maxWidth: '980px',
            pointerEvents: 'auto',
          }}>
            {FEATURES.map((f) => (
              <motion.div 
                variants={itemVariants}
                whileHover={{ 
                  scale: 1.03, 
                  y: -5,
                  boxShadow: '0 20px 50px rgba(0,0,0,0.6), inset 0 2px 0 rgba(0, 245, 212, 0.4)',
                  borderColor: 'rgba(0, 245, 212, 0.3)'
                }}
                key={f.title} 
                style={{
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                background: 'linear-gradient(180deg, rgba(20, 30, 45, 0.8) 0%, rgba(10, 18, 32, 0.9) 100%)',
                border: '1px solid rgba(0, 245, 212, 0.12)',
                borderRadius: '24px',
                padding: '2.5rem 2rem',
                maxWidth: '300px',
                textAlign: 'left',
                boxShadow: '0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
                transition: 'border-color 0.4s ease',
                cursor: 'pointer',
              }}>
                <motion.div 
                  initial={{ rotate: -20, opacity: 0 }}
                  whileInView={{ rotate: 0, opacity: 1 }}
                  transition={{ type: 'spring', damping: 10 }}
                  style={{
                  fontSize: '2.5rem',
                  marginBottom: '1.2rem',
                  filter: 'drop-shadow(0 0 12px var(--teal))',
                  display: 'inline-block'
                }}>{f.icon}</motion.div>
                <h3 style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.15rem',
                  fontWeight: 600,
                  color: '#f0f4f8',
                  marginBottom: '0.8rem',
                  letterSpacing: '-0.01em',
                }}>{f.title}</h3>
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.9rem',
                  color: 'var(--silver-dim)',
                  lineHeight: 1.7,
                  margin: 0,
                }}>{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ── SECTION 4: CTA ──────────────────────────────── */}
      <section
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 1.5rem',
          textAlign: 'center',
          willChange: 'transform',
          transform: parallaxY(scrollProgress, 30),
          opacity: Math.max(0, (scrollProgress - 0.75) * 5),
        }}
      >
        <motion.div
           initial="hidden"
           whileInView="visible"
           viewport={{ once: false, amount: 0.5 }}
           variants={containerVariants}
           style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          <motion.div variants={itemVariants} style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.72rem',
            fontWeight: 600,
            letterSpacing: '0.3em',
            color: 'var(--teal)',
            textTransform: 'uppercase',
            marginBottom: '1.2rem',
          }}>
            Begin Your Edge
          </motion.div>
          <motion.h2 variants={itemVariants} style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 'clamp(2.5rem, 8vw, 6rem)',
            color: '#f0f4f8',
            letterSpacing: '-0.03em',
            marginBottom: '1.5rem',
          }}>
            Trade Smarter.
            <br />
            <span style={{
              background: 'linear-gradient(90deg, var(--teal), #0073a8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Think Faster.
            </span>
          </motion.h2>
          <motion.p variants={itemVariants} style={{
            fontFamily: 'var(--font-body)',
            fontSize: '1.1rem',
            color: 'var(--silver-dim)',
            maxWidth: '480px',
            lineHeight: 1.7,
            marginBottom: '3rem',
          }}>
            MoneyMood.ai brings hedge-fund-level analytics to your fingertips. No compromise.
          </motion.p>
          
          <motion.div variants={itemVariants}>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link
                to="/app"
                style={{
                  pointerEvents: 'auto',
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textDecoration: 'none',
                  color: '#0a0b10',
                  background: 'linear-gradient(135deg, #00f5d4, #0073a8)',
                  padding: '1.2rem 3.2rem',
                  borderRadius: '9999px',
                  textTransform: 'uppercase',
                  boxShadow: '0 0 40px rgba(0, 245, 212, 0.4), 0 8px 30px rgba(0,0,0,0.5)',
                  transition: 'box-shadow 0.3s ease',
                  display: 'inline-block'
                }}
              >
                Enter MoneyMood.ai →
              </Link>
            </motion.div>
          </motion.div>
        </motion.div>
      </section>
    </div>
  );
}
