"use client";

import { useState, useEffect } from "react";
import { clsx } from "clsx";

export function DailyStats() {
    const [totalFocusMinutes, setTotalFocusMinutes] = useState(0);

    useEffect(() => {
        // Load local stats
        const today = new Date().toISOString().split('T')[0];
        const key = `readfocus_stats_${today}`;
        const stored = localStorage.getItem(key);
        if (stored) {
            setTotalFocusMinutes(parseInt(stored, 10));
        }
    }, []);

    // Expose a method to update stats (via custom event or exported context in future refactor)
    // For now, this component will just read. We need a way to WRITE to it from parent.
    // Actually, we can listen to a custom window event "focus-completed"

    useEffect(() => {
        const handleFocusComplete = (e: CustomEvent<{ minutes: number }>) => {
            const minutes = e.detail.minutes;
            setTotalFocusMinutes(prev => {
                const newVal = prev + minutes;
                const today = new Date().toISOString().split('T')[0];
                localStorage.setItem(`readfocus_stats_${today}`, newVal.toString());
                return newVal;
            });
        };

        window.addEventListener('focus-completed', handleFocusComplete as EventListener);
        return () => {
            window.removeEventListener('focus-completed', handleFocusComplete as EventListener);
        };
    }, []);

    return (
        <div className="fixed bottom-6 right-8 z-20 flex flex-col items-end pointer-events-none select-none animate-in fade-in slide-in-from-right-4 duration-700">
            <div className="flex items-baseline space-x-1">
                <span className="text-4xl font-bold text-white/10 font-mono">
                    {Math.floor(totalFocusMinutes / 60)}<span className="text-base text-white/10">h</span>
                    {totalFocusMinutes % 60}<span className="text-base text-white/10">m</span>
                </span>
            </div>
            <div className="text-[10px] tracking-[0.2em] uppercase text-white/20 mt-1">
                Today's Focus
            </div>
        </div>
    );
}
