import type { ContentPart } from '@ag-ui/client';

/** Limits shared with the server (server/src/chats/attachments.ts). */
export const MAX_ATTACHMENTS = 10;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 200 * 1024;

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
/** Browsers often leave `File.type` empty for .md, so documents are recognised by extension. */
const DOCUMENT_TYPES: Record<string, string> = {
  md: 'text/markdown',
  markdown: 'text/markdown',
  html: 'text/html',
  htm: 'text/html',
};

/** Value for the file picker's `accept`. */
export const ACCEPTED_FILES = [
  ...IMAGE_TYPES,
  ...Object.keys(DOCUMENT_TYPES).map((e) => `.${e}`),
].join(',');

/** An attachment as the feed shows it: images by URL (object URL live, server URL from history). */
export interface Attachment {
  name: string;
  kind: 'image' | 'document';
  url?: string;
}

export type FileCheck =
  { ok: true; kind: 'image' | 'document'; mimeType: string } | { ok: false; error: string };

export function checkFile(file: File): FileCheck {
  if (IMAGE_TYPES.has(file.type)) {
    return file.size > MAX_IMAGE_BYTES
      ? { ok: false, error: `${file.name}: картинка больше ${MAX_IMAGE_BYTES / 1024 / 1024} МБ` }
      : { ok: true, kind: 'image', mimeType: file.type };
  }
  const mimeType = DOCUMENT_TYPES[file.name.split('.').pop()?.toLowerCase() ?? ''];
  if (mimeType) {
    return file.size > MAX_DOCUMENT_BYTES
      ? { ok: false, error: `${file.name}: файл больше ${MAX_DOCUMENT_BYTES / 1024} КБ` }
      : { ok: true, kind: 'document', mimeType };
  }
  return { ok: false, error: `${file.name}: поддерживаются картинки, .md и .html` };
}

/** AG-UI content parts for the files, bytes inline as base64. Files must pass `checkFile`. */
export async function toContentParts(files: readonly File[]): Promise<ContentPart[]> {
  return Promise.all(
    files.map(async (file): Promise<ContentPart> => {
      const check = checkFile(file);
      if (!check.ok) {
        throw new Error(check.error);
      }
      const source = {
        type: 'data' as const,
        value: await toBase64(file),
        mimeType: check.mimeType,
      };
      return { type: check.kind, source, metadata: { filename: file.name } };
    }),
  );
}

async function toBase64(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
