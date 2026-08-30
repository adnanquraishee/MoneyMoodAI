import {
  BrowserRouter, Routes, Route, Navigate, useSearchParams, useLocation,
} from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { TopNav } from './components/layout/TopNav';
import { AppBackdrop } from './components/effects/AppBackdrop';
import { Salahkaar } from './components/features/Salahkaar';
import { CommandPalette } from './components/features/CommandPalette';
import { Sectors } from './pages/Sectors';
import { Dashboard } from './pages/Dashboard';
import { Compare } from './pages/Compare';
import { Landing } from './pages/Landing';
import { Screener } from './pages/Screener';
import { Heatmap } from './pages/Heatmap';
import { Watchlist } from './pages/Watchlist';
import { StockDesk } from './pages/StockDesk';
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

  return (
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
              <Route path="/watchlist" element={<Watchlist />} />
              <Route path="/stock" element={<StockDesk />} />
              <Route path="/compare" element={<Compare />} />
              {/* Legacy routes → Stock Desk tabs */}
              <Route path="/analysis" element={<LegacyRedirect tab="overview" />} />
              <Route path="/technical" element={<LegacyRedirect tab="technicals" />} />
              <Route path="/forecast" element={<LegacyRedirect tab="forecast" />} />
              <Route path="/quant" element={<LegacyRedirect tab="forecast" />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
      <Salahkaar />
      <CommandPalette />
    </div>
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
    </BrowserRouter>
  );
}

export default App;
