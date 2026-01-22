"use client";

import { useState, useEffect, useRef } from "react";

import { Timer, TimerHandle } from "@/components/Timer";
import { ReadingCard } from "@/components/ReadingCard";
import { CookieSetup } from "@/components/CookieSetup";
import { BookOpen, Settings } from "lucide-react";
import { clsx } from "clsx";
import { fetchNotebooks, getRandomBookmarkFromBooks, Bookmark, Book, WereadError } from "@/lib/weread";
import { hasUserCookie, hasSyncedData, getSyncedData } from "@/lib/cookie-store";
import { DailyStats } from "@/components/DailyStats";

export default function Home() {
  const [complete, setComplete] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [bookmark, setBookmark] = useState<Bookmark | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<WereadError | null>(null);

  // Cookie setup state - start with checking (not assuming needs setup)
  const [needsSetup, setNeedsSetup] = useState(false);
  const [isCheckingCookie, setIsCheckingCookie] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const timerRef = useRef<TimerHandle>(null);

  // Cache for books and preloaded bookmark
  const booksRef = useRef<Book[]>([]);
  const nextBookmarkRef = useRef<Bookmark | null>(null);
  const isPrefetchingRef = useRef(false);

  // Check cookie on mount - try API first (works with CookieCloud), then check localStorage
  useEffect(() => {
    const checkCookieAvailability = async () => {
      // If user has cookie in localStorage, we're good
      if (hasUserCookie()) {
        setNeedsSetup(false);
        setIsCheckingCookie(false);
        return;
      }

      // Try API to see if backend has cookie (via CookieCloud or env var)
      try {
        const response = await fetch('/api/weread/notebooks');
        if (response.ok) {
          // Backend has cookie, no setup needed
          setNeedsSetup(false);
        } else {
          // Backend doesn't have cookie, show setup
          setNeedsSetup(true);
        }
      } catch {
        // Error means no cookie available
        setNeedsSetup(true);
      }
      setIsCheckingCookie(false);
    };

    checkCookieAvailability();
  }, []);

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

    try {
      // 1. Prefetch from Local Sync Data
      if (hasSyncedData()) {
        const localBookmarks = getSyncedData();
        if (localBookmarks.length > 0) {

          // --- Custom Algorithm (Same as loadNewBookmark) ---
          const EXCLUDED_TITLES = ['房思琪的初恋乐园'];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let candidatePool = localBookmarks.filter((b: any) =>
            !EXCLUDED_TITLES.some(t => b.title.includes(t))
          );
          if (candidatePool.length === 0) candidatePool = localBookmarks;

          const PRIORITY_TITLES = [
            '沧浪之水', '教父', '认知觉醒', '也许你该找个人谈谈', '腰背维修师', '学习觉醒'
          ];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const priorityPool = candidatePool.filter((b: any) =>
            PRIORITY_TITLES.some(t => b.title.includes(t))
          );

          let selected: Bookmark;
          if (priorityPool.length > 0 && Math.random() < 0.8) {
            selected = priorityPool[Math.floor(Math.random() * priorityPool.length)];
          } else {
            selected = candidatePool[Math.floor(Math.random() * candidatePool.length)];
          }

          nextBookmarkRef.current = selected;
          isPrefetchingRef.current = false;
          return;
        }
      }

      // 2. Fallback Prefetch from API
      if (booksRef.current.length === 0) {
        booksRef.current = await fetchNotebooks();
      }
      const newBookmark = await getRandomBookmarkFromBooks(booksRef.current);
      if (newBookmark) {
        nextBookmarkRef.current = newBookmark;
      }
    } catch (e) {
      console.warn('[App] Prefetch failed:', e);
    } finally {
      isPrefetchingRef.current = false;
    }
  };

  const loadNewBookmark = async () => {
    // 1. Use preloaded if available
    if (nextBookmarkRef.current) {
      setBookmark(nextBookmarkRef.current);
      nextBookmarkRef.current = null;
      // Fetch next one in background
      prefetchBookmark();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // 2. CHECK LOCAL SYNC DATA FIRST (Zero Latency)
      if (hasSyncedData()) {
        const localBookmarks = getSyncedData();
        if (localBookmarks.length > 0) {
          console.log('[Mode] Using Local Synced Data');

          // --- Custom Algorithm for Offline Mode ---

          // 1. Blacklist Filtering
          const EXCLUDED_TITLES = ['房思琪的初恋乐园'];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let candidatePool = localBookmarks.filter((b: any) =>
            !EXCLUDED_TITLES.some(t => b.title.includes(t))
          );

          if (candidatePool.length === 0) {
            // Fallback if user blocked everything (rare)
            candidatePool = localBookmarks;
          }

          // 2. Priority Boosting
          // Instead of complex weights, we separate the pool and bias the random choice.
          const PRIORITY_TITLES = [
            '沧浪之水', '教父', '认知觉醒', '也许你该找个人谈谈', '腰背维修师', '学习觉醒'
          ];

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const priorityPool = candidatePool.filter((b: any) =>
            PRIORITY_TITLES.some(t => b.title.includes(t))
          );

          let selected: Bookmark;

          // Logic: If priority books exist in local data:
          // 80% chance to pick from Priority Pool
          // 20% chance to pick from General Pool (to keep some variety)
          if (priorityPool.length > 0 && Math.random() < 0.8) {
            console.log('[Offline] Boosted selection from Priority Pool');
            selected = priorityPool[Math.floor(Math.random() * priorityPool.length)];
          } else {
            // Normal selection
            selected = candidatePool[Math.floor(Math.random() * candidatePool.length)];
          }

          setBookmark(selected);
          setLoading(false);
          return;
        }
      }

      // 3. Fallback to API Fetch
      console.log('[Mode] Using API Fetch');
      if (booksRef.current.length === 0) {
        booksRef.current = await fetchNotebooks();
      }

      const newBookmark = await getRandomBookmarkFromBooks(booksRef.current);

      if (newBookmark) {
        setBookmark(newBookmark);
      } else {
        setError(new WereadError("No highlights found", "NO_CONTENT", "Try adding some highlights in WeRead first"));
      }
    } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      console.error(err);
      if (err.name === 'WereadError' || err.code === 'SESSION_EXPIRED' || err.response?.status === 401) {
        setError(err);
      } else {
        setError(new WereadError(err.message));
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

      {/* Loading State while checking cookie */}
      {isCheckingCookie && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center">
          <div className="text-white/60 text-sm">正在检查配置...</div>
        </div>
      )}

      {/* Cookie Setup Screen */}
      {!isCheckingCookie && needsSetup && (
        <CookieSetup onComplete={() => setNeedsSetup(false)} />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <CookieSetup
          isModal
          onComplete={() => setShowSettings(false)}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Background Gradient */}
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[#0a0a0a] to-[#111] z-0"></div>
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none"></div>

      <header className="absolute top-0 left-0 right-0 p-8 flex items-center justify-between z-20">
        <div className="flex items-center space-x-3">
          <div className="bg-white/10 p-2 rounded-lg backdrop-blur-sm border border-white/5">
            <BookOpen size={20} className="text-blue-400" />
          </div>
          <span className="font-bold text-lg tracking-wider text-white/80">ReadFocus</span>
        </div>

        {/* Settings Button */}
        {!needsSetup && (
          <button
            onClick={() => setShowSettings(true)}
            className="bg-white/5 hover:bg-white/10 p-2 rounded-lg backdrop-blur-sm border border-white/5 transition-colors"
            title="设置 Cookie"
          >
            <Settings size={18} className="text-white/60" />
          </button>
        )}
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
