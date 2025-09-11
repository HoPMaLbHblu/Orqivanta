'use client';

import { CheckCircle2, CircleAlert, RotateCcw, Upload, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useRef, useState } from 'react';
import { useServerMessage } from '@/components/providers/server-messages';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { formatBytes } from './format';

type UploadState = { id: string; file: File; progress: number; status: 'uploading' | 'done' | 'error' | 'canceled'; error?: string; xhr?: XMLHttpRequest };

export interface UploadResult {
  fileId: string;
  versionId: string;
  name?: string;
}

/**
 * Drag-and-drop or click to upload, with per-file progress, cancel and retry. Uses XHR so
 * progress can be reported; the server checks the real file type and the quota.
 */
export function FileUploader({ endpoint, meta, multiple = true, onUploaded, compact, label, className }: { endpoint: string; meta?: Record<string, unknown>; multiple?: boolean; onUploaded?: (r: UploadResult) => void; compact?: boolean; label?: string; className?: string }) {
  const t = useTranslations('files.upload');
  const tr = useServerMessage();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadState[]>([]);
  const [dragging, setDragging] = useState(false);

  const update = (id: string, patch: Partial<UploadState>) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const start = useCallback(
    (item: UploadState) => {
      const xhr = new XMLHttpRequest();
      const body = new FormData();
      body.append('file', item.file);
      body.append('meta', JSON.stringify(meta ?? {}));
      xhr.upload.onprogress = (e) => e.lengthComputable && update(item.id, { progress: e.loaded / e.total });
      xhr.onload = () => {
        let res: { ok: boolean; data?: UploadResult; error?: { message: string; fieldErrors?: Record<string, string> } } | null = null;
        try {
          res = JSON.parse(xhr.responseText);
        } catch {
          res = null;
        }
        if (res?.ok && res.data) {
          update(item.id, { status: 'done', progress: 1 });
          onUploaded?.(res.data);
          router.refresh();
          setTimeout(() => setItems((list) => list.filter((i) => i.id !== item.id)), 2500);
        } else {
          const msg = res?.error ? tr(Object.values(res.error.fieldErrors ?? {})[0] ?? res.error.message) : t('failed');
          update(item.id, { status: 'error', error: msg });
        }
      };
      xhr.onerror = () => update(item.id, { status: 'error', error: t('network') });
      xhr.open('POST', endpoint);
      xhr.send(body);
      update(item.id, { status: 'uploading', progress: 0, error: undefined, xhr });
    },
    [endpoint, meta, onUploaded, router, t, tr],
  );

  const add = (files: FileList | File[]) => {
    const list = Array.from(files).slice(0, multiple ? 20 : 1);
    const next = list.map((file) => ({ id: crypto.randomUUID(), file, progress: 0, status: 'uploading' as const }));
    setItems((cur) => [...cur, ...next]);
    next.forEach(start);
  };

  return (
    <div className={className}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) add(e.dataTransfer.files);
        }}
        className={cn('flex items-center gap-3 rounded-lg border border-dashed transition-colors', compact ? 'px-3 py-2' : 'flex-col justify-center px-6 py-8 text-center', dragging ? 'border-accent bg-accent-soft/50' : 'border-line-strong bg-surface')}
      >
        <Upload className={cn('text-ink-3', compact ? 'size-4' : 'size-5')} aria-hidden />
        <div className={cn('text-[13px] text-ink-2', compact && 'flex-1')}>
          {label ?? t('dropHere')}{' '}
          <button type="button" onClick={() => input.current?.click()} className="font-medium text-accent hover:underline">
            {t('browse')}
          </button>
          {!compact ? <p className="mt-1 text-[12px] text-ink-3">{t('limits')}</p> : null}
        </div>
        <input ref={input} type="file" multiple={multiple} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => e.target.files && add(e.target.files)} />
      </div>
      {items.length ? (
        <ul className="mt-2 flex flex-col gap-1.5" aria-live="polite">
          {items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2 text-[13px]">
              {i.status === 'done' ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : i.status === 'error' ? <CircleAlert className="size-4 text-danger" aria-hidden /> : <Upload className="size-4 text-ink-3" aria-hidden />}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-ink">{i.file.name}</span>
                  <span className="shrink-0 text-[12px] text-ink-3">{formatBytes(i.file.size)}</span>
                </div>
                {i.status === 'uploading' ? (
                  <div role="progressbar" aria-label={t('progress', { name: i.file.name })} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(i.progress * 100)} className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-3">
                    <div className="h-full bg-accent transition-[width]" style={{ width: `${Math.round(i.progress * 100)}%` }} />
                  </div>
                ) : null}
                {i.status === 'error' ? <p className="mt-0.5 text-[12px] text-danger">{i.error}</p> : null}
                {i.status === 'canceled' ? <p className="mt-0.5 text-[12px] text-ink-3">{t('canceled')}</p> : null}
              </div>
              {i.status === 'uploading' ? (
                <Button size="icon-sm" variant="ghost" aria-label={t('cancel')} onClick={() => { i.xhr?.abort(); update(i.id, { status: 'canceled' }); }}>
                  <X />
                </Button>
              ) : i.status === 'error' || i.status === 'canceled' ? (
                <div className="flex gap-1">
                  <Button size="icon-sm" variant="ghost" aria-label={t('retry')} onClick={() => start(i)}>
                    <RotateCcw />
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label={t('dismiss')} onClick={() => setItems((l) => l.filter((x) => x.id !== i.id))}>
                    <X />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
