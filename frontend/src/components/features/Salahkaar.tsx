import { useEffect, useRef, useState, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sparkles } from '@react-three/drei';
import ReactMarkdown from 'react-markdown';
import { Send, X, ShieldCheck } from 'lucide-react';
import * as THREE from 'three';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';

/* ------------------------------------------------------------------ */
/* 3D character: a holographic advisor — glowing head, blinking visor  */
/* eyes, a saffron "pagdi" ring, idle bobbing; nods while thinking.    */
/* ------------------------------------------------------------------ */
function Avatar({ thinking }: { thinking: boolean }) {
    const head = useRef<THREE.Group>(null);
    const eyeL = useRef<THREE.Mesh>(null);
    const eyeR = useRef<THREE.Mesh>(null);
    const ring = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        const t = state.clock.elapsedTime;
        if (head.current) {
            head.current.position.y = Math.sin(t * 1.6) * 0.06;
            head.current.rotation.y = Math.sin(t * 0.5) * 0.25 + (thinking ? Math.sin(t * 6) * 0.06 : 0);
            head.current.rotation.x = thinking ? Math.sin(t * 3.2) * 0.12 : Math.sin(t * 0.8) * 0.04;
        }
        // blink every ~3s
        const blink = Math.abs(Math.sin(t * 0.33 * Math.PI)) > 0.985 ? 0.12 : 1;
        if (eyeL.current) eyeL.current.scale.y = blink;
        if (eyeR.current) eyeR.current.scale.y = blink;
        if (ring.current) ring.current.rotation.z = t * (thinking ? 1.6 : 0.4);
    });

    const teal = '#00e5cf';
    const saffron = '#fbbf24';

    return (
        <Float speed={1.4} rotationIntensity={0.1} floatIntensity={0.25}>
            <group ref={head}>
                {/* head */}
                <mesh>
                    <sphereGeometry args={[0.72, 48, 48]} />
                    <meshStandardMaterial color="#12233b" roughness={0.25} metalness={0.7}
                        emissive={teal} emissiveIntensity={0.12} />
                </mesh>
                {/* visor */}
                <mesh position={[0, 0.06, 0.52]} rotation={[-0.08, 0, 0]}>
                    <capsuleGeometry args={[0.3, 0.5, 8, 16]} />
                    <meshStandardMaterial color="#0a1526" roughness={0.1} metalness={0.9}
                        transparent opacity={0.9} />
                </mesh>
                {/* eyes */}
                <mesh ref={eyeL} position={[-0.18, 0.09, 0.72]}>
                    <sphereGeometry args={[0.075, 16, 16]} />
                    <meshBasicMaterial color={teal} />
                </mesh>
                <mesh ref={eyeR} position={[0.18, 0.09, 0.72]}>
                    <sphereGeometry args={[0.075, 16, 16]} />
                    <meshBasicMaterial color={teal} />
                </mesh>
                {/* smile */}
                <mesh position={[0, -0.22, 0.66]} rotation={[0.5, 0, 0]}>
                    <torusGeometry args={[0.16, 0.022, 12, 24, Math.PI]} />
                    <meshBasicMaterial color={teal} transparent opacity={0.8} />
                </mesh>
                {/* pagdi (advisor's turban ring) */}
                <mesh position={[0, 0.5, 0]} rotation={[0.35, 0, 0]}>
                    <torusGeometry args={[0.55, 0.13, 16, 48]} />
                    <meshStandardMaterial color={saffron} roughness={0.35} metalness={0.4}
                        emissive={saffron} emissiveIntensity={0.25} />
                </mesh>
                <mesh position={[0, 0.78, 0.1]}>
                    <sphereGeometry args={[0.11, 16, 16]} />
                    <meshStandardMaterial color={teal} emissive={teal} emissiveIntensity={0.8} />
                </mesh>
                {/* collar */}
                <mesh ref={ring} position={[0, -0.85, 0]} rotation={[Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[0.62, 0.02, 8, 48]} />
                    <meshBasicMaterial color={teal} transparent opacity={0.5} />
                </mesh>
            </group>
            <Sparkles count={18} scale={2.6} size={1.4} speed={0.4} color={teal} opacity={0.5} />
        </Float>
    );
}

function AvatarCanvas({ thinking, className }: { thinking: boolean; className?: string }) {
    return (
        <div className={className}>
            <Canvas camera={{ position: [0, 0, 3.1], fov: 42 }} dpr={[1, 1.6]}
                gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}>
                <ambientLight intensity={0.6} />
                <directionalLight position={[2, 3, 4]} intensity={1.2} />
                <pointLight position={[-3, -1, 2]} intensity={0.4} color="#4361ee" />
                <Suspense fallback={null}>
                    <Avatar thinking={thinking} />
                </Suspense>
            </Canvas>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* Chat widget                                                         */
/* ------------------------------------------------------------------ */
interface Msg { role: 'user' | 'assistant'; content: string }

const WELCOME: Msg = {
    role: 'assistant',
    content: "Namaste! Main hoon **SALAHKAAR** — your finance education guide. " +
        "Ask me about P/E, ROE, ROCE, Debt/Equity, balance sheets, or what any " +
        "number on this platform means. \n\n*Dhyan rahe: I explain, I never advise — " +
        "no buy/sell calls, no target prices (SEBI compliance).*",
};

export function Salahkaar() {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<Msg[]>([WELCOME]);
    const [input, setInput] = useState('');
    const [thinking, setThinking] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const location = useLocation();

    const symbol = location.pathname.includes('/stock')
        ? new URLSearchParams(location.search).get('symbol') : null;

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, thinking, open]);

    const send = async () => {
        const text = input.trim();
        if (!text || thinking) return;
        const next: Msg[] = [...messages, { role: 'user', content: text }];
        setMessages(next);
        setInput('');
        setThinking(true);
        try {
            const res = await api.sendChat(
                next.filter(m => m !== WELCOME).map(m => ({ role: m.role, content: m.content })),
                symbol,
            );
            setMessages(m => [...m, { role: 'assistant', content: res.reply }]);
        } catch {
            setMessages(m => [...m, {
                role: 'assistant',
                content: 'I could not reach my knowledge service — please try again shortly.',
            }]);
        } finally {
            setThinking(false);
        }
    };

    return (
        <>
            {/* Floating character button */}
            {!open && (
                <button
                    onClick={() => setOpen(true)}
                    className="fixed bottom-16 right-6 z-50 group"
                    title="Ask SALAHKAAR"
                >
                    <div className="relative w-20 h-20 rounded-full border border-[var(--teal)]/30
                                    bg-[#0b1020]/80 backdrop-blur-xl shadow-[0_0_30px_rgba(0,245,212,0.25)]
                                    group-hover:shadow-[0_0_45px_rgba(0,245,212,0.45)] group-hover:scale-105
                                    transition-all duration-300 overflow-hidden">
                        <AvatarCanvas thinking={false} className="w-full h-full" />
                    </div>
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400
                                     border-2 border-[#0b1020] animate-pulse" />
                    <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-bold
                                     tracking-[0.2em] text-[var(--teal)] whitespace-nowrap">
                        SALAHKAAR
                    </span>
                </button>
            )}

            {/* Chat panel */}
            {open && (
                <div className="fixed bottom-6 right-6 z-50 w-[400px] max-w-[calc(100vw-2rem)]
                                h-[600px] max-h-[calc(100vh-6rem)] flex flex-col rounded-3xl
                                border border-[var(--teal)]/20 bg-[#0a0f1e]/95 backdrop-blur-2xl
                                shadow-[0_20px_80px_rgba(0,0,0,0.7),0_0_40px_rgba(0,245,212,0.12)]
                                animate-[fadeIn_0.25s_ease] overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10
                                    bg-gradient-to-r from-[var(--teal)]/10 to-transparent">
                        <AvatarCanvas thinking={thinking} className="w-14 h-14 shrink-0" />
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-white tracking-wide">SALAHKAAR</h3>
                            <p className="text-[10px] text-gray-400 flex items-center gap-1">
                                <ShieldCheck size={11} className="text-emerald-400" />
                                SEBI-compliant education guide {symbol ? `· viewing ${symbol.replace('.NS', '')}` : ''}
                            </p>
                        </div>
                        <button onClick={() => setOpen(false)}
                            className="text-gray-500 hover:text-white transition-colors"><X size={18} /></button>
                    </div>

                    {/* Messages */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                        {messages.map((m, i) => (
                            <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                                <div className={cn(
                                    'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed',
                                    m.role === 'user'
                                        ? 'bg-[var(--teal)]/15 border border-[var(--teal)]/25 text-white rounded-br-md'
                                        : 'bg-white/[0.05] border border-white/10 text-gray-200 rounded-bl-md'
                                )}>
                                    <div className="prose prose-invert prose-sm max-w-none
                                                    prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5
                                                    prose-strong:text-[var(--teal)]">
                                        <ReactMarkdown>{m.content}</ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {thinking && (
                            <div className="flex justify-start">
                                <div className="bg-white/[0.05] border border-white/10 rounded-2xl rounded-bl-md px-4 py-3">
                                    <span className="flex gap-1.5">
                                        {[0, 1, 2].map(i => (
                                            <span key={i}
                                                className="w-1.5 h-1.5 rounded-full bg-[var(--teal)] animate-bounce"
                                                style={{ animationDelay: `${i * 0.15}s` }} />
                                        ))}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input */}
                    <div className="px-4 pb-2 pt-2 border-t border-white/10">
                        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl
                                        px-3 py-2 focus-within:border-[var(--teal)]/40 transition-colors">
                            <input
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && send()}
                                placeholder={symbol ? `Ask about ${symbol.replace('.NS', '')} or any concept…` : 'Ask about any ratio or concept…'}
                                className="flex-1 bg-transparent outline-none text-sm placeholder:text-gray-600"
                            />
                            <button onClick={send} disabled={thinking || !input.trim()}
                                className="text-[var(--teal)] disabled:text-gray-700 hover:scale-110 transition-transform">
                                <Send size={17} />
                            </button>
                        </div>
                        <p className="text-[9px] text-gray-600 text-center mt-1.5">
                            Educational only · Not SEBI-registered investment advice · Powered by Groq (temp 0.0)
                        </p>
                    </div>
                </div>
            )}
        </>
    );
}
