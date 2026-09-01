import { Card } from './Card';
import { cn, getChangeColor, getChangeIcon } from '../../lib/utils';

interface MetricCardProps {
    label: string;
    value: string | number;
    change?: number;
    className?: string;
}

export function MetricCard({ label, value, change, className }: MetricCardProps) {
    return (
        <Card className={cn('p-5', className)}>
            <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-gray-400">
                    {label}
                </p>
                <p className="metric-value text-3xl">{value}</p>
                {change !== undefined && (
                    <p className={cn('text-sm font-semibold', getChangeColor(change))}>
                        {getChangeIcon(change)} {Math.abs(change).toFixed(2)}%
                    </p>
                )}
            </div>
        </Card>
    );
}
