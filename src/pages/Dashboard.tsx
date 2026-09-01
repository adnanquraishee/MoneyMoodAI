import { useMemo } from 'react';
import { Link, Link as RLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
    TrendingUp, TrendingDown, ArrowRight, BrainCircuit, Radar, Smile,
    Globe2, Zap, Activity,
} from 'lucide-react';
import { api } from '../lib/api';
import type { IndexCard, MarketPulse, TickerItem } from '../lib/types';
import { cn } from '../lib/utils';
import { HoloGlobe } from '../components/3d/HoloGlobe';
import { MoodOrb } from '../components/3d/MoodOrb';
import { CinematicScape } from '../components/effects/CinematicScape';
import { TiltCard, useCountUp } from '../components/ui/TiltCard';

// ---------- tiny pieces ----------
function Spark({ data, up }: { data: number[]; up: boolean }) {
    if (!data || data.length < 2) return <div className="h-9" />;
    const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
    const w = 130, h = 36;
    const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 5) - 2}`).join(' ');
    const color = up ? '#00FF9D' : '#FF4D6D';
    const id = useMemo(() => `sg${Math.random().toString(36).slice(2, 8)}`, []);
    return (
        <svg width={w} height={h} className="overflow-visible">
            <defs>
                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.35" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${id})`} />
            <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6"
                strokeLinejoin="round" strokeLinecap="round"
                style={{ strokeDasharray: 300, strokeDashoffset: 300, animation: 'sparkDraw 1.2s ease forwards' }} />
        </svg>
    );
}

function IndexCardView({ card, i }: { card: IndexCard; i: number }) {
    const up = (card.change ?? 0) >= 0;
    const animated = useCountUp(card.price);
    return (
        <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * i, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
            <TiltCard className="p-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">{card.name}</p>
                <p className="text-2xl font-bold tabular-nums mt-1.5 text-white">
                    {card.price == null ? <span className="text-gray-600">N/A</span>
                        : animated != null ? animated.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : ''}
                </p>
                <div className="flex items-end justify-between mt-1">
                    <span className={cn('flex items-center gap-1 text-sm font-bold',
                        card.change == null ? 'text-gray-600' : up ? 'text-[#00FF9D]' : 'text-[#FF4D6D]')}>
                        {card.change == null ? '—' : <>{up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                            {up ? '+' : ''}{card.change.toFixed(2)}%</>}
                    </span>
                    <Spark data={card.spark} up={up} />
                </div>
            </TiltCard>
        </motion.div>
    );
}

function MoodGauge({ pulse }: { pulse: MarketPulse }) {
    const { score, label, advancers, decliners, avg_change_pct, vix, vix_change } = pulse.mood;
    const R = 56, C = 2 * Math.PI * R;
    const color = label === 'bullish' ? '#00FF9D' : label === 'bearish' ? '#FF4D6D' : '#29B6FF';
    const fear = vix == null ? null : vix < 13 ? 'calm' : vix < 17 ? 'normal' : vix < 22 ? 'nervous' : 'fearful';
    const fearColor = vix == null ? '#8ea6c9' : vix < 13 ? '#00FF9D' : vix < 17 ? '#29B6FF' : vix < 22 ? '#FFC24D' : '#FF4D6D';
    return (
        <TiltCard className="p-6 h-full relative overflow-hidden">
            <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500">Market Sentiment</p>
            <div className="flex items-center gap-6 mt-3">
                <div className="relative w-36 h-36 shrink-0">
                    <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
                        <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="9" />
                        <circle cx="70" cy="70" r={R} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
                            strokeDasharray={C} strokeDashoffset={C * (1 - score / 100)}
                            style={{ filter: `drop-shadow(0 0 8px ${color})`, transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1)' }} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold tabular-nums">{score}</span>
                        <span className="text-[10px] text-gray-500 uppercase tracking-widest">/100</span>
                    </div>
                </div>
                <div className="space-y-2 min-w-0">
                    <p className="text-2xl font-bold capitalize" style={{ color }}>{label}</p>
                    <p className="text-xs text-gray-400">{advancers} advancing · {decliners} declining</p>
                    <p className="text-xs text-gray-500">avg move {avg_change_pct >= 0 ? '+' : ''}{avg_change_pct}%</p>
                    {vix != null && (
                        <div className="flex items-center gap-2 pt-1">
                            <span className="text-[10px] font-bold px-2 py-1 rounded-lg border tabular-nums"
                                style={{ color: fearColor, borderColor: `${fearColor}40`, background: `${fearColor}14` }}>
                                VIX {vix.toFixed(1)}{vix_change != null ? ` (${vix_change >= 0 ? '+' : ''}${vix_change.toFixed(1)}%)` : ''}
                            </span>
                            <span className="text-[10px] uppercase tracking-widest" style={{ color: fearColor }}>{fear}</span>
                        </div>
                    )}
                </div>
                {/* living 3D mood organism — churns harder as India VIX rises */}
                <div className="hidden md:block flex-1 h-40 -my-4">
                    <MoodOrb score={score} vix={vix} avgChange={avg_change_pct} />
                </div>
            </div>
        </TiltCard>
    );
}

function EventsCard() {
    const { data } = useQuery({
        queryKey: ['calendar'],
        queryFn: api.getCalendar,
        staleTime: 30 * 60_000,
    });
    const TYPE_META: Record<string, { label: string; color: string }> = {
        earnings: { label: 'Results', color: 'text-[var(--teal)] border-[var(--teal)]/30 bg-[var(--teal)]/10' },
        ex_dividend: { label: 'Ex-Div', color: 'text-amber-300 border-amber-300/30 bg-amber-300/10' },
        dividend: { label: 'Payout', color: 'text-emerald-300 border-emerald-300/30 bg-emerald-300/10' },
    };
    return (
        <TiltCard className="p-6 h-full">
            <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500 mb-4">
                Upcoming Events · Watchlist
            </p>
            {!data ? (
                <div className="space-y-3">
                    {[0, 1, 2].map(i => <div key={i} className="h-9 rounded-xl bg-white/5 animate-pulse" />)}
                </div>
            ) : data.events.length === 0 ? (
                <p className="text-xs text-gray-500">No corporate events on the horizon for your watchlist stocks.</p>
            ) : (
                <ul className="space-y-3">
                    {data.events.slice(0, 5).map((e, i) => {
                        const meta = TYPE_META[e.type] ?? TYPE_META.earnings;
                        return (
                            <li key={i}>
                                <RLink to={`/app/stock?symbol=${encodeURIComponent(e.symbol)}`}
                                    className="flex items-center gap-3 group">
                                    <span className="text-[10px] font-bold text-gray-400 tabular-nums w-14 shrink-0">
                                        {new Date(e.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                    </span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${meta.color}`}>
                                        {meta.label}
                                    </span>
                                    <span className="text-xs text-gray-300 group-hover:text-white truncate transition-colors">
                                        {e.symbol.replace('.NS', '')}
                                    </span>
                                </RLink>
                            </li>
                        );
                    })}
                </ul>
            )}
        </TiltCard>
    );
}


function StatsCard({ pulse }: { pulse: MarketPulse }) {
    const rows = [
        { icon: Globe2, label: 'Assets tracked', value: pulse.mood.universe.toLocaleString() },
        { icon: Zap, label: 'Market movers', value: String(pulse.mood.advancers + pulse.mood.decliners) },
        { icon: Activity, label: 'Top gainer', value: pulse.gainers[0] ? `${pulse.gainers[0].symbol.replace('.NS', '')} +${pulse.gainers[0].change_pct.toFixed(1)}%` : '—' },
    ];
    return (
        <TiltCard className="p-6 h-full">
            <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500 mb-4">Global Pulse</p>
            <ul className="space-y-4">
                {rows.map(r => (
                    <li key={r.label} className="flex items-center gap-3">
                        <span className="p-2 rounded-xl bg-[var(--teal)]/10 border border-[var(--teal)]/20">
                            <r.icon size={15} className="text-[var(--teal)]" />
                        </span>
                        <div>
                            <p className="text-sm font-bold text-white">{r.value}</p>
                            <p className="text-[11px] text-gray-500">{r.label}</p>
                        </div>
                    </li>
                ))}
            </ul>
        </TiltCard>
    );
}

const FEATURES = [
    {
        icon: BrainCircuit, title: 'AI Forecasting', to: '/app/stock?tab=forecast',
        desc: 'GARCH + Prophet Monte Carlo simulations with direction, magnitude and drivers.',
        cta: 'Explore Forecasts', accent: '#00F5FF',
        art: (
            <svg className="absolute inset-x-0 bottom-0 h-24 w-full opacity-60" viewBox="0 0 400 100" preserveAspectRatio="none">
                {[0, 1, 2].map(k => (
                    <path key={k} fill="none" stroke="#00F5FF" strokeWidth="1.2" opacity={0.5 - k * 0.14}
                        d={`M0,${62 + k * 10} C60,${20 + k * 12} 120,${86 - k * 8} 200,${48 + k * 8} S340,${18 + k * 14} 400,${56 + k * 6}`}>
                        <animate attributeName="d" dur={`${6 + k * 2}s`} repeatCount="indefinite"
                            values={`M0,${62 + k * 10} C60,${20 + k * 12} 120,${86 - k * 8} 200,${48 + k * 8} S340,${18 + k * 14} 400,${56 + k * 6};
                                     M0,${52 + k * 10} C60,${40 + k * 10} 120,${60 - k * 6} 200,${68 + k * 4} S340,${38 + k * 10} 400,${46 + k * 8};
                                     M0,${62 + k * 10} C60,${20 + k * 12} 120,${86 - k * 8} 200,${48 + k * 8} S340,${18 + k * 14} 400,${56 + k * 6}`} />
                    </path>
                ))}
            </svg>
        ),
    },
    {
        icon: Radar, title: 'Technical Analysis', to: '/app/stock?tab=technicals',
        desc: 'RSI, MACD, Bollinger Bands and trend structure read for you in plain English.',
        cta: 'View Analysis', accent: '#29B6FF',
        art: (
            <div className="absolute right-6 bottom-4 w-24 h-24 opacity-70">
                {[0, 1, 2].map(k => (
                    <div key={k} className="absolute inset-0 rounded-full border border-[#29B6FF]"
                        style={{ opacity: 0.5 - k * 0.15, transform: `scale(${1 - k * 0.28})` }} />
                ))}
                <div className="absolute inset-0 rounded-full animate-[radarSweep_3.2s_linear_infinite]"
                    style={{ background: 'conic-gradient(from 0deg, rgba(41,182,255,0.5), transparent 70deg)' }} />
            </div>
        ),
    },
    {
        icon: Smile, title: 'Sentiment Analysis', to: '/app/stock?tab=news',
        desc: 'FinBERT reads every headline — positive, neutral, negative — before you do.',
        cta: 'Analyze Sentiment', accent: '#00FF9D',
        art: (
            <svg className="absolute inset-x-0 bottom-0 h-20 w-full opacity-60" viewBox="0 0 400 80" preserveAspectRatio="none">
                <path fill="url(#sentg)" d="M0,80 C60,30 120,64 180,36 S300,60 400,24 V80 Z">
                    <animate attributeName="d" dur="7s" repeatCount="indefinite"
                        values="M0,80 C60,30 120,64 180,36 S300,60 400,24 V80 Z;
                                M0,80 C60,50 120,28 180,52 S300,20 400,44 V80 Z;
                                M0,80 C60,30 120,64 180,36 S300,60 400,24 V80 Z" />
                </path>
                <defs>
                    <linearGradient id="sentg" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#00FF9D" stopOpacity="0.5" />
                        <stop offset="60%" stopColor="#29B6FF" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#c084fc" stopOpacity="0.4" />
                    </linearGradient>
                </defs>
            </svg>
        ),
    },
];

function TickerBar({ items }: { items: TickerItem[] }) {
    if (!items.length) return null;
    const strip = [...items, ...items];   // seamless loop
    return (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10
                        bg-[#070b16]/85 backdrop-blur-xl overflow-hidden group">
            <div className="flex items-center">
                <span className="flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-amber-300 shrink-0 border-r border-white/10">
                    <Zap size={12} /> Live Movers
                </span>
                <div className="flex-1 overflow-hidden">
                    <div className="flex gap-8 whitespace-nowrap py-2.5 animate-[tickerScroll_45s_linear_infinite] group-hover:[animation-play-state:paused] w-max">
                        {strip.map((t, i) => (
                            <Link key={i} to={`/app/stock?symbol=${encodeURIComponent(t.symbol)}`}
                                className="flex items-center gap-2 text-sm hover:drop-shadow-[0_0_8px_rgba(0,245,255,0.6)] transition-all">
                                <span className="font-bold text-gray-200">{t.symbol.replace('.NS', '')}</span>
                                <span className="tabular-nums text-gray-400">₹{t.price.toLocaleString('en-IN')}</span>
                                <span className={cn('font-bold tabular-nums', t.change_pct >= 0 ? 'text-[#00FF9D]' : 'text-[#FF4D6D]')}>
                                    {t.change_pct >= 0 ? '▲' : '▼'} {Math.abs(t.change_pct).toFixed(2)}%
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ---------- page ----------
export function Dashboard() {
    const { data: pulse } = useQuery({
        queryKey: ['pulse'],
        queryFn: api.getPulse,
        refetchInterval: 60_000,
    });

    return (
        <div className="relative pb-16">
            {/* HERO */}
            <section className="relative h-[520px] overflow-hidden">
                <div className="absolute inset-0 grid grid-cols-1 lg:grid-cols-[42%_58%]">
                    <div className="relative hidden lg:block">
                        <HoloGlobe />
                    </div>
                    <div className="relative">
                        <CinematicScape />
                        {/* blend into the globe side */}
                        <div className="absolute inset-y-0 left-0 w-48"
                            style={{ background: 'linear-gradient(90deg, #060a14 0%, transparent 100%)' }} />
                    </div>
                </div>
                {/* bottom fade into content */}
                <div className="absolute inset-x-0 bottom-0 h-40"
                    style={{ background: 'linear-gradient(180deg, transparent, var(--obsidian))' }} />

                {/* hero copy */}
                <div className="absolute inset-0 flex items-center pointer-events-none">
                    <motion.div
                        initial={{ opacity: 0, y: 26, filter: 'blur(8px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                        className="px-10 lg:px-0 lg:ml-[38%] max-w-xl pointer-events-auto"
                    >
                        <h1 className="text-5xl font-bold tracking-tight drop-shadow-[0_2px_20px_rgba(0,0,0,0.8)]">
                            Market Overview
                        </h1>
                        <p className="text-gray-300 mt-3 text-lg drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
                            Real-time AI-powered market intelligence across the entire NSE.
                        </p>
                        <div className="flex items-center gap-3 mt-5">
                            <span className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00FF9D]/30 bg-[#00FF9D]/10 text-[#00FF9D] text-xs font-bold">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00FF9D] opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00FF9D]" />
                                </span>
                                LIVE
                            </span>
                            <span className="text-xs text-gray-400">
                                {pulse?.status === 'warming'
                                    ? `Scanning universe… ${Math.round((pulse.progress ?? 0) * 100)}%`
                                    : 'Market intelligence updating in real time'}
                            </span>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* MARKET CARDS */}
            <section className="px-8 lg:px-12 -mt-10 relative z-10">
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                    {(pulse?.indices ?? Array.from({ length: 8 }).map(() => null as any)).map((card: IndexCard | null, i: number) =>
                        card ? <IndexCardView key={card.symbol} card={card} i={i} />
                            : <div key={i} className="h-32 rounded-2xl bg-white/[0.04] border border-white/5 animate-pulse" />
                    )}
                </div>
            </section>

            {/* MOOD + STATS + EVENTS */}
            {pulse && (
                <section className="px-8 lg:px-12 mt-6 grid grid-cols-1 lg:grid-cols-[1fr_300px_300px] gap-4">
                    <MoodGauge pulse={pulse} />
                    <StatsCard pulse={pulse} />
                    <EventsCard />
                </section>
            )}

            {/* FEATURE CARDS */}
            <section className="px-8 lg:px-12 mt-10">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {FEATURES.map((f, i) => (
                        <motion.div key={f.title}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-60px' }}
                            transition={{ delay: 0.1 * i, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        >
                            <TiltCard className="p-7 h-60 flex flex-col relative">
                                {f.art}
                                <span className="p-2.5 w-fit rounded-xl border" style={{ borderColor: `${f.accent}40`, background: `${f.accent}14` }}>
                                    <f.icon size={19} style={{ color: f.accent }} />
                                </span>
                                <h3 className="text-xl font-bold mt-4">{f.title}</h3>
                                <p className="text-sm text-gray-400 mt-1.5 max-w-[85%]">{f.desc}</p>
                                <Link to={f.to}
                                    className="mt-auto flex items-center gap-2 text-sm font-bold w-fit group/cta relative z-10"
                                    style={{ color: f.accent }}>
                                    {f.cta}
                                    <ArrowRight size={15} className="transition-transform group-hover/cta:translate-x-1.5" />
                                </Link>
                            </TiltCard>
                        </motion.div>
                    ))}
                </div>
            </section>

            {pulse && <TickerBar items={pulse.ticker} />}

            <style>{`
                @keyframes sparkDraw { to { stroke-dashoffset: 0; } }
                @keyframes tickerScroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
                @keyframes radarSweep { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
