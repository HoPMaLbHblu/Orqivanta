'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Bookmark, BookmarkPlus, Check, Columns3, Eye, Filter, LayoutList, Search, Trash2, X } from 'lucide-react';
import { deleteViewAction, saveViewAction } from '@/actions/tasks';
import { Avatar } from '@/components/domain/avatar';
import { LabelChip, PriorityIcon, StatusIcon } from '@/components/domain/badges';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Menu, MenuCheckItem, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/cn';
import { useAction } from '@/lib/use-action';
import { CATEGORY_VALUES, DUE_VALUES, isFiltered, PRIORITY_VALUES, queryToParams, SORT_VALUES, type GroupBy, type TaskLayout, type TaskQuery } from './filters';
import { useTaskParams } from './use-task-params';

export interface SavedViewData {
  id: string;
  name: string;
  layout: 'list' | 'board';
  query: unknown;
  shared: boolean;
  mine: boolean;
}

export interface ToolbarContext {
  people: { id: string; name: string; avatarColor: string | null }[];
  labels: { id: string; name: string; color: string }[];
  milestones: { id: string; name: string }[];
}

export function TaskToolbar({ org, projectId, layout, query, context, savedViews, canSaveViews, count, truncated }: { org: string; projectId: string | null; layout: TaskLayout; query: TaskQuery; context: ToolbarContext; savedViews: SavedViewData[]; canSaveViews: boolean; count: number; truncated: boolean }) {
  const t = useTranslations('tasks');
  const tc = useTranslations('common');
  const te = useTranslations('enums');
  const { sp, setParams, toggleInList } = useTaskParams();
  const { call } = useAction();
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState(query.q ?? '');
  const filtered = isFiltered(query);

  const applyView = (v: SavedViewData) => {
    const qq = (v.query ?? {}) as TaskQuery;
    setParams({ ...queryToParams(qq), view: v.layout === 'board' ? 'board' : null });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label={t('toolbar.layout')} className="inline-flex rounded-md border border-line-strong p-0.5">
          <button type="button" aria-pressed={layout === 'list'} onClick={() => setParams({ view: null })} className={cn('inline-flex h-7 items-center gap-1.5 rounded-[5px] px-2 text-[13px] font-medium', layout === 'list' ? 'bg-surface-2 text-ink' : 'text-ink-3 hover:text-ink')}>
            <LayoutList className="size-4" aria-hidden /> {t('toolbar.list')}
          </button>
          <button type="button" aria-pressed={layout === 'board'} onClick={() => setParams({ view: 'board' })} className={cn('inline-flex h-7 items-center gap-1.5 rounded-[5px] px-2 text-[13px] font-medium', layout === 'board' ? 'bg-surface-2 text-ink' : 'text-ink-3 hover:text-ink')}>
            <Columns3 className="size-4" aria-hidden /> {t('toolbar.board')}
          </button>
        </div>

        <form
          role="search"
          className="relative min-w-0 flex-1 sm:max-w-56"
          onSubmit={(e) => {
            e.preventDefault();
            setParams({ q: q.trim() || null });
          }}
        >
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input value={q} onChange={(e) => { setQ(e.target.value); if (!e.target.value) setParams({ q: null }); }} onBlur={() => setParams({ q: q.trim() || null })} placeholder={t('toolbar.search')} aria-label={t('toolbar.search')} className="h-8 pl-8 text-[13px]" />
        </form>

        <Menu>
          <MenuTrigger asChild>
            <Button size="sm" variant={query.assignee ? 'primary' : 'secondary'}>
              {query.assignee === 'me' ? t('toolbar.assignedMe') : query.assignee === 'none' ? tc('unassigned') : query.assignee ? (context.people.find((p) => p.id === query.assignee)?.name ?? t('toolbar.assignee')) : t('toolbar.assignee')}
            </Button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem onSelect={() => setParams({ assignee: null })}>{t('toolbar.anyAssignee')}</MenuItem>
            <MenuItem onSelect={() => setParams({ assignee: 'me' })}>{t('toolbar.assignedMe')}</MenuItem>
            <MenuItem onSelect={() => setParams({ assignee: 'none' })}>{tc('unassigned')}</MenuItem>
            <MenuSeparator />
            {context.people.map((p) => (
              <MenuItem key={p.id} onSelect={() => setParams({ assignee: p.id })}>
                <Avatar name={p.name} color={p.avatarColor} size="xs" title="" /> {p.name}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>

        <Menu>
          <MenuTrigger asChild>
            <Button size="sm" variant={query.categories?.length || query.priorities?.length || query.labelIds?.length || query.milestoneId || query.due || query.watching || query.includeArchived ? 'primary' : 'secondary'}>
              <Filter /> {t('toolbar.filter')}
            </Button>
          </MenuTrigger>
          <MenuContent className="max-h-[70vh] overflow-y-auto">
            <MenuLabel>{t('toolbar.status')}</MenuLabel>
            {CATEGORY_VALUES.map((c) => (
              <MenuCheckItem key={c} checked={Boolean(query.categories?.includes(c))} onCheckedChange={() => toggleInList('category', c)}>
                <StatusIcon category={c} /> {te(`statusCategory.${c}`)}
              </MenuCheckItem>
            ))}
            <MenuSeparator />
            <MenuLabel>{t('toolbar.priority')}</MenuLabel>
            {PRIORITY_VALUES.map((p) => (
              <MenuCheckItem key={p} checked={Boolean(query.priorities?.includes(p))} onCheckedChange={() => toggleInList('priority', p)}>
                <PriorityIcon priority={p} /> {te(`priority.${p}`)}
              </MenuCheckItem>
            ))}
            {context.labels.length ? (
              <>
                <MenuSeparator />
                <MenuLabel>{t('toolbar.labels')}</MenuLabel>
                {context.labels.map((l) => (
                  <MenuCheckItem key={l.id} checked={Boolean(query.labelIds?.includes(l.id))} onCheckedChange={() => toggleInList('label', l.id)}>
                    <LabelChip name={l.name} color={l.color} />
                  </MenuCheckItem>
                ))}
              </>
            ) : null}
            {context.milestones.length ? (
              <>
                <MenuSeparator />
                <MenuLabel>{t('toolbar.milestone')}</MenuLabel>
                {context.milestones.map((m) => (
                  <MenuCheckItem key={m.id} checked={query.milestoneId === m.id} onCheckedChange={(v) => setParams({ milestone: v ? m.id : null })}>
                    {m.name}
                  </MenuCheckItem>
                ))}
              </>
            ) : null}
            <MenuSeparator />
            <MenuLabel>{t('toolbar.due')}</MenuLabel>
            {DUE_VALUES.map((d) => (
              <MenuCheckItem key={d} checked={query.due === d} onCheckedChange={(v) => setParams({ due: v ? d : null })}>
                {t(`toolbar.dueOption.${d}`)}
              </MenuCheckItem>
            ))}
            <MenuSeparator />
            <MenuCheckItem checked={Boolean(query.watching)} onCheckedChange={(v) => setParams({ watching: v ? '1' : null })}>
              <Eye /> {t('toolbar.watching')}
            </MenuCheckItem>
            <MenuCheckItem checked={Boolean(query.includeArchived)} onCheckedChange={(v) => setParams({ archived: v ? '1' : null })}>
              {t('toolbar.includeArchived')}
            </MenuCheckItem>
          </MenuContent>
        </Menu>

        {layout === 'list' ? (
          <div className="w-36">
            <Select
              size="sm"
              aria-label={t('toolbar.group')}
              value={query.groupBy ?? 'status'}
              onValueChange={(v) => setParams({ group: v === 'status' ? null : v })}
              options={(['status', 'assignee', 'priority', 'milestone', 'none'] as GroupBy[]).map((g) => ({ value: g, label: t(`toolbar.groupBy.${g}`) }))}
            />
          </div>
        ) : null}
        <div className="w-36">
          <Select size="sm" aria-label={t('toolbar.sort')} value={query.sort ?? 'manual'} onValueChange={(v) => setParams({ sort: v === 'manual' ? null : v })} options={SORT_VALUES.map((s) => ({ value: s, label: t(`toolbar.sortBy.${s}`) }))} />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {filtered ? (
            <Button size="sm" variant="ghost" onClick={() => { setQ(''); setParams({ assignee: null, category: null, priority: null, label: null, milestone: null, due: null, q: null, watching: null, archived: null }); }}>
              <X /> {tc('clearFilters')}
            </Button>
          ) : null}
          <Menu>
            <MenuTrigger asChild>
              <Button size="sm">
                <Bookmark /> {t('views.title')}
              </Button>
            </MenuTrigger>
            <MenuContent align="end">
              {savedViews.length ? <MenuLabel>{t('views.saved')}</MenuLabel> : null}
              {savedViews.map((v) => (
                <MenuItem key={v.id} onSelect={() => applyView(v)}>
                  <Check className={cn('opacity-0')} aria-hidden /> {v.name}
                  {v.shared ? <span className="ml-auto text-[11px] text-ink-3">{t('views.sharedTag')}</span> : null}
                </MenuItem>
              ))}
              {savedViews.length ? <MenuSeparator /> : null}
              {canSaveViews ? (
                <MenuItem onSelect={() => setSaving(true)}>
                  <BookmarkPlus /> {t('views.save')}
                </MenuItem>
              ) : null}
              {savedViews.filter((v) => v.mine).length ? (
                <>
                  <MenuSeparator />
                  <MenuLabel>{t('views.deleteLabel')}</MenuLabel>
                  {savedViews
                    .filter((v) => v.mine)
                    .map((v) => (
                      <MenuItem
                        key={`d-${v.id}`}
                        danger
                        onSelect={async () => {
                          await call(() => deleteViewAction(org, v.id), { success: t('views.deleted') });
                        }}
                      >
                        <Trash2 /> {v.name}
                      </MenuItem>
                    ))}
                </>
              ) : null}
            </MenuContent>
          </Menu>
        </div>
      </div>

      <p className="text-[12px] text-ink-3" role="status">
        {t('count', { count })}
        {truncated ? ` · ${t('truncated')}` : ''}
      </p>

      <Dialog open={saving} onOpenChange={setSaving}>
        <DialogContent title={t('views.saveTitle')} description={t('views.saveBody')} size="sm">
          {saving ? <SaveViewForm org={org} projectId={projectId} layout={layout} query={{ ...query, q: sp.get('q') ?? undefined }} onDone={() => setSaving(false)} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SaveViewForm({ org, projectId, layout, query, onDone }: { org: string; projectId: string | null; layout: TaskLayout; query: TaskQuery; onDone: () => void }) {
  const t = useTranslations('tasks');
  const tc = useTranslations('common');
  const { call, pending, fieldErrors } = useAction();
  const [name, setName] = useState('');
  const [shared, setShared] = useState(false);
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await call(() => saveViewAction(org, { projectId, name, layout, query, shared }), { inlineFieldErrors: true, success: t('views.savedToast') });
        if (res.ok) onDone();
      }}
    >
      <Field label={t('views.name')} error={fieldErrors.name}>
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={60} />
      </Field>
      <label className="flex items-start gap-2.5 text-[13px] text-ink">
        <Checkbox checked={shared} onCheckedChange={setShared} />
        <span>
          {t('views.shareWithTeam')}
          <span className="block text-[12px] text-ink-3">{t('views.shareHint')}</span>
        </span>
      </label>
      <DialogFooter>
        <Button variant="ghost" onClick={onDone} disabled={pending}>
          {tc('cancel')}
        </Button>
        <Button type="submit" variant="primary" loading={pending}>
          {tc('save')}
        </Button>
      </DialogFooter>
    </form>
  );
}
