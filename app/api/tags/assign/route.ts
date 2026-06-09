import { NextResponse } from 'next/server';
import * as queries from '@/lib/db/queries';

export async function POST(req: Request) {
  const { tagId, targetId, targetType } = await req.json();
  if (!tagId || !targetId || !targetType) {
    return NextResponse.json({ error: 'tagId, targetId, and targetType required' }, { status: 400 });
  }
  try {
    queries.assignTag(tagId, targetId, targetType);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Invalid tag assignment' }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const { tagId, targetId } = await req.json();
  if (!tagId || !targetId) {
    return NextResponse.json({ error: 'tagId and targetId required' }, { status: 400 });
  }
  queries.unassignTag(tagId, targetId);
  return NextResponse.json({ success: true });
}
