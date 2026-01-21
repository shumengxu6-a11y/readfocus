import { NextRequest, NextResponse } from 'next/server';
import { getWereadCookieFromCloud } from '@/lib/cookiecloud';
import { WeReadApi } from '@/lib/weread-api';
import { saveLocalBookmarks, getLocalBookmarks } from '@/lib/local-cache';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const bookId = searchParams.get('bookId');

  if (!bookId) {
    return NextResponse.json({ error: 'bookId required' }, { status: 400 });
  }

  // 1. STRATEGY: Check Local Cache FIRST
  // This ensures we use the 500+ extracted items immediately without network latency
  // and solves the "repetition" issue because we have the full list locally.
  const cachedBookmarks = getLocalBookmarks();
  const bookBookmarks = cachedBookmarks.filter(b => b.bookId === bookId);
  
  if (bookBookmarks.length > 0) {
      console.log(`[API] Serving ${bookBookmarks.length} bookmarks from local cache for book ${bookId}`);
      // Return ALL cached bookmarks for this book to frontend, 
      // let frontend handle randomization to ensure no repeats.
      return NextResponse.json({ updated: bookBookmarks });
  }

  // 2. Fallback to Network Fetch if not in cache
  let cookie = process.env.WEREAD_COOKIE;

  if (process.env.COOKIECLOUD_HOST && process.env.COOKIECLOUD_UUID) {
    const cloudCookie = await getWereadCookieFromCloud();
    if (cloudCookie) {
      cookie = cloudCookie;
    }
  }

  if (!cookie) {
    return NextResponse.json({ error: 'Cookie not configured' }, { status: 500 });
  }

  try {
    const api = new WeReadApi(cookie);
    const data = await api.getBookmarks(bookId);
    
    // Save fetched bookmarks to local cache
    if (data.length > 0) {
        saveLocalBookmarks(data.map((item: any) => ({
            bookmarkId: item.bookmarkId || `gen-${Date.now()}-${Math.random()}`,
            bookId: bookId,
            markText: item.markText,
            createTime: item.createTime,
            chapterUid: item.chapterUid,
            // Assuming we don't have title/author here, they are enriched in frontend
        })));
    }

    return NextResponse.json({ updated: data });
  } catch (error: any) {
    if (error.message === 'SESSION_EXPIRED') {
      return NextResponse.json({ 
        error: 'WeChat Reading Session Expired', 
        code: 'SESSION_EXPIRED' 
      }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Failed to fetch bookmarks', details: error.message },
      { status: 500 }
    );
  }
}
