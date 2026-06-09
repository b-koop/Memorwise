import { NextResponse } from 'next/server';
import fs from 'fs';
import * as queries from '@/lib/db/queries';
import { isBinarySource } from '@/lib/source-types';

function readTextPrefix(filepath: string, maxBytes = 64 * 1024): string {
  const fd = fs.openSync(filepath, 'r');
  try {
    const buffer = Buffer.alloc(maxBytes);
    const bytesRead = fs.readSync(fd, buffer, 0, maxBytes, 0);
    return buffer.subarray(0, bytesRead).toString('utf-8');
  } finally {
    fs.closeSync(fd);
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const source = queries.getSource(id);
  if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 });

  let content = '';
  const isBinary = isBinarySource(source.filetype, source.source_type);

  if (isBinary) {
    // For binary sources (images, audio, video), show the extracted text from vector chunks
    // The chunks contain the OCR/transcription text
    try {
      const { getDb } = await import('@/lib/db/index');
      const db = getDb();
      // Get chunk texts from messages or from the vector store
      // The extracted text was stored during ingestion — check if we can get it from vectorstore
      const lancedb = await import('@lancedb/lancedb');
      const { getLanceDbPath } = await import('@/lib/paths');
      const conn = await lancedb.connect(getLanceDbPath());
      const tableName = `notebook_${source.notebook_id.replace(/[^a-zA-Z0-9]/g, '_')}`;
      try {
        const table = await conn.openTable(tableName);
        const chunks = await table.query()
          .where(`source_id = '${id.replace(/[^a-f0-9-]/gi, '')}'`)
          .limit(100)
          .toArray();
        if (chunks.length > 0) {
          content = chunks
            .sort((a: any, b: any) => (a.chunk_index as number) - (b.chunk_index as number))
            .map((c: any) => c.text as string)
            .join('\n\n');
        } else {
          content = '(This source has not been indexed yet, or OCR/transcription found no text. Try clicking Re-index.)';
        }
      } catch {
        content = '(Could not read extracted text. Source may need re-indexing.)';
      }
    } catch {
      content = '(Binary file — extracted text not available)';
    }
  } else {
    // Text-based source — read the file directly
    try {
      content = readTextPrefix(source.filepath);
    } catch {
      content = '(Unable to read source file)';
    }
  }

  return NextResponse.json({
    ...source,
    content: content.slice(0, 50000),
  });
}
