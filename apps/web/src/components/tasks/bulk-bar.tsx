'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Archive, CalendarClock, Tag, UserRound, X } from 'lucide-react';
import { bulkUpdateTasksAction } from '@/actions/tasks';
import { Avatar } from '@/components/domain/avatar';
import { LabelChip, PriorityIcon, StatusIcon } from '@/components/domain/badges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PRIORITY_VALUES } from './filters';
import type { PersonOption, StatusOption } from './types';

/** Bulk editing bar. Reports how many tasks changed and how many a rule skipped. */
export function BulkBar({ org, ids, statuses, people, labels, onDone }: { org: string; ids: string[]; statuses: StatusOption[]; people: PersonOption[]; labels: { id: string; name: string; color: string }[]; onDone: () => void }) {
  const t = useTranslations('tasks');
  const tc = useTranslations('common');
  const te = useTranslations('enums');
  const [busy, setBusy] = useState(false);
  const [due, setDue] = useState('');
  const [dueOpen, setDueOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const apply = async (patch: Record<string, unknown>) => {
    setBusy(true);
    setNote(null);
    const res = await bulkUpdateTasksAction(org, { taskIds: ids, ...patch });
    setBusy(false);
    if (res.ok) {
      setNote(res.data.skipped.length ? t('bulk.resultPartial', { updated: res.data.updated.length, skipped: res.data.skipped.length }) : t('bulk.result', { updated: res.data.updated.length }));
      onDone();
    } else {
      setNote(res.error.message);
    }
  };

  return (
    <div role="region" aria-label={t('bulk.title')} className="sticky bottom-3 z-20 mx-auto flex w-full max-w-3xl flex-wrap items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 py-2 shadow-pop">
      <span className="text-[13px] font-medium text-ink">{t('bulk.selected', { count: ids.length })}</span>

      <Menu>
        <MenuTrigger asChild>
          <Button size="sm" disabled={busy}>
            {t('bulk.status')}
          </Button>
        </MenuTrigger>
        <MenuContent>
          <MenuLabel>{t('bulk.moveTo')}</MenuLabel>
          {statuses.map((s) => (
            <MenuItem key={s.id} onSelect={() => apply({ statusId: s.id })}>
              <StatusIcon category={s.category} /> {s.name}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>

      <Menu>
        <MenuTrigger asChild>
          <Button size="sm" disabled={busy}>
            <UserRound /> {t('bulk.assignee')}
          </Button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem onSelect={() => apply({ assigneeId: null })}>{tc('unassigned')}</MenuItem>
          <MenuSeparator />
          {people.map((p) => (
            <MenuItem key={p.id} onSelect={() => apply({ assigneeId: p.id })}>
              <Avatar name={p.name} color={p.avatarColor} size="xs" title="" /> {p.name}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>

      <Menu>
        <MenuTrigger asChild>
          <Button size="sm" disabled={busy}>
            {t('bulk.priority')}
          </Button>
        </MenuTrigger>
        <MenuContent>
          {PRIORITY_VALUES.map((p) => (
            <MenuItem key={p} onSelect={() => apply({ priority: p })}>
              <PriorityIcon priority={p} /> {te(`priority.${p}`)}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>

      <Popover open={dueOpen} onOpenChange={setDueOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" disabled={busy}>
            <CalendarClock /> {t('bulk.due')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56">
          <label className="text-[13px] font-medium text-ink" htmlFor="bulk-due">
            {t('bulk.dueDate')}
          </label>
          <Input id="bulk-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} className="mt-1.5" />
          <div className="mt-3 flex items-center justify-between gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setDueOpen(false); apply({ dueDate: null }); }}>
              {t('bulk.clearDue')}
            </Button>
            <Button size="sm" variant="primary" disabled={!due} onClick={() => { setDueOpen(false); apply({ dueDate: due }); }}>
              {tc('save')}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {labels.length ? (
        <Menu>
          <MenuTrigger asChild>
            <Button size="sm" disabled={busy}>
              <Tag /> {t('bulk.addLabel')}
            </Button>
          </MenuTrigger>
          <MenuContent>
            {labels.map((l) => (
              <MenuItem key={l.id} onSelect={() => apply({ addLabelId: l.id })}>
                <LabelChip name={l.name} color={l.color} />
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      ) : null}

      <Button size="sm" disabled={busy} onClick={() => apply({ archive: true })}>
        <Archive /> {tc('archive')}
      </Button>

      <Button size="sm" variant="ghost" onClick={onDone} aria-label={t('bulk.clearSelection')} className="ml-auto">
        <X /> {t('bulk.clearSelection')}
      </Button>
      {note ? (
        <p role="status" className="w-full text-[12px] text-ink-2">
          {note}
        </p>
      ) : null}
    </div>
  );
}
