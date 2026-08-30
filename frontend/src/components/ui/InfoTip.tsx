import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { GLOSSARY } from '../../lib/glossary';

/**
 * Hoverable help icon that explains a technical term in plain English.
 * Usage: <InfoTip term="pe" />  — term must exist in the glossary.
 */
export function InfoTip({ term, size = 12 }: { term: string; size?: number }) {
    const [open, setOpen] = useState(false);
    const text = GLOSSARY[term];
    if (!text) return null;
    return (
        <span
            className="relative inline-flex items-center align-middle ml-1"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
        >
            <HelpCircle
                size={size}
                className="text-gray-600 hover:text-[var(--teal)] cursor-help transition-colors"
            />
            {open && (
                <span
                    className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64
                               rounded-xl border border-[var(--teal)]/20 bg-[#0b1020]/98 p-3
                               text-[11px] leading-relaxed text-gray-300 shadow-2xl
                               backdrop-blur-md normal-case font-normal tracking-normal text-left"
                    style={{ pointerEvents: 'none' }}
                >
                    {text}
                    <span className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-[#0b1020]" />
                </span>
            )}
        </span>
    );
}
