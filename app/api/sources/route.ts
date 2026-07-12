import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { randomUUID } from 'crypto';
import * as queries from '@/lib/db/queries';
import { assertSafePathSegment, getSourceFilePath } from '@/lib/paths';
import { ingestSource } from '@/lib/rag/ingest';
import { detectSourceType } from '@/lib/source-types';

const Busboy = require('busboy');
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_FILES = 20;

class UploadError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

interface ParsedUpload {
  notebookId: string;
  folderId: string | null;
  files: Array<{
    filename: string;
    tempPath: string;
    size: number;
  }>;
  cleanup: () => void;
}

function headersToObject(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => { result[key.toLowerCase()] = value; });
  return result;
}

function parseMultipartUpload(req: Request): Promise<ParsedUpload> {
  if (!req.body) throw new UploadError('Missing request body', 400);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'thestacks-upload-'));
  const cleanup = () => fs.rmSync(tempDir, { recursive: true, force: true });

  return new Promise((resolve, reject) => {
    let notebookId = '';
    let folderId: string | null = null;
    let failed = false;
    const files: ParsedUpload['files'] = [];
    const writes: Promise<void>[] = [];
    const requestStream = Readable.fromWeb(req.body as any);

    const fail = (err: unknown) => {
      if (failed) return;
      failed = true;
      requestStream.destroy(err instanceof Error ? err : new Error(String(err)));
      cleanup();
      reject(err);
    };

    let busboy: any;
    try {
      busboy = Busboy({
        headers: headersToObject(req.headers),
        limits: {
          fileSize: MAX_FILE_SIZE,
          files: MAX_FILES,
          fields: 5,
          fieldSize: 1024,
        },
      });
    } catch (err) {
      cleanup();
      reject(new UploadError(`Invalid multipart upload: ${err instanceof Error ? err.message : String(err)}`, 400));
      return;
    }

    busboy.on('field', (name: string, value: string) => {
      if (name === 'notebookId') notebookId = value;
      if (name === 'folderId') folderId = value || null;
    });

    busboy.on('file', (fieldname: string, file: NodeJS.ReadableStream, info: { filename?: string }) => {
      if (fieldname !== 'files') {
        file.resume();
        return;
      }

      const filename = info.filename || 'upload';
      const tempPath = path.join(tempDir, `${randomUUID()}-${path.basename(filename)}`);
      let size = 0;
      let limited = false;

      file.on('data', (chunk: Buffer) => { size += chunk.byteLength; });
      file.on('limit', () => {
        limited = true;
        fail(new UploadError(`File "${filename}" exceeds 500MB limit`, 413));
      });

      const write = pipeline(file as any, fs.createWriteStream(tempPath, { flags: 'wx' }))
        .then(() => {
          if (!failed && !limited) files.push({ filename, tempPath, size });
        })
        .catch(err => {
          if (!failed) fail(err);
        });
      writes.push(write);
    });

    busboy.on('filesLimit', () => fail(new UploadError(`Too many files; upload at most ${MAX_FILES} files at a time`, 413)));
    busboy.on('fieldsLimit', () => fail(new UploadError('Too many form fields', 400)));
    busboy.on('error', fail);
    busboy.on('finish', async () => {
      try {
        await Promise.all(writes);
        if (failed) return;
        resolve({ notebookId, folderId, files, cleanup });
      } catch (err) {
        fail(err);
      }
    });

    requestStream.on('error', fail);
    requestStream.pipe(busboy);
  });
}

async function moveUploadedFile(src: string, dest: string): Promise<void> {
  try {
    await fs.promises.rename(src, dest);
  } catch (err: any) {
    if (err?.code !== 'EXDEV') throw err;
    await pipeline(
      fs.createReadStream(src),
      fs.createWriteStream(dest, { flags: 'wx' })
    );
    await fs.promises.unlink(src);
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const notebookId = searchParams.get('notebookId');
  if (!notebookId) return NextResponse.json({ error: 'notebookId required' }, { status: 400 });
  return NextResponse.json(queries.listSources(notebookId));
}

export async function POST(req: Request) {
  let upload: ParsedUpload;
  try {
    upload = await parseMultipartUpload(req);
  } catch (err) {
    const status = err instanceof UploadError ? err.status : 400;
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Invalid upload' }, { status });
  }

  const { notebookId, folderId, files } = upload;
  const rejectUpload = (message: string, status = 400) => {
    upload.cleanup();
    return NextResponse.json({ error: message }, { status });
  };

  if (!notebookId) return rejectUpload('notebookId required');
  try { assertSafePathSegment(notebookId, 'notebookId'); }
  catch { return rejectUpload('Invalid notebookId'); }
  if (!queries.getNotebook(notebookId)) return rejectUpload('Notebook not found', 404);

  if (folderId && !queries.listFolders(notebookId).some(f => f.id === folderId)) {
    return rejectUpload('Folder not found in notebook');
  }
  if (files.length === 0) return rejectUpload('No files');

  const sources = [];
  try {
    for (const file of files) {
      let destPath = '';
      try {
        if (file.size > MAX_FILE_SIZE) {
          return NextResponse.json({ error: `File "${file.filename}" exceeds 500MB limit` }, { status: 413 });
        }
        const ext = path.extname(file.filename).slice(1).toLowerCase();
        const sourceType = detectSourceType(ext);
        destPath = getSourceFilePath(notebookId, file.filename);
        await moveUploadedFile(file.tempPath, destPath);

        const source = queries.createSource(notebookId, file.filename, destPath, ext, file.size, sourceType, folderId ?? undefined);
        sources.push(source);

        // Async ingestion — don't await
        ingestSource(source.id, notebookId, destPath, ext, sourceType);
      } catch (err) {
        if (destPath) fs.rmSync(destPath, { force: true });
        console.error(`Failed to process ${file.filename}:`, err);
      }
    }
  } finally {
    upload.cleanup();
  }

  return NextResponse.json(sources);
}
