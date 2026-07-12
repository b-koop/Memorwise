import { NextResponse } from 'next/server';
import { searchSerper } from '@/lib/search/serper';

export async function POST() {
  try {
    await searchSerper('test', 1);
    return NextResponse.json({ available: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Search test failed';
    return NextResponse.json({ available: false, error: message }, { status: 502 });
  }
}
