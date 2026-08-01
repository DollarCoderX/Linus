import type { LinusAttachment } from '../../shared/linus';

export interface AttachmentReadResult {
  readableText: string;
  images: LinusAttachment[];
  documents: LinusAttachment[];
}

const maxDocumentChars = 18000;

export function splitAttachments(attachments: LinusAttachment[]): AttachmentReadResult {
  const images = attachments.filter((attachment) => attachment.mimeType.startsWith('image/')).slice(0, 7);
  const documents = attachments.filter((attachment) => !attachment.mimeType.startsWith('image/')).slice(0, 6);
  const readableText = documents.map(readDocumentAttachment).join('\n\n').slice(0, maxDocumentChars);

  return {
    readableText,
    images,
    documents
  };
}

function readDocumentAttachment(attachment: LinusAttachment): string {
  const buffer = dataUrlToBuffer(attachment.dataUrl);
  const ext = extensionOf(attachment.name);

  if (isTextDocument(attachment.mimeType, ext)) {
    return formatDocumentText(attachment, decodeText(buffer));
  }

  if (attachment.mimeType === 'application/pdf' || ext === '.pdf') {
    return formatDocumentText(attachment, extractRoughPdfText(buffer));
  }

  return [
    `Document: ${attachment.name}`,
    `Type: ${attachment.mimeType || 'unknown'}`,
    'Linus could not safely extract text from this binary document yet. Supported now: text, code, markdown, json, csv, logs, and rough PDF text.'
  ].join('\n');
}

function formatDocumentText(attachment: LinusAttachment, text: string): string {
  const clean = text.replace(/\u0000/g, '').replace(/[ \t]+\n/g, '\n').trim();
  return [
    `Document: ${attachment.name}`,
    `Type: ${attachment.mimeType || 'unknown'}`,
    'Content:',
    clean ? clean.slice(0, 6000) : '[No readable text extracted]'
  ].join('\n');
}

function isTextDocument(mimeType: string, ext: string): boolean {
  return (
    mimeType.startsWith('text/') ||
    [
      '.txt',
      '.md',
      '.markdown',
      '.json',
      '.jsonc',
      '.csv',
      '.tsv',
      '.log',
      '.js',
      '.jsx',
      '.ts',
      '.tsx',
      '.css',
      '.html',
      '.xml',
      '.yaml',
      '.yml',
      '.toml',
      '.ini',
      '.env',
      '.py',
      '.java',
      '.c',
      '.cpp',
      '.cs',
      '.go',
      '.rs',
      '.php',
      '.rb',
      '.sql'
    ].includes(ext)
  );
}

function extractRoughPdfText(buffer: Buffer): string {
  const latin = buffer.toString('latin1');
  const pieces = Array.from(latin.matchAll(/\(([^()]{3,500})\)\s*T[jJ]/g))
    .map((match) => match[1])
    .join(' ');
  const fallback = latin
    .replace(/[^\x20-\x7E\n\r\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 7000);

  return unescapePdfText(pieces || fallback);
}

function unescapePdfText(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeText(buffer: Buffer): string {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.subarray(2).toString('utf16le');
  }

  return buffer.toString('utf8');
}

function dataUrlToBuffer(dataUrl: string): Buffer {
  const base64 = dataUrl.split(',', 2)[1] ?? '';
  return Buffer.from(base64, 'base64');
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot).toLowerCase();
}
