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


const PRIORITY_TITLES = [
  "沧浪之水",
  "认知觉醒",
  "学习觉醒",
  "教父",
  "纳瓦尔宝典",
  "也许你该找个人聊聊",
  "把时间当作朋友"
];

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

  // 1. First Priority: User-specified books
  const priorityBooks = books.filter(b => PRIORITY_TITLES.some(title => b.title.includes(title)));

  // 2. Second Priority: Books with actual highlights
  const booksWithContent = books.filter(b =>
    (b.noteCount && b.noteCount > 0) || (b.bookmarkCount && b.bookmarkCount > 0)
  );

  // Determine search order
  let candidateBooks: Book[] = [];

  // Add priority books first
  if (priorityBooks.length > 0) {
    candidateBooks = [...candidateBooks, ...priorityBooks.sort(() => 0.5 - Math.random())];
  }

  // Add rest of books with content
  const restWithContent = booksWithContent.filter(b => !priorityBooks.includes(b));
  candidateBooks = [...candidateBooks, ...restWithContent.sort(() => 0.5 - Math.random())];

  // Fallback
  if (candidateBooks.length === 0) {
    candidateBooks = [...books].sort(() => 0.5 - Math.random());
  }

  console.log(`[WeRead] Priority books found: ${priorityBooks.length}, Total candidates: ${candidateBooks.length}`);

  // Get current seen history
  const seenBookmarks = getSeenBookmarks();

  // Try finding a bookmark
  const limit = Math.min(candidateBooks.length, 20);

  for (let i = 0; i < limit; i++) {
    const book = candidateBooks[i];
    try {
      const bookmarks = await fetchBookmarks(book.bookId);
      if (bookmarks.length > 0) {
        // Filter out recently seen bookmarks
        const unseen = bookmarks.filter(b => !seenBookmarks.has(b.markText));

        // If all seen, just pick random from all
        const candidates = unseen.length > 0 ? unseen : bookmarks;
        const randomBookmark = candidates[Math.floor(Math.random() * candidates.length)];

        // Add to persistent history
        addToSeenBookmarks(randomBookmark.markText);

        return {
          ...randomBookmark,
          title: book.title,
          author: book.author
        };
      }
    } catch {
      console.warn(`Failed to fetch bookmarks for ${book.title}, trying next...`);
    }
  }

  return null;
};
