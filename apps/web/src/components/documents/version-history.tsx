'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ArrowLeft, Bookmark, History, RotateCcw, Tag } from 'lucide-react';
import { nameDocumentVersionAction, restoreDocumentVersionAction } from '@/actions/documents';
import { Avatar } from '@/components/domain/avatar';
import { Badge } from '@/components/domain/badges';
import { FormattedDate, RelativeTime } from '@/components/domain/dates';
import { isEmptyDoc, RichText } from '@/components/rich-text/render';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { useAction } from '@/lib/use-action';

interface VersionRow {
  id: string;
  version: number;
  title: string;
  label: string | null;
  createdAt: Date;
  authorName: string | null;
  authorColor: string | null;
  length: number;
}

export function VersionHistory({ org, doc, canEdit, versions, selected }: { org: string; doc: { id: string; title: string; version: number; projectKey: string | null }; canEdit: boolean; versions: VersionRow[]; selected: { id: string; version: number; title: string; content: unknown; label: string | null; createdAt: Date } | null }) {
  const t = useTranslations('documents.historyPage');
  const tc = useTranslations('common');
  const router = useRouter();
  const { call, pending, fieldErrors } = useAction();
  const [restoring, setRestoring] = useState(false);
  const [naming, setNaming] = useState(false);
  const [label, setLabel] = useState('');
  const latest = versions[0];
  const isLatest = selected?.id === latest?.id;
  // Naming always labels the document as it is now; offer it when that state has no name yet.
  const canName = canEdit && isLatest && !(latest?.label && latest.version === doc.version);
  const base = `/${org}/documents/${doc.id}`;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-10">
      <Link href={base} className="inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink">
        <ArrowLeft className="size-3.5" aria-hidden /> {t('back', { name: doc.title })}
      </Link>
      <header className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">{t('title')}</h1>
          <p className="mt-1 max-w-2xl text-[13px] text-ink-2">{t('description')}</p>
        </div>
      </header>

      {versions.length === 0 ? (
        <div className="mt-6 rounded-lg border border-line bg-surface">
          <EmptyState icon={<History />} title={t('emptyTitle')} description={t('emptyHint')} />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <nav aria-label={t('listLabel')} className="overflow-hidden rounded-lg border border-line bg-surface lg:self-start">
            <ol className="max-h-[70vh] divide-y divide-line overflow-y-auto">
              {versions.map((v, i) => {
                const active = v.id === selected?.id;
                return (
                  <li key={v.id}>
                    <Link href={`${base}/history?v=${v.id}`} scroll={false} aria-current={active ? 'true' : undefined} className={cn('flex flex-col gap-1 px-4 py-2.5 transition-colors', active ? 'bg-accent-soft/60' : 'hover:bg-surface-2')}>
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-[12px] text-ink-2">v{v.version}</span>
                        {i === 0 ? <Badge tone="accent">{t('current')}</Badge> : null}
                        {v.label ? (
                          <Badge tone="neutral" icon={Tag}>
                            {v.label}
                          </Badge>
                        ) : null}
                      </span>
                      <span className="flex items-center gap-1.5 text-[12px] text-ink-3">
                        {v.authorName ? <Avatar name={v.authorName} color={v.authorColor} size="xs" title="" /> : null}
                        <span className="truncate">{v.authorName ?? t('unknown')}</span>
                        <span aria-hidden>·</span>
                        <RelativeTime date={v.createdAt} />
                      </span>
                      {v.title !== doc.title ? <span className="truncate text-[12px] text-ink-3">{t('titled', { title: v.title })}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </nav>

          {selected ? (
            <section aria-labelledby="version-heading" className="min-w-0 rounded-lg border border-line bg-surface">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
                <div className="min-w-0">
                  <h2 id="version-heading" className="text-[14px] font-semibold text-ink">
                    {t('versionHeading', { version: selected.version })}
                    {selected.label ? <span className="font-normal text-ink-3"> · {selected.label}</span> : null}
                  </h2>
                  <p className="text-[12px] text-ink-3">
                    <FormattedDate date={selected.createdAt} withTime /> · {isLatest ? t('readOnlyCurrent') : t('readOnly')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canName ? (
                    <Button size="sm" variant="secondary" onClick={() => { setLabel(''); setNaming(true); }}>
                      <Bookmark /> {t('name')}
                    </Button>
                  ) : null}
                  {canEdit && !isLatest ? (
                    <Button size="sm" variant="primary" onClick={() => setRestoring(true)}>
                      <RotateCcw /> {t('restore')}
                    </Button>
                  ) : null}
                </div>
              </div>
              <article className="px-5 py-6 sm:px-10">
                <p className="font-serif text-[30px] leading-tight text-ink">{selected.title}</p>
                <div className="mt-5">{isEmptyDoc(selected.content) ? <p className="text-[13px] text-ink-3">{t('emptyVersion')}</p> : <RichText doc={selected.content} />}</div>
              </article>
            </section>
          ) : null}
        </div>
      )}

      <ConfirmDialog
        open={restoring}
        onOpenChange={setRestoring}
        tone="primary"
        title={t('restoreTitle', { version: selected?.version ?? 0 })}
        description={t('restoreBody', { version: selected?.version ?? 0 })}
        confirmLabel={t('restore')}
        onConfirm={async () => {
          if (!selected) return false;
          const res = await call(() => restoreDocumentVersionAction(org, { documentId: doc.id, versionId: selected.id }), { success: t('restored', { version: selected.version }), refresh: false });
          if (res.ok) router.push(base);
          return res.ok;
        }}
      />
      <Dialog open={naming} onOpenChange={setNaming}>
        <DialogContent title={t('nameTitle')} description={t('nameHint')} size="sm">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await call(() => nameDocumentVersionAction(org, { documentId: doc.id, label }), { success: t('named'), inlineFieldErrors: true });
              if (res.ok) setNaming(false);
            }}
          >
            <Field label={t('nameLabel')} error={fieldErrors.label}>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} required autoFocus placeholder={t('namePlaceholder')} />
            </Field>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setNaming(false)}>
                {tc('cancel')}
              </Button>
              <Button type="submit" variant="primary" loading={pending} disabled={!label.trim()}>
                {tc('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
