import { cn } from '../../lib/utils';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    hover?: boolean;
}

export function Card({ children, className, hover = true }: CardProps) {
    return (
        <div
            className={cn(
                'glass-card p-6',
                hover && 'hover:shadow-xl hover:shadow-cyan-500/10',
                className
            )}
        >
            {children}
        </div>
    );
}
