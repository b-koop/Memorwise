export const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'webp'];
export const AUDIO_EXTS = ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'wma'];
export const VIDEO_EXTS = ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv'];

export const BINARY_SOURCE_TYPES = ['image', 'audio', 'video'];
export const BINARY_EXTS = [...IMAGE_EXTS, ...AUDIO_EXTS, ...VIDEO_EXTS];

export function detectSourceType(ext: string): 'image' | 'audio' | 'video' | 'file' {
  const normalized = ext.toLowerCase();
  if (IMAGE_EXTS.includes(normalized)) return 'image';
  if (AUDIO_EXTS.includes(normalized)) return 'audio';
  if (VIDEO_EXTS.includes(normalized)) return 'video';
  return 'file';
}

export function isBinarySource(filetype: string, sourceType: string): boolean {
  return BINARY_SOURCE_TYPES.includes(sourceType) || BINARY_EXTS.includes(filetype.toLowerCase());
}
