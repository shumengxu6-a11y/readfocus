'use client';

const COOKIE_KEY = 'weread_user_cookie';

/**
 * Get user's WeRead cookie from localStorage
 */
export function getUserCookie(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(COOKIE_KEY);
}

/**
 * Save user's WeRead cookie to localStorage
 */
export function setUserCookie(cookie: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(COOKIE_KEY, cookie);
}

/**
 * Remove user's WeRead cookie from localStorage
 */
export function clearUserCookie(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(COOKIE_KEY);
}

/**
 * Check if user has configured their cookie
 */
export function hasUserCookie(): boolean {
    return !!getUserCookie();
}

const DATA_KEY = 'readfocus_all_data';

// Determine if we have synced data
export function hasSyncedData(): boolean {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem(DATA_KEY);
}

// Get all synced bookmarks
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSyncedData(): any[] {
    if (typeof window === 'undefined') return [];
    try {
        const json = localStorage.getItem(DATA_KEY);
        return json ? JSON.parse(json) : [];
    } catch {
        return [];
    }
}

// Save all bookmarks locally
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function saveSyncedData(data: any[]): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(DATA_KEY, JSON.stringify(data));
        console.log(`[Storage] Saved ${data.length} items to local storage`);
    } catch (e) {
        console.error('[Storage] Failed to save data (quota exceeded?)', e);
        alert('存储失败：可能数据量过大超过浏览器限制，请清理缓存后重试。');
    }
}

export function clearSyncedData(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(DATA_KEY);
}
