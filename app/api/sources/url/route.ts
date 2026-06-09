import { NextResponse } from 'next/server';
import fs from 'fs';
import * as queries from '@/lib/db/queries';
import { extractFromUrl } from '@/lib/rag/web-extract';
import { ingestSource } from '@/lib/rag/ingest';
import { assertSafePathSegment, getSourceFilePath } from '@/lib/paths';

export async function POST(req: Request) {
  const { notebookId, url, folderId } = await req.json();
  if (!notebookId || !url) {
    return NextResponse.json({ error: 'notebookId and url required' }, { status: 400 });
  }
  try { assertSafePathSegment(notebookId, 'notebookId'); }
  catch { return NextResponse.json({ error: 'Invalid notebookId' }, { status: 400 }); }
  if (!queries.getNotebook(notebookId)) return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });
  if (folderId && !queries.listFolders(notebookId).some(f => f.id === folderId)) {
    return NextResponse.json({ error: 'Folder not found in notebook' }, { status: 400 });
  }

  // Extract content — fail early if extraction fails
  let title: string, text: string, sourceType: string;
  try {
    const result = await extractFromUrl(url);
    title = result.title;
    text = result.text;
    sourceType = result.sourceType;
  } catch (err) {
    return NextResponse.json({ error: `Failed to extract content: ${err instanceof Error ? err.message : String(err)}` }, { status: 422 });
  }

  if (!text.trim()) {
    return NextResponse.json({ error: 'No content could be extracted from this URL' }, { status: 422 });
  }

  // Save extracted text
  try {
    const textBuffer = Buffer.from(text, 'utf-8');
    const safeName = title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
    const textFilePath = getSourceFilePath(notebookId, `${safeName || 'url-source'}.txt`);
    fs.writeFileSync(textFilePath, textBuffer, { flag: 'wx' });

    const source = queries.createSource(notebookId, title, textFilePath, 'txt', textBuffer.length, sourceType, folderId);
    ingestSource(source.id, notebookId, textFilePath, 'txt', sourceType);
    return NextResponse.json(source);
  } catch (err) {
    return NextResponse.json({ error: `Failed to save source: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }
}
