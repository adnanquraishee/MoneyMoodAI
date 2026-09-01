import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    BookOpen, Wallet, ArrowRight, TrendingUp, TrendingDown, RotateCcw, History, Clock,
} from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { LESSONS } from '../lib/metricEducation';
import { REALITY_STORIES } from '../lib/realityStories';
import { useMetricLearn } from '../components/ui/MetricLearn';
import { SearchBox } from '../components/layout/SearchBox';
import { TryTradeInTime } from '../components/features/TryTradeInTime';
import type { PaperPortfolio } from '../lib/types';

const inr = (v: number | null | undefined, d = 0) =>
    v == null ? '—' : `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: d })}`;
const signed = (v: number | null | undefined, d = 1) =>
    v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(d)}%`;
const tone = (v: number | null | undefined) =>
    v == null ? 'text-gray-400' : v >= 0 ? 'text-emerald-400' : 'text-rose-400';

/* ================================================================ Lessons */

const GROUPS: { title: string; blurb: string; terms: string[] }[] = [
    { title: 'Is it expensive?', blurb: 'What you pay, and what for.', terms: ['pe', 'forward_pe', 'peg', 'pb', 'dividend_yield'] },
    { title: 'Is it a good business?', blurb: 'What the company does with money.', terms: ['roe', 'roa', 'profit_margin', 'operating_margin'] },
    { title: 'Is it growing?', blurb: 'Where the future earnings come from.', terms: ['earnings_growth', 'revenue_growth'] },
    { title: 'Can it survive a bad year?', blurb: 'Debt and cash.', terms: ['debt_to_equity', 'current_ratio'] },
    { title: 'What kind of ride is it?', blurb: 'Risk, in the sense of what it feels like to hold.', terms: ['beta', 'volatility', 'sharpe', 'alpha', 'momentum', 'rsi'] },
    { title: 'Putting it together', blurb: 'Composite reads — useful, and easy to over-trust.', terms: ['garp', 'conviction'] },
];

function LessonsTab() {
    const { open } = useMetricLearn();
    return (
        <div className="space-y-12">
            <section>
                <h2 className="text-xl font-bold text-white">Read a number the way a professional does</h2>
                <p className="text-sm text-gray-400 mt-1 max-w-2xl">
                    Every lesson shows the bands we use, where the real NSE market sits today, how the
                    number misleads, and which other numbers to check before trusting it.
                </p>
                <div className="mt-8 space-y-8">
                    {GROUPS.map(g => (
                        <div key={g.title}>
                            <div className="flex items-baseline gap-3 mb-3">
                                <h3 className="font-bold text-white">{g.title}</h3>
                                <span className="text-xs text-gray-500">{g.blurb}</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {g.terms.map(t => {
                                    const l = LESSONS[t];
                                    if (!l) return null;
                                    return (
                                        <button
                                            key={t}
                                            onClick={() => open({ term: t })}
                                            className="glass-card !transform-none p-4 text-left group hover:border-[var(--teal)]/40 transition-colors"
                                        >
                                            <div className="flex items-center justify-between">
                                                <p className="font-semibold text-white">{l.name}</p>
                                                <ArrowRight size={14} className="text-gray-600 group-hover:text-[var(--teal)] transition-colors" />
                                            </div>
                                            <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{l.plain}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section>
                <h2 className="text-xl font-bold text-white">What actually happened</h2>
                <p className="text-sm text-gray-400 mt-1 max-w-2xl">
                    Real Indian companies where the number said one thing and the market did another —
                    or where the number was right for a reason most people missed. Figures are rounded.
                </p>
                <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {REALITY_STORIES.map((s, i) => (
                        <article key={i} className="glass-card !transform-none p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="font-bold text-white">{s.company}</h3>
                                    <p className="text-[11px] text-gray-500">{s.period}</p>
                                </div>
                                <button
                                    onClick={() => open({ term: s.term })}
                                    className="text-[10px] font-semibold px-2.5 py-1 rounded-full border border-[var(--teal)]/30 text-[var(--teal)] hover:bg-[var(--teal)]/10 whitespace-nowrap"
                                >
                                    {LESSONS[s.term]?.name ?? s.term}
                                </button>
                            </div>
                            <dl className="mt-4 space-y-3 text-sm">
                                <div>
                                    <dt className="text-[10px] uppercase tracking-wider text-gray-500">The number</dt>
                                    <dd className="text-gray-300 mt-0.5">{s.theNumber}</dd>
                                </div>
                                <div>
                                    <dt className="text-[10px] uppercase tracking-wider text-gray-500">What people concluded</dt>
                                    <dd className="text-gray-400 italic mt-0.5">{s.theBelief}</dd>
                                </div>
                                <div>
                                    <dt className="text-[10px] uppercase tracking-wider text-gray-500">What happened</dt>
                                    <dd className="text-gray-200 mt-0.5">{s.whatHappened}</dd>
                                </div>
                                <div className="rounded-lg border border-[var(--teal)]/20 bg-[var(--teal)]/[0.06] p-3">
                                    <dt className="text-[10px] uppercase tracking-wider text-[var(--teal)]">The lesson</dt>
                                    <dd className="text-gray-200 mt-0.5">{s.lesson}</dd>
                                </div>
                            </dl>
                        </article>
                    ))}
                </div>
            </section>
        </div>
    );
}

/* ========================================================== Paper trading */

function Stat({ label, value, sub, subTone }: { label: string; value: string; sub?: string; subTone?: string }) {
    return (
        <div className="rounded-xl bg-white/[0.04] border border-white/5 px-4 py-3">
            <p className="text-[11px] text-gray-500">{label}</p>
            <p className="text-xl font-bold text-white mt-1 tabular-nums">{value}</p>
            {sub && <p className={cn('text-xs mt-0.5 font-semibold', subTone)}>{sub}</p>}
        </div>
    );
}

function TradeForm({ portfolio }: { portfolio: PaperPortfolio }) {
    const qc = useQueryClient();
    const [sym, setSym] = useState<{ symbol: string; name: string } | null>(null);
    const [side, setSide] = useState<'buy' | 'sell'>('buy');
    const [qty, setQty] = useState('10');
    const [reason, setReason] = useState('');
    const [error, setError] = useState<string | null>(null);

    const held = sym ? portfolio.holdings.find(h => h.symbol === sym.symbol) : undefined;

    const mut = useMutation({
        mutationFn: api.paperTrade,
        onSuccess: (data) => {
            qc.setQueryData(['paper'], data);
            setReason('');
            setError(null);
        },
        onError: (e: any) => setError(e?.response?.data?.detail ?? 'Trade failed'),
    });

    const submit = () => {
        if (!sym) { setError('Pick a company first'); return; }
        const n = parseInt(qty, 10);
        if (!Number.isFinite(n) || n <= 0) { setError('Quantity must be a positive number'); return; }
        mut.mutate({ symbol: sym.symbol, side, qty: n, reason });
    };

    return (
        <div className="glass-card !transform-none p-5">
            <h3 className="font-bold text-white mb-1">Place a paper trade</h3>
            <p className="text-xs text-gray-500 mb-4">
                Real prices, imaginary money. The reason you write is the lesson — you will see it
                again next to what the position actually did.
            </p>

            <div className="space-y-3">
                <SearchBox onSelect={(s, n) => { setSym({ symbol: s, name: n }); setError(null); }} placeholder="Search a company to trade…" />
                {sym && (
                    <p className="text-sm text-gray-300">
                        <span className="font-semibold text-white">{sym.symbol.replace('.NS', '')}</span>
                        <span className="text-gray-500"> · {sym.name}</span>
                        {held && <span className="text-gray-500"> · you hold {held.qty}</span>}
                    </p>
                )}

                <div className="grid grid-cols-[auto_1fr] gap-3 items-center">
                    <div className="flex rounded-lg border border-white/10 overflow-hidden">
                        {(['buy', 'sell'] as const).map(s => (
                            <button
                                key={s}
                                onClick={() => setSide(s)}
                                className={cn('px-4 py-2 text-xs font-bold uppercase transition-colors',
                                    side === s
                                        ? s === 'buy' ? 'bg-emerald-400/20 text-emerald-300' : 'bg-rose-400/20 text-rose-300'
                                        : 'text-gray-500 hover:text-gray-300')}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                    <input
                        type="number" min={1} value={qty} onChange={e => setQty(e.target.value)}
                        className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm text-white focus:border-[var(--teal)]/50 outline-none"
                        placeholder="Quantity"
                    />
                </div>

                <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    rows={3}
                    placeholder={side === 'buy'
                        ? 'Why are you buying? Be specific: which number convinced you, and what would prove you wrong?'
                        : 'Why are you selling? Did the reason you bought stop being true, or did the price just move?'}
                    className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-[var(--teal)]/50 outline-none resize-none"
                />

                {error && <p className="text-xs text-rose-400">{error}</p>}

                <button
                    onClick={submit}
                    disabled={mut.isPending}
                    className={cn('w-full rounded-lg py-2.5 text-sm font-bold transition-colors disabled:opacity-50',
                        side === 'buy'
                            ? 'bg-emerald-400/20 text-emerald-300 hover:bg-emerald-400/30'
                            : 'bg-rose-400/20 text-rose-300 hover:bg-rose-400/30')}
                >
                    {mut.isPending ? 'Placing…' : `${side === 'buy' ? 'Buy' : 'Sell'} at market`}
                </button>
                <p className="text-[10px] text-gray-600">
                    Cash available: {inr(portfolio.cash)}. Simulated only — no order reaches any broker.
                </p>
            </div>
        </div>
    );
}

function PaperTab() {
    const qc = useQueryClient();
    const { data, isLoading } = useQuery({ queryKey: ['paper'], queryFn: api.getPaper, refetchInterval: 60_000 });
    const reset = useMutation({
        mutationFn: api.paperReset,
        onSuccess: (d) => qc.setQueryData(['paper'], d),
    });

    const started = useMemo(() => data ? new Date(data.started_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '', [data]);

    if (isLoading || !data) {
        return <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />)}</div>;
    }

    const vsNifty = data.nifty_return_pct != null ? data.return_pct - data.nifty_return_pct : null;

    return (
        <div className="space-y-6">
            <div className="flex items-end justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-xl font-bold text-white">Your paper portfolio</h2>
                    <p className="text-xs text-gray-500 mt-1">Started {started} with {inr(data.starting_cash)}</p>
                </div>
                <button
                    onClick={() => { if (window.confirm('Start over with a fresh ₹1,00,000? Your trade log will be cleared.')) reset.mutate(); }}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-rose-400 transition-colors"
                >
                    <RotateCcw size={12} /> Start over
                </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Total value" value={inr(data.total_value)} sub={`${inr(data.pnl)} (${signed(data.return_pct)})`} subTone={tone(data.pnl)} />
                <Stat label="Cash" value={inr(data.cash)} />
                <Stat label="In stocks" value={inr(data.holdings_value)} sub={`${data.holdings.length} position${data.holdings.length === 1 ? '' : 's'}`} subTone="text-gray-500" />
                <Stat
                    label="You vs NIFTY 50"
                    value={vsNifty == null ? '—' : signed(vsNifty)}
                    sub={data.nifty_return_pct != null ? `NIFTY ${signed(data.nifty_return_pct)} since you started` : 'index level not yet available'}
                    subTone={vsNifty == null ? 'text-gray-500' : tone(vsNifty)}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5 items-start">
                <TradeForm portfolio={data} />

                <div className="space-y-5">
                    <div className="glass-card !transform-none p-5">
                        <h3 className="font-bold text-white mb-3">Holdings — and why you bought them</h3>
                        {data.holdings.length === 0 ? (
                            <p className="text-sm text-gray-500">Nothing yet. Your first trade goes on the left.</p>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {data.holdings.map(h => (
                                    <div key={h.symbol} className="py-3 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                                        <div>
                                            <div className="flex items-baseline gap-2">
                                                <span className="font-semibold text-white">{h.symbol.replace('.NS', '')}</span>
                                                <span className="text-[11px] text-gray-500 truncate">{h.name}</span>
                                            </div>
                                            <p className="text-[11px] text-gray-500 mt-0.5">
                                                {h.qty} × avg {inr(h.avg_cost, 2)} · now {inr(h.price, 2)}
                                            </p>
                                            {h.reason && (
                                                <p className="text-xs text-gray-400 mt-1.5 italic border-l-2 border-white/10 pl-2">
                                                    “{h.reason}”
                                                </p>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <p className={cn('font-bold tabular-nums flex items-center justify-end gap-1', tone(h.pnl))}>
                                                {h.pnl != null && (h.pnl >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />)}
                                                {signed(h.pnl_pct)}
                                            </p>
                                            <p className="text-[11px] text-gray-500 tabular-nums">{inr(h.pnl)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="glass-card !transform-none p-5">
                        <h3 className="font-bold text-white mb-1 flex items-center gap-2"><History size={14} className="text-[var(--teal)]" /> Decision log</h3>
                        <p className="text-xs text-gray-500 mb-3">Each decision, your reason at the time, and what the price has done since.</p>
                        {data.trades.length === 0 ? (
                            <p className="text-sm text-gray-500">No decisions yet.</p>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {data.trades.map(t => (
                                    <div key={t.id} className="py-3">
                                        <div className="flex items-center justify-between gap-3 flex-wrap">
                                            <p className="text-sm">
                                                <span className={cn('text-[10px] font-bold uppercase px-1.5 py-0.5 rounded mr-2',
                                                    t.side === 'buy' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-rose-400/15 text-rose-300')}>{t.side}</span>
                                                <span className="font-semibold text-white">{t.symbol.replace('.NS', '')}</span>
                                                <span className="text-gray-500"> · {t.qty} @ {inr(t.price, 2)}</span>
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {new Date(t.ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                {t.move_pct != null && (
                                                    <span className={cn('ml-2 font-semibold', t.side === 'buy' ? tone(t.move_pct) : tone(-t.move_pct))}>
                                                        since then {signed(t.move_pct)}
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1 italic">“{t.reason}”</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* =================================================================== Page */

export function Learn() {
    const [params, setParams] = useSearchParams();
    const raw = params.get('tab');
    const tab: 'lessons' | 'paper' | 'time' = raw === 'paper' ? 'paper' : raw === 'time' ? 'time' : 'lessons';
    const setTab = (t: 'lessons' | 'paper' | 'time') => setParams(t === 'lessons' ? {} : { tab: t }, { replace: true });

    return (
        <div className="max-w-7xl mx-auto px-6 pb-20">
            <header className="mb-8">
                <h1 className="text-3xl md:text-4xl font-bold text-white">Learn</h1>
                <p className="text-gray-400 mt-2 max-w-2xl">
                    Understand what the numbers mean, see what they did to real companies, test your
                    judgment with real prices and imaginary money — or go back in time and decide blind.
                </p>
            </header>

            <div className="flex gap-1 border-b border-white/10 mb-8">
                {([
                    ['lessons', 'Lessons', BookOpen],
                    ['paper', 'Paper Trading', Wallet],
                    ['time', 'Try Trade in Time', Clock],
                ] as const).map(([id, label, Icon]) => (
                    <button
                        key={id}
                        onClick={() => setTab(id)}
                        className={cn('flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors',
                            tab === id ? 'border-[var(--teal)] text-[var(--teal)]' : 'border-transparent text-gray-500 hover:text-gray-300')}
                    >
                        <Icon size={15} /> {label}
                    </button>
                ))}
            </div>

            {tab === 'lessons' ? <LessonsTab /> : tab === 'paper' ? <PaperTab /> : <TryTradeInTime />}
        </div>
    );
}
