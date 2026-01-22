"use client";

import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { TimerDisplay } from './timer/TimerDisplay';
import { Play, Pause, RotateCcw, Coffee, PictureInPicture } from 'lucide-react';
import { clsx } from 'clsx';

export interface TimerHandle {
  startBreak: (minutes: number) => void;
  switchMode: (mode: TimerMode) => void;
}

export type TimerMode = 'pomodoro' | 'custom' | 'countup' | 'break';

interface TimerProps {
  onComplete: (mode: TimerMode, durationSeconds: number) => void;
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

  // Document PiP State
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [pipSize, setPipSize] = useState({ width: 0, height: 0 }); // Track window size

  // Define switchMode early (or use via a function that references state setter)
  // For useImperativeHandle, we simply call the internal implementation
  const handleSwitchMode = (newMode: TimerMode) => {
    setMode(newMode);
    setIsActive(false);
    if (newMode === 'pomodoro') setTimeLeft(25 * 60);
    else if (newMode === 'custom') setTimeLeft(customMinutes * 60);
    else if (newMode === 'break') setTimeLeft(breakMinutes * 60);
    else if (newMode === 'countup') setCountUpTime(0);
  };

  useImperativeHandle(ref, () => ({
    startBreak: (minutes: number) => {
      setMode('break');
      setBreakMinutes(minutes); // Update state to reflect start param
      setTimeLeft(minutes * 60);
      setIsActive(true);
    },
    switchMode: (newMode: TimerMode) => {
      handleSwitchMode(newMode);
    }
  }));

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

  // Sync TimerDisplay canvas with Video PiP Stream
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!canvas || !video) return;

    // Ensure video plays the canvas stream
    if (video.srcObject === null) {
      const stream = canvas.captureStream(30);
      video.srcObject = stream;
      video.play().catch(() => { });
    }
  }, []); // Run once on mount to setup stream connection

  // Close PiP window cleanup & Resize Listener
  useEffect(() => {
    if (pipWindow) {
      const handleResize = () => {
        setPipSize({ width: pipWindow.innerWidth, height: pipWindow.innerHeight });
      };

      // Init size
      handleResize();


      pipWindow.addEventListener('unload', () => {
        setPipWindow(null);
      });
      pipWindow.addEventListener('resize', handleResize);

      return () => {
        pipWindow.removeEventListener('resize', handleResize);
      };
    }
  }, [pipWindow]);

  const togglePiP = async () => {
    // 1. Try Document Picture-in-Picture (Best for custom UI)
    if ('documentPictureInPicture' in window) {
      try {
        if (pipWindow) {
          pipWindow.close();
          setPipWindow(null);
          return;
        }

        const dpip = window.documentPictureInPicture as any;
        const noteWindow = await dpip.requestWindow({
          width: 400,
          height: 400,
        });

        // Copy styles
        [...document.styleSheets].forEach((styleSheet) => {
          try {
            const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join('');
            const style = document.createElement('style');
            style.textContent = cssRules;
            noteWindow.document.head.appendChild(style);
          } catch (e) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = styleSheet.href || '';
            noteWindow.document.head.appendChild(link);
          }
        });

        // Add dark background to body
        noteWindow.document.body.style.backgroundColor = '#111';
        noteWindow.document.body.style.display = 'flex';
        noteWindow.document.body.style.justifyContent = 'center';
        noteWindow.document.body.style.alignItems = 'center';
        noteWindow.document.body.style.margin = '0';

        setPipWindow(noteWindow);
        return;

      } catch (e) {
        console.error('Document PiP failed, falling back to Video PiP', e);
      }
    }

    // 2. Fallback to Video Picture-in-Picture (Standard)
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
                // Determine duration
                const duration = mode === 'custom' ? customMinutes * 60 : (mode === 'break' ? breakMinutes * 60 : 25 * 60);
                onComplete(mode, duration); // Pass mode to parent
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

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-10 w-full max-w-lg mx-auto transform transition-all">

      {/* Hidden Canvas & Video for PiP */}
      <video ref={videoRef} className="hidden" muted playsInline />

      {/* Mode Switcher */}
      <div className="flex space-x-1 bg-white/5 p-1 rounded-full border border-white/10 relative z-30">
        {(['pomodoro', 'custom', 'countup', 'break'] as TimerMode[]).map((m) => (
          <button
            key={m}
            onClick={() => handleSwitchMode(m)}
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
      {pipWindow ? (
        <div className="relative group z-10 w-[300px] h-[300px] flex items-center justify-center border-2 border-white/5 rounded-full">
          <span className="text-white/30 text-sm">Timer in Window</span>
        </div>
      ) : (
        <TimerDisplay
          mode={mode}
          timeStr={mode === 'countup' ? formatTime(countUpTime) : formatTime(timeLeft)}
          isActive={isActive}
          totalSeconds={mode === 'custom' ? customMinutes * 60 : (mode === 'break' ? breakMinutes * 60 : 25 * 60)}
          timeLeft={timeLeft}
          canvasRef={canvasRef} // For video fallback
        />
      )}

      {/* Render Portal content if PiP window exists */}
      {pipWindow && createPortal(
        <div className="flex items-center justify-center w-full h-full text-white overflow-hidden">
          <TimerDisplay
            mode={mode}
            timeStr={mode === 'countup' ? formatTime(countUpTime) : formatTime(timeLeft)}
            isActive={isActive}
            totalSeconds={mode === 'custom' ? customMinutes * 60 : (mode === 'break' ? breakMinutes * 60 : 25 * 60)}
            timeLeft={timeLeft}
            isPiP={true}
            // Dynamic scale calculation: Base size 350px.
            // If window is smaller, scale down. If larger, can stay 1 or scale up slightly.
            scale={Math.min(pipSize.width / 350, pipSize.height / 350, 1.2)}
          />
        </div>,
        pipWindow.document.body
      )}

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
          onClick={() => {
            setIsActive(false);
            onComplete(mode, countUpTime);
          }}
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
