import { NavLink, Link } from 'react-router-dom';
import {
    LayoutDashboard,
    GitCompare,
    ScanSearch,
    Star,
    LineChart,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';

interface SidebarProps {
    currentStock?: string | null;
    stockMetrics?: { 'Current Price'?: string; 'Market Cap'?: string; 'P/E Ratio'?: string };
}

export function Sidebar({ currentStock, stockMetrics }: SidebarProps) {
    // Construct URLs with symbol query parameter when available
    const getStockUrl = (path: string) => {
        return currentStock ? `${path}?symbol=${currentStock}` : path;
    };

    const NAV_ITEMS = [
        { label: 'Market Overview', icon: LayoutDashboard, path: '/app/' },
        { label: 'Screener', icon: ScanSearch, path: '/app/screener' },
        { label: 'Watchlist', icon: Star, path: '/app/watchlist' },
        { label: 'Stock Desk', icon: LineChart, path: getStockUrl('/app/stock') },
        { label: 'Peer Comparison', icon: GitCompare, path: '/app/compare' },
    ];

    return (
        <aside className="w-64 h-screen bg-[var(--obsidian)]/60 backdrop-blur-2xl border-r border-white/10 flex flex-col sticky top-0 shadow-2xl relative z-20">
            {/* Logo */}
            <Link to="/" className="block">
                <motion.div 
                    whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.02)' }}
                    whileTap={{ scale: 0.98 }}
                    className="p-6 text-center border-b border-white/10 transition-colors cursor-pointer"
                >
                    <div className="w-full h-20 flex items-center justify-center mb-3">
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-[var(--teal)] to-[var(--silver)] bg-clip-text text-transparent italic tracking-tight drop-shadow-[0_0_15px_rgba(0,245,212,0.3)]">
                            MoneyMood.ai
                        </h1>
                    </div>
                    <p className="text-[10px] tracking-[0.4em] text-[var(--teal)] font-bold uppercase opacity-80">
                        Intelligence in Motion
                    </p>
                </motion.div>
            </Link>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-2">
                <p className="text-[10px] font-bold text-gray-500 mb-6 px-3 tracking-widest uppercase">Navigation</p>
                {NAV_ITEMS.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.path === '/app/'}
                        className={({ isActive }) =>
                            cn(
                                'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group',
                                isActive
                                    ? 'bg-[var(--teal)]/10 text-[var(--teal)] border border-[var(--teal)]/20 shadow-[0_0_20px_rgba(0,245,212,0.05)]'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                            )
                        }
                    >
                        <item.icon size={18} className="transition-colors group-hover:text-[var(--teal)]" />
                        <span className="font-semibold text-sm tracking-wide">{item.label}</span>
                    </NavLink>
                ))}
            </nav>


            {/* Current Stock Info */}
            {currentStock && stockMetrics && (
                <div className="p-4 border-t border-white/10 space-y-3">
                    <h3 className="font-bold text-lg">{currentStock}</h3>

                    <div className="space-y-2">
                        {stockMetrics['Current Price'] && (
                            <div className="glass-card p-3">
                                <p className="text-xs text-gray-400">Current Price</p>
                                <p className="metric-value text-lg mt-1">{stockMetrics['Current Price']}</p>
                            </div>
                        )}

                        {stockMetrics['Market Cap'] && (
                            <div className="glass-card p-3">
                                <p className="text-xs text-gray-400">Market Cap</p>
                                <p className="text-sm font-semibold text-white mt-1">{stockMetrics['Market Cap']}</p>
                            </div>
                        )}

                        {stockMetrics['P/E Ratio'] && (
                            <div className="glass-card p-3">
                                <p className="text-xs text-gray-400">P/E Ratio</p>
                                <p className="text-sm font-semibold text-white mt-1">{stockMetrics['P/E Ratio']}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </aside>
    );
}
