import { NextRequest, NextResponse } from 'next/server';
import { getWereadCookieFromCloud } from '@/lib/cookiecloud';
import { WeReadApi } from '@/lib/weread-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Priority 1: Cookie from client (user's browser localStorage)
  let cookie = request.headers.get('X-Weread-Cookie');

  // Priority 2: CookieCloud (for local dev)
  if (!cookie && process.env.COOKIECLOUD_HOST && process.env.COOKIECLOUD_UUID) {
    const cloudCookie = await getWereadCookieFromCloud();
    if (cloudCookie) {
      cookie = cloudCookie;
    }
  }

  // Priority 3: Environment variable
  if (!cookie) {
    cookie = process.env.WEREAD_COOKIE || null;
  }

  if (!cookie) {
    return NextResponse.json({ error: 'Cookie not configured' }, { status: 500 });
  }

  try {
    const api = new WeReadApi(cookie);
    const data = await api.getNotebooks();
    return NextResponse.json(data);
  } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (error.message === 'SESSION_EXPIRED') {
      return NextResponse.json({
        error: 'WeChat Reading Session Expired',
        code: 'SESSION_EXPIRED'
      }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Failed to fetch notebooks', details: error.message },
      { status: 500 }
    );
  }
}
