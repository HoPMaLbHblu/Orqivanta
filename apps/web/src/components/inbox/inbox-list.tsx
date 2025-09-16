'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Archive, ArchiveRestore, CheckCheck, Mail, MailOpen, MoreHorizontal } from 'lucide-react';
import { markNotificationsAction } from '@/actions/inbox';
import { Avatar } from '@/components/domain/avatar';
import { RelativeTime } from '@/components/domain/dates';
import { Button } from '@/components/ui/button';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';
import { useAction } from '@/lib/use-action';
import { cn } from '@/lib/cn';
import { CategoryIcon } from './category-icon';

export interface InboxItem {
  id: string;
  category: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  actorName: string | null;
  actorColor: string | null;
}

export function MarkAllReadButton({ org }: { org: string }) {
  const t = useTranslations('inbox');
  const { call, pending } = useAction();
  return (
    <Button size="sm" loading={pending} onClick={() => call(() => markNotificationsAction(org, { all: true, action: 'read' }), { success: t('allMarkedRead') })}>
      <CheckCheck /> {t('markAllRead')}
    </Button>
  );
}

/** One day's notifications. Opening a notification marks it read, then follows its link. */
export function InboxGroup({ org, label, items }: { org: string; label: string; items: InboxItem[] }) {
  const t = useTranslations('inbox');
  const tc = useTranslations('enums.notificationCategory');
  const router = useRouter();
  const { call } = useAction();

  const mark = (id: string, action: 'read' | 'unread' | 'archive' | 'unarchive', success?: string) => call(() => markNotificationsAction(org, { ids: [id], action }), { success });

  async function open(item: InboxItem) {
    if (!item.readAt) await markNotificationsAction(org, { ids: [item.id], action: 'read' });
    if (item.href) router.push(item.href);
    else router.refresh();
  }

  return (
    <section aria-label={label}>
      <h2 className="px-1 pb-2 text-[12px] font-medium tracking-wide text-ink-3 uppercase">{label}</h2>
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {items.map((n) => {
          const unread = !n.readAt;
          return (
            <li key={n.id} className={cn('group relative flex items-start gap-3 px-3 py-2.5 hover:bg-surface-2', unread && 'bg-accent-soft/40')}>
              <span className="mt-1.5 flex w-2 shrink-0 justify-center">{unread ? <span className="size-2 rounded-full bg-accent" title={t('unreadDot')} /> : null}</span>
              <Avatar name={n.actorName ?? tc(n.category as never)} color={n.actorColor} size="sm" title="" className="mt-0.5" />
              <button type="button" onClick={() => open(n)} className="min-w-0 flex-1 text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-accent">
                <span className={cn('block text-[13px] leading-snug', unread ? 'font-medium text-ink' : 'text-ink-2')}>
                  {unread ? <span className="sr-only">{t('unreadDot')}: </span> : null}
                  {n.title}
                </span>
                {n.body ? <span className="mt-0.5 line-clamp-2 block text-[12px] text-ink-3">{n.body}</span> : null}
                <span className="mt-1 flex items-center gap-1.5 text-[12px] text-ink-3">
                  <CategoryIcon category={n.category} className="size-3.5" />
                  {tc(n.category as never)}
                  <span aria-hidden>·</span>
                  <RelativeTime date={n.createdAt} />
                </span>
              </button>
              <div className="relative z-10 flex shrink-0 items-center gap-0.5">
                <Button variant="ghost" size="icon-sm" className="hidden sm:inline-flex" aria-label={unread ? t('markRead') : t('markUnread')} title={unread ? t('markRead') : t('markUnread')} onClick={() => mark(n.id, unread ? 'read' : 'unread')}>
                  {unread ? <MailOpen /> : <Mail />}
                </Button>
                <Menu>
                  <MenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={t('actionsFor', { title: n.title })}>
                      <MoreHorizontal />
                    </Button>
                  </MenuTrigger>
                  <MenuContent align="end">
                    <MenuItem onSelect={() => mark(n.id, unread ? 'read' : 'unread')}>
                      {unread ? <MailOpen /> : <Mail />} {unread ? t('markRead') : t('markUnread')}
                    </MenuItem>
                    {n.archivedAt ? (
                      <MenuItem onSelect={() => mark(n.id, 'unarchive', t('unarchivedToast'))}>
                        <ArchiveRestore /> {t('unarchive')}
                      </MenuItem>
                    ) : (
                      <MenuItem onSelect={() => mark(n.id, 'archive', t('archivedToast'))}>
                        <Archive /> {t('archive')}
                      </MenuItem>
                    )}
                  </MenuContent>
                </Menu>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
