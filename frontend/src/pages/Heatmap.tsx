import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import { RefreshCw, Grid3X3 } from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/utils';

/** Color scale: deep rose (-3%) → neutral slate (0) → deep emerald (+3%) */
function heatColor(change: number | null): string {
    if (change == null) return '#1a2436';
    const c = Math.max(-3, Math.min(3, change)) / 3;   // -1..1
    if (c >= 0) {
        const t = c;
        return `rgb(${Math.round(20 + 10 * t)}, ${Math.round(60 + 120 * t)}, ${Math.round(60 + 70 * t)})`;
    }
    const t = -c;
    return `rgb(${Math.round(60 + 140 * t)}, ${Math.round(35 + 20 * t)}, ${Math.round(55 + 30 * t)})`;
}

interface Node {
    name: string;
    symbol?: string;
    size?: number;
    change?: number | null;
    children?: Node[];
}

function Cell(props: any) {
    const { x, y, width, height, name, change, symbol, depth, onOpen } = props;
    if (depth === 1) {
        // sector frame
        return (
            <g>
                <rect x={x} y={y} width={width} height={height}
                    fill="none" stroke="rgba(10,15,30,0.9)" strokeWidth={3} />
                {width > 70 && height > 16 && (
                    <text x={x + 5} y={y + 14} fill="#8ea6c9" fontSize={10}
                        fontWeight={700} style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                        {String(name).slice(0, Math.floor(width / 7))}
                    </text>
                )}
            </g>
        );
    }
    if (depth !== 2) return null;
    const showLabel = width > 46 && height > 26;
    const showPct = width > 46 && height > 40;
    return (
        <g style={{ cursor: 'pointer' }} onClick={() => symbol && onOpen(symbol)}>
            <rect x={x + 1} y={y + 1} width={Math.max(0, width - 2)} height={Math.max(0, height - 2)}
                fill={heatColor(change)} rx={3}
                stroke="rgba(255,255,255,0.06)" strokeWidth={0.5}
                className="transition-opacity hover:opacity-80" />
            {showLabel && (
                <text x={x + width / 2} y={y + height / 2 + (showPct ? -5 : 3)}
                    textAnchor="middle" fill="#f1f5f9" fontSize={Math.min(13, width / 6)}
                    fontWeight={700}>
                    {String(name).replace('.NS', '')}
                </text>
            )}
            {showPct && change != null && (
                <text x={x + width / 2} y={y + height / 2 + 11}
                    textAnchor="middle" fill="rgba(241,245,249,0.85)" fontSize={10}>
                    {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                </text>
            )}
        </g>
    );
}

const SIZES = [
    { id: 'top100', label: 'Top 100', n: 100 },
    { id: 'top250', label: 'Top 250', n: 250 },
    { id: 'top500', label: 'Top 500', n: 500 },
] as const;

export function Heatmap() {
    const navigate = useNavigate();
    const [sizeSel, setSizeSel] = useState<typeof SIZES[number]>(SIZES[0]);

    const { data, isLoading } = useQuery({
        queryKey: ['screener'],
        queryFn: api.getScreener,
        refetchInterval: (q) => (q.state.data?.status !== 'ready' ? 5000 : 5 * 60_000),
    });

    const tree = useMemo<Node[]>(() => {
        if (!data) return [];
        const rows = data.rows
            .filter(r => r.market_cap != null && r.change_pct != null)
            .sort((a, b) => (b.market_cap ?? 0) - (a.market_cap ?? 0))
            .slice(0, sizeSel.n);
        const bySector = new Map<string, typeof rows>();
        for (const r of rows) {
            const key = r.sector ?? 'Other';
            if (!bySector.has(key)) bySector.set(key, [] as any);
            bySector.get(key)!.push(r);
        }
        return Array.from(bySector.entries())
            .map(([sector, stocks]) => ({
                name: sector,
                children: stocks.map(s => ({
                    name: s.symbol.replace('.NS', ''),
                    symbol: s.symbol,
                    size: Math.sqrt(s.market_cap ?? 1),   // sqrt: keep giants from swallowing the map
                    change: s.change_pct,
                })),
            }))
            .sort((a, b) => b.children.length - a.children.length);
    }, [data, sizeSel]);

    const breadth = useMemo(() => {
        if (!data) return null;
        const rows = data.rows.filter(r => r.change_pct != null);
        const up = rows.filter(r => (r.change_pct ?? 0) > 0).length;
        return { up, down: rows.length - up, total: rows.length };
    }, [data]);

    return (
        <div className="px-8 pt-8 pb-16 space-y-5 animate-[fadeIn_0.4s_ease] max-w-[1500px] mx-auto">
            <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-white to-[var(--teal)] bg-clip-text text-transparent">
                        Sector Heatmap
                    </h1>
                    <p className="text-sm text-gray-400 mt-1">
                        The whole market at a glance — box size = market cap, color = today's move. Click any box to open its Stock Desk.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {breadth && (
                        <span className="text-xs text-gray-400">
                            <span className="text-emerald-400 font-bold">{breadth.up} ▲</span>
                            {' · '}
                            <span className="text-rose-400 font-bold">{breadth.down} ▼</span>
                            {' of '}{breadth.total}
                        </span>
                    )}
                    <div className="flex gap-1">
                        {SIZES.map(s => (
                            <button key={s.id} onClick={() => setSizeSel(s)}
                                className={cn('px-3 py-1.5 rounded-full text-xs font-bold border transition-all',
                                    sizeSel.id === s.id
                                        ? 'bg-[var(--teal)]/15 border-[var(--teal)]/40 text-[var(--teal)]'
                                        : 'border-white/10 text-gray-400 hover:text-white')}>
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {data?.status === 'warming' && (
                <p className="flex items-center gap-2 text-xs text-amber-300">
                    <RefreshCw size={13} className="animate-spin" />
                    Universe still loading ({Math.round((data.progress ?? 0) * 100)}%) — the map fills as data lands
                </p>
            )}

            <div className="glass-card !transform-none p-2 overflow-hidden">
                {isLoading || tree.length === 0 ? (
                    <div className="h-[640px] flex flex-col items-center justify-center gap-3 text-gray-500">
                        <Grid3X3 size={32} className="animate-pulse text-[var(--teal)]" />
                        <p className="text-sm">Building the market map…</p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={640}>
                        <Treemap
                            data={tree as any}
                            dataKey="size"
                            isAnimationActive={false}
                            content={<Cell onOpen={(sym: string) => navigate(`/app/stock?symbol=${encodeURIComponent(sym)}`)} />}
                        >
                            <Tooltip
                                contentStyle={{
                                    background: 'rgba(10,14,23,0.95)', border: '1px solid rgba(0,245,212,0.2)',
                                    borderRadius: 10, fontSize: 12,
                                }}
                                formatter={(_v: any, _n: any, entry: any) => {
                                    const p = entry?.payload;
                                    return [`${p?.change != null ? (p.change >= 0 ? '+' : '') + p.change.toFixed(2) + '%' : '—'} today`, p?.name];
                                }}
                            />
                        </Treemap>
                    </ResponsiveContainer>
                )}
            </div>

            <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-500">
                <span>-3%</span>
                {[-3, -2, -1, 0, 1, 2, 3].map(v => (
                    <span key={v} className="w-8 h-3 rounded-sm inline-block" style={{ background: heatColor(v) }} />
                ))}
                <span>+3%</span>
            </div>
        </div>
    );
}
