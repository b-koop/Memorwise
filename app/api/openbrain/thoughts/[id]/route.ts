import { NextResponse } from 'next/server';
import * as queries from '@/lib/db/queries';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const thought = queries.getOpenBrainThought(id, {
    includeRestricted: searchParams.get('unlocked') === '1',
  });
  if (!thought) return NextResponse.json({ error: 'Thought not found' }, { status: 404 });
  return NextResponse.json(thought);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const patch = await req.json();
  try {
    return NextResponse.json(queries.updateOpenBrainThought(id, patch));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Thought not found' }, { status: 404 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  queries.deleteOpenBrainThought(id);
  return NextResponse.json({ success: true });
}
