"use client";

import { useState, useEffect, useRef } from "react";
import { Timer } from "@/components/Timer";
import { ReadingCard } from "@/components/ReadingCard";
import { BookOpen } from "lucide-react";
import { fetchNotebooks, getRandomBookmarkFromBooks, Bookmark, Book, WereadError } from "@/lib/weread";

export default function Home() {
  const [isBreak, setIsBreak] = useState(false);
  const [bookmark, setBookmark] = useState<Bookmark | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<WereadError | null>(null);
  
  // Cache for books and preloaded bookmark
  const booksRef = useRef<Book[]>([]);
  const nextBookmarkRef = useRef<Bookmark | null>(null);
  const isPrefetchingRef = useRef(false);

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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center font-sans text-gray-900 selection:bg-gray-200">
      
      <header className="absolute top-0 left-0 p-6 flex items-center space-x-2 opacity-50 hover:opacity-100 transition-opacity">
        <div className="bg-black text-white p-2 rounded-lg">
          <BookOpen size={20} />
        </div>
        <span className="font-bold text-lg tracking-tight">ReadFocus</span>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-8 w-full max-w-2xl relative">
        
        {/* Persistent Timer for PiP stability */}
        <div className={isBreak ? "absolute opacity-0 pointer-events-none" : "block w-full"}>
          <Timer 
            onComplete={() => setIsBreak(true)} 
            quote={isBreak && bookmark ? bookmark.markText : null}
          />
        </div>

        {isBreak && (
           <div className="w-full z-10">
             <ReadingCard 
                bookmark={bookmark} 
                loading={loading} 
                error={error}
                onNext={loadNewBookmark}
                onClose={() => setIsBreak(false)}
              />
           </div>
        )}

      </div>

      <footer className="absolute bottom-4 text-xs text-gray-400">
        Focus. Read. Repeat.
      </footer>
    </div>
  );
}
