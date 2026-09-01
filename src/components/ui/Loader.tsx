import { Banknote } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';

interface LoaderProps {
    size?: number;
    className?: string;
    text?: string;
}

export function Loader({ size = 32, className, text }: LoaderProps) {
    return (
        <div className={cn('flex flex-col items-center justify-center gap-4', className)}>
            <motion.div
                animate={{ 
                    y: [0, -10, 0],
                    rotateY: [0, 180, 360],
                    rotateZ: [-5, 5, -5]
                }}
                transition={{ 
                    duration: 2.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
                className="relative text-[var(--teal)] drop-shadow-[0_0_15px_rgba(0,245,212,0.4)]"
                style={{ transformStyle: 'preserve-3d' }}
            >
                <Banknote size={size} strokeWidth={1.5} />
            </motion.div>
            {text && (
                <motion.p 
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="text-xs font-bold tracking-[0.2em] uppercase text-[var(--silver)] transparent"
                >
                    {text}
                </motion.p>
            )}
        </div>
    );
}
