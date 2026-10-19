import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { RunAgentInput } from '@ag-ui/core';
import type { ImageContent } from '@earendil-works/pi-ai';

/** Limits shared with the client (src/app/chat/attachments.ts). */
export const MAX_ATTACHMENTS = 10;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 200 * 1024;

const IMAGE_TYPES: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
};
const DOCUMENT_TYPES = new Set(['text/markdown', 'text/html']);

export interface AttachedImage extends ImageContent {
  filename: string;
}

export interface AttachedDocument {
  filename: string;
  mimeType: string;
  text: string;
}

export interface UserMessage {
  text: string;
  images: AttachedImage[];
  documents: AttachedDocument[];
}

/** A bad attachment: the run is rejected with 400 and this message. */
export class AttachmentError extends Error {}

/**
 * The last user message of an AG-UI run: its text plus image and document parts
 * (`source: { type: 'data' }`, file name in `metadata.filename`). Other parts are ignored.
 */
export function parseUserMessage(input: Partial<RunAgentInput>): UserMessage {
  const message = [...(input.messages ?? [])].reverse().find((m) => m.role === 'user');
  const result: UserMessage = { text: '', images: [], documents: [] };
  if (!message) {
    return result;
  }
  const { content } = message;
  if (typeof content === 'string') {
    return { ...result, text: content.trim() };
  }

  const texts: string[] = [];
  for (const part of content) {
    if (part.type === 'text') {
      texts.push(part.text);
      continue;
    }
    if (part.type !== 'image' && part.type !== 'document') {
      continue;
    }
    if (part.source.type !== 'data') {
      throw new AttachmentError('Attachments must be sent inline');
    }
    const { value, mimeType } = part.source;
    const filename = fileName(part.metadata);
    const bytes = Buffer.byteLength(value, 'base64');
    if (part.type === 'image') {
      if (!IMAGE_TYPES[mimeType]) {
        throw new AttachmentError(`Unsupported image type: ${filename}`);
      }
      if (bytes > MAX_IMAGE_BYTES) {
        throw new AttachmentError(`Image is too large: ${filename}`);
      }
      result.images.push({ type: 'image', data: value, mimeType, filename });
    } else {
      if (!DOCUMENT_TYPES.has(mimeType)) {
        throw new AttachmentError(`Unsupported file type: ${filename}`);
      }
      if (bytes > MAX_DOCUMENT_BYTES) {
        throw new AttachmentError(`File is too large: ${filename}`);
      }
      result.documents.push({
        filename,
        mimeType,
        text: Buffer.from(value, 'base64').toString('utf8'),
      });
    }
  }
  if (result.images.length + result.documents.length > MAX_ATTACHMENTS) {
    throw new AttachmentError(`At most ${MAX_ATTACHMENTS} attachments per message`);
  }
  return { ...result, text: texts.join('\n').trim() };
}

/** The text sent to the model: the user's text followed by each document inline. */
export function buildPrompt({ text, documents }: UserMessage): string {
  const files = documents.map(
    (doc) =>
      `<attached_file name="${escapeAttr(doc.filename)}" type="${doc.mimeType}">\n` +
      `${doc.text}\n</attached_file>`,
  );
  return [text, ...files].filter(Boolean).join('\n\n');
}

/** Short description of the request for the chat title and commit messages. */
export function requestSummary({ text, images, documents }: UserMessage): string {
  if (text) {
    return text;
  }
  const names = [...images, ...documents].map((a) => a.filename);
  return `Вложения: ${names.join(', ')}`;
}

/** What the feed shows for an attachment; stored images are served at `url`. */
export interface AttachmentView {
  name: string;
  kind: 'image' | 'document';
  url?: string;
}

/**
 * Stored copies of attached images, so the feed can show them after a reload
 * (`data/chats/<id>/attachments/<uuid>.<ext>`). Documents live only in the model's history.
 */
export class ChatAttachments {
  constructor(private readonly chatsDir: string) {}

  async save(chatId: string, message: UserMessage): Promise<AttachmentView[]> {
    const images = await Promise.all(
      message.images.map(async (image): Promise<AttachmentView> => {
        const file = `${randomUUID()}${IMAGE_TYPES[image.mimeType]}`;
        const dir = this.dir(chatId);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(path.join(dir, file), Buffer.from(image.data, 'base64'));
        return {
          name: image.filename,
          kind: 'image',
          url: `/api/chats/${chatId}/attachments/${file}`,
        };
      }),
    );
    const documents = message.documents.map((doc): AttachmentView => ({
      name: doc.filename,
      kind: 'document',
    }));
    return [...images, ...documents];
  }

  /** Absolute path of a stored image, or undefined for a name that is not one of ours. */
  filePath(chatId: string, file: string): string | undefined {
    const valid = /^[0-9a-f-]{36}\.(png|jpg|gif|webp)$/.test(file);
    return valid ? path.join(this.dir(chatId), file) : undefined;
  }

  private dir(chatId: string): string {
    return path.join(this.chatsDir, chatId, 'attachments');
  }
}

function fileName(metadata: unknown): string {
  const name = (metadata as { filename?: unknown } | undefined)?.filename;
  return typeof name === 'string' && name.trim() ? path.basename(name.trim()) : 'file';
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
