import axios, { AxiosInstance, AxiosResponse } from 'axios';

const WEREAD_BASE_URL = "https://weread.qq.com/";
const WEREAD_NOTEBOOKS_URL = "https://weread.qq.com/api/user/notebook";
const WEREAD_BOOKMARKLIST_URL = "https://weread.qq.com/web/book/bookmarklist";

// --- Interfaces for Type Safety ---

interface WeReadNotebookItem {
    bookId: string;
    book: {
        title: string;
        author: string;
        cover: string;
        [key: string]: unknown;
    };
    [key: string]: unknown;
}

interface WeReadNotebookResponse {
    books: WeReadNotebookItem[];
    [key: string]: unknown;
}

interface WeReadBookmark {
    bookmarkId?: string;
    markText: string;
    createTime: number;
    bookId?: string;
    [key: string]: unknown;
}

interface WeReadReview {
    review: {
        reviewId: string;
        abstract?: string;
        content?: string;
        createTime: number;
        [key: string]: unknown;
    };
    [key: string]: unknown;
}

interface BookmarkListResponse {
    updated: WeReadBookmark[];
    [key: string]: unknown;
}

interface BestBookmarkItem {
    text: string;
    [key: string]: unknown;
}

interface BestBookmarkResponse {
    items: BestBookmarkItem[];
    [key: string]: unknown;
}

interface ReviewListResponse {
    reviews: WeReadReview[];
    [key: string]: unknown;
}

export class WeReadApi {
    private cookie: string;
    private client: AxiosInstance;

    constructor(cookie: string) {
        this.cookie = cookie;
        this.client = axios.create({
            timeout: 60000,
            headers: this.getHeaders()
        });
    }

    private getHeaders(): Record<string, string> {
        return {
            'Cookie': this.cookie,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Connection': 'keep-alive',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'cache-control': 'no-cache',
            'pragma': 'no-cache',
            'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'Referer': 'https://weread.qq.com/',
            'Origin': 'https://weread.qq.com'
        };
    }

    private updateCookie(response: AxiosResponse) {
        const setCookie = response.headers['set-cookie'];
        if (setCookie && Array.isArray(setCookie)) {
            const newCookies = setCookie.map((c: string) => c.split(';')[0]);
            const currentCookies = this.cookie.split(';').map(c => c.trim());

            const cookieMap = new Map<string, string>();
            currentCookies.forEach(c => {
                const [key, value] = c.split('=');
                if (key) cookieMap.set(key, value);
            });

            newCookies.forEach((c: string) => {
                const [key, value] = c.split('=');
                if (key) cookieMap.set(key, value);
            });

            this.cookie = Array.from(cookieMap.entries())
                .map(([k, v]) => `${k}=${v}`)
                .join('; ');

            // Update client defaults
            this.client.defaults.headers['Cookie'] = this.cookie;
        }
    }

    private async visitHomepage(): Promise<void> {
        try {
            const response = await this.client.get(WEREAD_BASE_URL, {
                headers: {
                    ...this.getHeaders(),
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'sec-fetch-dest': 'document',
                    'sec-fetch-mode': 'navigate',
                }
            });
            this.updateCookie(response);
        } catch (e) {
            console.warn('[WeReadApi] Homepage visit failed (non-fatal):', e);
        }
    }

    public async getNotebooks(): Promise<WeReadNotebookResponse> {
        await this.visitHomepage();

        // Add random delay
        await new Promise(r => setTimeout(r, Math.random() * 500 + 500));

        try {
            const response = await this.client.get<WeReadNotebookResponse>(WEREAD_NOTEBOOKS_URL);
            this.updateCookie(response);
            return response.data;
        } catch (error: unknown) {
            this.handleError(error);
            throw error;
        }
    }

    public async getBookmarks(bookId: string): Promise<WeReadBookmark[]> {
        // Ensure session is active
        await this.visitHomepage();

        // Fetch personal bookmarks and reviews
        const [bookmarks, reviews] = await Promise.all([
            this.fetchBookmarkList(bookId),
            this.fetchReviewList(bookId)
        ]);

        let combined: WeReadBookmark[] = [...bookmarks, ...reviews];

        // Fallback: If no personal data found, try fetching 'Best Bookmarks' (popular highlights)
        if (combined.length === 0) {
            console.log(`[WeReadApi] No personal notes found for ${bookId}. Trying best bookmarks...`);
            const best = await this.fetchBestBookmarks(bookId);
            combined = best;
        }

        // Deduplicate
        const uniqueMap = new Map<string, WeReadBookmark>();
        combined.forEach(item => {
            const text = item.markText;
            if (text && typeof text === 'string' && text.trim().length > 0) {
                uniqueMap.set(text.trim(), item);
            }
        });

        const result = Array.from(uniqueMap.values());
        console.log(`[WeReadApi] Book ${bookId}: Final unique items count: ${result.length}`);
        return result;
    }

    private async fetchBestBookmarks(bookId: string): Promise<WeReadBookmark[]> {
        try {
            const response = await this.client.get<BestBookmarkResponse>("https://weread.qq.com/web/book/bestbookmarks", {
                params: { bookId }
            });
            const data = response.data;
            if (data.items) {
                return data.items.map((item) => ({
                    markText: item.text,
                    createTime: Date.now() / 1000,
                    isBest: true
                }));
            }
            return [];
        } catch (error) {
            console.warn(`[WeReadApi] Failed to fetch best bookmarks for ${bookId}`, error);
            return [];
        }
    }

    private async fetchBookmarkList(bookId: string): Promise<WeReadBookmark[]> {
        try {
            const response = await this.client.get<BookmarkListResponse>(WEREAD_BOOKMARKLIST_URL, {
                params: { bookId }
            });
            const data = response.data;
            if (data.updated) {
                return data.updated.filter((mark) => mark.markText);
            }
            return [];
        } catch (error) {
            console.warn(`[WeReadApi] Failed to fetch bookmarks for ${bookId}`, error);
            return [];
        }
    }

    private async fetchReviewList(bookId: string): Promise<WeReadBookmark[]> {
        const url = "https://weread.qq.com/web/review/list";
        try {
            const response = await this.client.get<ReviewListResponse>(url, {
                params: {
                    bookId,
                    listType: 4,
                    maxIdx: 0,
                    count: 0,
                    listMode: 2,
                    style: 2,
                    syncKey: 0
                }
            });

            const data = response.data;
            if (data.reviews) {
                return data.reviews.map((r) => {
                    const markText = r.review.abstract;

                    if (!markText) return null; // Skip pure thoughts without highlights

                    return {
                        ...r.review,
                        markText: markText,
                        noteText: r.review.content,
                        createTime: r.review.createTime
                    } as WeReadBookmark;
                }).filter((r): r is WeReadBookmark => r !== null);
            }
            return [];
        } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
            // error is explicitly 'any' here as axios errors can be complex, but we can type guard if strict
            console.warn(`[WeReadApi] Failed to fetch reviews for ${bookId}`, error.message);
            return [];
        }
    }

    private handleError(error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        if (error.response) {
            console.error('[WeReadApi] Error:', error.response.status, error.response.data);
            if (error.response.data?.errcode === -2012 || error.response.status === 401) {
                throw new Error('SESSION_EXPIRED');
            }
        }
        console.error('[WeReadApi] Request failed:', error.message);
    }
}
