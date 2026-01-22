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
