import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    ComposedChart, Line, Area, Bar, BarChart, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid, Cell, LabelList,
} from 'recharts';
import {
    Sprout, IndianRupee, Trophy, Gem, CheckCircle2, XCircle, AlertTriangle,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { LongTermResult } from '../../lib/types';
import { cn } from '../../lib/utils';
import { InfoTip } from '../ui/InfoTip';

const TEAL = 'hsl(178, 100%, 45%)';

const inr = (v: number) =>
    v >= 10000000 ? `₹${(v / 10000000).toFixed(2)} Cr`
        : v >= 100000 ? `₹${(v / 100000).toFixed(2)} L`
            : `₹${Math.round(v).toLocaleString('en-IN')}`;

function StatCard({ icon: Icon, label, value, sub, tone, term }: {
    icon: any; label: string; value: string; sub?: string;
    tone?: 'up' | 'down' | 'neutral'; term?: string;
}) {
    return (
        <div className="glass-card p-5 !transform-none">
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

/** Waterfall: yield + growth + rerating = expected CAGR (floating bars). */
function Waterfall({ w }: { w: LongTermResult['waterfall'] }) {
    const data = useMemo(() => {
        const steps = [
            { name: 'Dividend Yield', value: w.dividend_yield },
            { name: 'Earnings Growth', value: w.growth },
            { name: 'Re-rating', value: w.rerating },
        ];
        let running = 0;
        const rows = steps.map(s => {
            const lo = s.value >= 0 ? running : running + s.value;
            running += s.value;
            return {
                name: s.name, value: s.value,
                range: [lo, lo + Math.abs(s.value)] as [number, number],
                fill: s.value >= 0 ? '#34d399' : '#fb7185',
            };
        });
        rows.push({
            name: 'Expected CAGR', value: w.expected_cagr,
            range: [Math.min(0, w.expected_cagr), Math.max(0, w.expected_cagr)],
            fill: TEAL,
        });
        return rows;
    }, [w]);

    return (
        <ResponsiveContainer width="100%" height={230}>
            <BarChart data={data} margin={{ top: 24, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#8ea6c9', fontSize: 11 }} tickLine={false}
                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
                    tickFormatter={(v: number) => `${v}%`} width={38} />
                {/* floating range bars: dataKey returns [low, high] */}
                <Bar dataKey="range" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                    {data.map((d, i) => <Cell key={i} fill={d.fill} fillOpacity={0.85} />)}
                    <LabelList dataKey="value" position="top"
                        formatter={(v: any) => `${Number(v) >= 0 ? '+' : ''}${v}%`}
                        style={{ fill: '#e2e8f0', fontSize: 12, fontWeight: 700 }} />
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}

export function InvestorPanel({ symbol }: { symbol: string }) {
    const [horizonKey, setHorizonKey] = useState<'1' | '3' | '5'>('5');
    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['longterm', symbol],
        queryFn: () => api.getLongTerm(symbol),
        staleTime: 6 * 3600_000,
        retry: 1,
    });

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[0, 1, 2, 3].map(i => <div key={i} className="h-28 rounded-2xl bg-white/5 animate-pulse" />)}
                </div>
                <div className="h-72 rounded-2xl bg-white/5 animate-pulse" />
            </div>
        );
    }
    if (isError || !data) {
        return (
            <div className="glass-card p-8 text-center text-sm text-rose-300 !transform-none">
                Long-term view unavailable: {(error as any)?.response?.data?.detail ?? 'not enough data for this stock yet.'}
            </div>
        );
    }

    const h = data.horizons[horizonKey];
    const w = data.waterfall;
    const q = data.quality;
    const coneData = data.cone.years.map((y, i) => ({
        year: y === 0 ? 'Now' : `Yr ${y}`,
        band: [data.cone.p10[i], data.cone.p90[i]] as [number, number],
        p50: data.cone.p50[i],
    }));

    const CHECK_LABELS: Record<string, string> = {
        high_roe: 'ROE ≥ 15%', low_debt: 'Debt/Equity < 1', healthy_margin: 'Net margin ≥ 8%',
        positive_growth: 'Growth engine > 6%', reasonable_valuation: 'Valuation not stretched',
    };

    return (
        <div className="space-y-6">
            {/* Horizon selector */}
            <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 mr-1">Holding period:</span>
                {(['1', '3', '5'] as const).map(k => (
                    <button key={k} onClick={() => setHorizonKey(k)}
                        className={cn('px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all',
                            horizonKey === k
                                ? 'bg-[var(--teal)]/15 border-[var(--teal)]/40 text-[var(--teal)]'
                                : 'border-white/10 text-gray-400 hover:text-white hover:border-white/25')}>
                        {k} Year{k !== '1' ? 's' : ''}
                    </button>
                ))}
                {q.cyclical_warning && (
                    <span className="ml-auto flex items-center gap-1.5 text-[11px] text-amber-300">
                        <AlertTriangle size={13} />
                        Cyclical sector — trailing growth can mislead at cycle turns
                    </span>
                )}
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Sprout} label={`Median CAGR · ${h.years}y`} term="cagr"
                    value={`${h.cagr.p50 >= 0 ? '+' : ''}${h.cagr.p50}%/yr`}
                    tone={h.cagr.p50 >= 8 ? 'up' : h.cagr.p50 < 0 ? 'down' : 'neutral'}
                    sub={`middle half: ${h.cagr.p25}% … ${h.cagr.p75}%/yr`} />
                <StatCard icon={IndianRupee} label={`₹1 Lakh becomes`} term="wealth_projection"
                    value={inr(h.wealth_1l.p50)}
                    sub={`range ${inr(h.wealth_1l.p10)} – ${inr(h.wealth_1l.p90)}`} />
                <StatCard icon={Trophy} label="P(beats NIFTY)" term="p_beat_nifty"
                    value={`${Math.round(h.p_beat_nifty * 100)}%`}
                    tone={h.p_beat_nifty >= 0.5 ? 'up' : 'down'}
                    sub={`P(positive): ${Math.round(h.p_positive * 100)}% · P(2×): ${Math.round(h.p_double * 100)}%`} />
                <StatCard icon={Gem} label="Quality score" term="quality_gate"
                    value={`${q.score}/100`}
                    tone={q.score >= 70 ? 'up' : q.score < 40 ? 'down' : 'neutral'}
                    sub={`uncertainty ±${q.sigma_annual}%/yr — ${q.score >= 70 ? 'tight band' : 'wide band'}`} />
            </div>

            {/* Waterfall + wealth cone */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="glass-card p-6 !transform-none">
                    <h3 className="font-bold text-sm mb-1">
                        Where the return comes from<InfoTip term="return_waterfall" size={13} />
                    </h3>
                    <p className="text-[11px] text-gray-500 mb-3">
                        {w.growth_basis.join(' · ')}
                        {w.current_pe && w.fair_pe ? ` · P/E ${w.current_pe} vs sector ${w.fair_pe}` : ''}
                    </p>
                    <Waterfall w={w} />
                </div>
                <div className="glass-card p-6 !transform-none">
                    <h3 className="font-bold text-sm mb-3">
                        ₹1 Lakh over 5 years — 80% band<InfoTip term="wealth_projection" size={13} />
                    </h3>
                    <ResponsiveContainer width="100%" height={240}>
                        <ComposedChart data={coneData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                            <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis dataKey="year" tick={{ fill: '#8ea6c9', fontSize: 11 }} tickLine={false}
                                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
                            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
                                tickFormatter={(v: number) => inr(v)} width={70} />
                            <Tooltip
                                contentStyle={{ background: 'rgba(10,14,23,0.95)', border: '1px solid rgba(0,245,212,0.2)', borderRadius: 10, fontSize: 12 }}
                                formatter={(v: any) => Array.isArray(v)
                                    ? [`${inr(v[0])} – ${inr(v[1])}`, '10th–90th pct']
                                    : [inr(Number(v)), 'Median']}
                            />
                            <Area dataKey="band" stroke="none" fill={TEAL} fillOpacity={0.1} />
                            <Line dataKey="p50" stroke={TEAL} strokeWidth={2.5} dot={{ r: 3, fill: TEAL }} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Scenarios + quality checklist */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
                <div className="glass-card p-6 !transform-none">
                    <h3 className="font-bold text-sm mb-4">
                        Scenarios — judge the assumptions, not the number<InfoTip term="scenario_cards" size={13} />
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {data.scenarios.map(s => (
                            <div key={s.name} className={cn('rounded-2xl border p-4',
                                s.tone === 'up' ? 'border-emerald-400/25 bg-emerald-400/[0.05]'
                                    : s.tone === 'down' ? 'border-rose-400/25 bg-rose-400/[0.05]'
                                        : 'border-[var(--teal)]/25 bg-[var(--teal)]/[0.05]')}>
                                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{s.name}</p>
                                <p className={cn('text-2xl font-bold tabular-nums mt-1',
                                    s.tone === 'up' ? 'text-emerald-400' : s.tone === 'down' ? 'text-rose-400' : 'text-[var(--teal)]')}>
                                    {s.cagr >= 0 ? '+' : ''}{s.cagr}%<span className="text-xs text-gray-500">/yr</span>
                                </p>
                                <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">{s.assumptions}</p>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="glass-card p-6 !transform-none">
                    <h3 className="font-bold text-sm mb-4">Quality checklist<InfoTip term="quality_gate" size={13} /></h3>
                    <ul className="space-y-2.5">
                        {Object.entries(q.checks).map(([k, ok]) => (
                            <li key={k} className="flex items-center gap-2.5 text-[13px]">
                                {ok ? <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                                    : <XCircle size={15} className="text-rose-400 shrink-0" />}
                                <span className={ok ? 'text-gray-200' : 'text-gray-400'}>
                                    {CHECK_LABELS[k] ?? k}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <p className="text-[11px] text-gray-600 leading-relaxed">
                Model: dividend yield + earnings growth (faded toward ~10.5% nominal GDP
                <InfoTip term="growth_fade" />) + partial P/E reversion to sector norm
                <InfoTip term="rerating" />, simulated over {data.n_simulations.toLocaleString()} fat-tailed
                annual paths. Based on trailing fundamentals — it cannot foresee turnarounds or disruptions.
                Probabilistic ranges, not promises. Educational — not investment advice.
            </p>
        </div>
    );
}
