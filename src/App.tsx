import {
  BrowserRouter, Routes, Route, Navigate, useSearchParams, useLocation,
} from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { TopNav } from './components/layout/TopNav';
import { AppBackdrop } from './components/effects/AppBackdrop';
import { Salahkaar } from './components/features/Salahkaar';
import { CommandPalette } from './components/features/CommandPalette';
import { MetricLearnProvider } from './components/ui/MetricLearn';
import { Disclaimer } from './components/ui/Disclaimer';
import { Sectors } from './pages/Sectors';
import { Dashboard } from './pages/Dashboard';
import { Landing } from './pages/Landing';
import { Screener } from './pages/Screener';
import { Heatmap } from './pages/Heatmap';
import { StockDesk } from './pages/StockDesk';
import { Learn } from './pages/Learn';
import { Analytics } from '@vercel/analytics/react';
import './index.css';

/** Old routes (analysis/technical/forecast/quant) now live as Stock Desk tabs. */
function LegacyRedirect({ tab }: { tab?: string }) {
  const [params] = useSearchParams();
  const p = new URLSearchParams();
  const symbol = params.get('symbol');
  if (symbol) p.set('symbol', symbol);
  if (tab) p.set('tab', tab);
  const qs = p.toString();
  return <Navigate to={`/app/stock${qs ? `?${qs}` : ''}`} replace />;
}

function AppContent() {
  const location = useLocation();
  const isDashboard = location.pathname === '/' || location.pathname === '';
  // Routes here are mounted under /app/*, so the home path is /app or /app/.
  const isAppHome = location.pathname === '/app' || location.pathname === '/app/';

  return (
    <MetricLearnProvider>
    <div className="min-h-screen text-white relative">
      <AppBackdrop />
      <TopNav />
      <main className={`relative z-10 ${isDashboard ? 'pt-16' : 'pt-24'}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 14, scale: 0.995 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.997 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <Routes location={location}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/sectors" element={<Sectors />} />
              <Route path="/screener" element={<Screener />} />
              <Route path="/heatmap" element={<Heatmap />} />
              <Route path="/stock" element={<StockDesk />} />
              <Route path="/learn" element={<Learn />} />
              {/* Legacy routes → Stock Desk tabs */}
              <Route path="/analysis" element={<LegacyRedirect tab="overview" />} />
              <Route path="/technical" element={<LegacyRedirect tab="technicals" />} />
              <Route path="/forecast" element={<LegacyRedirect tab="forecast" />} />
              <Route path="/quant" element={<LegacyRedirect tab="forecast" />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
      {/* Big on the app home, compact strip elsewhere — present on every page. */}
      <footer className="relative z-10 mt-16">
        <Disclaimer variant={isAppHome ? 'hero' : 'bar'} />
      </footer>
      <Salahkaar />
      <CommandPalette />
    </div>
    </MetricLearnProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 3D immersive landing page */}
        <Route path="/" element={<Landing />} />

        {/* Dashboard under /app/* */}
        <Route path="/app/*" element={<AppContent />} />
      </Routes>
      <Analytics />
    </BrowserRouter>
  );
}

export default App;
