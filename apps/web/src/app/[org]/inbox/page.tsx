import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { BellOff, CheckCheck, Settings2 } from 'lucide-react';
import { listNotifications, unreadCount } from '@orqivanta/core';
import { CategoryIcon, NOTIFICATION_CATEGORIES } from '@/components/inbox/category-icon';
import { InboxGroup, MarkAllReadButton, type InboxItem } from '@/components/inbox/inbox-list';
import { EmptyState, PageHeader } from '@/components/ui/primitives';
import { requireActor, requireUser } from '@/lib/session';
import { cn } from '@/lib/cn';

export async function generateMetadata() {
  const t = await getTranslations('inbox');
  return { title: t('title') };
}

type Filter = 'unread' | 'all' | 'archived';

export default async function InboxPage({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<{ filter?: string; category?: string; before?: string }> }) {
  const { org } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const actor = await requireActor(org);
  const t = await getTranslations('inbox');
  const tc = await getTranslations('enums.notificationCategory');
  const tcommon = await getTranslations('common');
  const format = await getFormatter();

  const filter: Filter = sp.filter === 'unread' || sp.filter === 'archived' ? sp.filter : 'all';
  const category = (NOTIFICATION_CATEGORIES as readonly string[]).includes(sp.category ?? '') ? sp.category : undefined;
  const before = sp.before && !Number.isNaN(Date.parse(sp.before)) ? new Date(sp.before).toISOString() : undefined;
  const [page, unread] = await Promise.all([listNotifications(actor, { filter, category, before, limit: 50 }), unreadCount(actor)]);

  const base = `/${org}/inbox`;
  const href = (p: { filter?: Filter; category?: string | null; before?: string | null }) => {
    const q = new URLSearchParams();
    const f = p.filter ?? filter;
    if (f !== 'all') q.set('filter', f);
    const c = p.category === undefined ? category : p.category;
    if (c) q.set('category', c);
    if (p.before) q.set('before', p.before);
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };

  // Group by calendar day in the viewer's time zone.
  const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: user.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const today = dayKey(new Date());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000));
  const groups = new Map<string, InboxItem[]>();
  for (const n of page.items) {
    const k = dayKey(n.createdAt);
    const list = groups.get(k) ?? [];
    list.push({ ...n, readAt: n.readAt?.toISOString() ?? null, archivedAt: n.archivedAt?.toISOString() ?? null, createdAt: n.createdAt.toISOString() });
    groups.set(k, list);
  }
  const dayLabel = (k: string) => (k === today ? tcommon('today') : k === yesterday ? tcommon('yesterday') : format.dateTime(new Date(`${k}T12:00:00Z`), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }));

  const tabs: { key: Filter; label: string }[] = [
    { key: 'all', label: t('all') },
    { key: 'unread', label: t('unread') },
    { key: 'archived', label: t('archived') },
  ];

  return (
    <div className="mx-auto max-w-[880px] px-4 py-8 sm:px-6 lg:px-10">
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <>
            <Link href="/account/notifications" className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink">
              <Settings2 className="size-4" aria-hidden /> {t('preferences')}
            </Link>
            {unread > 0 && filter !== 'archived' ? <MarkAllReadButton org={org} /> : null}
          </>
        }
      />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label={t('filters')} className="inline-flex rounded-md border border-line bg-surface p-0.5">
          {tabs.map((tab) => (
            <Link key={tab.key} href={href({ filter: tab.key, before: null })} aria-current={filter === tab.key ? 'page' : undefined} className={cn('inline-flex h-7 items-center gap-1.5 rounded-[5px] px-2.5 text-[13px] font-medium', filter === tab.key ? 'bg-surface-3 text-ink' : 'text-ink-3 hover:text-ink')}>
              {tab.label}
              {tab.key === 'unread' && unread > 0 ? <span className="rounded-full bg-accent px-1.5 text-[11px] tabular-nums text-accent-ink">{unread}</span> : null}
            </Link>
          ))}
        </nav>
        <nav aria-label={t('category')} className="-mx-1 flex max-w-full flex-wrap gap-1">
          <Link href={href({ category: null, before: null })} aria-current={!category ? 'page' : undefined} className={cn('inline-flex h-7 items-center rounded-full border px-2.5 text-[12px] font-medium', !category ? 'border-accent/30 bg-accent-soft text-accent' : 'border-line text-ink-2 hover:bg-surface-2')}>
            {t('allCategories')}
          </Link>
          {NOTIFICATION_CATEGORIES.map((c) => (
            <Link key={c} href={href({ category: c, before: null })} aria-current={category === c ? 'page' : undefined} className={cn('inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[12px] font-medium', category === c ? 'border-accent/30 bg-accent-soft text-accent' : 'border-line text-ink-2 hover:bg-surface-2')}>
              <CategoryIcon category={c} className="size-3.5" />
              {tc(c)}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mt-6 flex flex-col gap-6">
        {page.items.length ? (
          [...groups.entries()].map(([k, items]) => <InboxGroup key={k} org={org} label={dayLabel(k)} items={items} />)
        ) : category ? (
          <EmptyState icon={<BellOff />} title={t('filteredEmptyTitle')} description={t('filteredEmptyBody')} action={<Link href={href({ category: null })} className="text-[13px] font-medium text-accent hover:underline">{tcommon('clearFilters')}</Link>} />
        ) : filter === 'unread' ? (
          <EmptyState icon={<CheckCheck />} title={t('emptyUnreadTitle')} description={t('emptyUnreadBody')} action={<Link href={href({ filter: 'all' })} className="text-[13px] font-medium text-accent hover:underline">{t('all')}</Link>} />
        ) : filter === 'archived' ? (
          <EmptyState icon={<BellOff />} title={t('emptyArchivedTitle')} description={t('emptyArchivedBody')} />
        ) : (
          <EmptyState icon={<BellOff />} title={t('emptyTitle')} description={t('emptyBody')} />
        )}
      </div>

      {page.nextCursor || before ? (
        <div className="mt-6 flex justify-center gap-4 text-[13px]">
          {before ? <Link href={href({ before: null })} className="font-medium text-ink-2 hover:text-ink hover:underline">{t('newest')}</Link> : null}
          {page.nextCursor ? <Link href={href({ before: page.nextCursor })} className="font-medium text-accent hover:underline">{t('older')}</Link> : null}
        </div>
      ) : null}
    </div>
  );
}
