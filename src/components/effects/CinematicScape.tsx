/**
 * Cinematic sunrise landscape — pure SVG + CSS (GPU-cheap, 60fps).
 * Layered mountain silhouettes, glowing sun, drifting clouds, fog banks
 * and a subtle constellation line, representing the global economy.
 */
export function CinematicScape() {
    return (
        <div className="relative w-full h-full overflow-hidden" aria-hidden>
            {/* sky */}
            <div className="absolute inset-0"
                style={{ background: 'linear-gradient(180deg, #060a14 0%, #0b1226 34%, #3b2137 62%, #b4552e 86%, #e8813f 100%)' }} />

            {/* sun + glow */}
            <div className="absolute left-[58%] top-[58%] -translate-x-1/2 -translate-y-1/2">
                <div className="w-40 h-40 rounded-full animate-[sunPulse_7s_ease-in-out_infinite]"
                    style={{ background: 'radial-gradient(circle, rgba(255,214,140,0.9) 0%, rgba(255,150,60,0.35) 40%, transparent 70%)' }} />
                <div className="absolute inset-0 m-auto w-10 h-10 rounded-full bg-[#ffe3a8] blur-[2px] shadow-[0_0_60px_25px_rgba(255,170,80,0.55)]" />
            </div>

            {/* drifting clouds */}
            <div className="absolute top-[18%] left-0 w-[130%] h-16 opacity-25 blur-2xl animate-[cloudDrift_48s_linear_infinite]"
                style={{ background: 'linear-gradient(90deg, transparent, #c9d6ff 20%, transparent 45%, #ffd9b0 70%, transparent 95%)' }} />
            <div className="absolute top-[34%] left-0 w-[140%] h-12 opacity-20 blur-2xl animate-[cloudDrift_64s_linear_infinite_reverse]"
                style={{ background: 'linear-gradient(90deg, transparent, #ffc9a0 30%, transparent 60%, #aebfff 85%, transparent)' }} />

            {/* mountains */}
            <svg className="absolute bottom-0 left-0 w-full h-[72%]" viewBox="0 0 1000 500" preserveAspectRatio="none">
                <path d="M0,300 L110,180 L200,260 L320,120 L430,250 L520,190 L640,290 L760,150 L870,260 L1000,200 L1000,500 L0,500 Z"
                    fill="#141b30" opacity="0.9" />
                <path d="M0,360 L90,270 L210,340 L330,230 L470,340 L580,270 L700,360 L830,250 L940,330 L1000,300 L1000,500 L0,500 Z"
                    fill="#0d1322" opacity="0.95" />
                <path d="M0,430 L140,360 L260,420 L400,340 L560,430 L700,370 L850,440 L1000,390 L1000,500 L0,500 Z"
                    fill="#080d18" />
                {/* river */}
                <path d="M470,500 C500,460 460,430 510,400 C540,380 520,360 540,345 L560,345 C545,365 570,380 545,405 C520,432 560,462 535,500 Z"
                    fill="url(#river)" opacity="0.8" />
                <defs>
                    <linearGradient id="river" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ffb46e" stopOpacity="0.9" />
                        <stop offset="100%" stopColor="#ff8f4a" stopOpacity="0.25" />
                    </linearGradient>
                </defs>
                {/* constellation market-line */}
                <g className="animate-[constPulse_5s_ease-in-out_infinite]">
                    <polyline points="620,240 700,180 770,215 840,140 910,170 970,110"
                        fill="none" stroke="#8ff7ea" strokeWidth="1.4" opacity="0.65" />
                    {[[620, 240], [700, 180], [770, 215], [840, 140], [910, 170], [970, 110]].map(([x, y], i) => (
                        <circle key={i} cx={x} cy={y} r="3.2" fill="#aefcf1" opacity="0.9" />
                    ))}
                </g>
            </svg>

            {/* fog banks */}
            <div className="absolute bottom-[16%] left-0 w-[130%] h-20 opacity-30 blur-3xl animate-[cloudDrift_38s_linear_infinite]"
                style={{ background: 'linear-gradient(90deg, transparent, #ffb98a 25%, transparent 55%, #b9c8ff 80%, transparent)' }} />
            <div className="absolute bottom-0 left-0 right-0 h-28"
                style={{ background: 'linear-gradient(180deg, transparent, rgba(6,10,20,0.95))' }} />

            <style>{`
                @keyframes sunPulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.12); opacity: 0.85; } }
                @keyframes cloudDrift { 0% { transform: translateX(-12%); } 100% { transform: translateX(6%); } }
                @keyframes constPulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
            `}</style>
        </div>
    );
}
