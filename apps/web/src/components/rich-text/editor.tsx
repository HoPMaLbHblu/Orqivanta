'use client';

import { EditorContent, useEditor, type Editor, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Mention from '@tiptap/extension-mention';
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import { Bold, Code, Heading2, Italic, Link2, List, ListChecks, ListOrdered, Quote, Strikethrough } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { forwardRef, useEffect, useImperativeHandle, useState, type ReactNode } from 'react';
import { Avatar } from '@/components/domain/avatar';
import { cn } from '@/lib/cn';

export interface Mentionable {
  id: string;
  name: string;
  color?: string | null;
}

type MentionListHandle = { onKeyDown: (p: SuggestionKeyDownProps) => boolean };

const MentionList = forwardRef<MentionListHandle, SuggestionProps<Mentionable>>(function MentionList(props, ref) {
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [props.items]);
  const pick = (i: number) => {
    const item = props.items[i];
    if (item) props.command({ id: item.id, label: item.name });
  };
  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowDown') {
        setIndex((i) => (i + 1) % Math.max(props.items.length, 1));
        return true;
      }
      if (event.key === 'ArrowUp') {
        setIndex((i) => (i - 1 + props.items.length) % Math.max(props.items.length, 1));
        return true;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        pick(index);
        return true;
      }
      return false;
    },
  }));
  if (!props.items.length) return null;
  return (
    <div role="listbox" className="z-50 w-56 overflow-hidden rounded-lg border border-line bg-surface p-1 shadow-pop">
      {props.items.map((item, i) => (
        <button key={item.id} type="button" role="option" aria-selected={i === index} onMouseDown={(e) => { e.preventDefault(); pick(i); }} className={cn('flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] text-ink', i === index && 'bg-surface-2')}>
          <Avatar name={item.name} color={item.color} size="xs" title="" />
          <span className="truncate">{item.name}</span>
        </button>
      ))}
    </div>
  );
});

function mentionSuggestion(people: Mentionable[]) {
  return {
    items: ({ query }: { query: string }) => people.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6),
    render: () => {
      let renderer: ReactRenderer<MentionListHandle, SuggestionProps<Mentionable>> | null = null;
      let el: HTMLDivElement | null = null;
      const place = (props: SuggestionProps<Mentionable>) => {
        const rect = props.clientRect?.();
        if (!rect || !el) return;
        el.style.position = 'fixed';
        el.style.left = `${rect.left}px`;
        el.style.top = `${rect.bottom + 6}px`;
        el.style.zIndex = '70';
      };
      return {
        onStart: (props: SuggestionProps<Mentionable>) => {
          renderer = new ReactRenderer(MentionList, { props, editor: props.editor });
          el = document.createElement('div');
          el.appendChild(renderer.element);
          document.body.appendChild(el);
          place(props);
        },
        onUpdate: (props: SuggestionProps<Mentionable>) => {
          renderer?.updateProps(props);
          place(props);
        },
        onKeyDown: (props: SuggestionKeyDownProps) => {
          if (props.event.key === 'Escape') {
            el?.remove();
            return true;
          }
          return renderer?.ref?.onKeyDown(props) ?? false;
        },
        onExit: () => {
          el?.remove();
          renderer?.destroy();
          el = null;
          renderer = null;
        },
      };
    },
  };
}

function ToolbarButton({ onClick, active, label, children }: { onClick: () => void; active?: boolean; label: string; children: ReactNode }) {
  return (
    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onClick} aria-label={label} aria-pressed={active} title={label} className={cn('flex size-7 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink [&_svg]:size-4', active && 'bg-surface-3 text-ink')}>
      {children}
    </button>
  );
}

export function EditorToolbar({ editor, className }: { editor: Editor | null; className?: string }) {
  const t = useTranslations('editor');
  if (!editor) return null;
  return (
    <div role="toolbar" aria-label={t('toolbar')} className={cn('flex flex-wrap items-center gap-0.5', className)}>
      <ToolbarButton label={t('bold')} active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold />
      </ToolbarButton>
      <ToolbarButton label={t('italic')} active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic />
      </ToolbarButton>
      <ToolbarButton label={t('strike')} active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough />
      </ToolbarButton>
      <ToolbarButton label={t('code')} active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}>
        <Code />
      </ToolbarButton>
      <span className="mx-1 h-4 w-px bg-line" aria-hidden />
      <ToolbarButton label={t('heading')} active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 />
      </ToolbarButton>
      <ToolbarButton label={t('bulletList')} active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List />
      </ToolbarButton>
      <ToolbarButton label={t('orderedList')} active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered />
      </ToolbarButton>
      <ToolbarButton label={t('taskList')} active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()}>
        <ListChecks />
      </ToolbarButton>
      <ToolbarButton label={t('quote')} active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote />
      </ToolbarButton>
      <ToolbarButton
        label={t('link')}
        active={editor.isActive('link')}
        onClick={() => {
          const prev = editor.getAttributes('link').href as string | undefined;
          const url = window.prompt(t('linkPrompt'), prev ?? 'https://');
          if (url === null) return;
          if (url === '' || url === 'https://') editor.chain().focus().extendMarkRange('link').unsetLink().run();
          else editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
        }}
      >
        <Link2 />
      </ToolbarButton>
    </div>
  );
}

export interface RichTextEditorProps {
  value: unknown;
  onChange?: (doc: unknown) => void;
  placeholder?: string;
  people?: Mentionable[];
  autoFocus?: boolean;
  className?: string;
  contentClassName?: string;
  onSubmit?: () => void;
  toolbar?: 'top' | 'none';
  ariaLabel?: string;
  onEditor?: (editor: Editor | null) => void;
  editable?: boolean;
}

/** Tiptap editor with @mentions. Content is JSON; the server sanitizes it again on save. */
export function RichTextEditor({ value, onChange, placeholder, people = [], autoFocus, className, contentClassName, onSubmit, toolbar = 'top', ariaLabel, onEditor, editable = true }: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer nofollow' } } }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Mention.configure({ HTMLAttributes: { class: 'mention' }, suggestion: mentionSuggestion(people), renderText: ({ node }) => `@${node.attrs.label}`, renderHTML: ({ node, options }) => ['span', options.HTMLAttributes, `@${node.attrs.label}`] }),
    ],
    content: (value as object) ?? '',
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      attributes: { class: cn('prose-orq focus:outline-none', contentClassName), 'aria-label': ariaLabel ?? placeholder ?? '', role: 'textbox', 'aria-multiline': 'true' },
      handleKeyDown: (_view, event) => {
        if (onSubmit && event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          onSubmit();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => onChange?.(editor.getJSON()),
  });

  useEffect(() => {
    onEditor?.(editor);
  }, [editor, onEditor]);

  return (
    <div className={className}>
      {toolbar === 'top' && editable ? <EditorToolbar editor={editor} className="mb-2" /> : null}
      <EditorContent editor={editor} />
    </div>
  );
}
