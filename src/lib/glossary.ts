// Plain-English explanations for every technical term shown in the UI.
// Rendered by <InfoTip term="..."/> on hover.

export const GLOSSARY: Record<string, string> = {
    // Composite / factor model
    conviction: 'MoneyMood.ai Conviction Score (0–100): blends CAPM alpha, Treynor ratio, momentum and low-volatility percentile ranks across the NIFTY-100. Above 70 = strong profile, below 30 = weak.',
    alpha: "Jensen's Alpha: the stock's 1-year return minus what CAPM says it should have returned for its risk (beta). Positive = beating its risk class.",
    capm: 'CAPM expected return = risk-free rate + beta × (market return − risk-free rate). The "fair" return for the stock\'s level of market risk.',
    treynor: 'Treynor Ratio = (return − risk-free rate) ÷ beta. Excess return earned per unit of market risk. Higher is better; only meaningful vs peers.',
    sharpe: 'Sharpe Ratio = (return − risk-free rate) ÷ volatility. Excess return per unit of total risk. Above 1 is good, above 2 is excellent.',
    momentum: '12-1 Momentum: price change from 12 months ago to 1 month ago. Skipping the last month avoids short-term reversal noise. Persistent winners tend to keep winning.',
    beta: 'Beta: how much the stock moves when the market (NIFTY 50) moves 1%. β>1 = amplifies market swings, β<1 = defensive.',
    volatility: 'Annualized volatility: how widely daily returns swing over a year. Higher = riskier, wider possible outcomes.',
    low_vol: 'Low-volatility rank: calmer stocks historically deliver better risk-adjusted returns (the "low-vol anomaly").',
    garp: 'GARP (Growth At a Reasonable Price): decent earnings growth (≥10%) with a PEG ratio ≤1.5 — growth you are not overpaying for.',

    // Valuation
    pe: 'Price-to-Earnings: price ÷ last 12 months earnings per share. How many years of current profit you pay for the stock. Compare within a sector.',
    forward_pe: 'Forward P/E: price ÷ analysts\' expected next-year earnings. Lower than trailing P/E implies expected profit growth.',
    peg: 'PEG Ratio: P/E ÷ earnings growth rate. Below 1 = possibly cheap for its growth; above 2 = paying up.',
    pb: 'Price-to-Book: price ÷ accounting net worth per share. Useful for banks/asset-heavy firms. Below 1 can signal value (or trouble).',
    ps: 'Price-to-Sales: market cap ÷ annual revenue. Useful when profits are small or volatile.',
    eps: 'Earnings Per Share: net profit ÷ shares outstanding, trailing 12 months.',
    market_cap: 'Market capitalization: share price × total shares. Total market value of the company.',
    dividend_yield: 'Dividend Yield: annual dividends ÷ price. Cash income the stock pays you, independent of price moves.',

    // Profitability / health
    roe: 'Return on Equity: net profit ÷ shareholder equity. How efficiently the company turns your capital into profit. >15% is strong in India.',
    roa: 'Return on Assets: net profit ÷ total assets. Efficiency independent of leverage.',
    profit_margin: 'Net Profit Margin: profit ÷ revenue. Share of every rupee of sales kept as profit.',
    operating_margin: 'Operating Margin: core-business profit ÷ revenue, before interest and tax.',
    revenue_growth: 'Revenue Growth: year-over-year sales growth.',
    earnings_growth: 'Earnings Growth: year-over-year profit growth.',
    debt_to_equity: 'Debt-to-Equity: borrowings ÷ shareholder equity. Above ~2× means heavy leverage; capital-intensive sectors run higher.',
    current_ratio: 'Current Ratio: short-term assets ÷ short-term liabilities. Below 1 can signal cash-flow stress.',

    // Technicals
    rsi: 'RSI (14-day Relative Strength Index): momentum from 0–100. Above 70 = overbought (may cool off), below 30 = oversold (may bounce).',
    macd: 'MACD: gap between the 12- and 26-day exponential averages. Histogram above zero and rising = bullish momentum building.',
    bollinger: 'Bollinger Bands: a ±2 standard-deviation envelope around the 20-day average. Price near the upper band = stretched; near the lower = compressed.',
    ma50: '50-day moving average: the medium-term trend line. Price above it = uptrend intact.',
    ma200: '200-day moving average: the long-term trend line institutions watch most.',
    golden_cross: 'Golden Cross: 50-day average above the 200-day — a classic long-term bullish trend signal. The reverse ("death cross") is bearish.',
    pct_52w_high: 'Distance from the 52-week high. Near 0% = at highs (strength); very negative = deep drawdown.',

    // Forecast
    prob_cone: 'The shaded cone shows where 1,000 simulated price paths landed: the inner band covers 50% of outcomes, the outer band 90%. It is a range of possibilities, not a target.',
    p_up: 'Share of the 1,000 Monte Carlo simulations that ended above today\'s price at the horizon.',
    expected_move: 'Median simulated ending price vs today. Half the simulations ended above this, half below.',
    garch: 'GARCH(1,1): a volatility model fitted to this stock — turbulent periods cluster, then mean-revert. It sets how fast the forecast cone widens.',
    monte_carlo: 'Monte Carlo simulation: running thousands of randomized "what-if" price paths using the stock\'s trend, volatility and fat-tail behaviour.',
    student_t: 'Student-t shocks: fat-tailed randomness that makes crashes/spikes more likely than a normal bell curve — closer to how markets actually behave.',
    sentiment: 'News sentiment from FinBERT (a finance-tuned AI model) scoring recent headlines from −1 (very negative) to +1 (very positive).',

    // Long-term investor engine
    return_waterfall: 'Long-term return decomposition (Grinold-Kroner): expected yearly return = dividend yield + earnings growth + valuation re-rating. This is how institutional 5-year forecasts are actually built.',
    sustainable_growth: 'Sustainable growth = ROE × (1 − payout ratio): how fast a company can grow earnings using only reinvested profits, without borrowing.',
    growth_fade: 'No company grows at 25% forever. The model fades high growth toward India\'s nominal GDP growth (~10.5%) over the horizon — the single most reliable pattern in corporate finance.',
    rerating: 'Valuation re-rating: if a stock trades far above or below its sector\'s typical P/E, part of that gap tends to close over years — a tailwind for cheap stocks, a drag on expensive ones.',
    cagr: 'CAGR — Compound Annual Growth Rate: the single yearly rate that turns the starting value into the ending value over the period. The honest way to state multi-year returns.',
    quality_gate: 'Quality score: high-ROE, low-debt, healthy-margin companies deliver their expected returns more reliably, so they get tighter uncertainty bands. Leveraged cyclicals get wider ones.',
    p_beat_nifty: 'Share of 2,000 simulations where this stock ended above a simulated NIFTY index investment over the same horizon. Below ~50% means an index fund was the better bet in most simulated futures.',
    wealth_projection: 'What ₹1,00,000 invested today becomes at the horizon, shown as a range across 2,000 simulated futures — not a promise.',
    scenario_cards: 'Bear/Base/Bull show the yearly return arithmetic under explicit assumptions about growth and valuation — so you can judge the assumptions, not just the number.',
};

export type GlossaryTerm = keyof typeof GLOSSARY;
