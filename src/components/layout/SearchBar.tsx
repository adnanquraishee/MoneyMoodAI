import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { api } from '../../lib/api';
import type { TickerOption } from '../../lib/types';
import { debounce } from '../../lib/utils';
import { Loader } from '../ui/Loader';

interface SearchBarProps {
    onStockSelect: (symbol: string) => void;
}

export function SearchBar({ onStockSelect }: SearchBarProps) {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<TickerOption[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);

    const searchStocks = async (searchQuery: string) => {
        if (!searchQuery.trim()) {
            setResults([]);
            return;
        }

        setIsLoading(true);
        try {
            const data = await api.searchStocks(searchQuery);
            setResults(data.results);
            setShowResults(true);
        } catch (error) {
            console.error('Search error:', error);
            setResults([]);
        } finally {
            setIsLoading(false);
        }
    };

    const debouncedSearch = debounce(searchStocks, 500);

    useEffect(() => {
        debouncedSearch(query);
    }, [query]);

    const handleSelect = (symbol: string) => {
        onStockSelect(symbol); // Prepares the parent (AppContent) state
        navigate(`/app/analysis?symbol=${symbol}`);
        setQuery('');
        setResults([]);
        setShowResults(false);
    };

    return (
        <div className="relative w-full max-w-2xl group">
            <div className="relative flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--teal)] opacity-50 group-focus-within:opacity-100 transition-opacity" size={20} />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && searchStocks(query)}
                        onFocus={() => results.length > 0 && setShowResults(true)}
                        placeholder="Search assets, companies, or tickers..."
                        className="w-full pl-14 pr-12 py-5 bg-[var(--obsidian2)] border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-[var(--teal)]/40 focus:ring-4 focus:ring-[var(--teal)]/5 transition-all font-medium text-lg shadow-2xl"
                    />
                    {query && (
                        <button
                            onClick={() => {
                                setQuery('');
                                setResults([]);
                                setShowResults(false);
                            }}
                            className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>
                
                <button 
                    onClick={() => searchStocks(query)}
                    className="h-[68px] px-8 bg-gradient-to-r from-[var(--teal)] to-[var(--teal-dim)] text-[var(--obsidian)] rounded-2xl font-bold uppercase tracking-widest text-xs hover:shadow-[0_0_30px_rgba(0,245,212,0.3)] transition-all active:scale-95 flex items-center gap-2"
                >
                    <Search size={18} />
                    Search
                </button>
            </div>

            {/* Search Results Dropdown */}
            {showResults && (results.length > 0 || isLoading) && (
                <div className="absolute top-full mt-2 w-full glass-card max-h-96 overflow-y-auto z-50">
                    {isLoading ? (
                        <div className="p-8">
                            <Loader text="Searching..." />
                        </div>
                    ) : (
                        <div className="p-2">
                            <p className="text-xs text-gray-400 px-3 py-2">
                                Found {results.length} result{results.length !== 1 ? 's' : ''}
                            </p>
                            {results.map((result: TickerOption) => (
                                <button
                                    key={result.ticker}
                                    onClick={() => handleSelect(result.ticker)}
                                    className="w-full text-left px-4 py-3 hover:bg-white/10 rounded-lg transition-colors group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-semibold text-white group-hover:text-primary transition-colors">
                                                {result.name}
                                            </p>
                                            <p className="text-sm text-gray-400">{result.ticker}</p>
                                        </div>
                                        <p className="text-xs text-gray-500">{result.exchange}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
