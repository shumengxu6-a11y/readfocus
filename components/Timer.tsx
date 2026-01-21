"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Coffee, Settings, PictureInPicture } from 'lucide-react';
import { clsx } from 'clsx';

type TimerMode = 'pomodoro' | 'custom' | 'countup';

interface TimerProps {
  onComplete: () => void;
  quote?: string | null; // Receive the quote to display in PiP
}

export function Timer({ onComplete, quote }: TimerProps) {
  const [mode, setMode] = useState<TimerMode>('pomodoro');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [countUpTime, setCountUpTime] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(45);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // PiP Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Helper to wrap text for canvas
  const wrapText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
    const words = text.split(''); // Split by char for Chinese support
    let line = '';
    let currentY = y;

    for(let n = 0; n < words.length; n++) {
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
      ctx.fillStyle = '#111111'; // Very dark grey
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (quote) {
          // --- DRAW QUOTE MODE ---
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 48px sans-serif'; // Larger font
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // Draw text wrapped
          wrapText(ctx, quote, canvas.width / 2, 150, 1000, 64);
          
          // Draw hint
          ctx.font = '32px sans-serif';
          ctx.fillStyle = '#666666';
          ctx.fillText("回到页面开始专注", canvas.width / 2, canvas.height - 50);

      } else {
          // --- DRAW TIMER MODE ---
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 240px monospace'; // Huge font for clarity
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          const timeStr = mode === 'countup' ? formatTime(countUpTime) : formatTime(timeLeft);
          ctx.fillText(timeStr, canvas.width / 2, canvas.height / 2 - 40);
          
          // Draw Progress Bar
          if (mode !== 'countup') {
              const total = mode === 'custom' ? customMinutes * 60 : 25 * 60;
              const progress = timeLeft / total;
              ctx.fillStyle = isActive ? '#22c55e' : '#374151';
              ctx.fillRect(0, canvas.height - 40, canvas.width * progress, 40);
          }
      }
    };

    draw();

    if (video.srcObject === null) {
        const stream = canvas.captureStream(30);
        video.srcObject = stream;
        video.play().catch(() => {}); 
    }
    
  }, [timeLeft, countUpTime, mode, isActive, customMinutes, quote]); // Re-draw when quote changes

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

  const notifyComplete = () => {
    // 1. Play sound
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.log('Audio play failed:', e));
    }

    // 2. Browser notification
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification("Time's up!", {
        body: "Great focus session! Take a break and read a highlight.",
        icon: "/favicon.ico"
      });
    }
    
    // 3. Document title update
    document.title = "🔔 Time's Up! - ReadFocus";
  };

  useEffect(() => {
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
              notifyComplete(); // Trigger notifications
              setTimeout(() => {
                onComplete();
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
  }, [isActive, mode, onComplete]);

  const toggleTimer = () => setIsActive(!isActive);

  const resetTimer = () => {
    setIsActive(false);
    if (mode === 'pomodoro') setTimeLeft(25 * 60);
    else if (mode === 'custom') setTimeLeft(customMinutes * 60);
    else if (mode === 'countup') setCountUpTime(0);
  };

  const switchMode = (newMode: TimerMode) => {
    setMode(newMode);
    setIsActive(false);
    if (newMode === 'pomodoro') setTimeLeft(25 * 60);
    else if (newMode === 'custom') setTimeLeft(customMinutes * 60);
    else if (newMode === 'countup') setCountUpTime(0);
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-8 w-full max-w-md mx-auto">
      
      {/* Hidden Canvas & Video for PiP */}
      <canvas ref={canvasRef} width={300} height={150} className="hidden" />
      <video ref={videoRef} className="hidden" muted playsInline />

      <div className="flex space-x-2 bg-gray-100 p-1 rounded-full">
        {(['pomodoro', 'custom', 'countup'] as TimerMode[]).map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className={clsx(
              "px-4 py-2 rounded-full text-sm font-medium transition-all capitalize",
              mode === m ? "bg-white shadow-sm text-black" : "text-gray-500 hover:text-gray-700"
            )}
          >
            {m === 'countup' ? 'Focus Flow' : m}
          </button>
        ))}
      </div>

      <div className="text-8xl font-bold font-mono tracking-tighter text-gray-800">
        {mode === 'countup' ? formatTime(countUpTime) : formatTime(timeLeft)}
      </div>

      {mode === 'custom' && !isActive && (
        <div className="flex items-center space-x-2">
           <span className="text-sm text-gray-500">Duration (min):</span>
           <input 
             type="number" 
             value={customMinutes} 
             onChange={(e) => {
               const val = parseInt(e.target.value) || 0;
               setCustomMinutes(val);
               setTimeLeft(val * 60);
             }}
             className="w-16 p-1 border rounded text-center"
           />
        </div>
      )}

      <div className="flex items-center space-x-6">
        <button
          onClick={toggleTimer}
          className="p-6 rounded-full bg-black text-white hover:scale-105 transition-transform shadow-lg"
        >
          {isActive ? <Pause size={32} /> : <Play size={32} fill="currentColor" />}
        </button>
        
        <button
          onClick={resetTimer}
          className="p-4 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          title="Reset Timer"
        >
          <RotateCcw size={24} />
        </button>

        <button
          onClick={togglePiP}
          className="p-3 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          title="Picture-in-Picture Mode"
        >
          <PictureInPicture size={20} />
        </button>
      </div>

      {mode === 'countup' && isActive && (
         <button 
           onClick={() => { setIsActive(false); onComplete(); }}
           className="px-6 py-2 rounded-lg bg-green-100 text-green-700 font-medium hover:bg-green-200 transition-colors flex items-center gap-2"
         >
           <Coffee size={18} />
           <span>Take a Break</span>
         </button>
      )}
    </div>
  );
}
