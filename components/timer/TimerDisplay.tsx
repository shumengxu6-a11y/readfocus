import React, { useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { TimerMode } from '../Timer';

interface TimerDisplayProps {
    mode: TimerMode;
    timeStr: string;
    isActive: boolean;
    totalSeconds: number;
    timeLeft: number;
    canvasRef?: React.RefObject<HTMLCanvasElement | null>; // Optional for PiP stream
}

export const TimerDisplay: React.FC<TimerDisplayProps> = ({ mode, timeStr, isActive, totalSeconds, timeLeft, canvasRef }) => {
    const internalCanvasRef = useRef<HTMLCanvasElement>(null);

    // Decide which ref to use: the parent one (for video stream) or internal one
    const canvasToUse = canvasRef || internalCanvasRef;

    // Sync with Canvas (for Video PiP Fallback Stream)
    // We keep this purely to support the Video Stream generation if needed
    useEffect(() => {
        const canvas = canvasToUse.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size for high resolution
        canvas.width = 1200;
        canvas.height = 800;

        const draw = () => {
            // Clear background
            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const radius = 250;
            const lineWidth = 20;

            // 1. Draw Background Ring
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.lineWidth = lineWidth;
            ctx.strokeStyle = '#222222';
            ctx.stroke();

            // 2. Draw Progress Ring
            if (mode !== 'countup') {
                const progress = timeLeft / totalSeconds;
                const startAngle = -Math.PI / 2;
                const endAngle = startAngle + (2 * Math.PI * progress);

                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, startAngle, endAngle);
                ctx.lineWidth = lineWidth;
                ctx.strokeStyle = isActive
                    ? (mode === 'break' ? '#22c55e' : '#3b82f6')
                    : '#555555';
                ctx.lineCap = 'round';

                // Add Glow Effect
                if (isActive) {
                    ctx.shadowBlur = 30;
                    ctx.shadowColor = mode === 'break' ? '#22c55e' : '#3b82f6';
                } else {
                    ctx.shadowBlur = 0;
                }

                ctx.stroke();
                ctx.shadowBlur = 0;
            }

            // 3. Draw Time Text
            ctx.fillStyle = mode === 'break' ? '#4ade80' : '#ffffff';
            ctx.font = 'bold 180px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(timeStr, centerX, centerY + 20);

            // 4. Draw Status Text
            ctx.font = '30px sans-serif';
            ctx.fillStyle = isActive
                ? (mode === 'break' ? '#22c55e' : '#3b82f6')
                : '#666666';
            ctx.fillText(isActive ? (mode === 'break' ? "R E S T I N G" : "F O C U S I N G") : "PAUSED", centerX, centerY + 140);
        };

        draw();

    }, [mode, timeStr, isActive, totalSeconds, timeLeft, canvasToUse]);

    return (
        <div className="relative group z-10 select-none flex flex-col items-center justify-center">
            {/* 
          This canvas is usually hidden in Main View, but populated for Video Stream.
          If we are rendering IN the PiP Window, we might want to show HTML instead.
       */}
            <canvas ref={canvasToUse} className="hidden" />

            {/* HTML Rendering for Main View or Window PiP */}
            <div className={clsx(
                "absolute -inset-4 rounded-full border-2 w-[300px] h-[300px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-1000 pointer-events-none",
                mode === 'break' ? "border-green-500/20" : "border-blue-500/20",
                isActive ? "scale-110 opacity-100 animate-pulse" : "scale-100 opacity-0"
            )}></div>

            <div className={clsx(
                "text-9xl font-bold font-mono tracking-tighter drop-shadow-2xl relative z-10 w-[320px] text-center",
                mode === 'break' ? "text-green-400" : "text-white"
            )}>
                {timeStr}
            </div>

            {/* Subtext status */}
            <div className={clsx(
                "absolute bottom-[-40px] text-sm tracking-[0.5em] font-medium uppercase transition-colors",
                isActive ? (mode === 'break' ? "text-green-500" : "text-blue-500") : "text-gray-600"
            )}>
                {isActive ? (mode === 'break' ? "Resting" : "Focusing") : "Paused"}
            </div>
        </div>
    );
};
