import { validation } from '../errors';

/**
 * Rich text is stored as editor JSON, never as HTML. On every write it is rebuilt from an
 * allowlist of node types, marks and attributes, so stored content can't carry scripts,
 * event handlers or unexpected markup. The UI renders it to React elements (no innerHTML).
 */

export interface RichNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
}
export interface RichDoc {
  type: 'doc';
  content?: RichNode[];
}

const BLOCKS = new Set([
  'paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'taskList', 'taskItem',
  'blockquote', 'codeBlock', 'horizontalRule', 'hardBreak', 'text', 'mention', 'image',
  'table', 'tableRow', 'tableHeader', 'tableCell',
]);
const MARKS = new Set(['bold', 'italic', 'strike', 'code', 'link', 'underline', 'highlight']);

const MAX_NODES = 20_000;
const MAX_DEPTH = 24;
const MAX_TEXT = 200_000;

export function isSafeUrl(href: unknown): href is string {
  if (typeof href !== 'string' || href.length > 2000) return false;
  if (href.startsWith('/') && !href.startsWith('//')) return true;
  try {
    const u = new URL(href);
    return ['http:', 'https:', 'mailto:'].includes(u.protocol);
  } catch {
    return false;
  }
}

function cleanAttrs(type: string, attrs: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!attrs) return undefined;
  switch (type) {
    case 'heading': {
      const level = Number(attrs.level);
      return { level: [1, 2, 3].includes(level) ? level : 2 };
    }
    case 'orderedList':
      return { start: Number.isInteger(attrs.start) ? attrs.start : 1 };
    case 'taskItem':
      return { checked: attrs.checked === true };
    case 'codeBlock':
      return typeof attrs.language === 'string' && /^[a-z0-9+#-]{1,20}$/i.test(attrs.language) ? { language: attrs.language } : undefined;
    case 'mention':
      return typeof attrs.id === 'string' && /^[0-9a-f-]{36}$/i.test(attrs.id)
        ? { id: attrs.id, label: typeof attrs.label === 'string' ? attrs.label.slice(0, 80) : '' }
        : undefined;
    case 'image':
      // Only images served by Orqivanta's own permission-checked file route.
      return typeof attrs.src === 'string' && /^\/api\/files\/[0-9a-f-]{36}\/(download|preview)$/.test(attrs.src)
        ? { src: attrs.src, alt: typeof attrs.alt === 'string' ? attrs.alt.slice(0, 300) : '' }
        : undefined;
    case 'tableCell':
    case 'tableHeader': {
      const colspan = Number(attrs.colspan) || 1;
      const rowspan = Number(attrs.rowspan) || 1;
      return { colspan: Math.min(colspan, 20), rowspan: Math.min(rowspan, 50) };
    }
    default:
      return undefined;
  }
}

export function sanitizeRichText(input: unknown): RichDoc {
  if (input === null || input === undefined) return { type: 'doc', content: [] };
  if (typeof input === 'string') return plainToRichText(input);
  if (typeof input !== 'object' || (input as { type?: unknown }).type !== 'doc') {
    throw validation({ content: 'The document format is not recognized.' });
  }
  let nodes = 0;
  let textLen = 0;
  const walk = (node: unknown, depth: number): RichNode | null => {
    if (!node || typeof node !== 'object') return null;
    if (++nodes > MAX_NODES || depth > MAX_DEPTH) throw validation({ content: 'This content is too large or too deeply nested.' });
    const n = node as RichNode;
    if (!BLOCKS.has(n.type)) return null;
    if (n.type === 'text') {
      if (typeof n.text !== 'string' || n.text.length === 0) return null;
      textLen += n.text.length;
      if (textLen > MAX_TEXT) throw validation({ content: 'This content is too long.' });
      const marks = (n.marks ?? [])
        .filter((m) => m && MARKS.has(m.type))
        .map((m) => (m.type === 'link' ? (isSafeUrl(m.attrs?.href) ? { type: 'link', attrs: { href: m.attrs!.href } } : null) : { type: m.type }))
        .filter(Boolean) as RichNode['marks'];
      return { type: 'text', text: n.text, ...(marks && marks.length ? { marks } : {}) };
    }
    const attrs = cleanAttrs(n.type, n.attrs);
    if ((n.type === 'mention' || n.type === 'image') && !attrs) return null;
    const content = Array.isArray(n.content)
      ? (n.content.map((c) => walk(c, depth + 1)).filter(Boolean) as RichNode[])
      : undefined;
    return { type: n.type, ...(attrs ? { attrs } : {}), ...(content && content.length ? { content } : {}) };
  };
  const doc = input as RichDoc;
  const content = (Array.isArray(doc.content) ? doc.content : []).map((c) => walk(c, 1)).filter(Boolean) as RichNode[];
  return { type: 'doc', content };
}

export function plainToRichText(text: string): RichDoc {
  const paras = text.replace(/\r\n/g, '\n').split(/\n{2,}/);
  return {
    type: 'doc',
    content: paras
      .filter((p) => p.trim().length)
      .map((p) => ({ type: 'paragraph', content: [{ type: 'text', text: p.trim() }] })),
  };
}

const BLOCK_BREAK = new Set(['paragraph', 'heading', 'listItem', 'taskItem', 'blockquote', 'codeBlock', 'tableRow']);

export function richTextToPlain(doc: RichDoc | null | undefined): string {
  if (!doc) return '';
  const out: string[] = [];
  const walk = (n: RichNode) => {
    if (n.type === 'text') out.push(n.text ?? '');
    else if (n.type === 'mention') out.push(`@${(n.attrs?.label as string) ?? ''}`);
    else if (n.type === 'hardBreak') out.push('\n');
    n.content?.forEach(walk);
    if (BLOCK_BREAK.has(n.type)) out.push('\n');
    if (n.type === 'tableCell' || n.type === 'tableHeader') out.push(' ');
  };
  doc.content?.forEach(walk);
  return out.join('').replace(/\n{3,}/g, '\n\n').trim();
}

export function extractMentions(doc: RichDoc | null | undefined): string[] {
  const ids = new Set<string>();
  const walk = (n: RichNode) => {
    if (n.type === 'mention' && typeof n.attrs?.id === 'string') ids.add(n.attrs.id);
    n.content?.forEach(walk);
  };
  doc?.content?.forEach(walk);
  return [...ids];
}

export function truncate(text: string, max = 140) {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}
