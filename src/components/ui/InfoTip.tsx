import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { GLOSSARY } from '../../lib/glossary';
import { LESSONS, zoneFor, formatValue, TONE_CLASS } from '../../lib/metricEducation';
import { useMetricLearn, hasLesson } from './MetricLearn';

/**
 * Hoverable help icon that explains a technical term in plain English.
 *
 * Two depths, so a learner chooses how far to go without leaving the page:
 *   hover → the one-line definition, plus a verdict on this stock's own value
 *           when one is supplied;
 *   click → the full lesson (bands, real-market percentile, traps, what to
 *           read next), for any metric that has one in metricEducation.ts.
 *
 * Usage: <InfoTip term="pe" />
 *        <InfoTip term="pe" value={f.pe} sector={f.sector} subject={f.name} />
 */
export function InfoTip({
    term, size = 12, value, sector, subject, values,
}: {
    term: string;
    size?: number;
    /** The stock's own value, in the raw stored scale. */
    value?: number | null;
    sector?: string | null;
    subject?: string | null;
    /** All of this stock's metric values, so the lesson can move between them. */
    values?: Record<string, number | null | undefined>;
}) {
    const [open, setOpen] = useState(false);
    const { open: openLesson } = useMetricLearn();

    const text = GLOSSARY[term];
    const lesson = LESSONS[term];
    const teachable = hasLesson(term);
    if (!text && !lesson) return null;

    const zone = lesson ? zoneFor(lesson, value) : null;

    return (
        <span
            className="relative inline-flex items-center align-middle ml-1 pointer-events-auto"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
        >
            <HelpCircle
                size={size}
                role={teachable ? 'button' : undefined}
                aria-label={teachable ? `Learn about ${lesson.name}` : undefined}
                onClick={teachable ? (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    openLesson({ term, value, sector, subject, values });
                } : undefined}
                className={`transition-colors ${teachable
                    ? 'text-gray-500 hover:text-[var(--teal)] cursor-pointer'
                    : 'text-gray-600 hover:text-[var(--teal)] cursor-help'
                    }`}
            />
            {open && (
                <span
                    className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64
                               rounded-xl border border-[var(--teal)]/20 bg-[#0b1020]/98 p-3
                               text-[11px] leading-relaxed text-gray-300 shadow-2xl
                               backdrop-blur-md normal-case font-normal tracking-normal text-left"
                    style={{ pointerEvents: 'none' }}
                >
                    {text ?? lesson.plain}

                    {zone && (
                        <span className="mt-2 block border-t border-white/10 pt-2">
                            <span className="text-white font-semibold">{formatValue(lesson, value)}</span>
                            <span className={`ml-1.5 font-semibold ${TONE_CLASS[zone.tone]}`}>
                                {zone.label}
                            </span>
                        </span>
                    )}

                    {teachable && (
                        <span className="mt-2 block text-[10px] text-[var(--teal)]">
                            Click to learn how to read it →
                        </span>
                    )}

                    <span className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-[#0b1020]" />
                </span>
            )}
        </span>
    );
}
