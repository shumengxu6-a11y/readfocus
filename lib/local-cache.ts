
import fs from 'fs';
import path from 'path';
import { Bookmark } from './weread';

const CACHE_FILE = path.resolve(process.cwd(), 'data/bookmarks-cache.json');

interface CacheData {
    bookmarks: Bookmark[];
    lastUpdated: number;
}

export function getLocalBookmarks(): Bookmark[] {
    if (!fs.existsSync(CACHE_FILE)) return [];
    try {
        const content = fs.readFileSync(CACHE_FILE, 'utf-8');
        const data: CacheData = JSON.parse(content);
        return data.bookmarks || [];
    } catch (e) {
        console.error('Failed to read local cache:', e);
        return [];
    }
}

export function saveLocalBookmarks(bookmarks: Bookmark[]) {
    try {
        // Read existing first to merge
        const existing = getLocalBookmarks();

        // Merge strategy: Unique by bookmarkId (if available) or markText
        // WeRead bookmarks don't always have stable IDs in our scraping, 
        // so we use markText + bookId as a composite key.

        const map = new Map<string, Bookmark>();

        // Load existing
        existing.forEach(b => {
            const key = `${b.bookId}-${b.markText}`;
            map.set(key, b);
        });

        // Add new
        bookmarks.forEach(b => {
            const key = `${b.bookId}-${b.markText}`;
            map.set(key, b);
        });

        const merged = Array.from(map.values());

        const data: CacheData = {
            bookmarks: merged,
            lastUpdated: Date.now()
        };

        const dir = path.dirname(CACHE_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
        console.log(`[Cache] Saved ${merged.length} bookmarks to ${CACHE_FILE}`);
    } catch (e) {
        console.error('Failed to save local cache:', e);
    }
}
