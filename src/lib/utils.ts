import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
    return clsx(inputs);
}

export function formatNumber(num: number | null | undefined, decimals: number = 2): string {
    if (num === null || num === undefined || isNaN(num)) return 'N/A';
    return num.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

export function formatCurrency(num: number | null | undefined, decimals: number = 2): string {
    if (num === null || num === undefined || isNaN(num)) return 'N/A';
    return `$${formatNumber(num, decimals)}`;
}

export function formatPercent(num: number | null | undefined, decimals: number = 2): string {
    if (num === null || num === undefined || isNaN(num)) return 'N/A';
    return `${formatNumber(num, decimals)}%`;
}

export function formatLargeNumber(num: number | null | undefined): string {
    if (num === null || num === undefined || isNaN(num)) return 'N/A';

    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;

    return formatCurrency(num);
}

export function getChangeColor(change: number | null | undefined): string {
    if (change === null || change === undefined || isNaN(change)) return 'text-gray-400';
    return change >= 0 ? 'text-success' : 'text-danger';
}

export function getChangeIcon(change: number | null | undefined): string {
    if (change === null || change === undefined || isNaN(change)) return '';
    return change >= 0 ? '▲' : '▼';
}

export function formatDate(dateString: string): string {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    } catch {
        return dateString;
    }
}

export function formatDateTime(dateString: string): string {
    try {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return dateString;
    }
}

export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;

    return function executedFunction(...args: Parameters<T>) {
        const later = () => {
            timeout = null;
            func(...args);
        };

        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
