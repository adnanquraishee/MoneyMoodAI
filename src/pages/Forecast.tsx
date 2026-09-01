import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { ForecastData } from '../lib/types';
import { Card } from '../components/ui/Card';
import { Loader } from '../components/ui/Loader';
import { Badge } from '../components/ui/Badge';
import { AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion } from 'framer-motion';

export function Forecast() {
    const [searchParams] = useSearchParams();
    const symbol = searchParams.get('symbol');

    const [data, setData] = useState<ForecastData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (symbol) {
            loadForecast(symbol);
        }
    }, [symbol]);

    const loadForecast = async (sym: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await api.getForecast(sym);
            setData(response);
        } catch (error: any) {
            console.error('Failed to load forecast:', error);
            setError(error.response?.data?.detail || 'Failed to generate forecast. This may be due to network issues or the operation taking too long. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader size={48} text="Generating forecast and ratings..." />
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
                            <h2 className="text-xl font-bold">Error Generating Forecast</h2>
                            <p className="text-gray-400 mt-2">{error}</p>
                            <button
                                onClick={() => symbol && loadForecast(symbol)}
                                className="mt-4 px-4 py-2 bg-[var(--teal)] text-white font-bold rounded-lg transition-colors hover:opacity-80"
                            >
                                Retry
                            </button>
                        </div>
                    </div>
                </Card>
            </div>
        );
    }

    if (!data) return null;

    const { accuracy } = data;
    const accuracyScore = accuracy?.accuracy_score || 0;

    let scoreColor = 'text-danger';
    let scoreBadge: 'danger' | 'warning' | 'success' = 'danger';
    let interpretation = 'Poor';

    if (accuracyScore >= 70) {
        scoreColor = 'text-success';
        scoreBadge = 'success';
        interpretation = 'Excellent';
    } else if (accuracyScore >= 55) {
        scoreColor = 'text-warning';
        scoreBadge = 'warning';
        interpretation = 'Good';
    } else if (accuracyScore >= 40) {
        scoreColor = 'text-warning';
        scoreBadge = 'warning';
        interpretation = 'Fair';
    }

    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="min-h-screen p-8 space-y-8 bg-[var(--obsidian)]"
        >
            <motion.h1 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-4xl font-bold bg-gradient-to-r from-white to-[var(--silver)] bg-clip-text text-transparent italic tracking-tight"
            >
                Forecast & Ratings — {symbol}
            </motion.h1>

            {/* Recommendation */}
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glass-card p-8 relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--teal)] opacity-[0.03] blur-3xl rounded-full -mr-16 -mt-16" />
                <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-[var(--teal)] rounded-full" />
                    AI Market Intelligence
                </h2>
                <div className="prose prose-invert max-w-none text-gray-300 leading-relaxed font-medium">
                    <ReactMarkdown>{data.recommendation}</ReactMarkdown>
                </div>
            </motion.div>


            {/* Forecast Chart */}
            {data.charts.forecast && (
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="glass-card p-8"
                >
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-[var(--silver)] rounded-full" />
                        90-Day Price Forecast (Monte Carlo)
                    </h2>
                    <img
                        src={`data:image/png;base64,${data.charts.forecast}`}
                        alt="Forecast Chart"
                        className="w-full rounded-lg"
                    />
                </motion.div>
            )}

            {/* Accuracy Score */}
            {accuracy && (
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="glass-card p-8"
                >
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-[var(--teal)] rounded-full" />
                        Forecast Accuracy Testing
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <motion.div 
                            whileHover={{ scale: 1.02, y: -4 }}
                            className="text-center p-8 rounded-2xl bg-gradient-to-br from-[var(--teal)]/10 to-transparent border border-[var(--teal)]/10 transition-all cursor-pointer"
                        >
                            <p className="text-[10px] tracking-widest text-gray-500 mb-3 uppercase font-bold">Accuracy Score</p>
                            <p className={`text-7xl font-bold ${scoreColor} tracking-tighter`}>{accuracyScore.toFixed(1)}</p>
                            <div className="mt-4">
                                <Badge variant={scoreBadge} className="px-4 py-1.5 uppercase tracking-wider text-[10px]">{interpretation}</Badge>
                            </div>
                        </motion.div>

                        <div className="space-y-4 flex flex-col justify-center">
                            <motion.div whileHover={{ x: 4, backgroundColor: 'rgba(255,255,255,0.05)' }} className="bg-white/5 p-4 rounded-xl border border-white/5 transition-colors cursor-pointer">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">RMSE</p>
                                <p className="text-3xl font-bold text-white tracking-tight">{accuracy.metrics.rmse.toFixed(4)}</p>
                            </motion.div>
                            <motion.div whileHover={{ x: 4, backgroundColor: 'rgba(255,255,255,0.05)' }} className="bg-white/5 p-4 rounded-xl border border-white/5 transition-colors cursor-pointer">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">MAE</p>
                                <p className="text-3xl font-bold text-white tracking-tight">{accuracy.metrics.mae.toFixed(4)}</p>
                            </motion.div>
                        </div>

                        <div className="space-y-4 flex flex-col justify-center">
                            <motion.div whileHover={{ x: 4, backgroundColor: 'rgba(255,255,255,0.05)' }} className="bg-white/5 p-4 rounded-xl border border-white/5 transition-colors cursor-pointer">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">MAPE</p>
                                <p className="text-3xl font-bold text-white tracking-tight">{accuracy.metrics.mape.toFixed(2)}%</p>
                            </motion.div>
                            <motion.div whileHover={{ x: 4, backgroundColor: 'rgba(255,255,255,0.05)' }} className="bg-white/5 p-4 rounded-xl border border-white/5 transition-colors cursor-pointer">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Directional Accuracy</p>
                                <p className="text-3xl font-bold text-[var(--teal)] tracking-tight">{accuracy.metrics.directional_accuracy.toFixed(2)}%</p>
                            </motion.div>
                        </div>
                    </div>

                    <div className="bg-secondary/10 p-4 rounded-lg border border-secondary/20">
                        <p className="text-sm text-gray-300">
                            <strong>About the Accuracy Score:</strong> This score (0-100) evaluates forecast quality through
                            Directional Accuracy (50%), MAPE (30%), and RMSE (20%). Scores above 55 indicate better-than-random prediction capability.
                        </p>
                    </div>
                </motion.div>
            )}
        </motion.div>
    );
}
