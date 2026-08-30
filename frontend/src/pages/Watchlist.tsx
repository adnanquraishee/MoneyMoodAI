import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Trash2, TrendingUp, TrendingDown, Eye } from 'lucide-react';
import { api } from '../lib/api';
import type { WatchlistItem } from '../lib/types';
import { cn } from '../lib/utils';
import { SearchBox } from '../components/layout/SearchBox';

function Sparkline({ data, up }: { data: number[]; up: boolean }) {
    if (!data || data.length < 2) return <div className="h-10" />;
    const min = Math.min(...data), max = Math.max(...data);
    const range = max - min || 1;
    const w = 120, h = 40;
    const pts = data.map((v, i) =>
        `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`
    ).join(' ');
    const color = up ? '#34d399' : '#fb7185';
    return (
        <svg width={w} height={h} className="overflow-visible">
            <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
            <circle
                cx={w} cy={h - ((data[data.length - 1] - min) / range) * (h - 4) - 2}
                r="2.5" fill={color}
            />
        </svg>
    );
}

function WatchCard({ item, onRemove }: { item: WatchlistItem; onRemove: (s: string) => void }) {
    const up = (item.change_pct ?? 0) >= 0;
    return (
        <div className="glass-card p-5 group relative">
            <button
                onClick={() => onRemove(item.symbol)}
                className="absolute top-3 right-3 text-gray-700 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all"
                title="Remove"
            >
                <Trash2 size={14} />
            </button>
            <div className="flex items-start justify-between pr-6">
                <div>
                    <h3 className="font-bold text-white">{item.symbol.replace('.NS', '')}</h3>
                    <p className="text-[11px] text-gray-500 truncate max-w-[140px]">{item.name}</p>
                </div>
                {item.score != null && (
                    <span className={cn(
                        'text-[10px] font-bold px-2 py-1 rounded-full border',
                        item.score >= 70 ? 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10'
                            : item.score >= 45 ? 'text-[var(--teal)] border-[var(--teal)]/30 bg-[var(--teal)]/10'
                                : 'text-rose-300 border-rose-400/30 bg-rose-400/10'
                    )}>
                        C {item.score.toFixed(0)}
                    </span>
                )}
            </div>
            <div className="mt-4 flex items-end justify-between gap-3">
                <div>
                    <p className="text-2xl font-bold tabular-nums">
                        {item.price != null ? `₹${item.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}
                    </p>
                    <p className={cn('text-sm font-semibold flex items-center gap-1 mt-0.5', up ? 'text-emerald-400' : 'text-rose-400')}>
                        {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                        {item.change_pct != null ? `${up ? '+' : ''}${item.change_pct.toFixed(2)}%` : '—'}
                    </p>
                </div>
                <Sparkline data={item.sparkline} up={up} />
            </div>
            <div className="mt-4 flex items-center justify-between text-[11px] text-gray-500">
                <span>RSI {item.rsi != null ? item.rsi.toFixed(0) : '—'}</span>
                <Link
                    to={`/app/stock?symbol=${item.symbol}&tab=forecast`}
                    className="flex items-center gap-1 text-[var(--teal)] hover:underline font-semibold"
                >
                    <Eye size={12} /> Forecast
                </Link>
            </div>
        </div>
    );
}

export function Watchlist() {
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ['watchlist'],
        queryFn: api.getWatchlist,
        refetchInterval: 60_000,      // fast-lane quotes refresh every 60s
    });

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    const addMutation = useMutation({ mutationFn: api.addToWatchlist, onSuccess: invalidate });
    const removeMutation = useMutation({ mutationFn: api.removeFromWatchlist, onSuccess: invalidate });

    return (
        <div className="p-8 space-y-6 animate-[fadeIn_0.4s_ease]">
            <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Watchlist</h1>
                    <p className="text-sm text-gray-400 mt-1">
                        Live quotes every 60s · forecasts pre-computed in the background
                    </p>
                </div>
                <div className="w-80">
                    <SearchBox
                        placeholder="Search a company to add…"
                        onSelect={(symbol) => addMutation.mutate(symbol)}
                    />
                </div>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="glass-card p-5 h-44 animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {data?.items.map(item => (
                        <WatchCard key={item.symbol} item={item} onRemove={s => removeMutation.mutate(s)} />
                    ))}
                    {data?.items.length === 0 && (
                        <div className="col-span-full glass-card p-12 text-center text-gray-500">
                            Your watchlist is empty — add a symbol above or star stocks in the Screener.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
