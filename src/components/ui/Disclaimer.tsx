import { AlertTriangle } from 'lucide-react';

/**
 * Site-wide legal disclaimer.
 *
 * `hero` — the large, unmissable version for the landing page and the app home.
 * `bar`  — a compact strip for the foot of inner pages.
 *
 * Deliberately not dismissible and not behind a toggle: a disclaimer only
 * protects you if a user cannot claim they never saw it.
 */

const POINTS = [
    ['Not investment advice.', 'Nothing on this site is a recommendation, solicitation or offer to buy or sell any security. We do not endorse, rate, favour or advise on any stock, sector or strategy.'],
    ['We are not your adviser.', 'MoneyMood.ai is not a SEBI-registered investment adviser, research analyst or broker. No content here is personalised to your circumstances, goals or risk tolerance.'],
    ['Scores and forecasts are not predictions.', 'Conviction scores, factor ranks, probability cones and long-term projections are the output of statistical models built on past data. They are illustrations of uncertainty, not forecasts of what will happen.'],
    ['Data may be wrong, delayed or incomplete.', 'Prices and fundamentals come from third-party sources and are provided as-is, without any warranty of accuracy, completeness or timeliness.'],
    ['Past performance says nothing about the future.', 'Historical returns, backtests and the simulated cases in Learn do not indicate future results.'],
    ['Simulated money only.', 'Paper trading and Try Trade in Time are educational simulations. No order is ever placed, and no trade reaches any broker or exchange.'],
    ['Your decisions are your own.', 'You are solely responsible for any investment decision you make and for any resulting profit or loss. Consult a SEBI-registered investment adviser and verify all figures independently before acting.'],
];

export function Disclaimer({ variant = 'hero' }: { variant?: 'hero' | 'bar' }) {
    if (variant === 'bar') {
        return (
            <div className="border-t border-amber-400/20 bg-amber-400/[0.04] px-6 py-4">
                <p className="max-w-5xl mx-auto text-[11px] leading-relaxed text-gray-400 flex items-start gap-2.5">
                    <AlertTriangle size={13} className="text-amber-400 mt-0.5 shrink-0" />
                    <span>
                        <span className="font-bold text-amber-300">Not investment advice.</span>{' '}
                        MoneyMood.ai is an educational tool and is not a SEBI-registered investment adviser,
                        research analyst or broker. We do not endorse or recommend any stock. Scores and
                        forecasts are model outputs, not predictions; data may be delayed or inaccurate.
                        All decisions and their consequences are yours alone.
                    </span>
                </p>
            </div>
        );
    }

    return (
        <section
            id="disclaimer"
            className="relative z-20 border-t border-amber-400/25 bg-[#12100a]"
            style={{ pointerEvents: 'auto' }}
        >
            <div className="max-w-5xl mx-auto px-6 py-14 md:py-20">
                <div className="flex items-center gap-3">
                    <AlertTriangle size={26} className="text-amber-400 shrink-0" />
                    <h2
                        className="font-bold text-amber-300 leading-none"
                        style={{ fontSize: 'clamp(1.6rem, 4.5vw, 3rem)', letterSpacing: '-0.02em' }}
                    >
                        This is not investment advice
                    </h2>
                </div>

                <p
                    className="text-gray-200 mt-6 leading-relaxed"
                    style={{ fontSize: 'clamp(1rem, 2vw, 1.35rem)' }}
                >
                    MoneyMood.ai is an <span className="text-white font-semibold">educational and informational tool</span>.
                    We do <span className="text-white font-semibold">not</span> endorse, recommend or advise on any stock,
                    and we are <span className="text-white font-semibold">not</span> a SEBI-registered investment adviser,
                    research analyst or broker. Nothing here is a recommendation to buy or sell anything.
                </p>

                <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5">
                    {POINTS.map(([head, body]) => (
                        <div key={head}>
                            <p className="text-sm font-bold text-amber-300">{head}</p>
                            <p className="text-sm text-gray-400 leading-relaxed mt-1">{body}</p>
                        </div>
                    ))}
                </div>

                <p className="text-xs text-gray-500 mt-10 leading-relaxed border-t border-white/10 pt-6">
                    Investments in securities are subject to market risk, including the possible loss of the
                    principal amount invested. Read all scheme- and instrument-related documents carefully.
                    By using this site you accept that MoneyMood.ai and its authors carry no liability for any
                    loss or damage arising from your use of, or reliance on, anything published here.
                </p>
            </div>
        </section>
    );
}
