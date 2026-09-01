// Experiential metric education.
//
// GLOSSARY (glossary.ts) answers "what is this?" in one hover. This file is the
// layer underneath: what a value actually means, where it stops being healthy,
// how it misleads, and which metric to read next so the learner never judges a
// company on a single number.
//
// Keys match the `term` strings used by <InfoTip term="..."/>, so any metric
// already carrying a tooltip gains a full lesson without touching its call site.
//
// Zone thresholds are teaching heuristics — deliberate, arguable judgments.
// The live percentile band shown beside them comes from
// /api/metrics/distributions, i.e. the real NSE universe as it stands today.
// Keeping the two visually separate is the point: opinion is labelled opinion.

export type Tone = 'good' | 'ok' | 'warn' | 'bad' | 'neutral';

/** How the raw stored value should be read. */
export type Scale = 'percent' | 'x' | 'raw';

export interface Zone {
    /** Upper bound of this zone in the RAW stored scale. `null` = open-ended. */
    upTo: number | null;
    label: string;
    tone: Tone;
    /** What a value in this band is actually telling you. */
    meaning: string;
}

export interface MetricLesson {
    name: string;
    /** One line, everyday words, no jargon. */
    plain: string;
    /** Why a buyer should care. */
    why: string;
    /** Formula in words, not symbols. */
    formula?: string;
    scale: Scale;
    /** Which way is "better" — or `null` when it is genuinely a band. */
    direction: 'higher' | 'lower' | 'band' | null;
    /** Key in the /api/metrics/distributions payload. */
    distributionKey?: string;
    zones: Zone[];
    /** How to actually use it. */
    rules: string[];
    /** Where it lies to you. */
    traps: string[];
    /** Read these next — teaches that no metric stands alone. */
    pairsWith: string[];
    /** Why the "good range" moves between industries. */
    sectorNote?: string;
}

export const LESSONS: Record<string, MetricLesson> = {
    // ---------------------------------------------------------------- valuation
    pe: {
        name: 'P/E Ratio',
        plain: 'How many rupees you pay for one rupee of the company\'s yearly profit.',
        why: 'It is the fastest read on whether the market already expects a lot from this company. A high P/E is not "bad" — it is a bill for optimism that future profits have to pay.',
        formula: 'Share price ÷ profit per share over the last 12 months',
        scale: 'x',
        direction: 'lower',
        distributionKey: 'pe',
        zones: [
            { upTo: 0, label: 'Loss-making', tone: 'bad', meaning: 'No P/E exists — the company lost money. Judge it on revenue growth and cash burn instead.' },
            { upTo: 12, label: 'Cheap', tone: 'good', meaning: 'You are paying little for current profits. Either a genuine bargain or the market expects those profits to shrink. Find out which before assuming the former.' },
            { upTo: 25, label: 'Reasonable', tone: 'good', meaning: 'Around the middle of the Indian market. Normal for a steady business growing at a normal pace.' },
            { upTo: 45, label: 'Rich', tone: 'ok', meaning: 'Priced for real growth. Fine if earnings are compounding fast — expensive if they are not. Check the growth rate.' },
            { upTo: null, label: 'Very expensive', tone: 'warn', meaning: 'The price assumes years of exceptional growth. If growth merely slows, the fall can be severe even when the business is still fine.' },
        ],
        rules: [
            'P/E only means something against a comparison: the same company\'s history, or direct competitors in the same industry.',
            'Pair it with growth. A P/E of 40 on 40% growth is cheaper in substance than a P/E of 15 on no growth — that is exactly what PEG measures.',
            'A falling P/E is not automatically good news. Check whether the price fell or the earnings rose.',
        ],
        traps: [
            'One-off gains — selling land, a tax writeback — inflate profit and make P/E look deceptively low for a year.',
            'Cyclical businesses (metals, cement, sugar) look cheapest at the top of their cycle, when profits peak just before they fall.',
            'A very low P/E often means the market knows something: pending litigation, a promoter issue, a business in structural decline.',
        ],
        pairsWith: ['peg', 'earnings_growth', 'roe', 'debt_to_equity'],
        sectorNote: 'IT and consumer companies normally carry higher P/Es than banks or commodity producers. Compare within a sector, never across.',
    },

    forward_pe: {
        name: 'Forward P/E',
        plain: 'The same P/E, but using what analysts think the company will earn next year.',
        why: 'It tells you what the market is paying for expected profits rather than past ones — closer to how the price is actually being set.',
        formula: 'Share price ÷ forecast profit per share for next year',
        scale: 'x',
        direction: 'lower',
        distributionKey: 'forward_pe',
        zones: [
            { upTo: 0, label: 'Losses expected', tone: 'bad', meaning: 'Analysts expect the company to stay unprofitable next year.' },
            { upTo: 12, label: 'Cheap', tone: 'good', meaning: 'Low price against expected profits — worth asking why the market is sceptical.' },
            { upTo: 25, label: 'Reasonable', tone: 'good', meaning: 'Broadly in line with the market.' },
            { upTo: 45, label: 'Rich', tone: 'ok', meaning: 'Growth is already in the price.' },
            { upTo: null, label: 'Very expensive', tone: 'warn', meaning: 'Priced for a large jump in profits that has not happened yet.' },
        ],
        rules: [
            'Forward P/E below trailing P/E means profits are expected to grow. Above it means they are expected to fall.',
            'The gap between the two is often more informative than either number alone.',
        ],
        traps: [
            'These are forecasts, and analyst forecasts are optimistic more often than not — especially for smaller companies.',
            'Coverage on mid- and small-caps in India is thin, so a forward P/E may rest on one or two estimates.',
        ],
        pairsWith: ['pe', 'earnings_growth', 'peg'],
    },

    peg: {
        name: 'PEG Ratio',
        plain: 'P/E divided by the growth rate — it asks whether the growth justifies the price.',
        why: 'This is the metric that resolves the "expensive vs cheap" argument. It lets a fast-growing company at a high P/E be correctly identified as better value than a stagnant one at a low P/E.',
        formula: 'P/E ÷ annual earnings growth rate (as a whole number, so 20% growth is 20)',
        scale: 'x',
        direction: 'lower',
        distributionKey: 'peg',
        zones: [
            { upTo: 0, label: 'Not meaningful', tone: 'neutral', meaning: 'Growth is negative or absent, so the ratio has no interpretation. Ignore it here.' },
            { upTo: 1, label: 'Growth looks underpriced', tone: 'good', meaning: 'You are paying less than one unit of P/E per unit of growth — the classic value-plus-growth signal. Verify the growth is durable, not a one-year rebound.' },
            { upTo: 1.5, label: 'Fair', tone: 'good', meaning: 'Price and growth are roughly in balance. This is the GARP zone.' },
            { upTo: 2.5, label: 'Paying up', tone: 'ok', meaning: 'You are paying a premium over the growth rate — sometimes justified for a very high-quality, predictable business.' },
            { upTo: null, label: 'Expensive for the growth', tone: 'warn', meaning: 'The price is far ahead of the growth supporting it.' },
        ],
        rules: [
            'PEG near or below 1 is the traditional bar, but it is a rule of thumb, not a law.',
            'It is only as good as the growth number inside it. A PEG built on one exceptional year is meaningless.',
            'Prefer growth averaged over several years to a single trailing figure.',
        ],
        traps: [
            'Recovering from a bad year produces enormous percentage growth and an artificially tiny PEG.',
            'Yahoo does not report PEG for most Indian listings, so it is often computed here from P/E and earnings growth — treat missing values as missing, not as zero.',
            'Very stable, slow-growing businesses (utilities, large banks) will always look bad on PEG. That does not make them bad investments.',
        ],
        pairsWith: ['pe', 'earnings_growth', 'garp', 'roe'],
    },

    pb: {
        name: 'Price-to-Book',
        plain: 'Price compared with the company\'s net worth on paper — what it owns minus what it owes.',
        why: 'For banks and asset-heavy businesses, book value is a meaningful floor, which makes P/B a better yardstick than P/E.',
        formula: 'Share price ÷ net assets per share',
        scale: 'x',
        direction: 'lower',
        distributionKey: 'pb',
        zones: [
            { upTo: 1, label: 'Below book value', tone: 'ok', meaning: 'The market values the company at less than its accounting net worth. Occasionally a real bargain, more often a signal that those assets are not earning enough.' },
            { upTo: 3, label: 'Normal', tone: 'good', meaning: 'A typical range for a profitable business.' },
            { upTo: 8, label: 'Premium', tone: 'ok', meaning: 'The market is paying well above book — usually for brand, technology or returns that the balance sheet does not capture.' },
            { upTo: null, label: 'Very high', tone: 'warn', meaning: 'Book value has stopped being a useful anchor. Judge on profitability and cash generation instead.' },
        ],
        rules: [
            'Read P/B together with ROE. High ROE justifies high P/B — a company earning 25% on its equity should trade well above book.',
            'Most useful for banks, insurers and manufacturers. Close to useless for software and services firms whose value is people, not assets.',
        ],
        traps: [
            'Book value is an accounting figure. Old property carried at decades-old cost understates it; goodwill from overpriced acquisitions overstates it.',
            'A P/B under 1 in a struggling company is not a floor — book value itself can fall as losses accumulate.',
        ],
        pairsWith: ['roe', 'pe', 'debt_to_equity'],
        sectorNote: 'Banks typically trade between 0.5× and 4× book depending on their returns. Asset-light IT firms routinely trade above 8× and that is normal for them.',
    },

    dividend_yield: {
        name: 'Dividend Yield',
        plain: 'The cash a company pays you each year, as a percentage of the share price.',
        why: 'It is the part of your return that arrives whatever the share price does — and a signal about how the company sees its own growth prospects.',
        formula: 'Annual dividend per share ÷ share price',
        scale: 'percent',
        direction: 'higher',
        distributionKey: 'dividend_yield',
        zones: [
            { upTo: 0.005, label: 'Little or none', tone: 'neutral', meaning: 'Profits are being reinvested rather than paid out. Entirely appropriate for a genuinely growing company.' },
            { upTo: 0.02, label: 'Modest', tone: 'ok', meaning: 'A token payout alongside reinvestment — the most common pattern in India.' },
            { upTo: 0.05, label: 'Healthy income', tone: 'good', meaning: 'A meaningful cash return, typical of mature and steadily profitable businesses.' },
            { upTo: 0.08, label: 'High', tone: 'ok', meaning: 'Generous. Check that profits actually cover it and that the price has not simply collapsed.' },
            { upTo: null, label: 'Suspiciously high', tone: 'warn', meaning: 'Yields this high usually mean the price has fallen sharply, or a one-off special dividend is inflating the figure. Rarely repeatable.' },
        ],
        rules: [
            'Yield rises when the price falls. Always check which of the two moved.',
            'A dividend is only as reliable as the profit behind it — compare the payout with earnings.',
            'For income, consistency across years matters far more than the size of any single year\'s yield.',
        ],
        traps: [
            'Special or one-time dividends make the trailing yield look permanent when it is not.',
            'A "high yield" screen reliably surfaces companies in decline — the yield is high precisely because the market is pricing trouble.',
        ],
        pairsWith: ['profit_margin', 'roe', 'debt_to_equity', 'earnings_growth'],
    },

    // ------------------------------------------------------------ profitability
    roe: {
        name: 'Return on Equity',
        plain: 'How much profit the company makes on every rupee that shareholders have put in.',
        why: 'It is the single clearest measure of whether management turns your capital into more capital. Sustained high ROE is what makes long-term compounding possible.',
        formula: 'Net profit ÷ shareholders\' equity',
        scale: 'percent',
        direction: 'higher',
        distributionKey: 'roe',
        zones: [
            { upTo: 0, label: 'Losing money', tone: 'bad', meaning: 'The company is destroying shareholder capital rather than growing it.' },
            { upTo: 0.08, label: 'Weak', tone: 'warn', meaning: 'Returns are near or below what a fixed deposit pays, for far more risk.' },
            { upTo: 0.15, label: 'Adequate', tone: 'ok', meaning: 'Respectable but unremarkable — roughly the Indian market\'s middle.' },
            { upTo: 0.25, label: 'Strong', tone: 'good', meaning: 'The company earns well on its capital. This is the range good compounders live in.' },
            { upTo: null, label: 'Exceptional', tone: 'good', meaning: 'Outstanding — but check whether heavy debt or a small equity base is flattering it.' },
        ],
        rules: [
            'Consistency matters more than any one year. Five years of steady 18% beats one spike to 40%.',
            'Always check debt alongside it: borrowing shrinks the equity base and mechanically lifts ROE without improving the business.',
            'ROE above 15% sustained for years is the hallmark of a business with a genuine competitive advantage.',
        ],
        traps: [
            'Heavy buybacks shrink equity and inflate ROE without any operational improvement.',
            'A company with tiny equity and large debt can post a spectacular ROE while being fragile.',
            'Compare with ROA — a wide gap between the two is leverage, not skill.',
        ],
        pairsWith: ['roa', 'debt_to_equity', 'profit_margin', 'pb'],
        sectorNote: 'Banks run structurally lower ROE than consumer brands because they are leveraged by design. Judge a bank against banks.',
    },

    roa: {
        name: 'Return on Assets',
        plain: 'Profit earned on every rupee of assets the company controls, borrowed money included.',
        why: 'It strips out the flattery of debt. Where ROE can be inflated by borrowing, ROA shows how productive the underlying business really is.',
        formula: 'Net profit ÷ total assets',
        scale: 'percent',
        direction: 'higher',
        distributionKey: 'roa',
        zones: [
            { upTo: 0, label: 'Losing money', tone: 'bad', meaning: 'Assets are producing losses.' },
            { upTo: 0.03, label: 'Low', tone: 'warn', meaning: 'Thin returns on the asset base — normal for banks, a concern for most other businesses.' },
            { upTo: 0.10, label: 'Decent', tone: 'ok', meaning: 'Reasonable productivity from the assets employed.' },
            { upTo: null, label: 'Strong', tone: 'good', meaning: 'The business generates a lot of profit per rupee of assets, usually a sign of an asset-light or high-margin model.' },
        ],
        rules: [
            'Read it next to ROE. Similar values mean little debt; a large gap means the returns are leverage-driven.',
            'Only compare within an industry — a bank and a software firm are not on the same scale.',
        ],
        traps: [
            'Banks and NBFCs sit at 1–2% by the nature of their model. That is not weakness.',
        ],
        pairsWith: ['roe', 'debt_to_equity', 'profit_margin'],
    },

    profit_margin: {
        name: 'Net Profit Margin',
        plain: 'Out of every ₹100 of sales, how much finally remains as profit.',
        why: 'It shows pricing power and cost discipline. Companies that keep more of each sale can survive downturns that wipe out thin-margin rivals.',
        formula: 'Net profit ÷ revenue',
        scale: 'percent',
        direction: 'higher',
        distributionKey: 'profit_margin',
        zones: [
            { upTo: 0, label: 'Loss-making', tone: 'bad', meaning: 'Sales do not cover costs.' },
            { upTo: 0.05, label: 'Thin', tone: 'warn', meaning: 'Very little cushion — a small rise in costs can erase the profit entirely. Normal in retail and distribution.' },
            { upTo: 0.15, label: 'Healthy', tone: 'ok', meaning: 'A solid, typical margin for a well-run business.' },
            { upTo: 0.30, label: 'Strong', tone: 'good', meaning: 'Real pricing power or a genuine cost advantage.' },
            { upTo: null, label: 'Exceptional', tone: 'good', meaning: 'Unusually profitable. Worth understanding what protects it, and whether that protection lasts.' },
        ],
        rules: [
            'The trend matters more than the level. A margin widening over three years says more than a single high number.',
            'Compare only within an industry — a jeweller and a software firm have structurally different margins.',
        ],
        traps: [
            'One-off items (asset sales, tax refunds, insurance payouts) inflate net margin for a single year. Operating margin is the steadier read.',
        ],
        pairsWith: ['operating_margin', 'roe', 'revenue_growth'],
        sectorNote: 'Software routinely clears 20%. Grocery retail lives near 2%. Both can be excellent businesses.',
    },

    operating_margin: {
        name: 'Operating Margin',
        plain: 'Profit from the core business before interest and tax, per ₹100 of sales.',
        why: 'It isolates how well the actual operation runs, before financing decisions and tax accounting muddy the picture.',
        formula: 'Operating profit ÷ revenue',
        scale: 'percent',
        direction: 'higher',
        distributionKey: 'operating_margin',
        zones: [
            { upTo: 0, label: 'Core business losing money', tone: 'bad', meaning: 'The operation itself is unprofitable, before any financing costs.' },
            { upTo: 0.08, label: 'Thin', tone: 'warn', meaning: 'Little room for error in the core operation.' },
            { upTo: 0.20, label: 'Healthy', tone: 'ok', meaning: 'The core business is solidly profitable.' },
            { upTo: null, label: 'Strong', tone: 'good', meaning: 'Efficient operations with meaningful pricing power.' },
        ],
        rules: [
            'A wide gap between operating and net margin points to heavy interest costs — check debt.',
            'More reliable than net margin for year-on-year comparison, because it excludes one-offs.',
        ],
        traps: [
            'Companies differ in what they classify as operating cost, so cross-company comparison is rougher than it looks.',
        ],
        pairsWith: ['profit_margin', 'debt_to_equity', 'revenue_growth'],
    },

    // -------------------------------------------------------------------- growth
    earnings_growth: {
        name: 'Earnings Growth',
        plain: 'How much the company\'s profit grew compared with the same period a year ago.',
        why: 'Over long horizons, share prices follow earnings. Growth in profit is the engine; almost everything else is a way of pricing that engine.',
        formula: 'This year\'s profit ÷ last year\'s profit − 1',
        scale: 'percent',
        direction: 'higher',
        distributionKey: 'earnings_growth',
        zones: [
            { upTo: -0.10, label: 'Shrinking', tone: 'bad', meaning: 'Profits are falling. Establish whether this is a cyclical dip or a structural decline before anything else.' },
            { upTo: 0.05, label: 'Flat', tone: 'warn', meaning: 'Little growth. The company may be mature, or losing ground.' },
            { upTo: 0.15, label: 'Steady', tone: 'ok', meaning: 'Growing at roughly the pace of the broader economy.' },
            { upTo: 0.35, label: 'Fast', tone: 'good', meaning: 'Clearly outgrowing the market. Check that it is not simply a rebound from a weak base.' },
            { upTo: null, label: 'Very fast', tone: 'ok', meaning: 'Exceptional growth — rarely sustainable at this rate. The key question is what it settles at.' },
        ],
        rules: [
            'Always ask what the comparison year looked like. Growth off a collapsed base is arithmetic, not achievement.',
            'Growth in profit should be supported by growth in revenue. Profit rising while sales stall means cost-cutting, which has a floor.',
            'Multi-year growth is far more informative than a single year.',
        ],
        traps: [
            'The single most common beginner error: extrapolating one exceptional year into the future. High growth rates decay towards the economy\'s rate — reliably, across every market ever studied.',
            'Accounting changes and acquisitions can manufacture growth that is not organic.',
        ],
        pairsWith: ['revenue_growth', 'peg', 'pe', 'roe'],
    },

    revenue_growth: {
        name: 'Revenue Growth',
        plain: 'How much more the company sold compared with a year ago.',
        why: 'Sales growth is harder to manufacture than profit growth. It shows real demand rather than accounting or cost control.',
        formula: 'This year\'s revenue ÷ last year\'s revenue − 1',
        scale: 'percent',
        direction: 'higher',
        distributionKey: 'revenue_growth',
        zones: [
            { upTo: -0.05, label: 'Shrinking', tone: 'bad', meaning: 'The company is selling less than a year ago — demand or market share is going the wrong way.' },
            { upTo: 0.08, label: 'Slow', tone: 'warn', meaning: 'Below inflation-plus-growth, so barely moving in real terms.' },
            { upTo: 0.20, label: 'Solid', tone: 'good', meaning: 'Healthy expansion in line with or ahead of the economy.' },
            { upTo: null, label: 'Rapid', tone: 'good', meaning: 'Strong demand. Check whether margins are holding as it scales.' },
        ],
        rules: [
            'Compare revenue growth with earnings growth. Profit growing faster is margin expansion; slower is margin pressure.',
            'Sustained revenue growth with stable margins is the healthiest pattern a business can show.',
        ],
        traps: [
            'Growth bought through acquisitions is not the same as growth from the existing business.',
            'Revenue can be grown by discounting, which shows up later as collapsing margins.',
        ],
        pairsWith: ['earnings_growth', 'operating_margin', 'profit_margin'],
    },

    // --------------------------------------------------------- financial health
    debt_to_equity: {
        name: 'Debt-to-Equity',
        plain: 'For every rupee shareholders have put in, how many rupees the company has borrowed.',
        why: 'Debt magnifies both directions. It lifts returns in good years and is the most common single reason companies fail in bad ones.',
        formula: 'Total borrowings ÷ shareholders\' equity',
        scale: 'x',
        direction: 'lower',
        distributionKey: 'debt_to_equity',
        zones: [
            { upTo: 0.25, label: 'Very low debt', tone: 'good', meaning: 'A conservative balance sheet with plenty of room to survive a downturn or fund growth.' },
            { upTo: 1, label: 'Comfortable', tone: 'good', meaning: 'Borrowings are smaller than the equity base — a normal, manageable structure.' },
            { upTo: 2, label: 'Leveraged', tone: 'ok', meaning: 'Meaningful debt. Sustainable while profits and interest rates cooperate, punishing when they do not.' },
            { upTo: null, label: 'Heavily indebted', tone: 'warn', meaning: 'Borrowings far exceed equity. The business now has to perform simply to service its lenders. Fragile if earnings dip.' },
        ],
        rules: [
            'Judge it against the industry. Infrastructure, real estate and utilities carry structurally higher debt than consumer or software firms.',
            'A rising trend matters more than the absolute level — debt growing faster than profit is the pattern that precedes trouble.',
            'Banks and financial companies are excluded from this logic entirely; borrowing is their raw material.',
        ],
        traps: [
            'Some balance-sheet debt sits off the main line — leases, guarantees, related-party loans. The ratio can understate real obligations.',
            'Low debt is not automatically good. A company that could profitably borrow and does not may be under-using its opportunity.',
        ],
        pairsWith: ['current_ratio', 'roe', 'roa', 'operating_margin'],
    },

    current_ratio: {
        name: 'Current Ratio',
        plain: 'Whether the company has enough short-term assets to cover its short-term bills.',
        why: 'Companies rarely fail because they are unprofitable. They fail because they run out of cash to pay what is due this quarter.',
        formula: 'Assets convertible to cash within a year ÷ liabilities due within a year',
        scale: 'x',
        direction: 'higher',
        distributionKey: 'current_ratio',
        zones: [
            { upTo: 1, label: 'Tight', tone: 'warn', meaning: 'Short-term bills exceed short-term assets. Workable for businesses with fast cash cycles, a warning sign elsewhere.' },
            { upTo: 2, label: 'Comfortable', tone: 'good', meaning: 'Enough near-term assets to cover near-term obligations.' },
            { upTo: 4, label: 'Very liquid', tone: 'good', meaning: 'Plenty of cushion.' },
            { upTo: null, label: 'Possibly idle', tone: 'ok', meaning: 'Unusually high. Sometimes prudence, sometimes cash and inventory sitting unproductive.' },
        ],
        rules: [
            'Read alongside debt. Low debt plus a healthy current ratio is the strongest balance-sheet combination.',
        ],
        traps: [
            'Inventory counts as a current asset but may not be sellable at book value — a distributor with unsold stock looks liquid on paper.',
        ],
        pairsWith: ['debt_to_equity', 'profit_margin'],
    },

    // ---------------------------------------------------------------------- risk
    beta: {
        name: 'Beta',
        plain: 'How violently this stock tends to move when the whole market moves.',
        why: 'It tells you what kind of ride to expect. A beta of 1.5 means roughly 15% moves when the market moves 10% — in both directions.',
        formula: 'How the stock\'s returns have historically tracked NIFTY 50\'s returns',
        scale: 'raw',
        direction: 'band',
        distributionKey: 'beta',
        zones: [
            { upTo: 0.7, label: 'Defensive', tone: 'good', meaning: 'Moves less than the market. Typically utilities, FMCG and pharma — steadier in falls, slower in rallies.' },
            { upTo: 1.2, label: 'Market-like', tone: 'ok', meaning: 'Broadly tracks the index.' },
            { upTo: 1.8, label: 'Aggressive', tone: 'ok', meaning: 'Amplifies the market. Larger gains in rallies, larger losses in corrections.' },
            { upTo: null, label: 'Highly volatile', tone: 'warn', meaning: 'Swings far more than the market. Position sizes should reflect that.' },
        ],
        rules: [
            'Beta is neither good nor bad — it is a description of volatility, which you choose to accept or not.',
            'It measures only market-linked risk. Company-specific risk (a fraud, a lost contract) is invisible to it.',
            'Match beta to your own tolerance: if a 30% drawdown would make you sell at the bottom, high beta will hurt you regardless of the analysis.',
        ],
        traps: [
            'Beta is backward-looking and drifts. A stock\'s past sensitivity is not a promise about its future.',
            'Illiquid small-caps often show artificially low beta simply because they trade infrequently, not because they are safe.',
        ],
        pairsWith: ['volatility', 'sharpe', 'alpha', 'capm'],
    },

    volatility: {
        name: 'Volatility',
        plain: 'How widely the price swings around over a year.',
        why: 'It sets the realistic width of outcomes. A 45% volatility stock can plausibly be a third lower or higher a year from now without anything unusual happening.',
        formula: 'Annualised standard deviation of daily returns',
        scale: 'percent',
        direction: 'lower',
        distributionKey: 'volatility',
        zones: [
            { upTo: 0.20, label: 'Calm', tone: 'good', meaning: 'Steady price behaviour — usually large, established companies.' },
            { upTo: 0.35, label: 'Normal', tone: 'ok', meaning: 'Typical for an Indian large- or mid-cap.' },
            { upTo: 0.55, label: 'Choppy', tone: 'ok', meaning: 'Large swings are routine here. Expect uncomfortable stretches.' },
            { upTo: null, label: 'Wild', tone: 'warn', meaning: 'Very large swings. Frequently small-caps or companies in distress or speculative favour.' },
        ],
        rules: [
            'Historically, calmer stocks have delivered better risk-adjusted returns than wild ones — the "low-volatility anomaly".',
            'Volatility is the honest input to any forecast: it is what makes a range a range instead of a point.',
        ],
        traps: [
            'Low past volatility does not mean low risk. It can simply mean nothing has tested the business yet.',
        ],
        pairsWith: ['beta', 'sharpe', 'low_vol'],
    },

    sharpe: {
        name: 'Sharpe Ratio',
        plain: 'How much return the stock delivered for each unit of the turbulence you had to sit through.',
        why: 'Return alone is not a result — return per unit of risk is. Two stocks up 20% are not equivalent if one did it smoothly and the other halved along the way.',
        formula: '(Return − risk-free rate) ÷ volatility',
        scale: 'raw',
        direction: 'higher',
        distributionKey: 'sharpe',
        zones: [
            { upTo: 0, label: 'Negative', tone: 'bad', meaning: 'Underperformed a government bond while carrying equity risk. You were not paid for the risk taken.' },
            { upTo: 0.5, label: 'Weak', tone: 'warn', meaning: 'Modest reward for the volatility endured.' },
            { upTo: 1, label: 'Decent', tone: 'ok', meaning: 'A reasonable return for the risk.' },
            { upTo: 2, label: 'Strong', tone: 'good', meaning: 'Good returns without proportionate turbulence.' },
            { upTo: null, label: 'Exceptional', tone: 'good', meaning: 'Rare over long periods. Check the measurement window before believing it persists.' },
        ],
        rules: [
            'Only compare Sharpe ratios measured over the same period — it is highly sensitive to the window chosen.',
            'A single year of high Sharpe is mostly luck. Consistency across years is the signal.',
        ],
        traps: [
            'It treats upside and downside swings identically, so it penalises a stock for rising sharply.',
        ],
        pairsWith: ['volatility', 'beta', 'alpha', 'treynor'],
    },

    alpha: {
        name: "Jensen's Alpha",
        plain: 'How much the stock beat — or missed — what its risk level alone would have predicted.',
        why: 'It separates genuine outperformance from simply having taken more risk in a rising market. A high-beta stock in a bull run should go up; alpha asks whether it did better than that.',
        formula: 'Actual return − the return CAPM says its beta deserved',
        scale: 'percent',
        direction: 'higher',
        distributionKey: 'alpha',
        zones: [
            { upTo: -0.05, label: 'Lagging', tone: 'warn', meaning: 'Delivered less than its risk level warranted.' },
            { upTo: 0.05, label: 'In line', tone: 'ok', meaning: 'Roughly what its risk profile would predict.' },
            { upTo: 0.20, label: 'Outperforming', tone: 'good', meaning: 'Beat its risk-adjusted benchmark meaningfully.' },
            { upTo: null, label: 'Strongly outperforming', tone: 'good', meaning: 'Large excess return. Worth understanding the cause before assuming it repeats.' },
        ],
        rules: [
            'Alpha is measured over a specific past window. It describes what happened, and does not forecast what will.',
            'Persistent positive alpha across several years is far more meaningful than one strong stretch.',
        ],
        traps: [
            'Past alpha is a notoriously weak predictor of future alpha — this is one of the most replicated findings in finance.',
        ],
        pairsWith: ['beta', 'capm', 'sharpe', 'momentum'],
    },

    rsi: {
        name: 'RSI',
        plain: 'A 0–100 gauge of how one-sided recent price moves have been.',
        why: 'It flags when a move has become stretched in one direction, which sometimes precedes a pause or a bounce.',
        formula: 'Average size of gains vs losses over the last 14 trading days',
        scale: 'raw',
        direction: 'band',
        distributionKey: 'rsi',
        zones: [
            { upTo: 30, label: 'Oversold', tone: 'ok', meaning: 'Heavy recent selling. Sometimes a bounce sets up here — but a falling knife also reads as oversold all the way down.' },
            { upTo: 45, label: 'Weak', tone: 'neutral', meaning: 'Sellers have had the upper hand recently.' },
            { upTo: 55, label: 'Neutral', tone: 'neutral', meaning: 'Buying and selling pressure roughly balanced.' },
            { upTo: 70, label: 'Strong', tone: 'neutral', meaning: 'Buyers in control, without being stretched.' },
            { upTo: null, label: 'Overbought', tone: 'ok', meaning: 'A sharp run-up. Often cools off — though strong stocks can stay overbought for months.' },
        ],
        rules: [
            'RSI is about timing, never about whether a business is worth owning.',
            'In a strong trend it stays pinned at an extreme far longer than beginners expect. "Overbought" is not a sell signal on its own.',
        ],
        traps: [
            'Treating RSI below 30 as an automatic buy is the most common way beginners catch falling knives.',
        ],
        pairsWith: ['macd', 'ma200', 'momentum'],
    },

    momentum: {
        name: '12-1 Momentum',
        plain: 'How the stock performed over the past year, ignoring the most recent month.',
        why: 'One of the most persistent patterns across global markets: stocks that have done well over roughly a year tend to keep doing well over the following months.',
        formula: 'Price change from 12 months ago to 1 month ago',
        scale: 'percent',
        direction: 'higher',
        distributionKey: 'momentum',
        zones: [
            { upTo: -0.10, label: 'Downtrend', tone: 'warn', meaning: 'Sustained decline over the past year.' },
            { upTo: 0.10, label: 'Flat', tone: 'neutral', meaning: 'Going sideways.' },
            { upTo: 0.40, label: 'Uptrend', tone: 'good', meaning: 'A solid advance over the year.' },
            { upTo: null, label: 'Strong uptrend', tone: 'good', meaning: 'A large run. Powerful while it lasts, and momentum reversals are abrupt when they come.' },
        ],
        rules: [
            'The most recent month is deliberately skipped, because very short-term moves tend to reverse.',
            'Momentum works on averages across many stocks. On any single stock it is a tendency, not a rule.',
        ],
        traps: [
            'Momentum crashes hard at market turning points — it is the factor that hurts most when the market reverses.',
        ],
        pairsWith: ['rsi', 'alpha', 'pct_52w_high'],
    },

    // -------------------------------------------------------------- composites
    garp: {
        name: 'GARP',
        plain: 'Growth At a Reasonable Price — a company growing decently that you are not overpaying for.',
        why: 'It is the middle ground between two ways of losing money: buying cheap companies that deserve to be cheap, and buying great companies at any price.',
        scale: 'raw',
        direction: null,
        zones: [],
        rules: [
            'The test used here is earnings growth of at least 10% together with a PEG of 1.5 or below.',
            'GARP deliberately excludes both extremes: the stagnant bargain and the flawless story priced for perfection.',
            'It is a starting filter, not a conclusion. It says the price and growth are compatible — not that the business is good.',
        ],
        traps: [
            'A GARP flag built on one unusual growth year is unreliable. Check whether the growth is repeatable.',
            'Quality is not part of the test. Always check debt and returns on capital before treating a GARP flag as reassuring.',
        ],
        pairsWith: ['peg', 'earnings_growth', 'pe', 'roe'],
    },

    conviction: {
        name: 'Conviction Score',
        plain: 'A 0–100 summary of how this stock ranks against the market on four evidence-backed factors.',
        why: 'It compresses alpha, risk-adjusted return, momentum and stability into one comparable number, so a 2,000-stock universe becomes sortable.',
        scale: 'raw',
        direction: 'higher',
        distributionKey: 'score',
        zones: [
            { upTo: 30, label: 'Weak profile', tone: 'warn', meaning: 'Ranks poorly against the universe on most factors.' },
            { upTo: 50, label: 'Below average', tone: 'neutral', meaning: 'Mixed, with more weak factors than strong ones.' },
            { upTo: 70, label: 'Above average', tone: 'ok', meaning: 'Ranks respectably across the factor set.' },
            { upTo: null, label: 'Strong profile', tone: 'good', meaning: 'Ranks highly on most factors simultaneously.' },
        ],
        rules: [
            'It is built entirely from past price behaviour and risk statistics — it knows nothing about the business, its management or its industry.',
            'Use it to shorten a list worth researching, never as the research itself.',
            'Because it is percentile-based, it says how a stock ranks against others, not whether it is objectively good.',
        ],
        traps: [
            'Every input is backward-looking. A high score describes what has already happened.',
            'It carries no valuation input, so an expensive stock can score highly on momentum alone.',
        ],
        pairsWith: ['alpha', 'treynor', 'momentum', 'low_vol'],
    },
};

/** Which zone a raw value falls into. */
export function zoneFor(lesson: MetricLesson, value: number | null | undefined): Zone | null {
    if (value == null || !Number.isFinite(value) || lesson.zones.length === 0) return null;
    for (const z of lesson.zones) {
        if (z.upTo === null || value < z.upTo) return z;
    }
    return lesson.zones[lesson.zones.length - 1];
}

/** Format a raw value the way its metric should read. */
export function formatValue(lesson: MetricLesson, value: number | null | undefined): string {
    if (value == null || !Number.isFinite(value)) return '—';
    switch (lesson.scale) {
        case 'percent': return `${(value * 100).toFixed(1)}%`;
        case 'x': return `${value.toFixed(2)}×`;
        default: return Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(2);
    }
}

export const TONE_CLASS: Record<Tone, string> = {
    good: 'text-emerald-400',
    ok: 'text-[var(--teal)]',
    warn: 'text-amber-400',
    bad: 'text-rose-400',
    neutral: 'text-gray-400',
};

export const TONE_BG: Record<Tone, string> = {
    good: 'bg-emerald-400',
    ok: 'bg-[var(--teal)]',
    warn: 'bg-amber-400',
    bad: 'bg-rose-400',
    neutral: 'bg-gray-500',
};
