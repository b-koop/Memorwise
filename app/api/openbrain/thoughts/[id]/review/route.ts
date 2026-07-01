import { NextResponse } from 'next/server';
import * as queries from '@/lib/db/queries';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { action } = await req.json();
  try {
    return NextResponse.json(queries.reviewOpenBrainThought(id, action));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Review failed';
    const status = message === 'Thought not found' ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
