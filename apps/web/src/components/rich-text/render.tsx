import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Node = { type: string; attrs?: Record<string, unknown>; content?: Node[]; marks?: { type: string; attrs?: Record<string, unknown> }[]; text?: string };

/**
 * Renders stored rich text (already sanitized on write) as React elements. No HTML string
 * is ever injected, so content can't run scripts even if the database were tampered with.
 */
export function RichText({ doc, className, compact }: { doc: unknown; className?: string; compact?: boolean }) {
  const root = doc as { type?: string; content?: Node[] } | null;
  if (!root || root.type !== 'doc' || !root.content?.length) return null;
  return <div className={cn('prose-orq', compact && 'compact', className)}>{root.content.map((n, i) => renderNode(n, i))}</div>;
}

function isExternal(href: string) {
  return /^https?:\/\//.test(href);
}

function renderText(n: Node, key: number): ReactNode {
  let el: ReactNode = n.text ?? '';
  for (const m of n.marks ?? []) {
    switch (m.type) {
      case 'bold':
        el = <strong>{el}</strong>;
        break;
      case 'italic':
        el = <em>{el}</em>;
        break;
      case 'strike':
        el = <s>{el}</s>;
        break;
      case 'underline':
        el = <u>{el}</u>;
        break;
      case 'code':
        el = <code>{el}</code>;
        break;
      case 'highlight':
        el = <mark className="rounded-sm bg-attention-soft text-ink">{el}</mark>;
        break;
      case 'link': {
        const href = String(m.attrs?.href ?? '');
        el = isExternal(href) ? (
          <a href={href} target="_blank" rel="noopener noreferrer nofollow">
            {el}
          </a>
        ) : (
          <a href={href}>{el}</a>
        );
        break;
      }
    }
  }
  return <Fragment key={key}>{el}</Fragment>;
}

function children(n: Node) {
  return n.content?.map((c, i) => renderNode(c, i));
}

function renderNode(n: Node, key: number): ReactNode {
  switch (n.type) {
    case 'text':
      return renderText(n, key);
    case 'paragraph':
      return <p key={key}>{children(n)}</p>;
    case 'heading': {
      const level = Number(n.attrs?.level) || 2;
      const H = (level === 1 ? 'h2' : level === 2 ? 'h3' : 'h4') as 'h2';
      // Document headings sit below the page title, so h1 in content renders as h2, and so on.
      return (
        <H key={key} className={level === 1 ? 'text-[1.5rem]' : undefined}>
          {children(n)}
        </H>
      );
    }
    case 'bulletList':
      return <ul key={key}>{children(n)}</ul>;
    case 'orderedList':
      return (
        <ol key={key} start={Number(n.attrs?.start) || 1}>
          {children(n)}
        </ol>
      );
    case 'listItem':
      return <li key={key}>{children(n)}</li>;
    case 'taskList':
      return (
        <ul key={key} data-type="taskList">
          {children(n)}
        </ul>
      );
    case 'taskItem': {
      const checked = n.attrs?.checked === true;
      return (
        <li key={key} data-checked={checked}>
          <label>
            <input type="checkbox" checked={checked} readOnly disabled aria-label={checked ? 'Done' : 'Not done'} className="accent-[var(--accent)]" />
          </label>
          <div>{children(n)}</div>
        </li>
      );
    }
    case 'blockquote':
      return <blockquote key={key}>{children(n)}</blockquote>;
    case 'codeBlock':
      return (
        <pre key={key}>
          <code>{n.content?.map((c) => c.text).join('')}</code>
        </pre>
      );
    case 'horizontalRule':
      return <hr key={key} />;
    case 'hardBreak':
      return <br key={key} />;
    case 'mention':
      return (
        <span key={key} className="mention" data-id={String(n.attrs?.id ?? '')}>
          @{String(n.attrs?.label ?? '')}
        </span>
      );
    case 'image':
      // eslint-disable-next-line @next/next/no-img-element
      return <img key={key} src={String(n.attrs?.src)} alt={String(n.attrs?.alt ?? '')} loading="lazy" />;
    case 'table':
      return (
        <table key={key}>
          <tbody>{children(n)}</tbody>
        </table>
      );
    case 'tableRow':
      return <tr key={key}>{children(n)}</tr>;
    case 'tableHeader':
      return <th key={key}>{children(n)}</th>;
    case 'tableCell':
      return <td key={key}>{children(n)}</td>;
    default:
      return null;
  }
}

/** True when a document has no visible text. */
export function isEmptyDoc(doc: unknown) {
  const walk = (n: Node): boolean => Boolean(n.text?.trim()) || n.type === 'mention' || n.type === 'image' || Boolean(n.content?.some(walk));
  const root = doc as { content?: Node[] } | null;
  return !root?.content?.some(walk);
}
