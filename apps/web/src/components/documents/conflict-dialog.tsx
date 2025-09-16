'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { AlertTriangle, ClipboardCopy, Download, Upload } from 'lucide-react';
import { RelativeTime } from '@/components/domain/dates';
import { isEmptyDoc, RichText } from '@/components/rich-text/render';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export interface ConflictState {
  theirs: { version: number; title: string; content: unknown; updatedAt: string | Date | null; updatedByName: string | null };
  mine: { title: string; content: unknown };
}

/**
 * Shown when someone else saved while this person was editing. Nothing is overwritten until
 * the person chooses; every option is explicit about what happens to which version.
 */
export function ConflictDialog({ conflict, onKeepTheirs, onCopyMine, onOverwrite }: { conflict: ConflictState | null; onKeepTheirs: () => void; onCopyMine: () => Promise<void>; onOverwrite: () => Promise<void> }) {
  const t = useTranslations('documents.conflict');
  const [busy, setBusy] = useState<null | 'copy' | 'overwrite'>(null);
  if (!conflict) return null;
  const who = conflict.theirs.updatedByName ?? t('someone');

  return (
    // Closing without choosing isn't allowed: the editor stays paused until a choice is made.
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent title={t('title')} description={t('description', { name: who })} size="xl" hideClose>
        <div className="flex items-start gap-2 rounded-lg border border-attention/25 bg-attention-soft px-3 py-2 text-[13px] text-ink">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-attention" aria-hidden />
          <p>{t('nothingLost')}</p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <section aria-labelledby="conflict-theirs" className="flex min-h-0 flex-col rounded-lg border border-line">
            <header className="border-b border-line px-3 py-2">
              <h3 id="conflict-theirs" className="text-[13px] font-semibold text-ink">
                {t('theirs', { name: who })}
              </h3>
              <p className="text-[12px] text-ink-3">
                {t('version', { version: conflict.theirs.version })}
                {conflict.theirs.updatedAt ? (
                  <>
                    {' · '}
                    <RelativeTime date={conflict.theirs.updatedAt} />
                  </>
                ) : null}
              </p>
            </header>
            <div className="max-h-[38vh] overflow-y-auto px-4 py-3">
              <p className="mb-2 text-[15px] font-semibold text-ink">{conflict.theirs.title}</p>
              {isEmptyDoc(conflict.theirs.content) ? <p className="text-[13px] text-ink-3">{t('emptyDoc')}</p> : <RichText doc={conflict.theirs.content} className="text-[14px]" />}
            </div>
          </section>
          <section aria-labelledby="conflict-mine" className="flex min-h-0 flex-col rounded-lg border border-accent/40">
            <header className="border-b border-line px-3 py-2">
              <h3 id="conflict-mine" className="text-[13px] font-semibold text-ink">
                {t('mine')}
              </h3>
              <p className="text-[12px] text-ink-3">{t('mineHint')}</p>
            </header>
            <div className="max-h-[38vh] overflow-y-auto px-4 py-3">
              <p className="mb-2 text-[15px] font-semibold text-ink">{conflict.mine.title}</p>
              {isEmptyDoc(conflict.mine.content) ? <p className="text-[13px] text-ink-3">{t('emptyDoc')}</p> : <RichText doc={conflict.mine.content} className="text-[14px]" />}
            </div>
          </section>
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <ChoiceButton icon={<Download />} label={t('keepTheirs')} hint={t('keepTheirsHint', { name: who })} disabled={Boolean(busy)} onClick={onKeepTheirs} />
          <ChoiceButton
            icon={<ClipboardCopy />}
            label={t('copyMine')}
            hint={t('copyMineHint')}
            busy={busy === 'copy'}
            disabled={Boolean(busy)}
            onClick={async () => {
              setBusy('copy');
              try {
                await onCopyMine();
              } finally {
                setBusy(null);
              }
            }}
          />
          <ChoiceButton
            icon={<Upload />}
            label={t('overwrite')}
            hint={t('overwriteHint', { name: who })}
            tone="danger"
            busy={busy === 'overwrite'}
            disabled={Boolean(busy)}
            onClick={async () => {
              setBusy('overwrite');
              try {
                await onOverwrite();
              } finally {
                setBusy(null);
              }
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ChoiceButton({ icon, label, hint, onClick, disabled, busy, tone }: { icon: React.ReactNode; label: string; hint: string; onClick: () => void; disabled?: boolean; busy?: boolean; tone?: 'danger' }) {
  return (
    <Button variant="secondary" onClick={onClick} disabled={disabled} loading={busy} className={`h-auto w-full justify-start gap-3 py-2.5 text-left whitespace-normal ${tone === 'danger' ? 'hover:border-danger/50' : ''}`}>
      {busy ? null : <span className={tone === 'danger' ? 'text-danger' : 'text-accent'}>{icon}</span>}
      <span className="flex min-w-0 flex-col">
        <span className={`text-[13px] font-semibold ${tone === 'danger' ? 'text-danger' : 'text-ink'}`}>{label}</span>
        <span className="text-[12px] font-normal text-ink-3">{hint}</span>
      </span>
    </Button>
  );
}
