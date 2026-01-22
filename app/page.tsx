"use client";

import { useState, useEffect, useRef } from "react";

import { Timer, TimerHandle } from "@/components/Timer";
import { ReadingCard } from "@/components/ReadingCard";
import { BookOpen } from "lucide-react";
import { clsx } from "clsx";
import { fetchNotebooks, getRandomBookmarkFromBooks, Bookmark, Book, WereadError } from "@/lib/weread";
import { DailyStats } from "@/components/DailyStats";

export default function Home() {
  const [complete, setComplete] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [bookmark, setBookmark] = useState<Bookmark | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<WereadError | null>(null);

  const timerRef = useRef<TimerHandle>(null);

  // Cache for books and preloaded bookmark
  const booksRef = useRef<Book[]>([]);
  const nextBookmarkRef = useRef<Bookmark | null>(null);
  const isPrefetchingRef = useRef(false);

  /* ... */

  // Prevent double-firing of completion logic
  const lastCompleteTimeRef = useRef(0);

  const handleTimerComplete = (finishedMode: string, durationSeconds: number) => {
    // Debounce: If completed within last 2 seconds, ignore
    const now = Date.now();
    if (now - lastCompleteTimeRef.current < 2000) return;
    lastCompleteTimeRef.current = now;

    if (finishedMode === 'break') {
      // Break done -> Back to Focus
      setIsBreak(false);
      if (timerRef.current) {
        timerRef.current.switchMode('pomodoro');
      }
    } else {
      // Focus done -> Start Break
      setComplete(true);
      setIsBreak(true);
      // Start 5 min break automatically
      if (timerRef.current) {
        timerRef.current.startBreak(5);
      }

      // Dispatch Focus Event for Stats
      // Use actual duration from Timer. Use floor to be conservative (e.g. 1m59s = 1m).
      // Minimum 1 minute to count? Or 0 is fine? Let's allow > 0.
      const minutes = Math.floor(durationSeconds / 60);
      if (minutes > 0) {
        console.log(`[App] Focus Complete: ${minutes} minutes (from ${durationSeconds}s)`);
        window.dispatchEvent(new CustomEvent('focus-completed', { detail: { minutes } }));
      }
    }
  };


  // Pre-fetch a bookmark in the background
  const prefetchBookmark = async () => {
    if (isPrefetchingRef.current || nextBookmarkRef.current) return;

    isPrefetchingRef.current = true;
    console.log('[App] Prefetching next bookmark...');

    try {
      if (booksRef.current.length === 0) {
        booksRef.current = await fetchNotebooks();
      }
      const newBookmark = await getRandomBookmarkFromBooks(booksRef.current);
      if (newBookmark) {
        nextBookmarkRef.current = newBookmark;
        console.log('[App] Bookmark prefetched ready.');
      }
    } catch (e) {
      console.warn('[App] Prefetch failed:', e);
    } finally {
      isPrefetchingRef.current = false;
    }
  };

  const loadNewBookmark = async () => {
    setLoading(true);
    setError(null);

    // If we have a prefetched bookmark, use it immediately
    if (nextBookmarkRef.current) {
      setBookmark(nextBookmarkRef.current);
      nextBookmarkRef.current = null; // Clear used
      setLoading(false);
      prefetchBookmark(); // Queue next one
      return;
    }

    // Otherwise fetch normally
    try {
      if (booksRef.current.length === 0) {
        booksRef.current = await fetchNotebooks();
      }
      const newBookmark = await getRandomBookmarkFromBooks(booksRef.current);
      setBookmark(newBookmark);

      // Trigger prefetch for the *next* time
      prefetchBookmark();
    } catch (e: any) {
      console.error(e);
      if (e.name === 'WereadError' || e.code === 'SESSION_EXPIRED' || e.response?.status === 401) {
        setError(e);
      } else {
        setError(new WereadError('Failed to fetch content. Please try again.'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Initial load / Prefetch when mounting
  useEffect(() => {
    prefetchBookmark();
  }, []);

  // When break starts, load content
  useEffect(() => {
    if (isBreak) {
      loadNewBookmark();
    } else {
      // When going back to focus, ensure we have one ready for next break
      prefetchBookmark();
    }
  }, [isBreak]);

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden">

      {/* Background Gradient */}
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[#0a0a0a] to-[#111] z-0"></div>
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none"></div>

      <header className="absolute top-0 left-0 p-8 flex items-center space-x-3 z-20">
        <div className="bg-white/10 p-2 rounded-lg backdrop-blur-sm border border-white/5">
          <BookOpen size={20} className="text-blue-400" />
        </div>
        <span className="font-bold text-lg tracking-wider text-white/80">ReadFocus</span>
      </header>

      <main className="relative z-10 w-full max-w-7xl px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center min-h-[600px]">

        {/* Left Col: Timer */}
        <div className="flex justify-center transition-all duration-500">
          <Timer
            ref={timerRef}
            onComplete={handleTimerComplete}
            quote={isBreak && bookmark ? bookmark.markText : null}
          />
        </div>

        {/* Right Col: Card Area */}
        <div className={clsx(
          "transition-all duration-700 ease-out transform",
          isBreak ? "opacity-100 translate-x-0" : "opacity-30 lg:opacity-50 blur-sm scale-95 pointer-events-none grayscale"
        )}>
          {isBreak ? (
            <ReadingCard
              bookmark={bookmark}
              loading={loading}
              error={error}
              onNext={loadNewBookmark}
              onClose={() => setIsBreak(false)}
            />
          ) : (
            /* Placeholder/teaser when focusing */
            <div className="hidden lg:flex glass-panel w-full max-w-lg mx-auto p-12 rounded-3xl min-h-[400px] flex-col items-center justify-center text-center border-white/5">
              <p className="text-2xl font-serif text-white/20">
                "Focus is the new IQ."
              </p>
              <p className="mt-4 text-xs tracking-widest text-white/10 uppercase">
                Complete the session to unlock knowledge
              </p>
            </div>
          )}
        </div>

      </main>

      <DailyStats />

      <footer className="absolute bottom-6 text-xs text-gray-700 font-mono tracking-widest z-20">
        DESIGNED FOR DEEP WORK
      </footer>
    </div>
  );
}
