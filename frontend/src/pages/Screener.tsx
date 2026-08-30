import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Star, ArrowUpDown, ArrowUp, ArrowDown, Filter, RefreshCw,
    SlidersHorizontal, X, Columns3, Plus,
} from 'lucide-react';
import { api } from '../lib/api';
import type { ScreenerRow } from '../lib/types';
import { cn } from '../lib/utils';
import { InfoTip } from '../components/ui/InfoTip';

/**
 * Metric registry: single source of truth for columns AND range filters.
 * `unit` describes how the user types the filter value;
 * `toRaw` converts typed value -> the row's raw scale for comparison.
 */
interface MetricDef {
    key: keyof ScreenerRow;
    label: string;
    term?: string;
    unit?: string;
    fmt: (r: ScreenerRow) => string;
    toRaw?: (v: number) => number;
    colored?: boolean;
    default?: boolean;
}

const pctFmt = (v: number | null, d = 1) => v == null ? '—' : `${(v * 100).toFixed(d)}%`;

const METRICS: MetricDef[] = [
    { key: 'price', label: 'Price', unit: '₹', default: true, fmt: r => r.price != null ? `₹${r.price.toLocaleString('en-IN')}` : '—' },
    { key: 'change_pct', label: '1D %', unit: '%', default: true, colored: true, fmt: r => r.change_pct != null ? `${r.change_pct >= 0 ? '+' : ''}${r.change_pct.toFixed(2)}%` : '—' },
    { key: 'return_1y', label: '1Y Return', unit: '%', default: true, colored: true, toRaw: v => v / 100, fmt: r => pctFmt(r.return_1y, 0) },
    { key: 'alpha', label: 'Alpha α', term: 'alpha', unit: '%', default: true, colored: true, toRaw: v => v / 100, fmt: r => pctFmt(r.alpha) },
    { key: 'sharpe', label: 'Sharpe', term: 'sharpe', default: true, fmt: r => r.sharpe != null ? r.sharpe.toFixed(2) : '—' },
    { key: 'treynor', label: 'Treynor', term: 'treynor', fmt: r => r.treynor != null ? r.treynor.toFixed(2) : '—' },
    { key: 'momentum', label: 'Momentum', term: 'momentum', unit: '%', colored: true, toRaw: v => v / 100, fmt: r => pctFmt(r.momentum) },
    { key: 'beta', label: 'Beta β', term: 'beta', default: true, fmt: r => r.beta != null ? r.beta.toFixed(2) : '—' },
    { key: 'volatility', label: 'Volatility', term: 'volatility', unit: '%', toRaw: v => v / 100, fmt: r => pctFmt(r.volatility, 0) },
    { key: 'rsi', label: 'RSI', term: 'rsi', default: true, fmt: r => r.rsi != null ? r.rsi.toFixed(0) : '—' },
    { key: 'pe', label: 'P/E', term: 'pe', default: true, fmt: r => r.pe != null ? r.pe.toFixed(1) : '—' },
    { key: 'forward_pe', label: 'Fwd P/E', term: 'forward_pe', fmt: r => r.forward_pe != null ? Number(r.forward_pe).toFixed(1) : '—' },
    { key: 'peg', label: 'PEG', term: 'peg', default: true, fmt: r => r.peg != null ? Number(r.peg).toFixed(2) : '—' },
    { key: 'pb', label: 'P/B', term: 'pb', fmt: r => r.pb != null ? Number(r.pb).toFixed(1) : '—' },
    { key: 'roe', label: 'ROE', term: 'roe', unit: '%', colored: true, toRaw: v => v / 100, default: true, fmt: r => pctFmt(r.roe, 0) },
    { key: 'profit_margin', label: 'Net Margin', term: 'profit_margin', unit: '%', toRaw: v => v / 100, fmt: r => pctFmt(r.profit_margin, 0) },
    { key: 'revenue_growth', label: 'Rev Growth', term: 'revenue_growth', unit: '%', colored: true, toRaw: v => v / 100, fmt: r => pctFmt(r.revenue_growth, 0) },
    { key: 'earnings_growth', label: 'EPS Growth', term: 'earnings_growth', unit: '%', colored: true, toRaw: v => v / 100, fmt: r => pctFmt(r.earnings_growth, 0) },
    { key: 'debt_to_equity', label: 'D/E', term: 'debt_to_equity', fmt: r => r.debt_to_equity != null ? Number(r.debt_to_equity).toFixed(2) : '—' },
    { key: 'dividend_yield', label: 'Div Yield', term: 'dividend_yield', unit: '%', toRaw: v => v / 100, default: true, fmt: r => pctFmt(r.dividend_yield) },
    { key: 'market_cap', label: 'Mcap', term: 'market_cap', unit: 'Cr', toRaw: v => v * 1e7, default: true, fmt: r => r.market_cap != null ? (r.market_cap >= 1e12 ? `₹${(r.market_cap / 1e12).toFixed(1)} L Cr` : `₹${(r.market_cap / 1e7).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr`) : '—' },
    { key: 'pct_from_52w_high', label: '↓ from 52W H', term: 'pct_52w_high', unit: '%', fmt: r => r.pct_from_52w_high != null ? `${Number(r.pct_from_52w_high).toFixed(1)}%` : '—' },
];

interface RangeFilter { key: keyof ScreenerRow; min: string; max: string }

const PRESETS = [
    { id: 'all', label: 'All Stocks', filter: (_r: ScreenerRow) => true },
    { id: 'high_conviction', label: 'High Conviction', filter: (r: ScreenerRow) => (r.score ?? 0) >= 70 },
    { id: 'garp', label: 'GARP', filter: (r: ScreenerRow) => r.garp === true },
    { id: 'alpha_leaders', label: 'Alpha Leaders', filter: (r: ScreenerRow) => (r.alpha ?? -1) > 0.05 },
    { id: 'dividend', label: 'Dividend Payers', filter: (r: ScreenerRow) => (r.dividend_yield ?? 0) >= 0.01 },
    { id: 'oversold', label: 'Oversold', filter: (r: ScreenerRow) => (r.rsi ?? 100) < 35 },
    { id: 'overbought', label: 'Overbought', filter: (r: ScreenerRow) => (r.rsi ?? 0) > 70 },
    { id: 'low_beta', label: 'Defensive', filter: (r: ScreenerRow) => (r.beta ?? 99) < 0.8 },
];

const LS_COLS = 'moneymood.screener.cols.v1';
const PAGE = 150;

function ScoreBar({ score }: { score: number | null }) {
    if (score == null) return <span className="text-gray-600">—</span>;
    const color = score >= 70 ? 'bg-emerald-400' : score >= 45 ? 'bg-[var(--teal)]' : 'bg-rose-400';
    return (
        <div className="flex items-center gap-2 min-w-[86px]">
            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className={cn('h-full rounded-full', color)} style={{ width: `${score}%` }} />
            </div>
            <span className="text-xs font-bold w-7 text-right">{score.toFixed(0)}</span>
        </div>
    );
}

export function Screener() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [preset, setPreset] = useState('all');
    const [sector, setSector] = useState('all');
    const [sortKey, setSortKey] = useState<keyof ScreenerRow>('score');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [search, setSearch] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [showColumns, setShowColumns] = useState(false);
    const [filters, setFilters] = useState<RangeFilter[]>([]);
    const [limit, setLimit] = useState(PAGE);
    const [visibleCols, setVisibleCols] = useState<Set<string>>(() => {
        try {
            const saved = localStorage.getItem(LS_COLS);
            if (saved) return new Set(JSON.parse(saved));
        } catch { /* fresh default below */ }
        return new Set(METRICS.filter(m => m.default).map(m => String(m.key)));
    });

    useEffect(() => {
        try { localStorage.setItem(LS_COLS, JSON.stringify([...visibleCols])); } catch { /* ignore */ }
    }, [visibleCols]);

    const { data, isLoading } = useQuery({
        queryKey: ['screener'],
        queryFn: api.getScreener,
        refetchInterval: (q) => (q.state.data?.status !== 'ready' ? 5000 : 5 * 60_000),
    });

    const { data: watchlist } = useQuery({ queryKey: ['watchlist'], queryFn: api.getWatchlist });
    const watched = useMemo(() => new Set(watchlist?.items.map(i => i.symbol) ?? []), [watchlist]);
    const toggleWatch = useMutation({
        mutationFn: (symbol: string) =>
            watched.has(symbol) ? api.removeFromWatchlist(symbol) : api.addToWatchlist(symbol),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
    });

    const sectors = useMemo(() => {
        const s = new Set<string>();
        data?.rows.forEach(r => r.sector && s.add(r.sector));
        return ['all', ...Array.from(s).sort()];
    }, [data]);

    const activeCols = METRICS.filter(m => visibleCols.has(String(m.key)));

    const rows = useMemo(() => {
        if (!data) return [];
        const presetFn = PRESETS.find(p => p.id === preset)?.filter ?? (() => true);
        const q = search.trim().toLowerCase();
        const active = filters
            .map(f => {
                const def = METRICS.find(m => m.key === f.key);
                const conv = def?.toRaw ?? ((v: number) => v);
                return {
                    key: f.key,
                    min: f.min === '' ? null : conv(Number(f.min)),
                    max: f.max === '' ? null : conv(Number(f.max)),
                };
            })
            .filter(f => f.min != null || f.max != null);

        const filtered = data.rows.filter(r => {
            if (!presetFn(r)) return false;
            if (sector !== 'all' && r.sector !== sector) return false;
            if (q && !r.symbol.toLowerCase().includes(q) && !r.name.toLowerCase().includes(q)) return false;
            for (const f of active) {
                const v = r[f.key];
                if (v == null || typeof v !== 'number') return false;
                if (f.min != null && v < f.min) return false;
                if (f.max != null && v > f.max) return false;
            }
            return true;
        });
        return [...filtered].sort((a, b) => {
            const av = a[sortKey] ?? -Infinity;
            const bv = b[sortKey] ?? -Infinity;
            const cmp = typeof av === 'string'
                ? String(av).localeCompare(String(bv))
                : Number(av) - Number(bv);
            return sortDir === 'asc' ? cmp : -cmp;
        });
    }, [data, preset, sector, search, sortKey, sortDir, filters]);

    const onSort = (key: keyof ScreenerRow) => {
        if (key === sortKey) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
        else { setSortKey(key); setSortDir('desc'); }
        setLimit(PAGE);
    };

    const SortIcon = ({ col }: { col: keyof ScreenerRow }) =>
        sortKey !== col ? <ArrowUpDown size={11} className="opacity-30" />
            : sortDir === 'desc' ? <ArrowDown size={11} className="text-[var(--teal)]" />
                : <ArrowUp size={11} className="text-[var(--teal)]" />;

    const addFilter = (key: string) => {
        if (!key || filters.some(f => String(f.key) === key)) return;
        setFilters(f => [...f, { key: key as keyof ScreenerRow, min: '', max: '' }]);
    };

    const totalCols = activeCols.length + 3;

    return (
        <div className="p-8 space-y-5 animate-[fadeIn_0.4s_ease]">
            <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-white to-[var(--teal)] bg-clip-text text-transparent">
                        Stock Screener
                    </h1>
                    <p className="text-sm text-gray-400 mt-1">
                        Entire NSE — {data?.count ?? '…'} companies ranked by Conviction Score
                        <InfoTip term="conviction" size={13} /> · click a row for its Stock Desk
                    </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                    {data?.status === 'warming' && (
                        <span className="flex items-center gap-2 text-amber-300">
                            <RefreshCw size={13} className="animate-spin" />
                            Loading universe… {Math.round((data.progress ?? 0) * 100)}%
                        </span>
                    )}
                    {data?.status === 'ready' && data.as_of && (
                        <span>{rows.length} matches · updated {new Date(data.as_of).toLocaleTimeString()}</span>
                    )}
                </div>
            </div>

            {/* Controls */}
            <div className="glass-card p-4 space-y-3 !transform-none">
                <div className="flex flex-wrap items-center gap-2">
                    <Filter size={15} className="text-[var(--teal)]" />
                    {PRESETS.map(p => (
                        <button
                            key={p.id}
                            onClick={() => { setPreset(p.id); setLimit(PAGE); }}
                            className={cn(
                                'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                                preset === p.id
                                    ? 'bg-[var(--teal)]/15 border-[var(--teal)]/40 text-[var(--teal)]'
                                    : 'border-white/10 text-gray-400 hover:text-white hover:border-white/25'
                            )}
                        >
                            {p.label}
                        </button>
                    ))}
                    <div className="ml-auto flex items-center gap-2">
                        <button
                            onClick={() => { setShowColumns(v => !v); setShowFilters(false); }}
                            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                                showColumns ? 'bg-[var(--teal)]/15 border-[var(--teal)]/40 text-[var(--teal)]' : 'border-white/10 text-gray-400 hover:text-white')}
                        >
                            <Columns3 size={13} /> Columns ({activeCols.length})
                        </button>
                        <button
                            onClick={() => { setShowFilters(v => !v); setShowColumns(false); }}
                            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                                showFilters || filters.length > 0 ? 'bg-[var(--teal)]/15 border-[var(--teal)]/40 text-[var(--teal)]' : 'border-white/10 text-gray-400 hover:text-white')}
                        >
                            <SlidersHorizontal size={13} /> Ratio Filters{filters.length > 0 ? ` (${filters.length})` : ''}
                        </button>
                        <select
                            value={sector}
                            onChange={e => { setSector(e.target.value); setLimit(PAGE); }}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-300 outline-none focus:border-[var(--teal)]/50 max-w-[150px]"
                        >
                            {sectors.map(s => <option key={s} value={s} className="bg-[#0f1522]">{s === 'all' ? 'All Sectors' : s}</option>)}
                        </select>
                        <input
                            value={search}
                            onChange={e => { setSearch(e.target.value); setLimit(PAGE); }}
                            placeholder="Filter by name…"
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-200 outline-none focus:border-[var(--teal)]/50 w-36"
                        />
                    </div>
                </div>

                {/* Column manager */}
                {showColumns && (
                    <div className="flex flex-wrap gap-2 pt-3 border-t border-white/5">
                        {METRICS.map(m => {
                            const on = visibleCols.has(String(m.key));
                            return (
                                <button
                                    key={String(m.key)}
                                    onClick={() => setVisibleCols(s => {
                                        const n = new Set(s);
                                        if (on) n.delete(String(m.key)); else n.add(String(m.key));
                                        return n;
                                    })}
                                    className={cn('px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all',
                                        on ? 'bg-[var(--teal)]/12 border-[var(--teal)]/35 text-[var(--teal)]'
                                            : 'border-white/10 text-gray-500 hover:text-gray-300')}
                                >
                                    {m.label}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Dynamic ratio range filters */}
                {showFilters && (
                    <div className="space-y-2.5 pt-3 border-t border-white/5">
                        {filters.map((f, i) => {
                            const def = METRICS.find(m => m.key === f.key)!;
                            return (
                                <div key={String(f.key)} className="flex items-center gap-2 text-xs">
                                    <span className="w-28 text-gray-300 font-semibold">{def.label}{def.term && <InfoTip term={def.term} />}</span>
                                    <span className="text-gray-600">from</span>
                                    <input
                                        value={f.min}
                                        onChange={e => setFilters(fs => fs.map((x, j) => j === i ? { ...x, min: e.target.value.replace(/[^0-9.\-]/g, '') } : x))}
                                        placeholder="min" className="w-20 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 outline-none focus:border-[var(--teal)]/50"
                                    />
                                    <span className="text-gray-600">to</span>
                                    <input
                                        value={f.max}
                                        onChange={e => setFilters(fs => fs.map((x, j) => j === i ? { ...x, max: e.target.value.replace(/[^0-9.\-]/g, '') } : x))}
                                        placeholder="max" className="w-20 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 outline-none focus:border-[var(--teal)]/50"
                                    />
                                    {def.unit && <span className="text-gray-600">{def.unit}</span>}
                                    <button onClick={() => setFilters(fs => fs.filter((_, j) => j !== i))}
                                        className="text-gray-600 hover:text-rose-400 ml-1"><X size={13} /></button>
                                </div>
                            );
                        })}
                        <div className="flex items-center gap-2">
                            <Plus size={13} className="text-[var(--teal)]" />
                            <select
                                value=""
                                onChange={e => addFilter(e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 outline-none focus:border-[var(--teal)]/50"
                            >
                                <option value="" className="bg-[#0f1522]">Add a ratio filter…</option>
                                {METRICS.filter(m => !filters.some(f => f.key === m.key)).map(m => (
                                    <option key={String(m.key)} value={String(m.key)} className="bg-[#0f1522]">{m.label}</option>
                                ))}
                            </select>
                            {filters.length > 0 && (
                                <button onClick={() => setFilters([])} className="text-[11px] text-rose-300 hover:text-rose-200 font-semibold ml-2">
                                    Clear all
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="glass-card overflow-x-auto !transform-none">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-gray-500">
                            <th className="px-3 py-3 text-left w-8"></th>
                            <th className="px-3 py-3 text-left cursor-pointer select-none" onClick={() => onSort('symbol')}>
                                <span className="flex items-center gap-1">Company <SortIcon col="symbol" /></span>
                            </th>
                            <th className="px-3 py-3 text-left cursor-pointer select-none" onClick={() => onSort('score')}>
                                <span className="flex items-center gap-1">Conviction<InfoTip term="conviction" /> <SortIcon col="score" /></span>
                            </th>
                            {activeCols.map(c => (
                                <th key={String(c.key)} className="px-2.5 py-3 text-right cursor-pointer select-none whitespace-nowrap" onClick={() => onSort(c.key)}>
                                    <span className="flex items-center justify-end gap-0.5">
                                        {c.label}{c.term && <InfoTip term={c.term} size={11} />} <SortIcon col={c.key} />
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading || !data ? (
                            Array.from({ length: 12 }).map((_, i) => (
                                <tr key={i} className="border-b border-white/5">
                                    {Array.from({ length: totalCols }).map((_, j) => (
                                        <td key={j} className="px-3 py-3">
                                            <div className="h-4 rounded bg-white/5 animate-pulse" style={{ width: `${40 + ((i * 7 + j * 13) % 40)}%` }} />
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : rows.slice(0, limit).map(r => (
                            <tr
                                key={r.symbol}
                                onClick={() => navigate(`/app/stock?symbol=${encodeURIComponent(r.symbol)}`)}
                                className="border-b border-white/5 hover:bg-[var(--teal)]/[0.04] transition-colors cursor-pointer"
                            >
                                <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                                    <button
                                        onClick={() => toggleWatch.mutate(r.symbol)}
                                        className="text-gray-600 hover:text-amber-300 transition-colors"
                                    >
                                        <Star size={14} className={watched.has(r.symbol) ? 'fill-amber-300 text-amber-300' : ''} />
                                    </button>
                                </td>
                                <td className="px-3 py-2.5">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-white">{r.symbol.replace('.NS', '')}</span>
                                        {r.garp && (
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-300/30 bg-amber-300/10 text-amber-300">GARP</span>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-gray-500 truncate max-w-[150px]">{r.name}</div>
                                </td>
                                <td className="px-3 py-2.5"><ScoreBar score={r.score} /></td>
                                {activeCols.map(c => {
                                    const v = r[c.key];
                                    const colored = c.colored && v != null;
                                    return (
                                        <td key={String(c.key)} className={cn(
                                            'px-2.5 py-2.5 text-right tabular-nums whitespace-nowrap text-[13px]',
                                            colored ? (Number(v) >= 0 ? 'text-emerald-400' : 'text-rose-400') : 'text-gray-300'
                                        )}>
                                            {c.fmt(r)}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                        {!isLoading && data && rows.length === 0 && (
                            <tr><td colSpan={totalCols} className="px-3 py-10 text-center text-gray-500">No stocks match the current filters.</td></tr>
                        )}
                    </tbody>
                </table>
                {!isLoading && rows.length > limit && (
                    <div className="p-4 text-center border-t border-white/5">
                        <button onClick={() => setLimit(l => l + 300)} className="btn-primary !py-2 text-sm">
                            Show more ({rows.length - limit} remaining)
                        </button>
                    </div>
                )}
            </div>
            <p className="text-[11px] text-gray-600">
                Universe = every NSE-listed equity (~2,300). Hover any <span className="text-gray-400">?</span> for a plain-English explanation.
                Fundamental ratios fill in as the background refresh completes. Educational analytics — not investment advice.
            </p>
        </div>
    );
}
