import axios from 'axios';
import { getUserCookie } from './cookie-store';

export interface Book {
  bookId: string;
  title: string;
  author: string;
  cover: string;
  noteCount?: number;
  bookmarkCount?: number;
}

export interface Bookmark {
  bookmarkId: string;
  bookId: string;
  markText: string;
  createTime: number;
  chapterUid?: number;
  title?: string;
  author?: string;
}

export interface WereadNotebooksResponse {
  books: Book[];
}

export interface WereadBookmarksResponse {
  updated: Bookmark[];
}

export class WereadError extends Error {
  code?: string;
  details?: string;
  constructor(message: string, code?: string, details?: string) {
    super(message);
    this.name = 'WereadError';
    this.code = code;
    this.details = details;
  }
}

// Helper to get headers with cookie
const getHeaders = () => {
  const cookie = getUserCookie();
  return cookie ? { 'X-Weread-Cookie': cookie } : {};
};

export const fetchNotebooks = async (): Promise<Book[]> => {
  try {
    const response = await axios.get<WereadNotebooksResponse>('/api/weread/notebooks', {
      headers: getHeaders()
    });

    if (response.data && Array.isArray(response.data.books)) {
      // Map the nested book structure to the flat Book interface
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return response.data.books.map((item: any) => ({
        bookId: item.bookId,
        title: item.book.title,
        author: item.book.author,
        cover: item.book.cover,
        noteCount: item.noteCount,
        bookmarkCount: item.bookmarkCount
      }));
    }
    return [];
  } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    console.error('Failed to fetch notebooks', error);

    if (error.response?.data?.error) {
      throw new WereadError(
        error.response.data.error,
        error.response.data.code,
        error.response.data.details
      );
    }
    throw error;
  }
};

export const fetchBookmarks = async (bookId: string): Promise<Bookmark[]> => {
  try {
    const response = await axios.get<WereadBookmarksResponse>(`/api/weread/bookmarks?bookId=${bookId}`, {
      headers: getHeaders()
    });
    if (response.data && Array.isArray(response.data.updated)) {
      return response.data.updated;
    }
    return [];
  } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    console.error('Failed to fetch bookmarks', error);
    if (error.response?.data?.error) {
      throw new WereadError(
        error.response.data.error,
        error.response.data.code,
        error.response.data.details
      );
    }
    return [];
  }
};


// Priority titles removed to favor fair randomization


// Persistent history to avoid repetition (survives page refresh)
const SEEN_HISTORY_KEY = 'readfocus_seen_bookmarks';
const MAX_HISTORY_SIZE = 200;

function getSeenBookmarks(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(SEEN_HISTORY_KEY);
    if (stored) {
      return new Set(JSON.parse(stored));
    }
  } catch (e) {
    console.warn('[History] Failed to load seen history:', e);
  }
  return new Set();
}

function addToSeenBookmarks(markText: string): void {
  if (typeof window === 'undefined') return;
  try {
    const seen = getSeenBookmarks();
    seen.add(markText);

    // Keep history size manageable
    if (seen.size > MAX_HISTORY_SIZE) {
      const arr = Array.from(seen);
      // Remove oldest entries (first ones in array)
      const trimmed = arr.slice(arr.length - MAX_HISTORY_SIZE);
      localStorage.setItem(SEEN_HISTORY_KEY, JSON.stringify(trimmed));
    } else {
      localStorage.setItem(SEEN_HISTORY_KEY, JSON.stringify(Array.from(seen)));
    }
  } catch (e) {
    console.warn('[History] Failed to save seen history:', e);
  }
}

export const getRandomBookmarkFromBooks = async (books: Book[]): Promise<Bookmark | null> => {
  if (books.length === 0) return null;

  // 1. Filter Books with actual highlights
  // Use noteCount or bookmarkCount
  const booksWithContent = books.filter(b =>
    (b.noteCount && b.noteCount > 0) || (b.bookmarkCount && b.bookmarkCount > 0)
  );

  // 2. Shuffle all valid books (Random Book Strategy)
  // This ensures fair chance for all books
  let candidateBooks = [...booksWithContent].sort(() => 0.5 - Math.random());

  // Fallback if no books have explicit counts
  if (candidateBooks.length === 0) {
    candidateBooks = [...books].sort(() => 0.5 - Math.random());
  }

  console.log(`[WeRead] Total candidates with content: ${candidateBooks.length}`);

  // Get current seen history
  const seenBookmarks = getSeenBookmarks();

  // 3. Try finding a bookmark, prioritizing UNSEEN content
  // Increased limit to 30 to reduce chance of empty results on books with ghost data
  const limit = Math.min(candidateBooks.length, 30);

  // Store a backup in case we fail to find any unseen content
  let backupBookmark: { bookmark: Bookmark, book: Book } | null = null;

  for (let i = 0; i < limit; i++) {
    const book = candidateBooks[i];
    try {
      const bookmarks = await fetchBookmarks(book.bookId);
      if (bookmarks.length > 0) {
        // Filter out recently seen bookmarks
        const unseen = bookmarks.filter(b => !seenBookmarks.has(b.markText));

        if (unseen.length > 0) {
          // Found unseen content! Pick one and return immediately.
          const randomBookmark = unseen[Math.floor(Math.random() * unseen.length)];
          addToSeenBookmarks(randomBookmark.markText);

          return {
            ...randomBookmark,
            title: book.title,
            author: book.author
          };
        }

        // If we're here, all bookmarks in this book have been seen.
        // Save one as backup, but continue searching other books for unseen content.
        if (!backupBookmark) {
          const randomSeen = bookmarks[Math.floor(Math.random() * bookmarks.length)];
          backupBookmark = { bookmark: randomSeen, book: book };
        }
      }
    } catch {
      console.warn(`Failed to fetch bookmarks for ${book.title}, trying next...`);
    }
  }

  // 4. Fallback A: Use seen bookmark from the random sampling
  if (backupBookmark) {
    console.log('[WeRead] No unseen bookmarks found in sampled books, reusing seen bookmark.');
    return {
      ...backupBookmark.bookmark,
      title: backupBookmark.book.title,
      author: backupBookmark.book.author
    };
  }

  // 5. Fallback B (Fail-Safe): If we checked 30 books and found NOTHING (all empty/failed),
  // pick the single book with the MOST notes and force fetch it.
  // This prevents "No highlights found" error when valid content exists but wasn't sampled.
  try {
    const bookWithMostNotes = [...booksWithContent].sort((a, b) =>
      ((b.noteCount || 0) + (b.bookmarkCount || 0)) - ((a.noteCount || 0) + (a.bookmarkCount || 0))
    )[0];

    if (bookWithMostNotes) {
      console.log(`[WeRead] Fail-safe: Fetching from largest book: ${bookWithMostNotes.title}`);
      const bookmarks = await fetchBookmarks(bookWithMostNotes.bookId);
      if (bookmarks.length > 0) {
        const randomBookmark = bookmarks[Math.floor(Math.random() * bookmarks.length)];
        return {
          ...randomBookmark,
          title: bookWithMostNotes.title,
          author: bookWithMostNotes.author
        };
      }
    }
  } catch (e) {
    console.error('[WeRead] Fail-safe also failed:', e);
  }

  return null;
};
