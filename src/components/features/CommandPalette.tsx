import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, LayoutDashboard, Flame, Filter, CandlestickChart, Star,
    GitCompareArrows, Compass, TrendingUp, CornerDownLeft, Plus, Loader2,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { TickerOption } from '../../lib/types';
import { cn } from '../../lib/utils';

/**
 * ⌘K command palette — the Bloomberg-terminal way in. Fuzzy page jumps,
 * live stock search over the NSE universe, quick actions (⌘⏎ = watchlist).
 */

const PAGES = [
    { label: 'Market Overview', to: '/app/', icon: LayoutDashboard, hint: 'dashboard home mood' },
    { label: 'Sector Rotation', to: '/app/sectors', icon: Compass, hint: 'rrg quadrant rotation money flow' },
    { label: 'Heatmap', to: '/app/heatmap', icon: Flame, hint: 'treemap sectors' },
    { label: 'Screener', to: '/app/screener', icon: Filter, hint: 'filter ratios factors scan' },
    { label: 'Stock Desk', to: '/app/stock', icon: CandlestickChart, hint: 'charts technicals forecast analysis' },
    { label: 'Watchlist', to: '/app/watchlist', icon: Star, hint: 'saved favourites' },
    { label: 'Compare', to: '/app/compare', icon: GitCompareArrows, hint: 'versus side by side' },
];

type Item =
    | { kind: 'page'; label: string; to: string; icon: typeof Search }
    | { kind: 'stock'; ticker: string; name: string; exchange: string };

export function CommandPalette() {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [stocks, setStocks] = useState<TickerOption[]>([]);
    const [searching, setSearching] = useState(false);
    const [active, setActive] = useState(0);
    const [toast, setToast] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>();

    // global hotkey
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setOpen(o => !o);
            } else if (e.key === 'Escape') {
                setOpen(false);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    // reset + focus on open
    useEffect(() => {
        if (open) {
            setQuery(''); setStocks([]); setActive(0);
            setTimeout(() => inputRef.current?.focus(), 30);
        }
    }, [open]);

    // debounced stock search
    useEffect(() => {
        clearTimeout(debounceRef.current);
        if (query.trim().length < 2) { setStocks([]); setSearching(false); return; }
        setSearching(true);
        debounceRef.current = setTimeout(async () => {
            try {
                const res = await api.searchStocks(query.trim());
                setStocks(res.results.slice(0, 6));
            } catch { setStocks([]); }
            setSearching(false);
        }, 220);
        return () => clearTimeout(debounceRef.current);
    }, [query]);

    const q = query.trim().toLowerCase();
    const pages = useMemo(
        () => PAGES.filter(p => !q || p.label.toLowerCase().includes(q) || p.hint.includes(q)),
        [q],
    );
    const items: Item[] = useMemo(() => [
        ...pages.map(p => ({ kind: 'page' as const, label: p.label, to: p.to, icon: p.icon })),
        ...stocks.map(s => ({ kind: 'stock' as const, ...s })),
    ], [pages, stocks]);

    useEffect(() => { setActive(a => Math.min(a, Math.max(0, items.length - 1))); }, [items.length]);

    const flash = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 1600);
    };

    const run = useCallback(async (item: Item, meta: boolean) => {
        if (item.kind === 'page') {
            navigate(item.to);
            setOpen(false);
        } else if (meta) {
            try {
                await api.addToWatchlist(item.ticker);
                flash(`${item.ticker.replace('.NS', '')} added to watchlist ★`);
            } catch { flash('Could not add to watchlist'); }
        } else {
            navigate(`/app/stock?symbol=${encodeURIComponent(item.ticker)}`);
            setOpen(false);
        }
    }, [navigate]);

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, items.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
        else if (e.key === 'Enter' && items[active]) { e.preventDefault(); run(items[active], e.metaKey || e.ctrlKey); }
    };

    const pageCount = pages.length;
    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className="fixed inset-0 z-[90] flex items-start justify-center pt-[16vh] px-4"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.16 }}
                >
                    <div className="absolute inset-0 bg-black/55 backdrop-blur-md" onClick={() => setOpen(false)} />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.94, y: -14 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: -10 }}
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                        className="relative w-full max-w-xl rounded-2xl border border-white/12 overflow-hidden
                                   bg-[#0a0f1d]/90 backdrop-blur-2xl
                                   shadow-[0_30px_90px_-20px_rgba(0,0,0,0.9),0_0_40px_rgba(0,229,255,0.07)]"
                    >
                        {/* animated top border sheen */}
                        <div className="absolute top-0 inset-x-0 h-px overflow-hidden">
                            <div className="h-full w-1/2 bg-gradient-to-r from-transparent via-[var(--teal)] to-transparent
                                            animate-[paletteSheen_2.6s_ease-in-out_infinite]" />
                        </div>

                        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/8">
                            {searching
                                ? <Loader2 size={17} className="text-[var(--teal)] animate-spin shrink-0" />
                                : <Search size={17} className="text-gray-500 shrink-0" />}
                            <input
                                ref={inputRef}
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={onKeyDown}
                                placeholder="Jump to a page, or search any NSE stock…"
                                className="flex-1 bg-transparent text-[15px] text-white placeholder-gray-600 outline-none"
                            />
                            <kbd className="text-[10px] text-gray-500 border border-white/10 rounded px-1.5 py-0.5">esc</kbd>
                        </div>

                        <div className="max-h-[46vh] overflow-y-auto py-2">
                            {pages.length > 0 && (
                                <p className="px-4 pt-1 pb-1.5 text-[10px] uppercase tracking-[0.2em] text-gray-600">Go to</p>
                            )}
                            {items.map((item, i) => {
                                const isActive = i === active;
                                return (
                                    <motion.button
                                        key={item.kind === 'page' ? item.to : item.ticker}
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: Math.min(i * 0.025, 0.15), duration: 0.18 }}
                                        onMouseEnter={() => setActive(i)}
                                        onClick={(e) => run(item, e.metaKey || e.ctrlKey)}
                                        className={cn(
                                            'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                                            isActive ? 'bg-[var(--teal)]/10' : '',
                                        )}
                                    >
                                        {item.kind === 'page' ? (
                                            <>
                                                <span className={cn('p-1.5 rounded-lg border',
                                                    isActive ? 'border-[var(--teal)]/40 bg-[var(--teal)]/10' : 'border-white/10 bg-white/5')}>
                                                    <item.icon size={14} className={isActive ? 'text-[var(--teal)]' : 'text-gray-400'} />
                                                </span>
                                                <span className={cn('text-sm font-semibold', isActive ? 'text-white' : 'text-gray-300')}>
                                                    {item.label}
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <span className={cn('p-1.5 rounded-lg border',
                                                    isActive ? 'border-[#00FF9D]/40 bg-[#00FF9D]/10' : 'border-white/10 bg-white/5')}>
                                                    <TrendingUp size={14} className={isActive ? 'text-[#00FF9D]' : 'text-gray-400'} />
                                                </span>
                                                <span className="min-w-0">
                                                    <span className={cn('block text-sm font-semibold truncate', isActive ? 'text-white' : 'text-gray-300')}>
                                                        {item.ticker.replace('.NS', '').replace('.BO', '')}
                                                        <span className="ml-2 text-[10px] text-gray-600">{item.exchange}</span>
                                                    </span>
                                                    <span className="block text-[11px] text-gray-500 truncate">{item.name}</span>
                                                </span>
                                            </>
                                        )}
                                        {isActive && (
                                            <span className="ml-auto flex items-center gap-2 shrink-0 text-[10px] text-gray-500">
                                                {item.kind === 'stock' && (
                                                    <span className="flex items-center gap-1 border border-white/10 rounded px-1.5 py-0.5">
                                                        <Plus size={9} /> ⌘⏎ watchlist
                                                    </span>
                                                )}
                                                <span className="flex items-center gap-1 border border-white/10 rounded px-1.5 py-0.5">
                                                    <CornerDownLeft size={9} /> open
                                                </span>
                                            </span>
                                        )}
                                        {item.kind === 'stock' && i === pageCount && (
                                            <span className="sr-only">stocks</span>
                                        )}
                                    </motion.button>
                                );
                            })}
                            {!items.length && (
                                <p className="px-4 py-6 text-center text-sm text-gray-600">
                                    {searching ? 'Searching…' : 'Nothing matches — try a ticker like TCS or INFY.'}
                                </p>
                            )}
                        </div>

                        <AnimatePresence>
                            {toast && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                    className="px-4 py-2.5 border-t border-[#00FF9D]/20 bg-[#00FF9D]/8 text-[#00FF9D] text-xs font-bold"
                                >
                                    {toast}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                    <style>{`@keyframes paletteSheen { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }`}</style>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
