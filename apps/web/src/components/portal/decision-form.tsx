'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import { decidePortalApprovalAction } from '@/actions/portal';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Field, FormError } from '@/components/ui/field';
import { Textarea } from '@/components/ui/input';
import { useAction } from '@/lib/use-action';

type Decision = 'approved' | 'changes_requested' | 'rejected';

/**
 * Approve / request changes / reject on one round. A note is required for anything but
 * approval — the server enforces it too; rejection asks for confirmation first.
 */
export function DecisionForm({ org, approvalId }: { org: string; approvalId: string }) {
  const t = useTranslations('portal.approvals');
  const tc = useTranslations('common');
  const router = useRouter();
  const { call, pending, fieldErrors, formError, setFieldErrors } = useAction();
  const [comment, setComment] = useState('');
  const [confirmReject, setConfirmReject] = useState(false);

  async function decide(decision: Decision) {
    if (decision !== 'approved' && !comment.trim()) {
      setFieldErrors({ comment: t('commentRequiredHint') });
      return false;
    }
    const res = await call(() => decidePortalApprovalAction(org, { approvalId, decision, comment: comment.trim() || null }), { inlineFieldErrors: true });
    if (res.ok) {
      setComment('');
      router.refresh();
    }
    return res.ok;
  }

  return (
    <div className="flex flex-col gap-4">
      <FormError message={formError} />
      <Field label={t('comment')} hint={t('commentRequiredHint')} error={fieldErrors.comment}>
        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} className="min-h-28" />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" loading={pending} onClick={() => decide('approved')}>
          <CheckCircle2 /> {t('approve')}
        </Button>
        <Button variant="secondary" disabled={pending} onClick={() => decide('changes_requested')}>
          <RotateCcw /> {t('requestChanges')}
        </Button>
        <Button variant="danger-ghost" disabled={pending} onClick={() => setConfirmReject(true)}>
          <XCircle /> {t('reject')}
        </Button>
      </div>
      <ConfirmDialog
        open={confirmReject}
        onOpenChange={setConfirmReject}
        title={t('reject')}
        description={tc('cannotUndo')}
        confirmLabel={t('reject')}
        onConfirm={() => decide('rejected')}
      />
    </div>
  );
}
