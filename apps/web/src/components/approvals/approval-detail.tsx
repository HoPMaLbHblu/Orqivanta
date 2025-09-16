'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { BellRing, CircleSlash, RotateCcw, UserRoundCog } from 'lucide-react';
import { cancelApprovalAction, decideApprovalAction, reassignReviewerAction, remindReviewersAction } from '@/actions/approvals';
import { Avatar } from '@/components/domain/avatar';
import { RelativeTime } from '@/components/domain/dates';
import type { ApprovalStatus } from '@/components/domain/badges';
import { ApprovalStatusBadge } from '@/components/domain/badges';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, FormError } from '@/components/ui/field';
import { NativeSelect, Textarea } from '@/components/ui/input';
import { Card, CardHeader, Mono } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { useAction } from '@/lib/use-action';
import { DECISION_ICON, type Decision } from './reviewer-chips';

type DecisionValue = 'approved' | 'changes_requested' | 'rejected';

/** The current reviewer's decision. Changes and rejections must say why. */
export function DecisionPanel({ org, approvalId, rule }: { org: string; approvalId: string; rule: 'any' | 'all' }) {
  const t = useTranslations('approvals.decide');
  const { call, pending, fieldErrors, formError, setFormError } = useAction();
  const [choice, setChoice] = useState<DecisionValue>('approved');
  const [comment, setComment] = useState('');
  const router = useRouter();
  const needsComment = choice !== 'approved';

  const submit = async () => {
    if (needsComment && !comment.trim()) {
      setFormError(t('commentRequired'));
      return;
    }
    const res = await call(() => decideApprovalAction(org, { approvalId, decision: choice, comment: comment.trim() || null }), { success: t(`recorded.${choice}`), inlineFieldErrors: true });
    if (res.ok) {
      setComment('');
      router.refresh();
    }
  };

  const options: { value: DecisionValue; label: string; className: string }[] = [
    { value: 'approved', label: t('approve'), className: 'data-[on=true]:border-success data-[on=true]:bg-success-soft data-[on=true]:text-success' },
    { value: 'changes_requested', label: t('requestChanges'), className: 'data-[on=true]:border-info data-[on=true]:bg-info-soft data-[on=true]:text-info' },
    { value: 'rejected', label: t('reject'), className: 'data-[on=true]:border-danger data-[on=true]:bg-danger-soft data-[on=true]:text-danger' },
  ];

  return (
    <Card className="border-attention/40">
      <CardHeader title={t('title')} description={t(`ruleHint.${rule}`)} />
      <div className="flex flex-col gap-3 px-4 py-3">
        <div role="radiogroup" aria-label={t('title')} className="flex flex-col gap-1.5">
          {options.map((o) => {
            const Icon = DECISION_ICON[o.value];
            const on = choice === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={on}
                data-on={on}
                onClick={() => setChoice(o.value)}
                className={cn('inline-flex h-9 items-center gap-2 rounded-md border border-line px-3 text-[13px] font-medium text-ink-2 hover:bg-surface-2', o.className)}
              >
                <Icon className="size-4" aria-hidden />
                {o.label}
              </button>
            );
          })}
        </div>
        <Field label={needsComment ? t('commentRequiredLabel') : t('commentLabel')} optional={needsComment ? undefined : t('optional')} error={fieldErrors.comment}>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={2000} placeholder={needsComment ? t('commentPlaceholderChanges') : t('commentPlaceholder')} />
        </Field>
        <FormError message={formError} />
        <Button variant="primary" loading={pending} onClick={submit}>
          {t('submit')}
        </Button>
      </div>
    </Card>
  );
}

export function ReviewerList({ reviewers, myUserId, rule, status }: { reviewers: { userId: string; name: string; avatarColor: string | null; decision: Decision; comment: string | null; decidedAt: Date | string | null }[]; myUserId: string; rule: 'any' | 'all'; status: ApprovalStatus }) {
  const t = useTranslations('approvals');
  const te = useTranslations('enums.decision');
  return (
    <Card>
      <CardHeader title={t('reviewers')} description={t(`rule.${rule}`)} />
      <ul className="divide-y divide-line">
        {reviewers.map((r) => {
          const key = r.decision ?? 'pending';
          const Icon = DECISION_ICON[key];
          return (
            <li key={r.userId} className="flex flex-col gap-1 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <Avatar name={r.name} color={r.avatarColor} size="sm" title="" />
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                  {r.name}
                  {r.userId === myUserId ? <span className="ml-1 text-ink-3">({t('you')})</span> : null}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-[12px] font-medium',
                    r.decision === 'approved' ? 'text-success' : r.decision === 'rejected' ? 'text-danger' : r.decision === 'changes_requested' ? 'text-info' : 'text-ink-3',
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {r.decision ? te(r.decision) : t('awaiting')}
                </span>
              </div>
              {r.decidedAt ? (
                <p className="pl-8 text-[12px] text-ink-3">
                  <RelativeTime date={r.decidedAt} />
                </p>
              ) : null}
              {r.comment ? <p className="pl-8 text-[13px] whitespace-pre-wrap text-ink-2">{r.comment}</p> : null}
            </li>
          );
        })}
      </ul>
      {status !== 'pending' ? <p className="border-t border-line px-4 py-2 text-[12px] text-ink-3">{t('closedRound')}</p> : null}
    </Card>
  );
}

/** Reminder, reassignment and cancellation, for whoever can manage the review. */
export function ManagePanel({ org, approvalId, undecided, candidates, lastReminderAt }: { org: string; approvalId: string; undecided: { userId: string; name: string }[]; candidates: { id: string; name: string }[]; lastReminderAt: string | null }) {
  const t = useTranslations('approvals.manage');
  const router = useRouter();
  const { call, pending, fieldErrors } = useAction();
  const [reassign, setReassign] = useState(false);
  const [fromUserId, setFromUserId] = useState(undecided[0]?.userId ?? '');
  const [toUserId, setToUserId] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);

  return (
    <Card>
      <CardHeader title={t('title')} />
      <div className="flex flex-col items-start gap-2 px-4 py-3">
        <Button size="sm" variant="secondary" loading={pending} disabled={!undecided.length} onClick={() => call(() => remindReviewersAction(org, { approvalId }), { success: t('reminded') })}>
          <BellRing /> {t('remind')}
        </Button>
        <p className="text-[12px] text-ink-3">
          {undecided.length ? t('remindHint', { count: undecided.length }) : t('allDecided')}
          {lastReminderAt ? (
            <>
              {' '}
              <span>
                {t('lastReminder')} <RelativeTime date={lastReminderAt} />
              </span>
            </>
          ) : null}
        </p>
        <Button size="sm" variant="secondary" disabled={!undecided.length || !candidates.length} onClick={() => setReassign(true)}>
          <UserRoundCog /> {t('reassign')}
        </Button>
        <Button size="sm" variant="danger-ghost" onClick={() => setConfirmCancel(true)}>
          <CircleSlash /> {t('cancel')}
        </Button>
      </div>

      <Dialog open={reassign} onOpenChange={setReassign}>
        <DialogContent title={t('reassignTitle')} description={t('reassignBody')}>
          <div className="flex flex-col gap-4">
            <Field label={t('from')} error={fieldErrors.fromUserId}>
              <NativeSelect value={fromUserId} onChange={(e) => setFromUserId(e.target.value)}>
                {undecided.map((r) => (
                  <option key={r.userId} value={r.userId}>
                    {r.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={t('to')} error={fieldErrors.toUserId}>
              <NativeSelect value={toUserId} onChange={(e) => setToUserId(e.target.value)}>
                <option value="">{t('choosePerson')}</option>
                {candidates.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReassign(false)}>
              {t('cancelAction')}
            </Button>
            <Button
              variant="primary"
              loading={pending}
              disabled={!toUserId}
              onClick={async () => {
                const res = await call(() => reassignReviewerAction(org, { approvalId, fromUserId, toUserId }), { success: t('reassigned') });
                if (res.ok) setReassign(false);
              }}
            >
              {t('reassignSubmit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={t('cancelTitle')}
        description={t('cancelBody')}
        confirmLabel={t('cancelConfirm')}
        onConfirm={async () => {
          const res = await call(() => cancelApprovalAction(org, { approvalId }), { success: t('canceled') });
          if (res.ok) router.refresh();
          return res.ok;
        }}
      />
    </Card>
  );
}

export function RoundHistory({ org, rounds, currentRound, newerRound }: { org: string; rounds: { id: string; round: number; status: ApprovalStatus; createdAt: string; fileVersion: number | null }[]; currentRound: number; newerRound: { id: string; round: number } | null }) {
  const t = useTranslations('approvals');
  if (!rounds.length && !newerRound) return null;
  return (
    <Card>
      <CardHeader title={t('rounds')} description={t('roundsHint')} />
      <ul className="divide-y divide-line">
        {newerRound ? (
          <li>
            <Link href={`/${org}/approvals/${newerRound.id}`} className="flex items-center gap-2 px-4 py-2.5 text-[13px] hover:bg-surface-2">
              <Mono>{t('roundN', { round: newerRound.round })}</Mono>
              <span className="flex-1 text-ink-2">{t('newest')}</span>
              <RotateCcw className="size-3.5 text-ink-3" aria-hidden />
            </Link>
          </li>
        ) : null}
        <li className="flex items-center gap-2 bg-surface-2 px-4 py-2.5 text-[13px]">
          <Mono>{t('roundN', { round: currentRound })}</Mono>
          <span className="flex-1 text-ink">{t('thisRound')}</span>
        </li>
        {rounds.map((r) => (
          <li key={r.id}>
            <Link href={`/${org}/approvals/${r.id}`} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-[13px] hover:bg-surface-2">
              <Mono>{t('roundN', { round: r.round })}</Mono>
              {r.fileVersion ? <span className="text-[12px] text-ink-3">v{r.fileVersion}</span> : null}
              <span className="flex-1" />
              <ApprovalStatusBadge status={r.status} />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
