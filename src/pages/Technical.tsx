import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { TechnicalDataPoint } from '../lib/types';
import { Card } from '../components/ui/Card';
import { Loader } from '../components/ui/Loader';
import { AlertCircle, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Bar,
    Cell,
    ComposedChart,
} from 'recharts';

export function Technical() {
    const [searchParams] = useSearchParams();
    const symbol = searchParams.get('symbol');

    const [data, setData] = useState<TechnicalDataPoint[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (symbol) {
            loadTechnicals(symbol);
        }
    }, [symbol]);

    const loadTechnicals = async (sym: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await api.getTechnicals(sym);
            setData(response.data);
        } catch (error: any) {
            console.error('Failed to load technicals:', error);
            setError(error.response?.data?.detail || 'Failed to load technical indicators. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader size={48} text="Loading technical indicators..." />
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
                            <h2 className="text-xl font-bold">Error Loading Technical Indicators</h2>
                            <p className="text-gray-400 mt-2">{error}</p>
                            <button
                                onClick={() => symbol && loadTechnicals(symbol)}
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
                Technical Analysis — {symbol}
            </motion.h1>

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glass-card p-8 shadow-2xl"
            >
                <div className="flex items-center gap-3 mb-8">
                    <Activity className="text-[var(--teal)]" size={24} />
                    <h2 className="text-2xl font-bold tracking-tight">Bollinger Bands (20-day)</h2>
                </div>
                <ResponsiveContainer width="100%" height={500}>
                    <ComposedChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis
                            dataKey="Date"
                            stroke="rgba(255,255,255,0.3)"
                            tick={{ fontSize: 11, fontWeight: 500 }}
                            tickFormatter={(value) => new Date(value).toLocaleDateString()}
                        />
                        <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11, fontWeight: 500 }} />
                        <Tooltip 
                            contentStyle={{ 
                                backgroundColor: 'var(--obsidian)', 
                                border: '1px solid rgba(0,245,212,0.2)',
                                borderRadius: '12px',
                                backdropFilter: 'blur(10px)'
                            }} 
                        />
                        <Line type="monotone" dataKey="BBU_20_2_0" stroke="var(--teal)" strokeWidth={1.5} dot={false} name="Upper Band" strokeDasharray="5 5" />
                        <Line type="monotone" dataKey="BBM_20_2_0" stroke="var(--silver)" strokeWidth={2} dot={false} name="Middle (SMA 20)" />
                        <Line type="monotone" dataKey="BBL_20_2_0" stroke="var(--teal)" strokeWidth={1.5} dot={false} name="Lower Band" strokeDasharray="5 5" />
                        <Line type="monotone" dataKey="Close" stroke="#fff" strokeWidth={3} dot={false} name="Price" />
                    </ComposedChart>
                </ResponsiveContainer>
            </motion.div>

            {/* MACD */}
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="glass-card p-8"
            >
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-[var(--silver)] rounded-full" />
                    MACD (12, 26, 9)
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#30363D" />
                        <XAxis
                            dataKey="Date"
                            stroke="#94a3b8"
                            tick={{ fontSize: 12 }}
                            tickFormatter={(value) => new Date(value).toLocaleDateString()}
                        />
                        <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#172032', border: '1px solid rgba(255,255,255,0.1)' }} />
                        <Bar dataKey="MACDh_12_26_9" name="Histogram">
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={(entry.MACDh_12_26_9 ?? 0) < 0 ? '#D40000' : '#1ED760'} />
                            ))}
                        </Bar>
                        <Line type="monotone" dataKey="MACD_12_26_9" stroke="#0D6EFD" strokeWidth={2} dot={false} name="MACD" />
                        <Line type="monotone" dataKey="MACDs_12_26_9" stroke="#FFC107" strokeWidth={2} dot={false} name="Signal" />
                    </ComposedChart>
                </ResponsiveContainer>
            </motion.div>

            {/* RSI */}
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="glass-card p-8"
            >
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-[var(--teal)] rounded-full" />
                    Relative Strength Index (RSI-14)
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#30363D" />
                        <XAxis
                            dataKey="Date"
                            stroke="#94a3b8"
                            tick={{ fontSize: 12 }}
                            tickFormatter={(value) => new Date(value).toLocaleDateString()}
                        />
                        <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} domain={[0, 100]} />
                        <Tooltip contentStyle={{ backgroundColor: '#172032', border: '1px solid rgba(255,255,255,0.1)' }} />
                        <Line type="monotone" dataKey="RSI_14" stroke="#00FFFF" strokeWidth={2} dot={false} name="RSI" />
                        {/* Reference lines for overbought/oversold */}
                        <Line type="monotone" dataKey={() => 70} stroke="#D40000" strokeDasharray="5 5" strokeWidth={1} dot={false} name="Overbought (70)" />
                        <Line type="monotone" dataKey={() => 30} stroke="#1ED760" strokeDasharray="5 5" strokeWidth={1} dot={false} name="Oversold (30)" />
                    </LineChart>
                </ResponsiveContainer>
            </motion.div>
        </motion.div>
    );
}
