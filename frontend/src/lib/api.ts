import axios from 'axios';
import type {
    SearchResponse,
    StockData,
    ChartResponse,
    TechnicalResponse,
    ForecastData,
    InsightsResponse,
    SentimentResponse,
    MarketIndicesResponse,
    ComparisonData,
    ScreenerResponse,
    WatchlistResponse,
    ForecastV2Status,
    FactorsResponse,
    OhlcResponse,
    StockOverview,
    NewsResponse,
    MarketPulse,
    CalendarResponse,
    LongTermResult,
    SectorRotationResponse,
    MetricDistributions,
    PaperPortfolio,
    TimeTradeCasePreview,
    TimeTradeCase,
    TimeTradeReveal,
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:6150';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 120000, // 120 seconds for forecast endpoints
});

// Request interceptor for logging
apiClient.interceptors.request.use(
    (config) => {
        console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response) {
            console.error('API Error:', error.response.status, error.response.data);
        } else if (error.request) {
            console.error('Network Error:', error.message);
        } else {
            console.error('Error:', error.message);
        }
        return Promise.reject(error);
    }
);

export const api = {
    // Search for stocks
    searchStocks: async (query: string): Promise<SearchResponse> => {
        const response = await apiClient.get<SearchResponse>('/api/search', {
            params: { query },
        });
        return response.data;
    },

    // Get stock data with fundamentals
    getStock: async (symbol: string): Promise<StockData> => {
        const response = await apiClient.get<StockData>(`/api/stock/${encodeURIComponent(symbol)}`);
        return response.data;
    },

    // Get chart data
    getChart: async (
        symbol: string,
        period: string = '2y',
        interval: string = '1d'
    ): Promise<ChartResponse> => {
        const response = await apiClient.get<ChartResponse>(
            `/api/stock/${encodeURIComponent(symbol)}/chart`,
            {
                params: { period, interval },
            }
        );
        return response.data;
    },

    // Get technical indicators
    getTechnicals: async (symbol: string): Promise<TechnicalResponse> => {
        const response = await apiClient.get<TechnicalResponse>(
            `/api/stock/${encodeURIComponent(symbol)}/technicals`
        );
        return response.data;
    },

    // Get forecast and recommendation
    getForecast: async (symbol: string): Promise<ForecastData> => {
        const response = await apiClient.get<ForecastData>(
            `/api/stock/${encodeURIComponent(symbol)}/forecast`
        );
        return response.data;
    },

    // Get AI insights
    getInsights: async (symbol: string): Promise<InsightsResponse> => {
        const response = await apiClient.get<InsightsResponse>(
            `/api/stock/${encodeURIComponent(symbol)}/insights`
        );
        return response.data;
    },

    // Get sentiment analysis
    getSentiment: async (symbol: string): Promise<SentimentResponse> => {
        const response = await apiClient.get<SentimentResponse>(
            `/api/stock/${encodeURIComponent(symbol)}/sentiment`
        );
        return response.data;
    },

    // Get market indices
    getMarketIndices: async (): Promise<MarketIndicesResponse> => {
        const response = await apiClient.get<MarketIndicesResponse>(
            '/api/market/indices'
        );
        return response.data;
    },

    // Compare stocks
    compareStocks: async (symbols: string[]): Promise<ComparisonData> => {
        const response = await apiClient.post<ComparisonData>('/api/compare', {
            symbols,
        });
        return response.data;
    },

    // ---- v2: screener / watchlist / probabilistic forecast ----

    getScreener: async (): Promise<ScreenerResponse> => {
        const response = await apiClient.get<ScreenerResponse>('/api/screener');
        return response.data;
    },

    /** Percentile bands per metric across the live universe — the real-market
     *  context behind the metric-education UI. */
    getMetricDistributions: async (): Promise<MetricDistributions> => {
        const response = await apiClient.get<MetricDistributions>('/api/metrics/distributions');
        return response.data;
    },

    // ---- paper trading (Learn tab) ----
    getPaper: async (): Promise<PaperPortfolio> => {
        const response = await apiClient.get<PaperPortfolio>('/api/paper');
        return response.data;
    },
    paperTrade: async (body: { symbol: string; side: 'buy' | 'sell'; qty: number; reason: string }): Promise<PaperPortfolio> => {
        const response = await apiClient.post<PaperPortfolio>('/api/paper/trade', body);
        return response.data;
    },
    paperReset: async (): Promise<PaperPortfolio> => {
        const response = await apiClient.post<PaperPortfolio>('/api/paper/reset');
        return response.data;
    },

    // ---- Try Trade in Time ----
    getTimeTradeCases: async (): Promise<{ cases: TimeTradeCasePreview[] }> => {
        const response = await apiClient.get<{ cases: TimeTradeCasePreview[] }>('/api/timetrade/cases');
        return response.data;
    },
    getTimeTradeCase: async (id: string): Promise<TimeTradeCase> => {
        const response = await apiClient.get<TimeTradeCase>(`/api/timetrade/case/${encodeURIComponent(id)}`);
        return response.data;
    },
    timeTradeRandom: async (exclude: string[] = []): Promise<TimeTradeCase> => {
        const response = await apiClient.post<TimeTradeCase>('/api/timetrade/random', { exclude });
        return response.data;
    },
    timeTradeDecide: async (body: { id: string; amount: number }): Promise<TimeTradeReveal> => {
        const response = await apiClient.post<TimeTradeReveal>('/api/timetrade/decide', body);
        return response.data;
    },

    getWatchlist: async (): Promise<WatchlistResponse> => {
        const response = await apiClient.get<WatchlistResponse>('/api/watchlist');
        return response.data;
    },

    addToWatchlist: async (symbol: string): Promise<WatchlistResponse> => {
        const response = await apiClient.post<WatchlistResponse>('/api/watchlist', { symbol });
        return response.data;
    },

    removeFromWatchlist: async (symbol: string): Promise<WatchlistResponse> => {
        const response = await apiClient.delete<WatchlistResponse>(`/api/watchlist/${encodeURIComponent(symbol)}`);
        return response.data;
    },

    getForecastV2: async (symbol: string, horizon = 90): Promise<ForecastV2Status> => {
        const response = await apiClient.get<ForecastV2Status>(
            `/api/stock/${encodeURIComponent(symbol)}/forecast-v2`,
            { params: { horizon } }
        );
        return response.data;
    },

    getFactors: async (symbol: string): Promise<FactorsResponse> => {
        const response = await apiClient.get<FactorsResponse>(`/api/stock/${encodeURIComponent(symbol)}/factors`);
        return response.data;
    },

    // ---- v3: stock desk ----

    getOhlc: async (symbol: string, period = '1y', interval = '1d'): Promise<OhlcResponse> => {
        const response = await apiClient.get<OhlcResponse>(
            `/api/stock/${encodeURIComponent(symbol)}/ohlc`, { params: { period, interval } });
        return response.data;
    },

    getOverview: async (symbol: string): Promise<StockOverview> => {
        const response = await apiClient.get<StockOverview>(`/api/stock/${encodeURIComponent(symbol)}/overview`);
        return response.data;
    },

    getNews: async (symbol: string): Promise<NewsResponse> => {
        const response = await apiClient.get<NewsResponse>(`/api/stock/${encodeURIComponent(symbol)}/news`);
        return response.data;
    },

    getPulse: async (): Promise<MarketPulse> => {
        const response = await apiClient.get<MarketPulse>('/api/market/pulse');
        return response.data;
    },

    sendChat: async (
        messages: { role: string; content: string }[],
        symbol?: string | null,
    ): Promise<{ reply: string; error?: string }> => {
        const response = await apiClient.post('/api/chat', { messages, symbol });
        return response.data;
    },

    getSectorRotation: async (): Promise<SectorRotationResponse> => {
        const response = await apiClient.get<SectorRotationResponse>('/api/market/sectors');
        return response.data;
    },

    getCalendar: async (): Promise<CalendarResponse> => {
        const response = await apiClient.get<CalendarResponse>('/api/calendar');
        return response.data;
    },

    getLongTerm: async (symbol: string): Promise<LongTermResult> => {
        const response = await apiClient.get<LongTermResult>(
            `/api/stock/${encodeURIComponent(symbol)}/longterm`);
        return response.data;
    },
};

export default api;
