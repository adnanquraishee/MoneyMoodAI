import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass, MoveRight } from 'lucide-react';
import { api } from '../lib/api';
import type { SectorRotationItem } from '../lib/types';
import { SectorRotationScene, QUADRANT_COLORS } from '../components/3d/SectorRotationScene';
import { TiltCard } from '../components/ui/TiltCard';
import { cn } from '../lib/utils';

const QUADRANT_META: Record<SectorRotationItem['quadrant'], { label: string; blurb: string }> = {
    leading: { label: 'Leading', blurb: 'Beating NIFTY and still accelerating' },
    weakening: { label: 'Weakening', blurb: 'Still ahead of NIFTY, but losing steam' },
    improving: { label: 'Improving', blurb: 'Behind NIFTY, but gaining momentum' },
    lagging: { label: 'Lagging', blurb: 'Behind NIFTY and falling further back' },
};
const QUADRANT_ORDER: SectorRotationItem['quadrant'][] = ['leading', 'improving', 'weakening', 'lagging'];

function mcapLabel(v: number) {
    if (v >= 1e12) return `₹${(v / 1e12).toFixed(1)}L Cr`;
    if (v >= 1e9) return `₹${(v / 1e9).toFixed(0)}k Cr`;
    return `₹${(v / 1e7).toFixed(0)} Cr`;
}

export function Sectors() {
    const { data, isLoading } = useQuery({
        queryKey: ['sector-rotation'],
        queryFn: api.getSectorRotation,
        refetchInterval: 10 * 60_000,
    });
    const [highlight, setHighlight] = useState<string | null>(null);
    const sectors = data?.sectors ?? [];

    return (
        <div className="px-8 lg:px-12 pb-16">
            <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
                <div className="flex items-center gap-3">
                    <span className="p-2.5 rounded-xl border border-[var(--teal)]/25 bg-[var(--teal)]/10">
                        <Compass size={20} className="text-[var(--teal)]" />
                    </span>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Sector Rotation</h1>
                        <p className="text-sm text-gray-400">
                            Where money is moving — every sector vs NIFTY, with 8 weeks of motion trails.
                            Drag to orbit, hover a sphere for details.
                        </p>
                    </div>
                </div>
            </motion.div>

            <div className="mt-6 grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4">
                {/* 3D quadrant */}
                <TiltCard className="relative h-[600px] overflow-hidden" maxTilt={0}>
                    {isLoading || !sectors.length ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                            <div className="w-10 h-10 rounded-full border-2 border-[var(--teal)]/30 border-t-[var(--teal)] animate-spin" />
                            <p className="text-xs text-gray-500">
                                {isLoading ? 'Computing sector relative strength…'
                                    : 'Warming up — sector data appears once the universe scan has enough history.'}
                            </p>
                        </div>
                    ) : (
                        <SectorRotationScene sectors={sectors} highlight={highlight} onHover={setHighlight} />
                    )}
                </TiltCard>

                {/* quadrant legend */}
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                    {QUADRANT_ORDER.map((q, qi) => {
                        const items = sectors.filter(s => s.quadrant === q);
                        const color = QUADRANT_COLORS[q];
                        return (
                            <motion.div key={q}
                                initial={{ opacity: 0, x: 24 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 * qi, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            >
                                <TiltCard className="p-4" maxTilt={4}>
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                                        <p className="text-sm font-bold" style={{ color }}>{QUADRANT_META[q].label}</p>
                                        <span className="text-[10px] text-gray-500 ml-auto">{items.length} sectors</span>
                                    </div>
                                    <p className="text-[10px] text-gray-500 mt-0.5">{QUADRANT_META[q].blurb}</p>
                                    <AnimatePresence>
                                        <ul className="mt-2.5 space-y-1.5">
                                            {items.map(s => (
                                                <motion.li key={s.sector} layout
                                                    onMouseEnter={() => setHighlight(s.sector)}
                                                    onMouseLeave={() => setHighlight(null)}
                                                    className={cn(
                                                        'flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-default transition-colors',
                                                        highlight === s.sector ? 'bg-white/10' : 'hover:bg-white/5',
                                                    )}
                                                >
                                                    <span className="text-xs text-gray-200 truncate">{s.sector}</span>
                                                    <span className="ml-auto text-[10px] text-gray-500 tabular-nums shrink-0">
                                                        {mcapLabel(s.market_cap)}
                                                    </span>
                                                    {s.avg_change_pct != null && (
                                                        <span className="text-[10px] font-bold tabular-nums shrink-0"
                                                            style={{ color: s.avg_change_pct >= 0 ? '#00FF9D' : '#FF4D6D' }}>
                                                            {s.avg_change_pct >= 0 ? '+' : ''}{s.avg_change_pct}%
                                                        </span>
                                                    )}
                                                </motion.li>
                                            ))}
                                            {!items.length && (
                                                <li className="text-[11px] text-gray-600 px-2 py-1">— none right now</li>
                                            )}
                                        </ul>
                                    </AnimatePresence>
                                </TiltCard>
                            </motion.div>
                        );
                    })}
                    <Link to="/app/heatmap"
                        className="flex items-center gap-2 text-xs font-bold text-[var(--teal)] px-2 group">
                        See the heatmap view
                        <MoveRight size={14} className="transition-transform group-hover:translate-x-1" />
                    </Link>
                </div>
            </div>
        </div>
    );
}
