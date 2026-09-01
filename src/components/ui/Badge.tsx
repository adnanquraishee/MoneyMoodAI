import { cn } from '../../lib/utils';

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'success' | 'danger' | 'warning' | 'info' | 'neutral';
    className?: string;
    style?: React.CSSProperties;
}

export function Badge({ children, variant = 'neutral', className, style }: BadgeProps) {
    const variants = {
        success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        danger: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
        warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        info: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
        neutral: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
    };

    return (
        <span
            style={style}
            className={cn(
                'px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider border',
                variants[variant],
                className
            )}
        >
            {children}
        </span>
    );
}
