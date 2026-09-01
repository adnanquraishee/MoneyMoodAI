import { useState } from 'react';
import { api } from '../lib/api';
import  type { ComparisonData } from '../lib/types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Loader } from '../components/ui/Loader';
import ReactMarkdown from 'react-markdown';
import { motion } from 'framer-motion';

export function Compare() {
    const [symbols, setSymbols] = useState('AAPL, MSFT, GOOG, NVDA');
    const [data, setData] = useState<ComparisonData | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleCompare = async () => {
        const symbolList = symbols.split(',').map(s => s.trim()).filter(Boolean);

        if (symbolList.length < 2) {
            alert('Please enter at least 2 symbols');
            return;
        }

        setIsLoading(true);
        try {
            const response = await api.compareStocks(symbolList);
            setData(response);
        } catch (error: any) {
            alert(error.response?.data?.detail || 'Failed to compare stocks');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="min-h-screen p-8 space-y-8 bg-[var(--obsidian)]"
        >
            <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-[var(--silver)] bg-clip-text text-transparent italic tracking-tight">Peer Comparison Analysis</h1>
                <p className="text-gray-400 mt-3 font-medium italic">Benchmarking asset performance across sectors</p>
            </motion.div>


            {/* Input */}
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glass-card p-8 bg-gradient-to-br from-[var(--teal)]/5 to-transparent shadow-2xl"
            >
                <div className="space-y-6">
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-3">
                            Asset Discovery Symbols (Comma Separated)
                        </label>
                        <input
                            type="text"
                            value={symbols}
                            onChange={(e) => setSymbols(e.target.value)}
                            placeholder="e.g., AAPL, MSFT, GOOG"
                            className="w-full px-6 py-4 bg-[var(--obsidian)] border border-white/10 rounded-xl text-white font-medium focus:outline-none focus:border-[var(--teal)]/40 focus:ring-2 focus:ring-[var(--teal)]/10 transition-all"
                        />
                    </div>

                    <Button onClick={handleCompare} disabled={isLoading} className="btn-primary w-full md:w-auto h-14 px-10">
                        {isLoading ? 'Processing Signals...' : 'Run Comparative Engine'}
                    </Button>
                </div>
            </motion.div>


            {isLoading && (
                <div className="py-12">
                    <Loader size={48} text="Comparing stocks..." />
                </div>
            )}

            {data && !isLoading && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ staggerChildren: 0.1, delayChildren: 0.2 }}
                    className="space-y-8"
                >
                    {/* Comparison Table */}
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-card p-8"
                    >
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                            <div className="w-1.5 h-6 bg-[var(--silver)] rounded-full" />
                            Comparative Ratios
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-white/10">
                                        {data.data.length > 0 &&
                                            Object.keys(data.data[0]).map((key) => (
                                                <th key={key} className="text-left p-3 text-sm font-semibold text-gray-400">
                                                    {key}
                                                </th>
                                            ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.data.map((row, idx) => (
                                        <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                            {Object.values(row).map((value, i) => (
                                                <td key={i} className="p-3 text-sm font-medium">
                                                    {value?.toString() || 'N/A'}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>

                    {/* Performance Chart */}
                    {data.chart && (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <Card>
                                <h2 className="text-2xl font-bold mb-6">Performance Chart</h2>
                                <img
                                    src={`data:image/png;base64,${data.chart}`}
                                    alt="Comparison Chart"
                                    className="w-full rounded-lg"
                                />
                            </Card>
                        </motion.div>
                    )}

                    {/* AI Insights */}
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-card p-8"
                    >
                        <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
                            <div className="w-1.5 h-6 bg-[var(--teal)] rounded-full" />
                            AI Comparative Intelligence
                        </h2>
                        <div className="prose prose-invert max-w-none text-gray-300 leading-relaxed font-medium">
                            <ReactMarkdown>{data.summary}</ReactMarkdown>
                        </div>
                    </motion.div>

                </motion.div>
            )}
        </motion.div>
    );
}
