import fs from 'fs';
import path from 'path';
import type { Source } from './types';
import { getNotebookSourcesPath, getSourcesPath, isPathInside } from './paths';

export function unlinkSourceFile(source: Pick<Source, 'filepath'>): void {
  const sourcesRoot = getSourcesPath();
  const filePath = path.resolve(source.filepath);
  if (!isPathInside(sourcesRoot, filePath)) return;
  try { fs.rmSync(filePath, { force: true }); } catch {}
}

export function removeNotebookSourcesDir(notebookId: string): void {
  const sourcesRoot = getSourcesPath();
  const notebookDir = path.resolve(getNotebookSourcesPath(notebookId));
  if (!isPathInside(sourcesRoot, notebookDir) || notebookDir === sourcesRoot) return;
  try { fs.rmSync(notebookDir, { recursive: true, force: true }); } catch {}
}
