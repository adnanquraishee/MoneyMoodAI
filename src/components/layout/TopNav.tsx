import { NavLink, Link, useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { SearchBox } from './SearchBox';

const LINKS = [
    { label: 'Overview', to: '/app/', end: true },
    { label: 'Sectors', to: '/app/sectors' },
    { label: 'Heatmap', to: '/app/heatmap' },
    { label: 'Screener', to: '/app/screener' },
    { label: 'Stock Desk', to: '/app/stock' },
    { label: 'Watchlist', to: '/app/watchlist' },
    { label: 'Compare', to: '/app/compare' },
    { label: 'Learn', to: '/app/learn' },
];

/** Floating glass navigation bar — MoneyMood.ai brand + global search. */
export function TopNav() {
    const navigate = useNavigate();
    return (
        <header className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-[1500px]">
            <div className="flex items-center gap-4 px-5 py-2.5 rounded-2xl border border-white/10
                            bg-[#0a0f1d]/70 backdrop-blur-2xl shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
                {/* Brand */}
                <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
                    <img src="/logo.png" alt="MoneyMood.ai"
                        className="w-9 h-9 object-contain drop-shadow-[0_0_12px_rgba(0,245,212,0.35)]
                                   transition-transform duration-500 group-hover:scale-110 group-hover:rotate-[8deg]" />
                    <span className="text-lg font-bold tracking-tight hidden sm:block">
                        MoneyMood<span className="text-[var(--teal)]">.ai</span>
                    </span>
                </Link>

                {/* Links */}
                <nav className="flex items-center gap-1 ml-2">
                    {LINKS.map(l => (
                        <NavLink
                            key={l.to} to={l.to} end={l.end}
                            className={({ isActive }) =>
                                `relative px-3.5 py-2 text-sm font-semibold rounded-xl transition-all duration-300 group ${
                                    isActive ? 'text-[var(--teal)]' : 'text-gray-400 hover:text-white'}`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    {l.label}
                                    <span className={`absolute left-3 right-3 -bottom-0.5 h-[2px] rounded-full
                                        bg-gradient-to-r from-[var(--teal)] to-[#29B6FF]
                                        transition-all duration-300 origin-left
                                        ${isActive ? 'scale-x-100 opacity-100 shadow-[0_0_8px_rgba(0,245,212,0.8)]' : 'scale-x-0 opacity-0 group-hover:scale-x-100 group-hover:opacity-50'}`} />
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* Search + bell */}
                <div className="ml-auto flex items-center gap-3 flex-1 max-w-md justify-end">
                    <div className="flex-1 max-w-sm hidden md:block">
                        <SearchBox
                            placeholder="Search assets, companies, tickers…"
                            onSelect={(sym) => navigate(`/app/stock?symbol=${encodeURIComponent(sym)}`)}
                        />
                    </div>
                    <button
                        onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
                        className="hidden md:flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-white/10
                                   text-[11px] font-bold text-gray-500 hover:text-[var(--teal)]
                                   hover:border-[var(--teal)]/30 transition-all"
                        title="Command palette">
                        ⌘K
                    </button>
                    <button className="relative p-2.5 rounded-xl border border-white/10 text-gray-400
                                       hover:text-[var(--teal)] hover:border-[var(--teal)]/30 transition-all">
                        <Bell size={16} />
                        <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[var(--teal)] animate-ping" />
                        <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[var(--teal)]" />
                    </button>
                </div>
            </div>
        </header>
    );
}
