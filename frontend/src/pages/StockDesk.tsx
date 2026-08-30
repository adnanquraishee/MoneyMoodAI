import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    ComposedChart, Line, Area, Bar, XAxis, YAxis, Tooltip as RTooltip,
    ResponsiveContainer, CartesianGrid, ReferenceLine, Cell,
} from 'recharts';
import {
    Star, TrendingUp, TrendingDown, CandlestickChart, LayoutGrid,
    Activity, LineChart as LineChartIcon, CheckCircle2, XCircle,
    Newspaper, ExternalLink,
} from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { InfoTip } from '../components/ui/InfoTip';
import { SearchBox } from '../components/layout/SearchBox';
import { CandleChart } from '../components/charts/CandleChart';
import { QuantForecastPanel } from '../components/features/QuantForecastPanel';
import { ConvictionOrb } from '../components/3d/ConvictionOrb';
import { RatioBars3D } from '../components/3d/RatioBars3D';

const TEAL = 'hsl(178, 100%, 45%)';

// ---------- formatting helpers ----------
const inr = (v: number | null | undefined, digits = 2) =>
    v == null ? '—' : `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: digits })}`;
const num = (v: number | null | undefined, digits = 2) =>
    v == null ? '—' : Number(v).toFixed(digits);
const pct = (v: number | null | undefined, digits = 1) =>
    v == null ? '—' : `${(Number(v) * 100).toFixed(digits)}%`;
const cr = (v: number | null | undefined) => {
    if (v == null) return '—';
    const crores = Number(v) / 1e7;
    if (crores >= 100000) return `₹${(crores / 100000).toFixed(2)} L Cr`;
    return `₹${crores.toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr`;
};

// ---------- small building blocks ----------
function Metric({ label, value, term, tone }: {
    label: string; value: string; term?: string; tone?: 'up' | 'down';
}) {
    return (
        <div className="rounded-xl bg-white/[0.04] border border-white/5 px-4 py-3">
            <p className="text-[11px] text-gray-500 flex items-center">{label}{term && <InfoTip term={term} />}</p>
            <p className={cn('font-bold mt-1 tabular-nums',
                tone === 'up' ? 'text-emerald-400' : tone === 'down' ? 'text-rose-400' : 'text-white')}>
                {value}
            </p>
        </div>
    );
}

function Range52W({ price, low, high }: { price: number; low: number | null; high: number | null }) {
    if (low == null || high == null || high <= low) return null;
    const posPct = Math.min(100, Math.max(0, ((price - low) / (high - low)) * 100));
    return (
        <div className="min-w-[220px]">
            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                <span>52W Low {inr(low, 0)}</span>
                <span>52W High {inr(high, 0)}</span>
            </div>
            <div className="relative h-1.5 rounded-full bg-white/10">
                <div className="absolute h-full rounded-full bg-gradient-to-r from-rose-400/60 via-amber-300/60 to-emerald-400/60 w-full opacity-40" />
                <div
                    className="absolute -top-[3px] w-3 h-3 rounded-full bg-[var(--teal)] shadow-[0_0_8px_rgba(0,245,212,0.8)]"
                    style={{ left: `calc(${posPct}% - 6px)` }}
                />
            </div>
        </div>
    );
}

function SignalCard({ ok, label, detail, term }: { ok: boolean; label: string; detail: string; term: string }) {
    return (
        <div className={cn('rounded-xl border px-4 py-3 flex items-start gap-3',
            ok ? 'border-emerald-400/20 bg-emerald-400/5' : 'border-rose-400/20 bg-rose-400/5')}>
            {ok ? <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                : <XCircle size={16} className="text-rose-400 mt-0.5 shrink-0" />}
            <div>
                <p className="text-sm font-semibold text-white">{label}<InfoTip term={term} /></p>
                <p className="text-[11px] text-gray-400 mt-0.5">{detail}</p>
            </div>
        </div>
    );
}

// ---------- Overview tab ----------
function OverviewTab({ symbol }: { symbol: string }) {
    const { data, isLoading } = useQuery({
        queryKey: ['overview', symbol],
        queryFn: () => api.getOverview(symbol),
        staleTime: 60_000,
    });

    if (isLoading || !data) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
                ))}
            </div>
        );
    }
    const f = data.fundamentals;
    const fac = data.factors ?? {};

    return (
        <div className="space-y-6">
            {/* Conviction hero: 3D orb + factor strip */}
            <div className="glass-card p-0 overflow-hidden !transform-none">
                <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] items-stretch">
                    <div className="relative bg-gradient-to-br from-white/[0.03] to-transparent">
                        <ConvictionOrb
                            score={(fac.score as number) ?? null}
                            changePct={data.quote.change_pct}
                        />
                        <div className="absolute bottom-3 left-0 right-0 text-center pointer-events-none">
                            <p className="text-[10px] uppercase tracking-[0.25em] text-gray-500">
                                Conviction<InfoTip term="conviction" />
                            </p>
                            <p className={cn('text-3xl font-bold tabular-nums drop-shadow-[0_0_12px_rgba(0,0,0,0.8)]',
                                fac.score == null ? 'text-gray-400'
                                    : (fac.score as number) >= 70 ? 'text-emerald-400'
                                        : (fac.score as number) >= 45 ? 'text-[var(--teal)]' : 'text-rose-400')}>
                                {fac.score != null ? Number(fac.score).toFixed(0) : '—'}
                                <span className="text-sm text-gray-500 font-semibold">/100</span>
                            </p>
                        </div>
                    </div>
                    <div className="p-6 flex flex-col justify-center gap-4">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="font-bold text-white">Factor profile vs NIFTY-100</h3>
                            {(fac as any).garp && (
                                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border border-amber-300/30 bg-amber-300/10 text-amber-300">
                                    GARP<InfoTip term="garp" />
                                </span>
                            )}
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {([
                                ['Alpha rank', 'alpha', fac.rank_alpha],
                                ['Treynor rank', 'treynor', fac.rank_treynor],
                                ['Momentum rank', 'momentum', fac.rank_momentum],
                                ['Low-vol rank', 'low_vol', fac.rank_low_vol],
                            ] as const).map(([label, term, v]) => (
                                <div key={label}>
                                    <div className="flex justify-between text-[10px] text-gray-500">
                                        <span>{label}<InfoTip term={term} /></span>
                                        <span className="font-bold text-gray-300">{v != null ? Number(v).toFixed(0) : '—'}</span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-white/10 mt-1.5 overflow-hidden">
                                        <div className="h-full rounded-full bg-gradient-to-r from-[var(--teal-dim)] to-[var(--teal)]" style={{ width: `${v ?? 0}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                        {fac.score == null && (
                            <p className="text-[11px] text-gray-500">
                                Outside the NIFTY-100 universe — factor ranks appear where computable.
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* 3D factor constellation */}
            <section className="glass-card !transform-none overflow-hidden">
                <div className="px-6 pt-5 flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">
                        Factor Constellation — 3D<InfoTip term="conviction" />
                    </h3>
                    <span className="text-[10px] text-gray-600">drag to orbit · percentile ranks vs full NSE</span>
                </div>
                <RatioBars3D
                    height={250}
                    data={[
                        { label: 'Alpha', value: (fac.rank_alpha as number) ?? null },
                        { label: 'Treynor', value: (fac.rank_treynor as number) ?? null },
                        { label: 'Momentum', value: (fac.rank_momentum as number) ?? null },
                        { label: 'Low Vol', value: (fac.rank_low_vol as number) ?? null },
                        { label: 'RSI', value: (fac.rsi as number) ?? null },
                        { label: 'Score', value: (fac.score as number) ?? null },
                    ]}
                />
            </section>

            {/* Valuation */}
            <section>
                <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3">Valuation</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
                    <Metric label="Market Cap" term="market_cap" value={cr(f.market_cap)} />
                    <Metric label="P/E (TTM)" term="pe" value={num(f.pe, 1)} />
                    <Metric label="Forward P/E" term="forward_pe" value={num(f.forward_pe, 1)} />
                    <Metric label="PEG" term="peg" value={num(f.peg)} />
                    <Metric label="P/B" term="pb" value={num(f.pb)} />
                    <Metric label="P/S" term="ps" value={num(f.ps)} />
                    <Metric label="EPS (TTM)" term="eps" value={inr(f.eps)} />
                    <Metric label="Book Value" value={inr(f.book_value)} />
                    <Metric label="Dividend Yield" term="dividend_yield" value={pct(f.dividend_yield, 2)} />
                </div>
            </section>

            {/* Profitability & growth */}
            <section>
                <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3">Profitability & Growth</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
                    <Metric label="ROE" term="roe" value={pct(f.roe)} tone={f.roe != null ? (f.roe >= 0.15 ? 'up' : f.roe < 0.08 ? 'down' : undefined) : undefined} />
                    <Metric label="ROA" term="roa" value={pct(f.roa)} />
                    <Metric label="Net Margin" term="profit_margin" value={pct(f.profit_margin)} />
                    <Metric label="Op. Margin" term="operating_margin" value={pct(f.operating_margin)} />
                    <Metric label="Revenue Growth" term="revenue_growth" value={pct(f.revenue_growth)} tone={f.revenue_growth != null ? (f.revenue_growth >= 0 ? 'up' : 'down') : undefined} />
                    <Metric label="Earnings Growth" term="earnings_growth" value={pct(f.earnings_growth)} tone={f.earnings_growth != null ? (f.earnings_growth >= 0 ? 'up' : 'down') : undefined} />
                </div>
            </section>

            {/* Risk & performance */}
            <section>
                <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3">Risk & Performance</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
                    <Metric label="Beta" term="beta" value={num(fac.beta as number)} />
                    <Metric label="Volatility (1Y)" term="volatility" value={pct(fac.volatility as number)} />
                    <Metric label="Sharpe" term="sharpe" value={num((fac as any).sharpe)} tone={(fac as any).sharpe != null ? ((fac as any).sharpe >= 1 ? 'up' : (fac as any).sharpe < 0 ? 'down' : undefined) : undefined} />
                    <Metric label="Treynor" term="treynor" value={num(fac.treynor as number)} />
                    <Metric label="Jensen's α" term="alpha" value={fac.alpha != null ? pct(fac.alpha as number) : '—'} tone={fac.alpha != null ? ((fac.alpha as number) >= 0 ? 'up' : 'down') : undefined} />
                    <Metric label="1Y Return" value={fac.return_1y != null ? pct(fac.return_1y as number) : '—'} tone={fac.return_1y != null ? ((fac.return_1y as number) >= 0 ? 'up' : 'down') : undefined} />
                    <Metric label="12-1 Momentum" term="momentum" value={fac.momentum != null ? pct(fac.momentum as number) : '—'} />
                    <Metric label="From 52W High" term="pct_52w_high" value={fac.pct_from_52w_high != null ? `${Number(fac.pct_from_52w_high).toFixed(1)}%` : '—'} />
                    <Metric label="Debt / Equity" term="debt_to_equity" value={num(f.debt_to_equity)} />
                    <Metric label="Current Ratio" term="current_ratio" value={num(f.current_ratio)} />
                </div>
            </section>

            {f.summary && (
                <section className="glass-card p-6 !transform-none">
                    <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-2">
                        About {data.name}
                    </h3>
                    <p className="text-sm text-gray-400 leading-relaxed">{f.summary}…</p>
                    {(f.sector || f.industry) && (
                        <p className="text-[11px] text-gray-600 mt-3">
                            {f.sector}{f.industry ? ` · ${f.industry}` : ''}
                        </p>
                    )}
                </section>
            )}
        </div>
    );
}

// ---------- Technicals tab ----------
function TechnicalsTab({ symbol }: { symbol: string }) {
    const { data: overview } = useQuery({
        queryKey: ['overview', symbol],
        queryFn: () => api.getOverview(symbol),
        staleTime: 60_000,
    });
    const { data: tech, isLoading } = useQuery({
        queryKey: ['technicals', symbol],
        queryFn: () => api.getTechnicals(symbol),
        staleTime: 5 * 60_000,
    });

    const rows = useMemo(() => {
        if (!tech?.data) return [];
        return (tech.data as any[]).slice(-180).map(r => ({
            date: String(r.Date).slice(0, 10),
            close: r.Close,
            bbU: r['BBU_20_2_0'], bbM: r['BBM_20_2_0'], bbL: r['BBL_20_2_0'],
            band: [r['BBL_20_2_0'], r['BBU_20_2_0']],
            rsi: r['RSI_14'],
            macd: r['MACD_12_26_9'], macdS: r['MACDs_12_26_9'], macdH: r['MACDh_12_26_9'],
        }));
    }, [tech]);

    const t = overview?.technicals;
    const axis = { tick: { fill: '#64748b', fontSize: 10 }, tickLine: false as const };
    const tooltipStyle = {
        background: 'rgba(10,14,23,0.95)', border: '1px solid rgba(0,245,212,0.2)',
        borderRadius: 10, fontSize: 11,
    };

    return (
        <div className="space-y-5">
            {t && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                    <SignalCard
                        ok={(t.rsi ?? 50) >= 30 && (t.rsi ?? 50) <= 70} term="rsi"
                        label={`RSI ${t.rsi != null ? Number(t.rsi).toFixed(0) : '—'}`}
                        detail={(t.rsi ?? 50) > 70 ? 'Overbought — rally may be stretched'
                            : (t.rsi ?? 50) < 30 ? 'Oversold — selling may be exhausted'
                                : 'Neutral zone — no momentum extreme'}
                    />
                    <SignalCard
                        ok={t.macd_state === 'bullish'} term="macd"
                        label={`MACD ${t.macd_state === 'bullish' ? 'Bullish' : 'Bearish'}`}
                        detail={`Histogram ${t.macd_hist != null ? t.macd_hist.toFixed(2) : '—'} — ${t.macd_state === 'bullish' ? 'short-term momentum above trend' : 'short-term momentum below trend'}`}
                    />
                    <SignalCard
                        ok={(t.price_vs_ma200 ?? 0) >= 0} term="ma200"
                        label={`${(t.price_vs_ma200 ?? 0) >= 0 ? 'Above' : 'Below'} 200-DMA`}
                        detail={`Price is ${t.price_vs_ma200 != null ? Math.abs(t.price_vs_ma200).toFixed(1) : '—'}% ${(t.price_vs_ma200 ?? 0) >= 0 ? 'above' : 'below'} the long-term trend line`}
                    />
                    <SignalCard
                        ok={t.golden_cross} term="golden_cross"
                        label={t.golden_cross ? 'Golden Cross intact' : 'No Golden Cross'}
                        detail={t.golden_cross ? '50-DMA above 200-DMA — long-term uptrend structure' : '50-DMA below 200-DMA — weak long-term structure'}
                    />
                </div>
            )}

            {isLoading && <div className="h-[300px] rounded-xl bg-white/5 animate-pulse" />}

            {rows.length > 0 && (
                <>
                    <div className="glass-card p-5 !transform-none">
                        <h3 className="font-bold text-sm mb-3">Price & Bollinger Bands<InfoTip term="bollinger" size={13} /></h3>
                        <ResponsiveContainer width="100%" height={260}>
                            <ComposedChart data={rows} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                                <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                                <XAxis dataKey="date" {...axis} minTickGap={50} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
                                <YAxis {...axis} domain={['auto', 'auto']} width={60} axisLine={false} />
                                <RTooltip contentStyle={tooltipStyle} labelStyle={{ color: '#94a3b8' }} />
                                <Area dataKey="band" stroke="none" fill={TEAL} fillOpacity={0.07} name="BB range" />
                                <Line dataKey="bbM" stroke="#64748b" strokeWidth={1} dot={false} strokeDasharray="4 3" name="20-DMA" />
                                <Line dataKey="close" stroke="#e2e8f0" strokeWidth={2} dot={false} name="Close" />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <div className="glass-card p-5 !transform-none">
                            <h3 className="font-bold text-sm mb-3">RSI (14)<InfoTip term="rsi" size={13} /></h3>
                            <ResponsiveContainer width="100%" height={180}>
                                <ComposedChart data={rows} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                                    <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                                    <XAxis dataKey="date" {...axis} minTickGap={60} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
                                    <YAxis {...axis} domain={[0, 100]} ticks={[0, 30, 50, 70, 100]} width={32} axisLine={false} />
                                    <RTooltip contentStyle={tooltipStyle} labelStyle={{ color: '#94a3b8' }} />
                                    <ReferenceLine y={70} stroke="rgba(251,113,133,0.5)" strokeDasharray="4 3" />
                                    <ReferenceLine y={30} stroke="rgba(52,211,153,0.5)" strokeDasharray="4 3" />
                                    <Line dataKey="rsi" stroke={TEAL} strokeWidth={1.8} dot={false} name="RSI" />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="glass-card p-5 !transform-none">
                            <h3 className="font-bold text-sm mb-3">MACD (12, 26, 9)<InfoTip term="macd" size={13} /></h3>
                            <ResponsiveContainer width="100%" height={180}>
                                <ComposedChart data={rows} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                                    <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                                    <XAxis dataKey="date" {...axis} minTickGap={60} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
                                    <YAxis {...axis} width={45} axisLine={false} />
                                    <RTooltip contentStyle={tooltipStyle} labelStyle={{ color: '#94a3b8' }} />
                                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" />
                                    <Bar dataKey="macdH" name="Histogram" isAnimationActive={false}>
                                        {rows.map((r, i) => (
                                            <Cell key={i} fill={r.macdH >= 0 ? 'rgba(52,211,153,0.6)' : 'rgba(251,113,133,0.6)'} />
                                        ))}
                                    </Bar>
                                    <Line dataKey="macd" stroke={TEAL} strokeWidth={1.5} dot={false} name="MACD" />
                                    <Line dataKey="macdS" stroke="#c084fc" strokeWidth={1.5} dot={false} name="Signal" />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// ---------- News tab ----------
function NewsTab({ symbol }: { symbol: string }) {
    const { data, isLoading, isError } = useQuery({
        queryKey: ['news', symbol],
        queryFn: () => api.getNews(symbol),
        staleTime: 15 * 60_000,
    });

    if (isLoading) {
        return (
            <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
                ))}
            </div>
        );
    }
    if (isError || !data) {
        return <div className="glass-card p-8 text-center text-sm text-gray-500">Could not load news right now — try again shortly.</div>;
    }
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm text-gray-400">
                    Live headlines for <span className="text-white font-semibold">{data.company}</span>
                    <InfoTip term="sentiment" />
                </p>
                {data.avg_sentiment != null && (
                    <span className={cn('text-xs font-bold px-3 py-1.5 rounded-full border',
                        data.avg_sentiment > 0.1 ? 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10'
                            : data.avg_sentiment < -0.1 ? 'text-rose-300 border-rose-400/30 bg-rose-400/10'
                                : 'text-gray-300 border-white/10 bg-white/5')}>
                        Avg sentiment {data.avg_sentiment >= 0 ? '+' : ''}{data.avg_sentiment.toFixed(2)}
                    </span>
                )}
            </div>
            {data.distribution && data.items.length > 0 && (() => {
                const d = data.distribution!;
                const total = Math.max(1, d.positive + d.neutral + d.negative);
                return (
                    <div className="glass-card !transform-none p-4">
                        <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">
                            AI sentiment breakdown (FinBERT + VADER)<InfoTip term="sentiment" />
                        </p>
                        <div className="flex h-2.5 rounded-full overflow-hidden bg-white/5">
                            <div className="bg-emerald-400/80" style={{ width: `${(d.positive / total) * 100}%` }} />
                            <div className="bg-gray-500/60" style={{ width: `${(d.neutral / total) * 100}%` }} />
                            <div className="bg-rose-400/80" style={{ width: `${(d.negative / total) * 100}%` }} />
                        </div>
                        <div className="flex justify-between mt-2 text-[11px]">
                            <span className="text-emerald-400 font-semibold">{d.positive} positive</span>
                            <span className="text-gray-400">{d.neutral} neutral</span>
                            <span className="text-rose-400 font-semibold">{d.negative} negative</span>
                        </div>
                    </div>
                );
            })()}
            {data.items.length === 0 && (
                <div className="glass-card p-8 text-center text-sm text-gray-500">No recent headlines found for this company.</div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {data.items.map((n, i) => (
                    <a
                        key={i} href={n.link} target="_blank" rel="noopener noreferrer"
                        className="glass-card !transform-none p-4 flex items-start gap-3 group hover:border-[var(--teal)]/30"
                    >
                        <span className={cn('mt-1 w-2 h-2 rounded-full shrink-0',
                            n.label === 'positive' ? 'bg-emerald-400'
                                : n.label === 'negative' ? 'bg-rose-400' : 'bg-gray-500')} />
                        <span className="flex-1 text-sm text-gray-200 leading-snug group-hover:text-white transition-colors">
                            {n.title}
                        </span>
                        <ExternalLink size={13} className="text-gray-600 group-hover:text-[var(--teal)] shrink-0 mt-1 transition-colors" />
                    </a>
                ))}
            </div>
            <p className="text-[11px] text-gray-600">
                Source: Google News · each headline scored by a FinBERT + VADER hybrid. Dot color = tone of the headline.
            </p>
        </div>
    );
}

// ---------- Page ----------
const TABS = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'charts', label: 'Charts', icon: CandlestickChart },
    { id: 'technicals', label: 'Technicals', icon: Activity },
    { id: 'forecast', label: 'Quant Forecast', icon: LineChartIcon },
    { id: 'news', label: 'News', icon: Newspaper },
] as const;

export function StockDesk() {
    const [params, setParams] = useSearchParams();
    const symbol = (params.get('symbol') || 'RELIANCE.NS').toUpperCase();
    const tab = params.get('tab') || 'overview';
    const queryClient = useQueryClient();

    const { data: overview } = useQuery({
        queryKey: ['overview', symbol],
        queryFn: () => api.getOverview(symbol),
        staleTime: 60_000,
    });
    const { data: watchlist } = useQuery({ queryKey: ['watchlist'], queryFn: api.getWatchlist });
    const watched = useMemo(() => new Set(watchlist?.items.map(i => i.symbol) ?? []), [watchlist]);

    const toggleWatch = useMutation({
        mutationFn: () => watched.has(symbol) ? api.removeFromWatchlist(symbol) : api.addToWatchlist(symbol),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
    });

    const setTab = (t: string) => setParams({ symbol, tab: t });
    const q = overview?.quote;
    const up = (q?.change_pct ?? 0) >= 0;

    return (
        <div className="p-8 space-y-6 animate-[fadeIn_0.4s_ease]">
            {/* Header: search + quote */}
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div className="space-y-4 min-w-[280px] flex-1">
                    <SearchBox onSelect={(sym) => setParams({ symbol: sym, tab })} />
                    <div className="flex items-end gap-4 flex-wrap">
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl font-bold tracking-tight">
                                    {overview?.name ?? symbol.replace('.NS', '')}
                                </h1>
                                <button
                                    onClick={() => toggleWatch.mutate()}
                                    title={watched.has(symbol) ? 'Remove from watchlist' : 'Add to watchlist'}
                                    className="text-gray-600 hover:text-amber-300 transition-colors"
                                >
                                    <Star size={20} className={watched.has(symbol) ? 'fill-amber-300 text-amber-300' : ''} />
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {symbol} · NSE {q?.as_of ? `· as of ${q.as_of}` : ''}
                            </p>
                        </div>
                        {q && (
                            <div className="flex items-center gap-3">
                                <span className="text-3xl font-bold tabular-nums">{inr(q.price)}</span>
                                <span className={cn('flex items-center gap-1 text-sm font-bold',
                                    up ? 'text-emerald-400' : 'text-rose-400')}>
                                    {up ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                                    {up ? '+' : ''}{q.change_pct.toFixed(2)}%
                                </span>
                            </div>
                        )}
                    </div>
                </div>
                {q && <Range52W price={q.price} low={q.low_52w} high={q.high_52w} />}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-white/10">
                {TABS.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={cn(
                            'flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-all border-b-2 -mb-px',
                            tab === t.id
                                ? 'text-[var(--teal)] border-[var(--teal)]'
                                : 'text-gray-500 border-transparent hover:text-white'
                        )}
                    >
                        <t.icon size={15} /> {t.label}
                    </button>
                ))}
            </div>

            {tab === 'overview' && <OverviewTab symbol={symbol} />}
            {tab === 'charts' && (
                <div className="glass-card p-5 !transform-none">
                    <CandleChart symbol={symbol} />
                </div>
            )}
            {tab === 'technicals' && <TechnicalsTab symbol={symbol} />}
            {tab === 'forecast' && <QuantForecastPanel symbol={symbol} />}
            {tab === 'news' && <NewsTab symbol={symbol} />}
        </div>
    );
}
