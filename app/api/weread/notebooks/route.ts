import { NextResponse } from 'next/server';
import { getWereadCookieFromCloud } from '@/lib/cookiecloud';
import { WeReadApi } from '@/lib/weread-api';

export const dynamic = 'force-dynamic';

export async function GET() {
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
