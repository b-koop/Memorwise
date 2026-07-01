import { NextResponse } from 'next/server';
import * as queries from '@/lib/db/queries';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  return NextResponse.json(queries.listOpenBrainThoughts({
    includeRestricted: searchParams.get('unlocked') === '1',
    type: searchParams.get('type') ?? undefined,
    reviewStatus: searchParams.get('review_status') ?? undefined,
  }));
}
