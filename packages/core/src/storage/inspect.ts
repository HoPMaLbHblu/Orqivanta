import { fileTypeFromBuffer } from 'file-type';
import { validation } from '../errors';

/**
 * Determines a file's real type from its contents (magic bytes), not from the name or the
 * browser-supplied MIME type. Only the types below are accepted.
 */
const ALLOWED_BINARY: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'video/mp4': 'mp4',
  'audio/mpeg': 'mp3',
};

const TEXT_EXTENSIONS: Record<string, string> = {
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  json: 'application/json',
};

export const PREVIEWABLE = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf']);
export const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

export function sanitizeFileName(name: string) {
  const cleaned = name
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
  return cleaned || 'file';
}

function looksLikeUtf8Text(buf: Buffer) {
  const sample = buf.subarray(0, 64 * 1024);
  if (sample.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(sample);
    return true;
  } catch {
    return false;
  }
}

export async function inspectUpload(buf: Buffer, originalName: string): Promise<{ mimeType: string }> {
  const detected = await fileTypeFromBuffer(buf);
  if (detected) {
    if (!ALLOWED_BINARY[detected.mime]) {
      throw validation({ file: `Files of type ${detected.ext.toUpperCase()} aren’t supported. Use images, PDF, Office documents, ZIP, MP4, MP3 or plain text.` });
    }
    return { mimeType: detected.mime };
  }
  const ext = originalName.split('.').pop()?.toLowerCase() ?? '';
  const textType = TEXT_EXTENSIONS[ext];
  if (textType && looksLikeUtf8Text(buf)) return { mimeType: textType };
  throw validation({ file: 'This file type isn’t supported or the file is damaged.' });
}
