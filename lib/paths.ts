import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

const SAFE_PATH_SEGMENT = /^[A-Za-z0-9_-]+$/;

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function assertSafePathSegment(value: string, label = 'path segment'): string {
  if (!value || !SAFE_PATH_SEGMENT.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}

export function isPathInside(parent: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

export function sanitizeFilename(filename: string, fallback = 'source.txt'): string {
  const base = path.basename(filename || '').replace(/[^a-zA-Z0-9._-]/g, '_');
  const trimmed = base.replace(/^\.+$/, '').slice(0, 160);
  return trimmed || fallback;
}

const DATA_DIR = process.env.MEMORWISE_DATA_DIR || path.join(process.cwd(), '.memorwise');

export function getDataDir() {
  return ensureDir(DATA_DIR);
}

export function getDbPath() {
  return path.join(getDataDir(), 'memorwise.db');
}

export function getLanceDbPath() {
  return ensureDir(path.join(getDataDir(), 'lancedb'));
}

export function getSourcesPath() {
  return ensureDir(path.join(getDataDir(), 'sources'));
}

export function getNotebookSourcesPath(notebookId: string) {
  const safeNotebookId = assertSafePathSegment(notebookId, 'notebookId');
  return ensureDir(path.join(getSourcesPath(), safeNotebookId));
}

export function getSourceFilePath(notebookId: string, filename: string) {
  const dir = getNotebookSourcesPath(notebookId);
  const safeName = sanitizeFilename(filename);
  const destPath = path.join(dir, `${Date.now()}_${randomUUID()}_${safeName}`);
  if (!isPathInside(dir, destPath)) throw new Error('Invalid source filepath');
  return destPath;
}
