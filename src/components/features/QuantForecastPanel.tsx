import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    ComposedChart, Line, Area, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import {
    Cpu, Gauge, Percent, Sigma, TrendingUp, TrendingDown, MoveRight,
    PlusCircle, MinusCircle, CircleDot,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { ForecastV2Result } from '../../lib/types';
import { cn } from '../../lib/utils';
import { InfoTip } from '../ui/InfoTip';
import { InvestorPanel } from './InvestorPanel';

const TEAL = 'hsl(178, 100%, 45%)';

function StatCard({ icon: Icon, label, value, sub, tone, term }: {
    icon: any; label: string; value: string; sub?: string;
    tone?: 'up' | 'down' | 'neutral'; term?: string;
}) {
    return (
        <div className="glass-card p-5">
            <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wider">
                <Icon size={14} className="text-[var(--teal)]" /> {label}
                {term && <InfoTip term={term} />}
            </div>
            <p className={cn('text-2xl font-bold mt-2 tabular-nums',
                tone === 'up' ? 'text-emerald-400' : tone === 'down' ? 'text-rose-400' : 'text-white')}>
                {value}
            </p>
            {sub && <p className="text-[11px] text-gray-500 mt-1">{sub}</p>}
        </div>
    );
}

function FactorBar({ label, value, term }: { label: string; value: number | null | undefined; term?: string }) {
    return (
        <div>
            <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">{label}{term && <InfoTip term={term} />}</span>
                <span className="font-bold text-gray-200">{value != null ? value.toFixed(0) : '—'}</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                    className="h-full rounded-full bg-gradient-to-r from-[var(--teal-dim)] to-[var(--teal)]"
                    style={{ width: `${value ?? 0}%` }}
                />
            </div>
        </div>
    );
}

function ConeChart({ result }: { result: ForecastV2Result }) {
    const data = useMemo(() => {
        const hist = result.history.dates.map((d, i) => ({
            date: d, price: result.history.prices[i],
        }));
        const lastHist = hist[hist.length - 1];
        const fc = result.forecast.dates.map((d, i) => ({
            date: d,
            p50: result.forecast.p50[i],
            outer: [result.forecast.p5[i], result.forecast.p95[i]] as [number, number],
            inner: [result.forecast.p25[i], result.forecast.p75[i]] as [number, number],
        }));
        const bridge = {
            date: lastHist.date, p50: lastHist.price,
            outer: [lastHist.price, lastHist.price] as [number, number],
            inner: [lastHist.price, lastHist.price] as [number, number],
        };
        return [...hist, bridge, ...fc];
    }, [result]);

    return (
        <ResponsiveContainer width="100%" height={420}>
            <ComposedChart data={data} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                    dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }}
                    tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    minTickGap={60}
                />
                <YAxis
                    domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 11 }}
                    tickLine={false} axisLine={false} width={70}
                    tickFormatter={(v: number) => `₹${v.toLocaleString('en-IN')}`}
                />
                <Tooltip
                    contentStyle={{
                        background: 'rgba(10, 14, 23, 0.95)', border: '1px solid rgba(0,245,212,0.2)',
                        borderRadius: 12, fontSize: 12,
                    }}
                    labelStyle={{ color: '#94a3b8' }}
                    formatter={(value: any, name: any) => {
                        if (Array.isArray(value)) {
                            const label = name === 'outer' ? '90% range' : '50% range';
                            return [`₹${value[0].toLocaleString('en-IN')} – ₹${value[1].toLocaleString('en-IN')}`, label];
                        }
                        const label = name === 'price' ? 'Historical' : 'Median forecast';
                        return [`₹${Number(value).toLocaleString('en-IN')}`, label];
                    }}
                />
                <Area dataKey="outer" stroke="none" fill={TEAL} fillOpacity={0.08} connectNulls={false} />
                <Area dataKey="inner" stroke="none" fill={TEAL} fillOpacity={0.15} connectNulls={false} />
                <Line dataKey="price" stroke="#e2e8f0" strokeWidth={2} dot={false} connectNulls={false} />
                <Line dataKey="p50" stroke={TEAL} strokeWidth={2.5} strokeDasharray="6 3" dot={false} connectNulls={false} />
                <ReferenceLine
                    x={result.as_of} stroke="rgba(255,255,255,0.25)" strokeDasharray="4 4"
                    label={{ value: 'today', fill: '#64748b', fontSize: 11, position: 'insideTopRight' }}
                />
            </ComposedChart>
        </ResponsiveContainer>
    );
}

function ComputingState() {
    return (
        <div className="glass-card p-12 flex flex-col items-center gap-4 text-center">
            <Cpu size={36} className="text-[var(--teal)] animate-pulse" />
            <div>
                <p className="font-semibold text-white">Running the quant engine…</p>
                <p className="text-sm text-gray-400 mt-1 max-w-md">
                    Fitting GARCH(1,1) volatility, extracting the Prophet trend, reading news sentiment
                    and simulating 1,000 Student-t price paths. Usually 5–15 seconds.
                </p>
            </div>
            <div className="w-64 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full w-1/3 rounded-full bg-[var(--teal)] animate-[shimmer_1.2s_ease-in-out_infinite]" />
            </div>
            <style>{`@keyframes shimmer { 0% { margin-left: -35%; } 100% { margin-left: 100%; } }`}</style>
        </div>
    );
}

const HORIZONS = [30, 60, 90, 180] as const;

function VerdictCard({ result }: { result: import('../../lib/types').ForecastV2Result }) {
    const v = result.verdict;
    if (!v) return null;
    const dir = v.direction;
    const DirIcon = dir === 'growth' ? TrendingUp : dir === 'fall' ? TrendingDown : MoveRight;
    const dirColor = dir === 'growth' ? 'text-emerald-400' : dir === 'fall' ? 'text-rose-400' : 'text-gray-300';
    const dirBg = dir === 'growth' ? 'border-emerald-400/25 bg-emerald-400/[0.06]'
        : dir === 'fall' ? 'border-rose-400/25 bg-rose-400/[0.06]' : 'border-white/10 bg-white/[0.03]';
    return (
        <div className={cn('glass-card !transform-none p-6 border', dirBg)}>
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
                {/* 1 & 2: direction + magnitude */}
                <div className="space-y-3">
                    <p className="text-[11px] uppercase tracking-wider text-gray-500">Model verdict — {v.horizon_days} days</p>
                    <div className={cn('flex items-center gap-3', dirColor)}>
                        <DirIcon size={34} strokeWidth={2.5} />
                        <span className="text-3xl font-bold capitalize">{dir}</span>
                    </div>
                    <p className="text-sm text-gray-300">
                        <span className="font-bold text-white">{(v.prob_up * 100).toFixed(0)}%</span> of simulations end higher ·
                        <span className={cn('font-bold', v.expected_move_pct >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                            {' '}{v.expected_move_pct >= 0 ? '+' : ''}{v.expected_move_pct}%
                        </span> median move
                    </p>
                    <p className="text-[12px] text-gray-400">
                        Likely range (50% of outcomes): <span className="font-semibold text-gray-200">
                            {v.likely_range_pct.low}% … {v.likely_range_pct.high >= 0 ? '+' : ''}{v.likely_range_pct.high}%
                        </span>
                    </p>
                    <span className={cn('inline-block text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider',
                        v.confidence === 'high' ? 'text-emerald-300 border-emerald-400/30'
                            : v.confidence === 'moderate' ? 'text-amber-300 border-amber-300/30'
                                : 'text-gray-400 border-white/15')}>
                        {v.confidence} conviction
                    </span>
                </div>
                {/* 3: drivers */}
                <div>
                    <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-3">What's driving this</p>
                    <ul className="space-y-2">
                        {v.drivers.map((d, i) => (
                            <li key={i} className="flex items-start gap-2.5 text-[13px]">
                                {d.impact === 'positive'
                                    ? <PlusCircle size={15} className="text-emerald-400 mt-0.5 shrink-0" />
                                    : d.impact === 'negative'
                                        ? <MinusCircle size={15} className="text-rose-400 mt-0.5 shrink-0" />
                                        : <CircleDot size={15} className="text-gray-500 mt-0.5 shrink-0" />}
                                <span>
                                    <span className="font-semibold text-gray-200">{d.name}:</span>{' '}
                                    <span className="text-gray-400">{d.detail}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}

/** Embeddable forecast panel with Trader/Investor mode toggle. */
export function QuantForecastPanel({ symbol }: { symbol: string }) {
    const [mode, setMode] = useState<'trader' | 'investor'>('trader');
    return (
        <div className="space-y-6">
            {/* Mode toggle */}
            <div className="flex items-center justify-center">
                <div className="inline-flex rounded-2xl border border-white/10 bg-white/[0.04] p-1 backdrop-blur-xl">
                    {([
                        ['trader', '⚡ Trader', '30–180 days · momentum, volatility & news'],
                        ['investor', '🌱 Investor', '1–5 years · fundamentals & valuation'],
                    ] as const).map(([id, label, hint]) => (
                        <button key={id} onClick={() => setMode(id)}
                            title={hint}
                            className={cn('px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300',
                                mode === id
                                    ? 'bg-[var(--teal)]/15 text-[var(--teal)] shadow-[0_0_20px_rgba(0,245,212,0.15)] border border-[var(--teal)]/30'
                                    : 'text-gray-400 hover:text-white border border-transparent')}>
                            {label}
                            <span className="block text-[9px] font-normal text-gray-500 mt-0.5">{hint}</span>
                        </button>
                    ))}
                </div>
            </div>
            {mode === 'trader' ? <TraderPanel symbol={symbol} /> : <InvestorPanel symbol={symbol} />}
        </div>
    );
}

/** Short-term view: GARCH + Prophet Monte Carlo with layered news sentiment. */
function TraderPanel({ symbol }: { symbol: string }) {
    const [horizon, setHorizon] = useState<number>(90);
    const { data, error } = useQuery({
        queryKey: ['forecast-v2', symbol, horizon],
        queryFn: () => api.getForecastV2(symbol, horizon),
        refetchInterval: (q) => (q.state.data?.status === 'computing' ? 2500 : false),
        staleTime: 5 * 60_000,
    });

    const result = data?.status === 'ready' ? data.result : undefined;
    const probs = result?.probabilities;
    const model = result?.model;

    return (
        <div className="space-y-6">
            {/* Horizon selector */}
            <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 mr-1">Forecast period:</span>
                {HORIZONS.map(h => (
                    <button
                        key={h}
                        onClick={() => setHorizon(h)}
                        className={cn('px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all',
                            horizon === h
                                ? 'bg-[var(--teal)]/15 border-[var(--teal)]/40 text-[var(--teal)]'
                                : 'border-white/10 text-gray-400 hover:text-white hover:border-white/25')}
                    >
                        {h}D
                    </button>
                ))}
            </div>

            {result && <VerdictCard result={result} />}
            {data?.status === 'error' && (
                <div className="glass-card p-6 border-rose-400/30 text-rose-300 text-sm">
                    Forecast failed: {data.error}. Check the symbol and try again shortly.
                </div>
            )}
            {!!error && (
                <div className="glass-card p-6 border-rose-400/30 text-rose-300 text-sm">
                    Could not reach the API — is the backend running on port 8200?
                </div>
            )}

            {!result && data?.status !== 'error' && !error && <ComputingState />}

            {result && probs && model && (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard
                            icon={Percent} label={`P(up in ${result.horizon_days}d)`} term="p_up"
                            value={`${(probs.up * 100).toFixed(0)}%`}
                            tone={probs.up >= 0.5 ? 'up' : 'down'}
                            sub={`${result.n_simulations} simulated paths`}
                        />
                        <StatCard
                            icon={Gauge} label="Expected move (median)" term="expected_move"
                            value={`${probs.expected_return_pct >= 0 ? '+' : ''}${probs.expected_return_pct.toFixed(1)}%`}
                            tone={probs.expected_return_pct >= 0 ? 'up' : 'down'}
                            sub={`from ₹${result.last_price.toLocaleString('en-IN')}`}
                        />
                        <StatCard
                            icon={Percent} label="P(gain > 5%)" term="monte_carlo"
                            value={`${(probs.up_5pct * 100).toFixed(0)}%`}
                            sub={`P(loss > 5%): ${(probs.down_5pct * 100).toFixed(0)}%`}
                        />
                        <StatCard
                            icon={Sigma} label="Conviction score" term="conviction"
                            value={model.conviction_score != null ? model.conviction_score.toFixed(0) : '—'}
                            tone={model.conviction_score != null ? (model.conviction_score >= 55 ? 'up' : model.conviction_score < 45 ? 'down' : 'neutral') : 'neutral'}
                            sub={model.sentiment_score != null
                                ? `incl. news sentiment ${model.sentiment_score >= 0 ? '+' : ''}${model.sentiment_score.toFixed(2)}`
                                : 'sentiment unavailable'}
                        />
                    </div>

                    <div className="glass-card p-6 !transform-none">
                        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                            <h2 className="font-bold text-lg">
                                Probability Cone — {result.horizon_days} days
                                <InfoTip term="prob_cone" size={14} />
                            </h2>
                            <div className="flex gap-4 text-[11px] text-gray-400">
                                <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm inline-block" style={{ background: 'rgba(0,245,212,0.15)' }} /> 50% range</span>
                                <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm inline-block" style={{ background: 'rgba(0,245,212,0.08)' }} /> 90% range</span>
                                <span className="flex items-center gap-1.5"><i className="w-4 h-0.5 inline-block" style={{ background: TEAL }} /> median</span>
                            </div>
                        </div>
                        <ConeChart result={result} />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <div className="glass-card p-6">
                            <h3 className="font-bold mb-4">Why this conviction score</h3>
                            <div className="space-y-4">
                                <FactorBar label="CAPM Alpha (percentile)" term="alpha" value={result.factors.rank_alpha as number} />
                                <FactorBar label="Treynor Ratio (percentile)" term="treynor" value={result.factors.rank_treynor as number} />
                                <FactorBar label="12-1 Momentum (percentile)" term="momentum" value={result.factors.rank_momentum as number} />
                                <FactorBar label="Low Volatility (percentile)" term="low_vol" value={result.factors.rank_low_vol as number} />
                            </div>
                            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                                {([
                                    ['β', 'beta', result.factors.beta != null ? Number(result.factors.beta).toFixed(2) : '—'],
                                    ['α (1Y)', 'alpha', result.factors.alpha != null ? `${(Number(result.factors.alpha) * 100).toFixed(1)}%` : '—'],
                                    ['RSI', 'rsi', result.factors.rsi != null ? Number(result.factors.rsi).toFixed(0) : '—'],
                                ] as const).map(([k, term, v]) => (
                                    <div key={k} className="rounded-xl bg-white/5 py-3">
                                        <p className="text-[11px] text-gray-500">{k}<InfoTip term={term} /></p>
                                        <p className="font-bold text-white mt-0.5">{v}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="glass-card p-6">
                            <h3 className="font-bold mb-4">Model internals</h3>
                            <ul className="text-sm text-gray-300 space-y-2.5">
                                <li className="flex justify-between border-b border-white/5 pb-2">
                                    <span className="text-gray-500">Volatility model<InfoTip term="garch" /></span>
                                    <span className="font-semibold">{String(model.garch.method ?? '—')}</span>
                                </li>
                                {'persistence' in model.garch && (
                                    <li className="flex justify-between border-b border-white/5 pb-2">
                                        <span className="text-gray-500">GARCH persistence (α+β)</span>
                                        <span className="font-semibold tabular-nums">{Number(model.garch.persistence).toFixed(3)}</span>
                                    </li>
                                )}
                                <li className="flex justify-between border-b border-white/5 pb-2">
                                    <span className="text-gray-500">Fat-tail dof (Student-t ν)<InfoTip term="student_t" /></span>
                                    <span className="font-semibold tabular-nums">{model.tail_dof.toFixed(1)}</span>
                                </li>
                                <li className="flex justify-between border-b border-white/5 pb-2">
                                    <span className="text-gray-500">Conviction tilt λ</span>
                                    <span className="font-semibold tabular-nums">{model.tilt_lambda}</span>
                                </li>
                                <li className="flex justify-between">
                                    <span className="text-gray-500">Data as of</span>
                                    <span className="font-semibold">{result.as_of}</span>
                                </li>
                            </ul>
                            <p className="text-[11px] text-gray-600 mt-5 leading-relaxed">
                                P<sub>t+1</sub> = P<sub>t</sub> · exp(μ̃<sub>t</sub> − σ²<sub>t</sub>/2 + σ<sub>t</sub>ε<sub>t</sub>),
                                ε<sub>t</sub> ~ standardized Student-t. Drift μ̃ = Prophet trend + λ·((C−50)/50)·σ.
                                Probabilistic ranges, not price targets. Educational — not investment advice.
                            </p>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
