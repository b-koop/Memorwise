import { NextResponse } from 'next/server';
import * as queries from '@/lib/db/queries';
import { deleteSourceChunks } from '@/lib/rag/vectorstore';
import { unlinkSourceFile } from '@/lib/source-files';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const source = queries.getSource(id);
  if (source) {
    await deleteSourceChunks(source.notebook_id, id);
    unlinkSourceFile(source);
    queries.deleteSource(id);
  }
  return NextResponse.json({ success: true });
}
