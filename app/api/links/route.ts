import { NextResponse } from 'next/server';
import * as queries from '@/lib/db/queries';

export async function POST(req: Request) {
  const { notebookId, fromId, fromType, toId, toType } = await req.json();
  if (!notebookId || !fromId || !fromType || !toId || !toType) {
    return NextResponse.json({ error: 'notebookId, fromId, fromType, toId, and toType required' }, { status: 400 });
  }
  try {
    const link = queries.createLink(notebookId, fromId, fromType, toId, toType);
    return NextResponse.json(link);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Invalid link' }, { status: 400 });
  }
}
