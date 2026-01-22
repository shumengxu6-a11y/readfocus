"use client";

import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Play, Pause, RotateCcw, Coffee, PictureInPicture } from 'lucide-react';
import { clsx } from 'clsx';

export interface TimerHandle {
  startBreak: (minutes: number) => void;
  switchMode: (mode: TimerMode) => void;
}

export type TimerMode = 'pomodoro' | 'custom' | 'countup' | 'break';

interface TimerProps {
  onComplete: (mode?: TimerMode) => void;
  quote?: string | null;
}

const TimerComponent = forwardRef<TimerHandle, TimerProps>(({ onComplete, quote }, ref) => {
  const [mode, setMode] = useState<TimerMode>('pomodoro');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [countUpTime, setCountUpTime] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(45);
  const [breakMinutes, setBreakMinutes] = useState(5);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null); // Audio ref for completion sound

  // PiP Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useImperativeHandle(ref, () => ({
    startBreak: (minutes: number) => {
      setMode('break');
      setBreakMinutes(minutes); // Update state to reflect start param
      setTimeLeft(minutes * 60);
      setIsActive(true);
    },
    switchMode: (newMode: TimerMode) => {
      switchMode(newMode);
    }
  }));

  // Helper to wrap text for canvas
  const wrapText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
    const words = text.split(''); // Split by char for Chinese support
    let line = '';
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n];
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, currentY);
        line = words[n];
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, currentY);
  };

  // Request notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    }
    // Initialize audio
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // PiP: Draw timer OR Quote to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size for high resolution (Retina/High DPI)
    canvas.width = 1200;
    canvas.height = 800;

    const draw = () => {
      // Clear background
      ctx.fillStyle = '#0a0a0a'; // Dark background
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (quote) {
        // --- DRAW QUOTE MODE ---
        ctx.fillStyle = '#ededed';
        ctx.font = 'bold 48px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        wrapText(ctx, quote, canvas.width / 2, 150, 1000, 64);

        ctx.font = '32px sans-serif';
        ctx.fillStyle = '#888888';
        ctx.fillText("回到页面开始专注", canvas.width / 2, canvas.height - 50);

      } else {
        // --- DRAW TIMER MODE ---
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
          // Total calculation moved later or duplicated if needed for progress
          const total = mode === 'custom' ? customMinutes * 60 : (mode === 'break' ? breakMinutes * 60 : 25 * 60);
          const progress = timeLeft / total;

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

          // Reset Shadow
          ctx.shadowBlur = 0;
        }

        // 2.5 Calculate Total for Ring
        const total = mode === 'custom' ? customMinutes * 60 : (mode === 'break' ? breakMinutes * 60 : 25 * 60);

        // 3. Draw Time Text
        ctx.fillStyle = mode === 'break' ? '#4ade80' : '#ffffff';
        ctx.font = 'bold 180px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const timeStr = mode === 'countup' ? formatTime(countUpTime) : formatTime(timeLeft);
        ctx.fillText(timeStr, centerX, centerY + 20);

        // 4. Draw Status Text
        ctx.font = '30px sans-serif';
        ctx.fillStyle = isActive
          ? (mode === 'break' ? '#22c55e' : '#3b82f6')
          : '#666666';
        ctx.fillText(isActive ? (mode === 'break' ? "R E S T I N G" : "F O C U S I N G") : "PAUSED", centerX, centerY + 140);
      }
    };

    draw();

    if (video.srcObject === null) {
      const stream = canvas.captureStream(30);
      video.srcObject = stream;
      video.play().catch(() => { });
    }

  }, [timeLeft, countUpTime, mode, isActive, customMinutes, quote]);

  const togglePiP = async () => {
    if (!videoRef.current) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (e) {
      console.error('PiP failed:', e);
      alert('Failed to enter Picture-in-Picture. Please try interacting with the page first.');
    }
  };

  useEffect(() => {
    const notifyComplete = () => {
      if (audioRef.current) {
        audioRef.current.play().catch(e => console.log('Audio play failed:', e));
      }
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification("Time's up!", {
          body: mode === 'break' ? "Break is over! Ready to focus?" : "Great focus session! Take a break.",
          icon: "/favicon.ico"
        });
      }
      document.title = "🔔 Time's Up! - ReadFocus";
    };

    if (isActive) {
      document.title = `(${mode === 'countup' ? formatTime(countUpTime) : formatTime(timeLeft)}) ReadFocus`;
      timerRef.current = setInterval(() => {
        if (mode === 'countup') {
          setCountUpTime(prev => prev + 1);
        } else {
          setTimeLeft((prev) => {
            if (prev <= 1) {
              clearInterval(timerRef.current!);
              setIsActive(false);
              notifyComplete();
              setTimeout(() => {
                onComplete(mode); // Pass mode to parent
              }, 0);
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (!isActive && timeLeft > 0) document.title = "ReadFocus";
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, mode, onComplete, timeLeft, countUpTime]);

  const toggleTimer = () => setIsActive(!isActive);

  const resetTimer = () => {
    setIsActive(false);
    if (mode === 'pomodoro') setTimeLeft(25 * 60);
    else if (mode === 'custom') setTimeLeft(customMinutes * 60);
    else if (mode === 'break') setTimeLeft(breakMinutes * 60);
    else if (mode === 'countup') setCountUpTime(0);
  };

  const switchMode = (newMode: TimerMode) => {
    setMode(newMode);
    setIsActive(false);
    if (newMode === 'pomodoro') setTimeLeft(25 * 60);
    else if (newMode === 'custom') setTimeLeft(customMinutes * 60);
    else if (newMode === 'break') setTimeLeft(breakMinutes * 60);
    else if (newMode === 'countup') setCountUpTime(0);
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-10 w-full max-w-lg mx-auto transform transition-all">

      {/* Hidden Canvas & Video for PiP */}
      <canvas ref={canvasRef} width={300} height={150} className="hidden" />
      <video ref={videoRef} className="hidden" muted playsInline />

      {/* Mode Switcher */}
      <div className="flex space-x-1 bg-white/5 p-1 rounded-full border border-white/10 relative z-30">
        {(['pomodoro', 'custom', 'countup', 'break'] as TimerMode[]).map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className={clsx(
              "px-5 py-2 rounded-full text-sm font-medium transition-all capitalize",
              mode === m
                ? (m === 'break' ? "bg-green-600 text-white shadow-lg shadow-green-500/30" : "bg-blue-600 text-white shadow-lg shadow-blue-500/30")
                : "text-gray-400 hover:text-white hover:bg-white/10"
            )}
          >
            {m === 'countup' ? 'Focus Flow' : (m === 'break' ? 'Rest' : m)}
          </button>
        ))}
      </div>

      {/* Main Timer Display */}
      <div className="relative group z-10">
        {/* Decorative Rings */}
        <div className={clsx(
          "absolute -inset-4 rounded-full border-2 w-[300px] h-[300px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-1000 pointer-events-none",
          mode === 'break' ? "border-green-500/20" : "border-blue-500/20",
          isActive ? "scale-110 opacity-100 animate-pulse" : "scale-100 opacity-0"
        )}></div>

        <div className="text-9xl font-bold font-mono tracking-tighter text-white drop-shadow-2xl relative z-10 w-[320px] text-center">
          {mode === 'countup' ? formatTime(countUpTime) : formatTime(timeLeft)}
        </div>


      </div>

      {/* Custom Input (Custom OR Break) */}
      {(mode === 'custom' || mode === 'break') && !isActive ? (
        <div className="flex items-center space-x-3 bg-[#111] px-5 py-3 rounded-full border border-white/20 z-50 shadow-2xl animate-in slide-in-from-bottom-2 fade-in duration-300">
          <span className="text-xs text-gray-400 font-bold tracking-wider">MIN</span>
          <input
            type="number"
            value={mode === 'break' ? breakMinutes : customMinutes}
            onChange={(e) => {
              const val = parseInt(e.target.value) || 0;
              if (val >= 0 && val <= 999) {
                if (mode === 'break') {
                  setBreakMinutes(val);
                } else {
                  setCustomMinutes(val);
                }
                setTimeLeft(val * 60);
              }
            }}
            className="w-20 bg-transparent text-center text-2xl font-mono text-white border-b-2 border-gray-700 focus:border-blue-500 outline-none [&::-webkit-inner-spin-button]:appearance-none m-0"
            placeholder={mode === 'break' ? "5" : "25"}
          />
        </div>
      ) : (
        <div className="h-2"></div>
      )}

      {/* Controls */}
      <div className="flex items-center space-x-8 relative z-20">
        <button
          onClick={resetTimer}
          className="p-4 rounded-full bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-all border border-white/5 hover:border-white/20"
          title="Reset Timer"
        >
          <RotateCcw size={24} />
        </button>

        <button
          onClick={toggleTimer}
          className={clsx(
            "p-8 rounded-full transition-all shadow-2xl hover:scale-105 active:scale-95 flex items-center justify-center",
            isActive
              ? (mode === 'break'
                ? "bg-green-500/20 text-green-500 border border-green-500/50 hover:bg-green-500/30 shadow-green-900/20"
                : "bg-amber-500/20 text-amber-500 border border-amber-500/50 hover:bg-amber-500/30 shadow-amber-900/20")
              : (mode === 'break'
                ? "bg-green-600 text-white hover:bg-green-500 shadow-green-900/40"
                : "bg-blue-600 text-white hover:bg-blue-500 shadow-blue-900/40")
          )}
        >
          {isActive ? <Pause size={42} fill="currentColor" /> : <Play size={42} fill="currentColor" className="ml-1" />}
        </button>

        <button
          onClick={togglePiP}
          className="p-4 rounded-full bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-all border border-white/5 hover:border-white/20"
          title="Picture-in-Picture Mode"
        >
          <PictureInPicture size={24} />
        </button>
      </div>

      {mode === 'countup' && isActive && (
        <button
          onClick={() => { setIsActive(false); onComplete(); }}
          className="px-6 py-2 rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-colors flex items-center gap-2"
        >
          <Coffee size={18} />
          <span>Take a Break</span>
        </button>
      )}
    </div>
  );
});

TimerComponent.displayName = 'Timer';
export const Timer = TimerComponent;
