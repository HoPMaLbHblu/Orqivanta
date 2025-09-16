'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { MessageSquarePlus, Radio } from 'lucide-react';
import { postProjectUpdateAction } from '@/actions/projects';
import { Avatar } from '@/components/domain/avatar';
import { Badge, HealthBadge, type Health } from '@/components/domain/badges';
import { RelativeTime } from '@/components/domain/dates';
import { RichTextEditor } from '@/components/rich-text/editor';
import { isEmptyDoc, RichText } from '@/components/rich-text/render';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, FormError } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import { Card, CardHeader, EmptyState } from '@/components/ui/primitives';
import { useAction } from '@/lib/use-action';

export interface UpdateData {
  id: string;
  health: Health;
  summary: string;
  body: unknown;
  sharedWithClient: boolean;
  createdAt: Date;
  authorName: string | null;
  authorColor: string | null;
}

export function UpdatesPanel({ org, projectId, updates, canPost, canShare, portalEnabled, health, healthSource }: { org: string; projectId: string; updates: UpdateData[]; canPost: boolean; canShare: boolean; portalEnabled: boolean; health: Health; healthSource: 'reported' | 'computed' }) {
  const t = useTranslations('projects');
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardHeader
        title={t('updates.title')}
        description={healthSource === 'computed' ? t('updates.computedHint') : t('updates.hint')}
        action={
          canPost ? (
            <Button size="xs" onClick={() => setOpen(true)}>
              <MessageSquarePlus /> {t('updates.post')}
            </Button>
          ) : null
        }
      />
      {updates.length ? (
        <ol className="divide-y divide-line">
          {updates.map((u) => (
            <li key={u.id} className="px-4 py-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <HealthBadge health={u.health} source="manual" />
                <p className="min-w-0 flex-1 text-[14px] font-medium text-ink">{u.summary}</p>
                {u.sharedWithClient ? <Badge tone="accent">{t('updates.shared')}</Badge> : <Badge tone="muted">{t('updates.internal')}</Badge>}
              </div>
              {u.body && !isEmptyDoc(u.body) ? <RichText doc={u.body} compact className="mt-2 text-[13px]" /> : null}
              <p className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-3">
                <Avatar name={u.authorName} color={u.authorColor} size="xs" title="" />
                {u.authorName ?? t('updates.unknownAuthor')} <span aria-hidden>·</span> <RelativeTime date={u.createdAt} />
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          compact
          icon={<Radio />}
          title={t('updates.empty')}
          description={canPost ? t('updates.emptyBody', { health: t(`healthWord.${health}`) }) : t('updates.emptyBodyReader')}
          action={canPost ? <Button size="sm" onClick={() => setOpen(true)}>{t('updates.post')}</Button> : null}
        />
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={t('updates.dialogTitle')} description={t('updates.dialogBody')}>
          {open ? <UpdateForm org={org} projectId={projectId} currentHealth={health} canShare={canShare} portalEnabled={portalEnabled} onDone={() => setOpen(false)} /> : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function UpdateForm({ org, projectId, currentHealth, canShare, portalEnabled, onDone }: { org: string; projectId: string; currentHealth: Health; canShare: boolean; portalEnabled: boolean; onDone: () => void }) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const th = useTranslations('enums.health');
  const { call, pending, fieldErrors, formError } = useAction();
  const [health, setHealth] = useState<Health>(currentHealth);
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState<unknown>(null);
  const [shared, setShared] = useState(false);

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await call(() => postProjectUpdateAction(org, { projectId, health, summary, body: body ?? undefined, sharedWithClient: shared }), { inlineFieldErrors: true, success: t('updates.posted') });
        if (res.ok) onDone();
      }}
    >
      <FormError message={formError} />
      <Field label={t('updates.health')} error={fieldErrors.health}>
        <NativeSelect value={health} onChange={(e) => setHealth(e.target.value as Health)}>
          {(['on_track', 'at_risk', 'off_track'] as const).map((h) => (
            <option key={h} value={h}>
              {th(h)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label={t('updates.summary')} hint={t('updates.summaryHint')} error={fieldErrors.summary}>
        <Input value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={200} autoFocus />
      </Field>
      <div>
        <p className="mb-1.5 text-[13px] font-medium text-ink">
          {t('updates.details')} <span className="font-normal text-ink-3">{tc('optional')}</span>
        </p>
        <div className="rounded-md border border-line-strong p-2">
          <RichTextEditor value={body} onChange={setBody} placeholder={t('updates.detailsPlaceholder')} ariaLabel={t('updates.details')} contentClassName="compact min-h-20" />
        </div>
      </div>
      {canShare ? (
        <label className="flex items-start gap-2.5 text-[13px] text-ink">
          <Checkbox checked={shared} onCheckedChange={setShared} disabled={!portalEnabled} />
          <span>
            {t('updates.shareWithClient')}
            <span className="block text-[12px] text-ink-3">{portalEnabled ? t('updates.shareHint') : t('updates.sharePortalOff')}</span>
          </span>
        </label>
      ) : null}
      <DialogFooter>
        <Button variant="ghost" onClick={onDone} disabled={pending}>
          {tc('cancel')}
        </Button>
        <Button type="submit" variant="primary" loading={pending}>
          {t('updates.submit')}
        </Button>
      </DialogFooter>
    </form>
  );
}
