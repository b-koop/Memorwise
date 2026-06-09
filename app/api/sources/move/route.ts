import { NextResponse } from 'next/server';
import { updateSourceFolder } from '@/lib/db/queries';

export async function POST(req: Request) {
  const { sourceId, folderId } = await req.json();
  if (!sourceId) return NextResponse.json({ error: 'sourceId required' }, { status: 400 });
  try {
    updateSourceFolder(sourceId, folderId || null);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Invalid move' }, { status: 400 });
  }
}
