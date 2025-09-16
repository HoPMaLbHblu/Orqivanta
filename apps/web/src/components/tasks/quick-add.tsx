'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { createTaskAction } from '@/actions/tasks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAction } from '@/lib/use-action';

/** One-line task creation. Stays open after each save so several tasks can be typed in a row. */
export function QuickAdd({ org, projectId, statusId, milestoneId, label, compact }: { org: string; projectId: string; statusId?: string; milestoneId?: string; label?: string; compact?: boolean }) {
  const t = useTranslations('tasks');
  const { call, pending, fieldErrors } = useAction();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');

  if (!open) {
    return (
      <Button variant="ghost" size={compact ? 'xs' : 'sm'} className="w-full justify-start text-ink-3" onClick={() => setOpen(true)}>
        <Plus /> {label ?? t('quickAdd.open')}
      </Button>
    );
  }

  return (
    <form
      className="flex flex-col gap-1"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        const res = await call(() => createTaskAction(org, { projectId, title, statusId, milestoneId }), { inlineFieldErrors: true });
        if (res.ok) setTitle('');
      }}
    >
      <div className="flex items-center gap-1.5">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          maxLength={300}
          placeholder={t('quickAdd.placeholder')}
          aria-label={t('quickAdd.placeholder')}
          aria-invalid={fieldErrors.title ? true : undefined}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false);
              setTitle('');
            }
          }}
          className="h-8 text-[13px]"
        />
        <Button type="submit" size="sm" variant="primary" loading={pending} disabled={!title.trim()}>
          {t('quickAdd.add')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setTitle(''); }}>
          {t('quickAdd.done')}
        </Button>
      </div>
      {fieldErrors.title ? (
        <p role="alert" className="text-[12px] text-danger">
          {fieldErrors.title}
        </p>
      ) : (
        <p className="text-[11px] text-ink-3">{t('quickAdd.hint')}</p>
      )}
    </form>
  );
}
