import { useEffect, useRef, useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';

interface Option { ticker: string; name: string; exchange: string }

/**
 * Debounced company-name search with a dropdown of Indian (NSE/BSE) matches.
 * The user types "tata elx" — never needs to know the exact ticker.
 */
export function SearchBox({ onSelect, placeholder = 'Search any Indian company…', autoFocus = false }: {
    onSelect: (symbol: string, name: string) => void;
    placeholder?: string;
    autoFocus?: boolean;
}) {
    const [query, setQuery] = useState('');
    const [options, setOptions] = useState<Option[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const boxRef = useRef<HTMLDivElement>(null);
    const timer = useRef<ReturnType<typeof setTimeout>>();

    useEffect(() => {
        if (query.trim().length < 2) { setOptions([]); setOpen(false); return; }
        setLoading(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(async () => {
            try {
                const res = await api.searchStocks(query.trim());
                setOptions(res.results as Option[]);
                setOpen(true);
                setHighlight(0);
            } catch { setOptions([]); }
            finally { setLoading(false); }
        }, 300);
        return () => clearTimeout(timer.current);
    }, [query]);

    useEffect(() => {
        const close = (e: MouseEvent) => {
            if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const pick = (opt: Option) => {
        onSelect(opt.ticker, opt.name);
        setQuery('');
        setOpen(false);
    };

    const onKey = (e: React.KeyboardEvent) => {
        if (!open || options.length === 0) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, options.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
        else if (e.key === 'Enter') { e.preventDefault(); pick(options[highlight]); }
        else if (e.key === 'Escape') setOpen(false);
    };

    return (
        <div ref={boxRef} className="relative w-full max-w-md">
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5
                            focus-within:border-[var(--teal)]/50 focus-within:shadow-[0_0_20px_rgba(0,245,212,0.08)] transition-all">
                {loading
                    ? <Loader2 size={16} className="text-[var(--teal)] animate-spin shrink-0" />
                    : <Search size={16} className="text-gray-500 shrink-0" />}
                <input
                    value={query}
                    autoFocus={autoFocus}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={onKey}
                    onFocus={() => options.length > 0 && setOpen(true)}
                    placeholder={placeholder}
                    className="bg-transparent outline-none text-sm w-full placeholder:text-gray-600"
                />
            </div>
            {open && (
                <div className="absolute z-50 mt-2 w-full rounded-xl border border-white/10 bg-[#0b1020]/98
                                backdrop-blur-xl shadow-2xl overflow-hidden">
                    {options.length === 0 && !loading && (
                        <p className="px-4 py-3 text-xs text-gray-500">No Indian listings found for “{query}”.</p>
                    )}
                    {options.map((opt, i) => (
                        <button
                            key={opt.ticker}
                            onMouseEnter={() => setHighlight(i)}
                            onClick={() => pick(opt)}
                            className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors
                                        ${i === highlight ? 'bg-[var(--teal)]/10' : ''}`}
                        >
                            <span>
                                <span className="block text-sm font-semibold text-white">{opt.name}</span>
                                <span className="block text-[11px] text-gray-500">{opt.ticker}</span>
                            </span>
                            <span className="text-[10px] font-bold text-gray-500 border border-white/10 rounded px-1.5 py-0.5">
                                {opt.exchange}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
