import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { StockData, ChartDataPoint } from '../lib/types';
import { Card } from '../components/ui/Card';
import { Loader } from '../components/ui/Loader';
import { Badge } from '../components/ui/Badge';
import { AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    BarChart,
    Bar,
} from 'recharts';

export function StockAnalysis() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const symbol = searchParams.get('symbol');

    const [stockData, setStockData] = useState<StockData | null>(null);
    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (symbol) {
            loadStockData(symbol);
        } else {
            navigate('/');
        }
    }, [symbol]);

    const loadStockData = async (sym: string) => {
        setIsLoading(true);
        setError(null);

        try {
            const [stock, chart] = await Promise.all([
                api.getStock(sym),
                api.getChart(sym, '2y', '1d'),
            ]);

            setStockData(stock);
            setChartData(chart.data);

            // Update parent with stock info
            window.dispatchEvent(
                new CustomEvent('stock-loaded', {
                    detail: { symbol: sym, metrics: stock.metrics, profile: stock.profile },
                })
            );
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to load stock data');
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader size={48} text={`Loading ${symbol}...`} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Card className="max-w-lg">
                    <div className="flex items-center gap-4 text-danger">
                        <AlertCircle size={32} />
                        <div>
                            <h2 className="text-xl font-bold">Error Loading Stock</h2>
                            <p className="text-gray-400 mt-2">{error}</p>
                        </div>
                    </div>
                </Card>
            </div>
        );
    }

    if (!stockData) return null;

    const { metrics, profile } = stockData;

    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="min-h-screen p-8 space-y-8 bg-[var(--obsidian)]"
        >
            {/* Header */}
            <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="relative"
            >
                <div className="absolute -top-10 -left-10 w-64 h-64 bg-[var(--teal)] opacity-[0.03] blur-[100px] rounded-full" />
                <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-[var(--silver)] bg-clip-text text-transparent italic tracking-tight">
                    {profile.longName || symbol} <span className="text-[var(--teal)] not-italic opacity-50">({symbol})</span>
                </h1>
                <div className="flex items-center gap-3 mt-4">
                    {profile.sector && <Badge variant="info" style={{ backgroundColor: 'hsla(178, 100%, 45%, 0.1)', color: 'var(--teal)', borderColor: 'hsla(178, 100%, 45%, 0.2)' }} className="px-3 py-1 font-bold uppercase tracking-wider text-[10px]">{profile.sector}</Badge>}
                    {profile.industry && <Badge variant="neutral" className="bg-white/5 text-gray-400 border-white/10 px-3 py-1 font-bold uppercase tracking-wider text-[10px]">{profile.industry}</Badge>}
                </div>
            </motion.div>


            {/* Key Metrics */}
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glass-card p-8"
            >
                <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-[var(--teal)] rounded-full" />
                    Key Financials
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                    {Object.entries(metrics).map(([key, value]) => (
                        <div key={key} className="space-y-2 border-l border-white/5 pl-4 hover:border-[var(--teal)]/30 transition-colors">
                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">{key}</p>
                            <p className="font-bold text-xl text-white tracking-tight">{value}</p>
                        </div>
                    ))}
                </div>
            </motion.div>


            {/* Price Chart */}
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="glass-card p-8"
            >
                <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-[var(--silver)] rounded-full" />
                    Price & Volume Analysis
                </h2>

                <div className="space-y-6">
                    {/* Price Chart with MA */}
                    <ResponsiveContainer width="100%" height={400}>
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#30363D" />
                            <XAxis
                                dataKey="Date"
                                stroke="#94a3b8"
                                tick={{ fontSize: 12 }}
                                tickFormatter={(value) => {
                                    const date = new Date(value);
                                    return `${date.getMonth() + 1}/${date.getDate()}`;
                                }}
                            />
                            <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} domain={['auto', 'auto']} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#172032',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                }}
                                labelStyle={{ color: '#e0e6ed' }}
                            />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="Close"
                                stroke="#1ED760"
                                strokeWidth={2}
                                dot={false}
                                name="Close Price"
                            />
                            <Line
                                type="monotone"
                                dataKey="MA50"
                                stroke="#FFC107"
                                strokeWidth={1.5}
                                dot={false}
                                name="50-Day MA"
                            />
                            <Line
                                type="monotone"
                                dataKey="MA200"
                                stroke="#00FFFF"
                                strokeWidth={1.5}
                                dot={false}
                                name="200-Day MA"
                            />
                        </LineChart>
                    </ResponsiveContainer>

                    {/* Volume Chart */}
                    <ResponsiveContainer width="100%" height={150}>
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#30363D" />
                            <XAxis
                                dataKey="Date"
                                stroke="#94a3b8"
                                tick={{ fontSize: 12 }}
                                tickFormatter={(value) => {
                                    const date = new Date(value);
                                    return `${date.getMonth() + 1}/${date.getDate()}`;
                                }}
                            />
                            <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#172032',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                }}
                            />
                            <Bar dataKey="Volume" fill="#0D6EFD" opacity={0.6} name="Volume" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </motion.div>

            {/* Company Profile */}
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="grid grid-cols-1 lg:grid-cols-2 gap-8"
            >
                <div className="glass-card p-8">
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-[var(--teal)] rounded-full" />
                        Company Profile
                    </h2>
                    <div className="space-y-4">
                        <div className="flex justify-between border-b border-white/5 pb-2">
                            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Sector</span>
                            <span className="font-semibold text-white">{profile.sector || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between border-b border-white/5 pb-2">
                            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Industry</span>
                            <span className="font-semibold text-white">{profile.industry || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between border-b border-white/5 pb-2">
                            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Website</span>
                            <span className="ml-2 font-semibold">
                                {profile.website ? (
                                    <a
                                        href={profile.website}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[var(--teal)] hover:underline"
                                    >
                                        {profile.website.replace('https://', '').replace('http://', '')}
                                    </a>
                                ) : (
                                    'N/A'
                                )}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="glass-card p-8 bg-gradient-to-br from-white/[0.02] to-transparent">
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-[var(--silver)] rounded-full" />
                        Strategic Summary
                    </h2>
                    <p className="text-gray-400 leading-relaxed font-medium">{profile.summary || 'No summary available'}</p>
                </div>
            </motion.div>


            {/* Historical Data Charts */}
            {stockData.charts && Object.keys(stockData.charts).length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                >
                    <Card>
                        <h2 className="text-2xl font-bold mb-6">Financial Trends</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {Object.entries(stockData.charts).map(([key, base64]) => (
                                <div key={key}>
                                    <h3 className="font-semibold mb-3 capitalize">{key.replace('_', ' ')}</h3>
                                    <img
                                        src={`data:image/png;base64,${base64}`}
                                        alt={key}
                                        className="w-full rounded-lg"
                                    />
                                </div>
                            ))}
                        </div>
                    </Card>
                </motion.div>
            )}
        </motion.div>
    );
}
