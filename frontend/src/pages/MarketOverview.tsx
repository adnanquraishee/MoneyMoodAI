import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { MarketIndex } from '../lib/types';
import { MetricCard } from '../components/ui/MetricCard';
import { Loader } from '../components/ui/Loader';
import { SearchBar } from '../components/layout/SearchBar';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { motion, Variants } from 'framer-motion';

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

export function MarketOverview() {
    const [indices, setIndices] = useState<MarketIndex[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        loadMarketData();
    }, []);

    const loadMarketData = async () => {
        try {
            const data = await api.getMarketIndices();
            setIndices(data.indices);
        } catch (error) {
            console.error('Failed to load market data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStockSelect = (symbol: string) => {
        navigate(`/app/analysis?symbol=${symbol}`);
    };

    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="min-h-screen p-8 bg-[var(--obsidian)]"
        >
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="space-y-4"
                >
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-[var(--silver)] bg-clip-text text-transparent">Market Overview</h1>
                    <p className="text-gray-400 font-medium italic">
                        Real-time global market intelligence and asset analysis
                    </p>
                </motion.div>

                {/* Search Bar */}
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
                    className="flex justify-center"
                >
                    <SearchBar onStockSelect={handleStockSelect} />
                </motion.div>

                {/* Market Indices */}
                <div className="glass-card p-8 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[var(--teal)]/30 to-transparent" />
                    <div className="flex items-center gap-3 mb-8">
                        <Activity className="text-[var(--teal)]" size={24} />
                        <h2 className="text-2xl font-bold tracking-tight">Global Markets</h2>
                    </div>

                    {isLoading ? (
                        <div className="py-12">
                            <Loader size={32} text="Syncing market data..." />
                        </div>
                    ) : (
                        <motion.div 
                            variants={containerVariants}
                            initial="hidden"
                            animate="show"
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
                        >
                            {indices.map((index) => (
                                <motion.div key={index.symbol} variants={itemVariants}>
                                    <MetricCard
                                        label={index.name}
                                        value={
                                            index.price !== null
                                                ? index.price.toLocaleString('en-US', {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                })
                                                : 'N/A'
                                        }
                                        change={index.change ?? undefined}
                                    />
                                </motion.div>
                            ))}
                        </motion.div>
                    )}
                </div>

                {/* Info Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="glass-card p-6 border-l-4 border-l-[var(--teal)]">
                        <div className="flex items-start gap-4">
                            <TrendingUp className="text-[var(--teal)] flex-shrink-0" size={32} />
                            <div>
                                <h3 className="font-bold text-lg mb-2 text-white">Advanced Forecasting</h3>
                                <p className="text-sm text-gray-400 leading-relaxed">
                                    Monte Carlo simulations with 90-day price predictions and accuracy metrics
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card p-6 border-l-4 border-l-[var(--silver)]">
                        <div className="flex items-start gap-4">
                            <Activity className="text-[var(--silver)] flex-shrink-0" size={32} />
                            <div>
                                <h3 className="font-bold text-lg mb-2 text-white">Technical Analysis</h3>
                                <p className="text-sm text-gray-400 leading-relaxed">
                                    RSI, MACD, Bollinger Bands and more technical indicators
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card p-6 border-l-4 border-l-[#2d4bb8]">
                        <div className="flex items-start gap-4">
                            <TrendingDown className="text-[#2d4bb8] flex-shrink-0" size={32} />
                            <div>
                                <h3 className="font-bold text-lg mb-2 text-white">Sentiment Analysis</h3>
                                <p className="text-sm text-gray-400 leading-relaxed">
                                    AI-powered news sentiment and market mood analysis
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center text-sm text-gray-600 pt-8 border-t border-white/5 font-medium">
                    © 2025 MoneyMood.ai Analytics | Real-time Market Intelligence Engine
                </div>
            </div>
        </motion.div>
    );
}
