export interface TickerOption {
    ticker: string;
    name: string;
    exchange: string;
}

export interface StockMetrics {
    [key: string]: string;
}

export interface CompanyProfile {
    longName?: string;
    sector?: string;
    industry?: string;
    website?: string;
    employees?: string | number;
    summary?: string;
}

export interface StockData {
    symbol: string;
    metrics: StockMetrics;
    profile: CompanyProfile;
    charts: Record<string, string>;
}

export interface ChartDataPoint {
    Date: string;
    Open: number;
    High: number;
    Low: number;
    Close: number;
    Volume: number;
    MA50?: number;
    MA200?: number;
}

export interface TechnicalDataPoint extends ChartDataPoint {
    RSI_14?: number;
    MACD_12_26_9?: number;
    MACDs_12_26_9?: number;
    MACDh_12_26_9?: number;
    BBL_20_2_0?: number;
    BBM_20_2_0?: number;
    BBU_20_2_0?: number;
}

export interface AccuracyMetrics {
    rmse: number;
    mae: number;
    mape: number;
    directional_accuracy: number;
}

export interface AccuracyResults {
    metrics: AccuracyMetrics;
    accuracy_score: number;
    forecast_prices: number[];
    actual_prices: number[];
    dates: string[];
    error?: string;
}

export interface ForecastData {
    symbol: string;
    recommendation: string;
    sentiment_score: number;
    charts: {
        sentiment: string | null;
        forecast: string | null;
        recommendation: string | null;
    };
    accuracy: AccuracyResults;
}

export interface MarketIndex {
    symbol: string;
    name: string;
    price: number | null;
    change: number | null;
}

export interface ComparisonData {
    symbols: string[];
    summary: string;
    data: Array<Record<string, any>>;
    chart: string;
}

export interface SearchResponse {
    results: TickerOption[];
}

export interface ChartResponse {
    symbol: string;
    period: string;
    interval: string;
    data: ChartDataPoint[];
}

export interface TechnicalResponse {
    symbol: string;
    data: TechnicalDataPoint[];
}

export interface InsightsResponse {
    symbol: string;
    summary: string;
}

export interface SentimentResponse {
    symbol: string;
    score: number;
    chart: string;
}

export interface MarketIndicesResponse {
    indices: MarketIndex[];
}

// ---- v2: screener / watchlist / probabilistic forecast ----

export interface ScreenerRow {
    symbol: string;
    name: string;
    sector: string | null;
    price: number;
    change_pct: number | null;
    beta: number | null;
    return_1y: number | null;
    capm_expected: number | null;
    alpha: number | null;
    treynor: number | null;
    momentum: number | null;
    volatility: number | null;
    rsi: number | null;
    pct_from_52w_high: number | null;
    score: number | null;
    rank_alpha: number | null;
    rank_treynor: number | null;
    rank_momentum: number | null;
    rank_low_vol: number | null;
    market_cap: number | null;
    pe: number | null;
    sharpe: number | null;
    forward_pe: number | null;
    peg: number | null;
    pb: number | null;
    roe: number | null;
    profit_margin: number | null;
    revenue_growth: number | null;
    earnings_growth: number | null;
    debt_to_equity: number | null;
    dividend_yield: number | null;
    eps: number | null;
    garp: boolean;
}

export interface ScreenerResponse {
    status: 'cold' | 'warming' | 'ready';
    progress: number;
    as_of: string | null;
    count: number;
    rows: ScreenerRow[];
}

export interface WatchlistItem {
    symbol: string;
    added_at: string | null;
    note: string;
    price: number | null;
    change_pct: number | null;
    score: number | null;
    rsi: number | null;
    name: string;
    sparkline: number[];
}

export interface WatchlistResponse {
    items: WatchlistItem[];
}

export interface ForecastV2Result {
    verdict?: ForecastVerdict;
    symbol: string;
    horizon_days: number;
    n_simulations: number;
    last_price: number;
    as_of: string;
    history: { dates: string[]; prices: number[] };
    forecast: {
        dates: string[];
        p5: number[]; p25: number[]; p50: number[]; p75: number[]; p95: number[];
    };
    probabilities: {
        up: number;
        up_5pct: number;
        down_5pct: number;
        expected_return_pct: number;
    };
    model: {
        garch: Record<string, number | string>;
        tail_dof: number;
        tilt_lambda: number;
        conviction_score: number | null;
        base_score: number | null;
        sentiment_score: number | null;
    };
    factors: Partial<ScreenerRow>;
}

export interface ForecastV2Status {
    status: 'ready' | 'computing' | 'error';
    result?: ForecastV2Result;
    error?: string;
}

export interface FactorsResponse {
    symbol: string;
    in_universe: boolean;
    factors: Partial<ScreenerRow>;
}

// ---- v3: stock desk / candles / overview ----

export interface OhlcResponse {
    symbol: string;
    period: string;
    interval: string;
    time: (string | number)[];
    open: number[];
    high: number[];
    low: number[];
    close: number[];
    volume: number[];
    ma20: (number | null)[];
    ma50: (number | null)[];
    ma200: (number | null)[];
}

export interface Fundamentals {
    name?: string;
    sector?: string | null;
    industry?: string | null;
    summary?: string | null;
    market_cap?: number | null;
    pe?: number | null;
    forward_pe?: number | null;
    peg?: number | null;
    pb?: number | null;
    ps?: number | null;
    eps?: number | null;
    book_value?: number | null;
    roe?: number | null;
    roa?: number | null;
    profit_margin?: number | null;
    operating_margin?: number | null;
    revenue_growth?: number | null;
    earnings_growth?: number | null;
    debt_to_equity?: number | null;
    current_ratio?: number | null;
    dividend_yield?: number | null;
    high_52w?: number | null;
    low_52w?: number | null;
}

export interface TechnicalSnapshot {
    rsi: number | null;
    ma50: number | null;
    ma200: number | null;
    price_vs_ma50: number | null;
    price_vs_ma200: number | null;
    macd_hist: number | null;
    macd_state: 'bullish' | 'bearish';
    bb_position: number | null;
    golden_cross: boolean;
}

export interface StockOverview {
    symbol: string;
    name: string;
    quote: {
        price: number;
        change_pct: number;
        high_52w: number | null;
        low_52w: number | null;
        as_of: string;
    };
    fundamentals: Fundamentals;
    factors: Partial<ScreenerRow> | null;
    technicals: TechnicalSnapshot;
    sparkline: number[];
}

// ---- v4: news + forecast verdict ----

export interface NewsItem {
    title: string;
    link: string;
    sentiment: number;
    label: 'positive' | 'negative' | 'neutral';
}

export interface NewsResponse {
    symbol: string;
    company: string;
    avg_sentiment: number | null;
    distribution?: { positive: number; neutral: number; negative: number };
    items: NewsItem[];
}

export interface ForecastDriver {
    name: string;
    impact: 'positive' | 'negative' | 'neutral';
    detail: string;
}

export interface ForecastVerdict {
    direction: 'growth' | 'fall' | 'sideways';
    confidence: 'high' | 'moderate' | 'low';
    prob_up: number;
    expected_move_pct: number;
    likely_range_pct: { low: number; high: number };
    horizon_days: number;
    drivers: ForecastDriver[];
}

// ---- v6: dashboard pulse ----

export interface IndexCard {
    symbol: string;
    name: string;
    price: number | null;
    change: number | null;
    spark: number[];
}

export interface TickerItem {
    symbol: string;
    name: string;
    price: number;
    change_pct: number;
    score: number | null;
}

export interface MarketPulse {
    status: string;
    progress: number;
    as_of: string | null;
    indices: IndexCard[];
    mood: {
        score: number;
        label: 'bullish' | 'neutral' | 'bearish';
        advancers: number;
        decliners: number;
        universe: number;
        avg_change_pct: number;
        vix: number | null;
        vix_change: number | null;
    };
    gainers: TickerItem[];
    losers: TickerItem[];
    ticker: TickerItem[];
}

// ---- v9: sector rotation (RRG) ----

export interface SectorTrailPoint {
    x: number;      // RS-ratio (100 = in line with NIFTY)
    y: number;      // RS-momentum (100 = flat)
    date: string;
}

export interface SectorRotationItem {
    sector: string;
    members: number;
    market_cap: number;
    avg_change_pct: number | null;
    avg_score: number | null;
    rs_ratio: number;
    rs_momentum: number;
    quadrant: 'leading' | 'weakening' | 'improving' | 'lagging';
    trail: SectorTrailPoint[];
}

export interface SectorRotationResponse {
    as_of: string | null;
    sectors: SectorRotationItem[];
}

// ---- v7: corporate events calendar ----

export interface CalendarEvent {
    symbol: string;
    name: string;
    type: 'earnings' | 'ex_dividend' | 'dividend';
    date: string;              // YYYY-MM-DD
    detail: string;
}

export interface CalendarResponse {
    as_of: string | null;
    events: CalendarEvent[];
}

// ---- v8: long-term investor engine ----

export interface HorizonStats {
    years: number;
    cagr: { p10: number; p25: number; p50: number; p75: number; p90: number };
    wealth_1l: { p10: number; p50: number; p90: number };
    p_beat_nifty: number;
    p_positive: number;
    p_double: number;
}

export interface LongTermResult {
    symbol: string;
    last_price: number;
    waterfall: {
        dividend_yield: number;
        growth: number;
        rerating: number;
        expected_cagr: number;
        growth_basis: string[];
        current_pe: number | null;
        fair_pe: number | null;
        sector: string | null;
    };
    quality: {
        score: number;
        checks: Record<string, boolean>;
        sigma_annual: number;
        cyclical_warning: boolean;
    };
    horizons: Record<string, HorizonStats>;
    cone: { years: number[]; p10: number[]; p50: number[]; p90: number[] };
    scenarios: { name: string; tone: 'up' | 'down' | 'neutral'; cagr: number; assumptions: string }[];
    n_simulations: number;
}
