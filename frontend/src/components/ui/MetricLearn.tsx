import {
    createContext, useCallback, useContext, useMemo, useState, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X, AlertTriangle, Compass, ArrowRight, BookOpen } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { GLOSSARY } from '../../lib/glossary';
import {
    LESSONS, zoneFor, formatValue, TONE_CLASS, TONE_BG,
    type MetricLesson,
} from '../../lib/metricEducation';
import type { MetricDistribution } from '../../lib/types';
import { storiesFor } from '../../lib/realityStories';

/* ------------------------------------------------------------------ context */

interface LessonRequest {
    term: string;
    /** The stock's own value, so the lesson can be about this stock. */
    value?: number | null;
    /** Sector, for the peer median line. */
    sector?: string | null;
    /** Stock name, so the lesson reads as being about something concrete. */
    subject?: string | null;
    /** Every metric value for this stock, keyed by term, so following a
     *  "read this next" chip keeps teaching about the same company. */
    values?: Record<string, number | null | undefined>;
}

interface MetricLearnCtx {
    open: (req: LessonRequest) => void;
}

const Ctx = createContext<MetricLearnCtx | null>(null);

/** Opens the metric lesson panel. Safe to call where no provider is mounted. */
export function useMetricLearn(): MetricLearnCtx {
    return useContext(Ctx) ?? { open: () => { } };
}

/** True when a metric has a full lesson (not just a one-line glossary entry). */
export function hasLesson(term: string): boolean {
    return term in LESSONS;
}

/* ------------------------------------------------------- percentile helpers */

/** Approximate percentile of `value` by interpolating the published bands. */
function percentileOf(d: MetricDistribution, value: number): number {
    const pts: [number, number][] = [
        [d.p10, 10], [d.p25, 25], [d.p50, 50], [d.p75, 75], [d.p90, 90],
    ];
    if (value <= pts[0][0]) return 10 * (value / (pts[0][0] || 1));
    for (let i = 0; i < pts.length - 1; i++) {
        const [v0, q0] = pts[i];
        const [v1, q1] = pts[i + 1];
        if (value <= v1) {
            const span = v1 - v0;
            return span <= 0 ? q1 : q0 + ((value - v0) / span) * (q1 - q0);
        }
    }
    return 95;
}

/* ------------------------------------------------------------- zone band UI */

/**
 * The zone strip. Segments are drawn equal-width rather than to scale: the
 * lesson is "which band is this in and what does that mean", and true scaling
 * would crush every useful band into a sliver whenever one bound is open-ended.
 */
function ZoneBand({ lesson, value }: { lesson: MetricLesson; value: number | null | undefined }) {
    const zones = lesson.zones;

    const activeIdx = useMemo(() => {
        if (value == null || !Number.isFinite(value)) return -1;
        return zones.findIndex(z => z.upTo === null || value < z.upTo);
    }, [zones, value]);

    // Position inside the active segment, so the marker moves as the value moves.
    const markerPct = useMemo(() => {
        if (activeIdx < 0 || value == null || zones.length === 0) return null;
        const w = 100 / zones.length;
        const lower = activeIdx === 0
            ? Math.min(value, zones[0].upTo ?? value)
            : zones[activeIdx - 1].upTo!;
        const upper = zones[activeIdx].upTo;
        let frac = 0.5;
        if (upper !== null && Number.isFinite(lower)) {
            const span = upper - lower;
            if (span > 0) frac = Math.min(0.94, Math.max(0.06, (value - lower) / span));
        }
        return activeIdx * w + frac * w;
    }, [activeIdx, value, zones]);

    if (zones.length === 0) return null;

    return (
        <div className="mt-4">
            <div className="relative">
                <div className="flex gap-1">
                    {zones.map((z, i) => (
                        <div key={i} className="flex-1">
                            <div
                                className={`h-2 rounded-full transition-opacity ${TONE_BG[z.tone]} ${i === activeIdx ? 'opacity-100' : 'opacity-25'
                                    }`}
                            />
                            <p
                                className={`mt-2 text-[10px] leading-tight text-center ${i === activeIdx ? TONE_CLASS[z.tone] + ' font-semibold' : 'text-gray-600'
                                    }`}
                            >
                                {z.label}
                            </p>
                        </div>
                    ))}
                </div>
                {markerPct !== null && (
                    <motion.div
                        className="absolute -top-1.5 w-0 h-0"
                        initial={{ left: '50%', opacity: 0 }}
                        animate={{ left: `${markerPct}%`, opacity: 1 }}
                        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <div className="-translate-x-1/2 w-3 h-3 rounded-full bg-white shadow-lg ring-2 ring-[var(--teal)]" />
                    </motion.div>
                )}
            </div>
        </div>
    );
}

/* ------------------------------------------------------ market context strip */

function MarketContext({
    lesson, value, sector, dist,
}: {
    lesson: MetricLesson;
    value: number | null | undefined;
    sector?: string | null;
    dist?: MetricDistribution;
}) {
    if (!dist || dist.count < 20) return null;

    const hasValue = value != null && Number.isFinite(value);
    const pct = hasValue ? percentileOf(dist, value as number) : null;
    const sectorMedian = sector ? dist.sectors?.[sector]?.p50 : undefined;
    const sectorCount = sector ? dist.sectors?.[sector]?.count : undefined;

    return (
        <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-3">
                Against the real market
            </p>

            {hasValue && pct !== null && (
                <p className="text-sm text-gray-200 mb-3">
                    This stock&rsquo;s <span className="text-white font-semibold">{formatValue(lesson, value)}</span>{' '}
                    is higher than roughly{' '}
                    <span className="text-[var(--teal)] font-semibold">{Math.round(pct)}%</span>{' '}
                    of the {dist.count.toLocaleString('en-IN')} stocks with data.
                </p>
            )}

            <div className="grid grid-cols-3 gap-3 text-center">
                {([['Lower quarter', dist.p25], ['Market median', dist.p50], ['Upper quarter', dist.p75]] as const).map(
                    ([label, v]) => (
                        <div key={label} className="rounded-lg bg-black/30 py-2">
                            <p className="text-[10px] text-gray-500">{label}</p>
                            <p className="text-sm font-semibold text-gray-200 mt-0.5">
                                {formatValue(lesson, v)}
                            </p>
                        </div>
                    ),
                )}
            </div>

            {sectorMedian != null && (
                <p className="text-xs text-gray-400 mt-3">
                    Median for <span className="text-gray-200">{sector}</span> ({sectorCount} stocks):{' '}
                    <span className="text-gray-200 font-semibold">{formatValue(lesson, sectorMedian)}</span>
                </p>
            )}

            {lesson.sectorNote && (
                <p className="text-xs leading-relaxed text-gray-500 mt-2">{lesson.sectorNote}</p>
            )}
        </div>
    );
}

/* -------------------------------------------------------------------- modal */

function LessonPanel({ req, onClose, onNavigate }: {
    req: LessonRequest;
    onClose: () => void;
    onNavigate: (term: string) => void;
}) {
    const lesson = LESSONS[req.term];
    const { data: dists } = useQuery({
        queryKey: ['metric-distributions'],
        queryFn: api.getMetricDistributions,
        staleTime: 10 * 60_000,
    });

    if (!lesson) return null;
    const zone = zoneFor(lesson, req.value);
    const dist = lesson.distributionKey ? dists?.metrics?.[lesson.distributionKey] : undefined;

    return (
        <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

            <motion.div
                className="relative w-full max-w-2xl max-h-[86vh] overflow-y-auto rounded-2xl
                           border border-[var(--teal)]/25 bg-[#0b1020]/98 shadow-2xl"
                initial={{ scale: 0.96, y: 16 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.97, y: 8 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            >
                {/* header */}
                <div className="sticky top-0 z-10 flex items-start justify-between gap-4
                                border-b border-white/10 bg-[#0b1020]/98 px-6 py-5 backdrop-blur-md">
                    <div>
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[var(--teal)]">
                            <BookOpen size={12} /> Understanding the metric
                        </div>
                        <h2 className="text-xl font-bold text-white mt-1">{lesson.name}</h2>
                        {req.subject && (
                            <p className="text-xs text-gray-500 mt-0.5">as it applies to {req.subject}</p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-gray-500 hover:bg-white/10 hover:text-white transition-colors"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="px-6 py-5">
                    {/* plain meaning */}
                    <p className="text-base leading-relaxed text-gray-200">{lesson.plain}</p>
                    {lesson.formula && (
                        <p className="mt-2 text-xs text-gray-500 font-mono">{lesson.formula}</p>
                    )}

                    <p className="mt-4 text-sm leading-relaxed text-gray-400">{lesson.why}</p>

                    {/* this stock's reading */}
                    {req.value != null && zone && (
                        <div className="mt-5 rounded-xl border border-[var(--teal)]/20 bg-[var(--teal)]/[0.06] p-4">
                            <div className="flex items-baseline gap-3">
                                <span className="text-2xl font-bold text-white">
                                    {formatValue(lesson, req.value)}
                                </span>
                                <span className={`text-sm font-semibold ${TONE_CLASS[zone.tone]}`}>
                                    {zone.label}
                                </span>
                            </div>
                            <p className="mt-2 text-sm leading-relaxed text-gray-300">{zone.meaning}</p>
                        </div>
                    )}

                    {/* zone strip */}
                    {lesson.zones.length > 0 && (
                        <>
                            <ZoneBand lesson={lesson} value={req.value} />
                            <p className="mt-3 text-[10px] text-gray-600 text-center">
                                Bands are our interpretation, not a market standard.
                            </p>
                        </>
                    )}

                    {/* real market context */}
                    <MarketContext lesson={lesson} value={req.value} sector={req.sector} dist={dist} />

                    {/* how to use it */}
                    {lesson.rules.length > 0 && (
                        <section className="mt-6">
                            <h3 className="flex items-center gap-2 text-sm font-bold text-white mb-3">
                                <Compass size={14} className="text-[var(--teal)]" /> How to read it
                            </h3>
                            <ul className="space-y-2">
                                {lesson.rules.map((r, i) => (
                                    <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-gray-300">
                                        <span className="mt-2 h-1 w-1 flex-none rounded-full bg-[var(--teal)]" />
                                        {r}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {/* where it misleads */}
                    {lesson.traps.length > 0 && (
                        <section className="mt-6">
                            <h3 className="flex items-center gap-2 text-sm font-bold text-white mb-3">
                                <AlertTriangle size={14} className="text-amber-400" /> Where it misleads
                            </h3>
                            <ul className="space-y-2">
                                {lesson.traps.map((t, i) => (
                                    <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-gray-400">
                                        <span className="mt-2 h-1 w-1 flex-none rounded-full bg-amber-400/70" />
                                        {t}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {/* what actually happened — the reality behind the number */}
                    {storiesFor(req.term).length > 0 && (
                        <section className="mt-6">
                            <h3 className="text-sm font-bold text-white mb-3">What actually happened</h3>
                            <div className="space-y-3">
                                {storiesFor(req.term).map((s, i) => (
                                    <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                                        <p className="text-sm font-semibold text-white">
                                            {s.company} <span className="text-gray-500 font-normal text-xs">· {s.period}</span>
                                        </p>
                                        <p className="text-xs text-gray-400 mt-2"><span className="text-gray-500">The number:</span> {s.theNumber}</p>
                                        <p className="text-xs text-gray-400 mt-1 italic"><span className="text-gray-500 not-italic">People concluded:</span> {s.theBelief}</p>
                                        <p className="text-xs text-gray-200 mt-1"><span className="text-gray-500">What happened:</span> {s.whatHappened}</p>
                                        <p className="text-xs text-[var(--teal)] mt-2">{s.lesson}</p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* the exploration graph — never judge on one number */}
                    {lesson.pairsWith.length > 0 && (
                        <section className="mt-6 border-t border-white/10 pt-5">
                            <h3 className="text-sm font-bold text-white mb-1">Never read this one alone</h3>
                            <p className="text-xs text-gray-500 mb-3">
                                These are the numbers that confirm or contradict what {lesson.name} is telling you.
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {lesson.pairsWith.map(t => {
                                    const target = LESSONS[t];
                                    const label = target?.name ?? GLOSSARY[t]?.split(':')[0] ?? t;
                                    const clickable = !!target;
                                    return (
                                        <button
                                            key={t}
                                            disabled={!clickable}
                                            onClick={() => clickable && onNavigate(t)}
                                            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs
                                                        transition-colors ${clickable
                                                    ? 'border-[var(--teal)]/30 text-[var(--teal)] hover:bg-[var(--teal)]/10'
                                                    : 'border-white/10 text-gray-600 cursor-default'
                                                }`}
                                        >
                                            {label}
                                            {clickable && <ArrowRight size={11} />}
                                        </button>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    <p className="mt-6 text-[10px] leading-relaxed text-gray-600">
                        Educational explanation of a financial metric. Not investment advice, and not a
                        recommendation to buy or sell any security.
                    </p>
                </div>
            </motion.div>
        </motion.div>
    );
}

/* ----------------------------------------------------------------- provider */

export function MetricLearnProvider({ children }: { children: ReactNode }) {
    const [req, setReq] = useState<LessonRequest | null>(null);

    const open = useCallback((r: LessonRequest) => {
        if (LESSONS[r.term]) setReq(r);
    }, []);

    // Following a "read this next" chip keeps the stock in view and swaps in
    // that metric's own value, so the lesson stays about the same company.
    const navigate = useCallback((term: string) => {
        setReq(prev => ({
            term,
            value: prev?.values?.[term] ?? null,
            sector: prev?.sector,
            subject: prev?.subject,
            values: prev?.values,
        }));
    }, []);

    const ctx = useMemo(() => ({ open }), [open]);

    return (
        <Ctx.Provider value={ctx}>
            {children}
            {createPortal(
                <AnimatePresence>
                    {req && (
                        <LessonPanel
                            key={req.term}
                            req={req}
                            onClose={() => setReq(null)}
                            onNavigate={navigate}
                        />
                    )}
                </AnimatePresence>,
                document.body,
            )}
        </Ctx.Provider>
    );
}
