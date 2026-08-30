import { useEffect, useRef, useState } from 'react';
import {
    createChart, ColorType, CandlestickSeries, HistogramSeries, LineSeries,
    type IChartApi, type Time,
} from 'lightweight-charts';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';

const PERIODS = [
    { label: '1M', period: '1mo', interval: '1d' },
    { label: '3M', period: '3mo', interval: '1d' },
    { label: '6M', period: '6mo', interval: '1d' },
    { label: '1Y', period: '1y', interval: '1d' },
    { label: '2Y', period: '2y', interval: '1d' },
    { label: '5Y', period: '5y', interval: '1wk' },
] as const;

const UP = '#34d399';
const DOWN = '#fb7185';

/** Professional TradingView-style candlestick chart with volume and MAs. */
export function CandleChart({ symbol }: { symbol: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const [sel, setSel] = useState<typeof PERIODS[number]>(PERIODS[3]);
    const [showMA, setShowMA] = useState({ ma20: false, ma50: true, ma200: true });

    const { data, isLoading, isError } = useQuery({
        queryKey: ['ohlc', symbol, sel.period, sel.interval],
        queryFn: () => api.getOhlc(symbol, sel.period, sel.interval),
        staleTime: 5 * 60_000,
    });

    useEffect(() => {
        if (!containerRef.current || !data) return;

        const chart = createChart(containerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#64748b',
                fontSize: 11,
                attributionLogo: false,
            },
            grid: {
                vertLines: { color: 'rgba(255,255,255,0.04)' },
                horzLines: { color: 'rgba(255,255,255,0.04)' },
            },
            rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
            timeScale: { borderColor: 'rgba(255,255,255,0.1)', timeVisible: sel.interval.endsWith('m') },
            crosshair: {
                horzLine: { color: 'rgba(0,245,212,0.4)', labelBackgroundColor: '#0d9488' },
                vertLine: { color: 'rgba(0,245,212,0.4)', labelBackgroundColor: '#0d9488' },
            },
            height: 460,
            autoSize: true,
        });
        chartRef.current = chart;

        const candles = chart.addSeries(CandlestickSeries, {
            upColor: UP, downColor: DOWN,
            wickUpColor: UP, wickDownColor: DOWN,
            borderVisible: false,
        });
        candles.setData(data.time.map((t, i) => ({
            time: t as Time,
            open: data.open[i], high: data.high[i], low: data.low[i], close: data.close[i],
        })));

        const volume = chart.addSeries(HistogramSeries, {
            priceFormat: { type: 'volume' },
            priceScaleId: 'vol',
        });
        chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
        volume.setData(data.time.map((t, i) => ({
            time: t as Time,
            value: data.volume[i],
            color: data.close[i] >= data.open[i] ? 'rgba(52,211,153,0.35)' : 'rgba(251,113,133,0.35)',
        })));

        const maDefs: { key: 'ma20' | 'ma50' | 'ma200'; color: string }[] = [
            { key: 'ma20', color: '#fbbf24' },
            { key: 'ma50', color: '#38bdf8' },
            { key: 'ma200', color: '#c084fc' },
        ];
        for (const { key, color } of maDefs) {
            if (!showMA[key]) continue;
            const series = chart.addSeries(LineSeries, {
                color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
                crosshairMarkerVisible: false,
            });
            series.setData(
                data.time
                    .map((t, i) => ({ time: t as Time, value: data[key][i] }))
                    .filter((p): p is { time: Time; value: number } => p.value != null)
            );
        }

        chart.timeScale().fitContent();
        return () => { chart.remove(); chartRef.current = null; };
    }, [data, showMA, sel.interval]);

    return (
        <div>
            <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                <div className="flex gap-1">
                    {PERIODS.map(p => (
                        <button
                            key={p.label}
                            onClick={() => setSel(p)}
                            className={cn(
                                'px-3 py-1 rounded-lg text-xs font-bold transition-all',
                                sel.label === p.label
                                    ? 'bg-[var(--teal)]/15 text-[var(--teal)] border border-[var(--teal)]/30'
                                    : 'text-gray-500 hover:text-white border border-transparent'
                            )}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                <div className="flex gap-3 text-[11px]">
                    {([['ma20', '#fbbf24', 'MA 20'], ['ma50', '#38bdf8', 'MA 50'], ['ma200', '#c084fc', 'MA 200']] as const).map(([key, color, label]) => (
                        <button
                            key={key}
                            onClick={() => setShowMA(m => ({ ...m, [key]: !m[key] }))}
                            className={cn('flex items-center gap-1.5 font-semibold transition-opacity',
                                showMA[key] ? 'opacity-100' : 'opacity-35')}
                        >
                            <i className="w-3 h-0.5 inline-block rounded" style={{ background: color }} />
                            <span className="text-gray-300">{label}</span>
                        </button>
                    ))}
                </div>
            </div>
            {isLoading && <div className="h-[460px] rounded-xl bg-white/5 animate-pulse" />}
            {isError && <div className="h-[460px] flex items-center justify-center text-sm text-rose-300">No chart data available for {symbol}.</div>}
            <div ref={containerRef} className={isLoading || isError ? 'hidden' : ''} />
        </div>
    );
}
