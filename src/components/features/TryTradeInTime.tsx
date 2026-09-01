import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, ReferenceDot,
} from 'recharts';
import { Lock, Unlock, Newspaper, Clock, ArrowLeft, CheckCircle2, Sparkles, Shuffle, BarChart3, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import { InfoTip } from '../ui/InfoTip';
import { TimeRevealScene } from '../3d/TimeRevealScene';
import type { TimeTradeCase, TimeTradeCasePreview, TimeTradeReveal } from '../../lib/types';

const inr = (v: number | null | undefined, d = 0) =>
    v == null ? '—' : `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: d })}`;
const signed = (v: number | null | undefined, d = 1) =>
    v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(d)}%`;
const tone = (v: number | null | undefined) =>
    v == null ? 'text-gray-400' : v >= 0 ? 'text-emerald-400' : 'text-rose-400';

const LS_KEY = 'moneymood.timetrade.v1';
type Done = Record<string, { amount: number; pnl_pct: number | null; name: string }>;
const loadDone = (): Done => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; } };
const saveDone = (d: Done) => { try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch { /* ignore */ } };

const AMOUNTS = [10_000, 25_000, 50_000, 100_000];

type Stage = 'pick' | 'dossier' | 'travel' | 'reveal';

/* ------------------------------------------------------------- case picker */

function CasePicker({ cases, done, onPick, onDraw, drawing, drawError }: {
    cases: TimeTradeCasePreview[]; done: Done; onPick: (id: string) => void;
    onDraw: () => void; drawing: boolean; drawError: boolean;
}) {
    return (
        <div>
            <h2 className="text-xl font-bold text-white">Try Trade in Time</h2>
            <p className="text-sm text-gray-400 mt-1 max-w-2xl">
                A real company on a real date — its numbers, but not its name. Decide whether to invest.
                Then we replay what actually happened.
            </p>

            <div className="mt-6 rounded-2xl border border-[var(--teal)]/30 bg-[var(--teal)]/[0.06] p-6 flex flex-col md:flex-row md:items-center gap-5">
                <div className="flex-1">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--teal)] flex items-center gap-2"><Shuffle size={12} /> A different company every time</p>
                    <h3 className="text-lg font-bold text-white mt-1">Draw a random case</h3>
                    <p className="text-sm text-gray-300 mt-1.5 leading-relaxed max-w-xl">
                        A mid- or large-cap picked at random, on a random day in the last few years. Its P/E, PEG,
                        ROE, debt, growth, Sharpe and beta are computed from the statements and prices as they stood
                        that day — nothing is typed in.
                    </p>
                    {drawError && <p className="text-xs text-rose-400 mt-2">Could not build a case just now — try again.</p>}
                </div>
                <button
                    onClick={onDraw}
                    disabled={drawing}
                    className="flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold bg-[var(--teal)]/20 text-[var(--teal)] hover:bg-[var(--teal)]/30 transition-colors disabled:opacity-60 whitespace-nowrap"
                >
                    {drawing ? <><Loader2 size={15} className="animate-spin" /> Building the dossier…</> : <><Shuffle size={15} /> Draw a case</>}
                </button>
            </div>

            <div className="mt-8 flex items-baseline gap-3">
                <h3 className="font-bold text-white">Classic cases</h3>
                <span className="text-xs text-gray-500">hand-written, with what the news was actually saying</span>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {cases.map((c, i) => {
                    const d = done[c.id];
                    return (
                        <button
                            key={c.id}
                            onClick={() => onPick(c.id)}
                            className="glass-card !transform-none p-4 text-left group hover:border-[var(--teal)]/40 transition-colors"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase tracking-wider text-gray-500">Case {String(i + 1).padStart(2, '0')}</span>
                                {d ? <Unlock size={13} className="text-gray-500" /> : <Lock size={13} className="text-[var(--teal)]" />}
                            </div>
                            <p className="font-semibold text-white mt-2">{c.sector}</p>
                            <p className="text-[11px] text-gray-500">{c.period_label} · {c.size}</p>
                            <p className="text-xs text-gray-400 mt-2 leading-relaxed">{c.teaser}</p>
                            {d && (
                                <p className={cn('text-[11px] mt-3 font-semibold', tone(d.pnl_pct))}>
                                    {d.amount > 0 ? `You invested ${inr(d.amount)} → ${signed(d.pnl_pct)}` : `You skipped · stock ${signed(d.pnl_pct)}`}
                                    <span className="text-gray-500 font-normal"> · {d.name}</span>
                                </p>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

/* ---------------------------------------------------------------- dossier */

function Dossier({ c, onDecide, onBack }: {
    c: TimeTradeCase; onDecide: (amount: number) => void; onBack: () => void;
}) {
    const [amount, setAmount] = useState(25_000);
    const [custom, setCustom] = useState('');
    const pf = c.price_facts;
    const chosen = custom ? Number(custom) : amount;

    return (
        <div className="space-y-6">
            <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300">
                <ArrowLeft size={12} /> All cases
            </button>

            {/* date banner */}
            <div className="rounded-2xl border border-[var(--teal)]/25 bg-[var(--teal)]/[0.05] p-5 flex items-start gap-4">
                <Clock size={22} className="text-[var(--teal)] mt-0.5 shrink-0" />
                <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--teal)]">Today is</p>
                    <h2 className="text-2xl font-bold text-white">{c.period_label}</h2>
                    <p className="text-sm text-gray-300 mt-2 leading-relaxed">{c.context}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-start">
                <div className="space-y-5">
                    {/* identity */}
                    <div className="glass-card !transform-none p-5">
                        <div className="flex items-baseline justify-between flex-wrap gap-2">
                            <div>
                                <p className="text-[10px] uppercase tracking-wider text-gray-500">The company</p>
                                <p className="font-bold text-white text-lg">{c.sector}</p>
                                <p className="text-xs text-gray-500">{c.size} · name withheld</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] uppercase tracking-wider text-gray-500">Share price</p>
                                <p className="font-bold text-white text-lg tabular-nums">{inr(c.price_then, 2)}</p>
                                <p className="text-[10px] text-gray-600">adjusted for later splits</p>
                            </div>
                        </div>

                        <p className="text-[10px] uppercase tracking-wider text-gray-500 mt-5 mb-2">What the chart says</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {([
                                ['1-year move', signed(pf.ret_1y), 'momentum', pf.ret_1y],
                                ['3-month move', signed(pf.ret_3m), undefined, pf.ret_3m],
                                ['From 52-week high', signed(pf.pct_from_52w_high), 'pct_52w_high', pf.pct_from_52w_high],
                                ['Volatility', pf.volatility_1y != null ? `${(pf.volatility_1y * 100).toFixed(0)}%` : '—', 'volatility', null],
                            ] as const).map(([l, v, term, t]) => (
                                <div key={l} className="rounded-lg bg-black/30 px-3 py-2">
                                    <p className="text-[10px] text-gray-500 flex items-center">{l}{term && <InfoTip term={term} />}</p>
                                    <p className={cn('font-semibold tabular-nums mt-0.5', t == null ? 'text-white' : tone(t))}>{v}</p>
                                </div>
                            ))}
                        </div>
                        {c.nifty_ret_1y != null && (
                            <p className="text-[11px] text-gray-500 mt-2">NIFTY over the same year: <span className={tone(c.nifty_ret_1y)}>{signed(c.nifty_ret_1y)}</span></p>
                        )}
                    </div>

                    {/* financials */}
                    <div className="glass-card !transform-none p-5">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-3">Financials, as reported around this date</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {c.facts.map(f => (
                                <div key={f.label} className="rounded-lg bg-black/30 px-3 py-2">
                                    <p className="text-[10px] text-gray-500 flex items-center">{f.label}{f.term && <InfoTip term={f.term} />}</p>
                                    <p className="font-semibold text-white mt-0.5">{f.value}</p>
                                    {f.note && <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{f.note}</p>}
                                </div>
                            ))}
                        </div>
                        <p className="text-[10px] text-gray-600 mt-3">
                            {c.fiscal_note ?? 'Approximate reconstruction of what was public at the time.'} Tap any ? to learn the metric.
                        </p>
                    </div>

                    {/* risk & performance, computed from prices up to that day */}
                    {c.risk_facts && Object.keys(c.risk_facts).length > 0 && (
                        <div className="glass-card !transform-none p-5">
                            <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2"><BarChart3 size={12} /> Risk & performance on this date</p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {([
                                    ['Sharpe (1y)', 'sharpe', c.risk_facts.sharpe != null ? c.risk_facts.sharpe.toFixed(2) : null, c.risk_facts.sharpe],
                                    ['Beta vs NIFTY', 'beta', c.risk_facts.beta != null ? c.risk_facts.beta.toFixed(2) : null, null],
                                    ["Jensen's alpha (1y)", 'alpha', c.risk_facts.alpha != null ? signed(c.risk_facts.alpha * 100) : null, c.risk_facts.alpha],
                                    ['12-1 momentum', 'momentum', c.risk_facts.momentum != null ? signed(c.risk_facts.momentum * 100) : null, c.risk_facts.momentum],
                                    ['RSI (14)', 'rsi', c.risk_facts.rsi != null ? c.risk_facts.rsi.toFixed(0) : null, null],
                                    ['Worst fall in past year', undefined, c.risk_facts.max_drawdown_1y != null ? `${(c.risk_facts.max_drawdown_1y * 100).toFixed(0)}%` : null, c.risk_facts.max_drawdown_1y],
                                ] as const).filter(r => r[2] != null).map(([l, term, v, t]) => (
                                    <div key={l} className="rounded-lg bg-black/30 px-3 py-2">
                                        <p className="text-[10px] text-gray-500 flex items-center">{l}{term && <InfoTip term={term} />}</p>
                                        <p className={cn('font-semibold tabular-nums mt-0.5', t == null ? 'text-white' : tone(t as number))}>{v}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* news */}
                    <div className="glass-card !transform-none p-5">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
                            <Newspaper size={12} /> {c.news_kind === 'data' ? 'What the market was saying' : 'What the news was saying'}
                        </p>
                        <ul className="space-y-2.5">
                            {c.news.map((n, i) => (
                                <li key={i} className="flex gap-2.5 text-sm text-gray-300 leading-relaxed">
                                    <span className="mt-2 h-1 w-1 flex-none rounded-full bg-gray-500" />{n}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* decision */}
                <div className="glass-card !transform-none p-5 lg:sticky lg:top-28">
                    <h3 className="font-bold text-white">Your decision</h3>
                    <p className="text-xs text-gray-500 mt-1">
                        It is {c.period_label}. You know only what is on this page.
                    </p>

                    <p className="text-[10px] uppercase tracking-wider text-gray-500 mt-5 mb-2">How much to invest</p>
                    <div className="grid grid-cols-2 gap-2">
                        {AMOUNTS.map(a => (
                            <button
                                key={a}
                                onClick={() => { setAmount(a); setCustom(''); }}
                                className={cn('rounded-lg border px-3 py-2 text-sm font-semibold transition-colors',
                                    !custom && amount === a
                                        ? 'border-[var(--teal)] bg-[var(--teal)]/10 text-[var(--teal)]'
                                        : 'border-white/10 text-gray-400 hover:text-white')}
                            >
                                {inr(a)}
                            </button>
                        ))}
                    </div>
                    <input
                        type="number" min={1000} step={1000} value={custom} onChange={e => setCustom(e.target.value)}
                        placeholder="or any amount in ₹"
                        className="mt-2 w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-[var(--teal)]/50 outline-none"
                    />

                    <button
                        onClick={() => onDecide(Math.max(0, chosen || 0))}
                        disabled={!chosen || chosen < 1000}
                        className="mt-4 w-full rounded-lg py-3 text-sm font-bold bg-emerald-400/20 text-emerald-300 hover:bg-emerald-400/30 transition-colors disabled:opacity-40"
                    >
                        Invest {inr(chosen || 0)} and travel to today
                    </button>
                    <button
                        onClick={() => onDecide(0)}
                        className="mt-2 w-full rounded-lg py-3 text-sm font-bold border border-white/10 text-gray-300 hover:border-rose-400/40 hover:text-rose-300 transition-colors"
                    >
                        Skip this one — show me anyway
                    </button>
                    <p className="text-[10px] text-gray-600 mt-3">
                        Imaginary money. The outcome is the real share price from this date to today.
                    </p>
                </div>
            </div>
        </div>
    );
}

/* ----------------------------------------------------------------- reveal */

function Reveal({ r, onNext, onAnother, drawing }: { r: TimeTradeReveal; onNext: () => void; onAnother: () => void; drawing: boolean }) {
    const invested = r.qty > 0;
    const positive = (r.stock_pct ?? 0) >= 0;
    const worstPt = r.path.find(p => p.d >= r.worst.date) ?? null;
    const beatNifty = r.stock_pct != null && r.nifty_pct != null ? r.stock_pct - r.nifty_pct : null;

    return (
        <div className="space-y-6">
            <TimeRevealScene
                phase="reveal"
                positive={positive}
                name={r.name}
                priceNow={inr(r.price_now, 2)}
                pct={signed(r.stock_pct)}
            />

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1, duration: 0.5 }} className="space-y-5">
                {/* the money */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {invested ? (
                        <>
                            <div className="rounded-xl bg-white/[0.04] border border-white/5 px-4 py-3">
                                <p className="text-[11px] text-gray-500">You invested</p>
                                <p className="text-xl font-bold text-white tabular-nums mt-1">{inr(r.invested)}</p>
                                <p className="text-[11px] text-gray-500">{r.qty} shares @ {inr(r.price_then, 2)}</p>
                            </div>
                            <div className={cn('rounded-xl border px-4 py-3', positive ? 'bg-emerald-400/10 border-emerald-400/30' : 'bg-rose-400/10 border-rose-400/30')}>
                                <p className="text-[11px] text-gray-400">Worth today</p>
                                <p className={cn('text-xl font-bold tabular-nums mt-1', tone(r.pnl))}>{inr(r.value_now)}</p>
                                <p className={cn('text-[11px] font-semibold', tone(r.pnl))}>{r.pnl >= 0 ? 'profit' : 'loss'} of {inr(Math.abs(r.pnl))} ({signed(r.stock_pct)})</p>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="rounded-xl bg-white/[0.04] border border-white/5 px-4 py-3">
                                <p className="text-[11px] text-gray-500">You skipped</p>
                                <p className="text-xl font-bold text-white mt-1">{inr(r.reference_amount)}</p>
                                <p className="text-[11px] text-gray-500">kept as cash</p>
                            </div>
                            <div className={cn('rounded-xl border px-4 py-3', positive ? 'bg-rose-400/10 border-rose-400/30' : 'bg-emerald-400/10 border-emerald-400/30')}>
                                <p className="text-[11px] text-gray-400">{positive ? 'You missed' : 'You avoided'}</p>
                                <p className={cn('text-xl font-bold tabular-nums mt-1', positive ? 'text-rose-400' : 'text-emerald-400')}>{signed(r.stock_pct)}</p>
                                <p className="text-[11px] text-gray-500">over {r.years} years</p>
                            </div>
                        </>
                    )}
                    <div className="rounded-xl bg-white/[0.04] border border-white/5 px-4 py-3">
                        <p className="text-[11px] text-gray-500">Same money in NIFTY 50</p>
                        <p className="text-xl font-bold text-white tabular-nums mt-1">{inr(r.nifty_value)}</p>
                        <p className={cn('text-[11px] font-semibold', tone(r.nifty_pct))}>{signed(r.nifty_pct)} · {beatNifty != null && (beatNifty >= 0 ? `stock beat it by ${beatNifty.toFixed(0)} pts` : `index won by ${Math.abs(beatNifty).toFixed(0)} pts`)}</p>
                    </div>
                    <div className="rounded-xl bg-white/[0.04] border border-white/5 px-4 py-3">
                        <p className="text-[11px] text-gray-500">The ride</p>
                        <p className="text-xl font-bold text-rose-400 tabular-nums mt-1">{r.max_drawdown_pct.toFixed(0)}%</p>
                        <p className="text-[11px] text-gray-500">worst fall from a peak along the way</p>
                    </div>
                </div>

                {/* the path */}
                <div className="glass-card !transform-none p-5">
                    <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
                        <h3 className="font-bold text-white">{r.name} <span className="text-gray-500 font-normal text-sm">· {r.symbol.replace('.NS', '')} · {r.sector}</span></h3>
                        <p className="text-[11px] text-gray-500">{r.date} → {r.as_of} · CAGR {signed(r.cagr)}</p>
                    </div>
                    <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={r.path} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="tt-fill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={positive ? '#34d399' : '#fb7185'} stopOpacity={0.35} />
                                        <stop offset="100%" stopColor={positive ? '#34d399' : '#fb7185'} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="d" tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={d => d.slice(0, 4)} minTickGap={40} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} width={56} tickFormatter={v => `₹${v}`} domain={['auto', 'auto']} />
                                <RTooltip
                                    contentStyle={{ background: '#0b1020', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 12 }}
                                    formatter={(v: any) => [inr(v, 2), 'Price']}
                                />
                                <Area type="monotone" dataKey="p" stroke={positive ? '#34d399' : '#fb7185'} strokeWidth={2} fill="url(#tt-fill)" dot={false} />
                                <ReferenceDot x={r.path[0].d} y={r.path[0].p} r={4} fill="#fff" stroke="none" />
                                {worstPt && r.worst.pct != null && r.worst.pct < -5 && (
                                    <ReferenceDot x={worstPt.d} y={worstPt.p} r={4} fill="#fb7185" stroke="none" />
                                )}
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-gray-500 mt-2">
                        <span>Worst point: <span className="text-rose-400">{signed(r.worst.pct)}</span> on {r.worst.date}</span>
                        <span>Best point: <span className="text-emerald-400">{signed(r.best.pct)}</span> on {r.best.date}</span>
                    </div>
                </div>

                {/* the story */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="glass-card !transform-none p-5">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">What happened next</p>
                        <p className="text-sm text-gray-200 leading-relaxed">{r.what_happened}</p>
                    </div>
                    <div className="rounded-2xl border border-[var(--teal)]/25 bg-[var(--teal)]/[0.06] p-5">
                        <p className="text-[10px] uppercase tracking-wider text-[var(--teal)] mb-2 flex items-center gap-1.5"><Sparkles size={11} /> The lesson</p>
                        <p className="text-sm text-gray-100 leading-relaxed">{r.lesson}</p>
                    </div>
                </div>

                <div className="flex justify-end gap-2 flex-wrap">
                    <button onClick={onNext} className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold border border-white/10 text-gray-300 hover:text-white transition-colors">
                        <CheckCircle2 size={15} /> All cases
                    </button>
                    <button onClick={onAnother} disabled={drawing} className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold bg-[var(--teal)]/15 text-[var(--teal)] hover:bg-[var(--teal)]/25 transition-colors disabled:opacity-60">
                        {drawing ? <Loader2 size={15} className="animate-spin" /> : <Shuffle size={15} />} Try another company
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

/* ------------------------------------------------------------------- root */

export function TryTradeInTime() {
    const [stage, setStage] = useState<Stage>('pick');
    const [caseId, setCaseId] = useState<string | null>(null);
    const [reveal, setReveal] = useState<TimeTradeReveal | null>(null);
    const [done, setDone] = useState<Done>(loadDone);

    const [random, setRandom] = useState<TimeTradeCase | null>(null);
    const [seen, setSeen] = useState<string[]>([]);

    const { data: list } = useQuery({ queryKey: ['timetrade-cases'], queryFn: api.getTimeTradeCases, staleTime: Infinity });
    const { data: fetched, isLoading: loadingCase } = useQuery({
        queryKey: ['timetrade-case', caseId],
        queryFn: () => api.getTimeTradeCase(caseId!),
        enabled: !!caseId && stage === 'dossier' && !random,
        staleTime: Infinity,
    });
    const dossier = random ?? fetched;

    // A fresh company and date on every draw; symbols already seen this
    // session are excluded server-side so "try another" really is another.
    const draw = useMutation({
        mutationFn: () => api.timeTradeRandom(seen),
        onSuccess: (c) => { setRandom(c); setCaseId(c.id); setStage('dossier'); },
    });
    const drawRandom = () => { setReveal(null); draw.mutate(); };

    // Open straight onto a random case so every visit starts somewhere new.
    // A ref, not state: React's dev-mode double effect must not draw twice.
    const autoDrawn = useRef(false);
    useEffect(() => {
        if (!autoDrawn.current && stage === 'pick') { autoDrawn.current = true; draw.mutate(); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stage]);

    const decide = useMutation({
        mutationFn: api.timeTradeDecide,
        onSuccess: (r) => {
            setReveal(r);
            setSeen(prev => prev.includes(r.symbol) ? prev : [...prev, r.symbol]);
            if (!r.id.startsWith('rnd-')) {
                const next = { ...done, [r.id]: { amount: r.amount, pnl_pct: r.stock_pct, name: r.name } };
                setDone(next); saveDone(next);
            }
        },
        onError: () => setStage('dossier'),
    });

    // The travel phase is deliberately held for a beat even when the reply is
    // instant: the wait is part of the experience of years passing.
    const [travelDone, setTravelDone] = useState(false);
    useEffect(() => {
        if (stage !== 'travel') { setTravelDone(false); return; }
        const t = setTimeout(() => setTravelDone(true), 2600);
        return () => clearTimeout(t);
    }, [stage]);
    useEffect(() => {
        if (stage === 'travel' && travelDone && reveal) setStage('reveal');
    }, [stage, travelDone, reveal]);

    const yearsLabel = useMemo(() => dossier ? `${dossier.years_ago} years forward, to today` : 'to today', [dossier]);

    const onDecide = (amount: number) => {
        if (!caseId) return;
        setReveal(null);
        setStage('travel');
        decide.mutate({ id: caseId, amount });
    };

    const reset = () => { setStage('pick'); setCaseId(null); setReveal(null); setRandom(null); };

    return (
        // Default (overlapping) mode rather than "wait": the next stage must never
        // depend on an exit animation finishing, which it will not in a background tab.
        <AnimatePresence initial={false}>
            {stage === 'pick' && (
                <motion.div key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }}>
                    {list ? <CasePicker cases={list.cases} done={done} onPick={(id) => { setRandom(null); setCaseId(id); setStage('dossier'); }}
                        onDraw={drawRandom} drawing={draw.isPending} drawError={draw.isError} />
                        : <div className="grid grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-36 rounded-xl bg-white/5 animate-pulse" />)}</div>}
                </motion.div>
            )}
            {stage === 'dossier' && (
                <motion.div key="dossier" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.15 } }}>
                    {loadingCase || !dossier
                        ? <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 rounded-xl bg-white/5 animate-pulse" />)}</div>
                        : <Dossier c={dossier} onDecide={onDecide} onBack={reset} />}
                    {decide.isError && <p className="text-xs text-rose-400 mt-3">Could not fetch the outcome — price history unavailable. Try again.</p>}
                </motion.div>
            )}
            {stage === 'travel' && (
                <motion.div key="travel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }}>
                    <TimeRevealScene phase="travel" positive={null} yearsLabel={yearsLabel} />
                </motion.div>
            )}
            {stage === 'reveal' && reveal && (
                <motion.div key="reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }}>
                    <Reveal r={reveal} onNext={reset} onAnother={drawRandom} drawing={draw.isPending} />
                </motion.div>
            )}
        </AnimatePresence>
    );
}
