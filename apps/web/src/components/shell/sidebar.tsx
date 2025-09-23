'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BarChart3, Briefcase, CheckSquare, ChevronsUpDown, FileText, FolderKanban, Home, Inbox, Plus, Search, Settings, Stamp, Users, type LucideIcon } from 'lucide-react';
import { LogoMark } from '@/components/brand';
import { Avatar } from '@/components/domain/avatar';
import { toneInk } from '@/components/domain/tone';
import { Kbd } from '@/components/ui/primitives';
import { Menu, MenuCheckItem, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { cn } from '@/lib/cn';
import { AccountMenu } from './account-menu';
import { useCommandPalette } from './command-palette';

export interface ShellOrg {
  slug: string;
  name: string;
  role: string;
  isDemo: boolean;
}

export interface ShellData {
  org: ShellOrg;
  orgs: ShellOrg[];
  user: { name: string; email: string; color: string };
  unread: number;
  reviewsWaiting: number;
  openRequests: number;
  favorites: { entityType: string; entityId: string; title: string; key: string | null; color: string | null }[];
  canSeeSettings: boolean;
  canSeeReports: boolean;
}

function NavItem({ href, icon: Icon, label, count, exact, attention }: { href: string; icon: LucideIcon; label: string; count?: number; exact?: boolean; attention?: boolean }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link href={href} aria-current={active ? 'page' : undefined} className={cn('group flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors', active ? 'bg-surface-3 font-medium text-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink')}>
      <Icon className={cn('size-4 shrink-0', active ? 'text-ink' : 'text-ink-3 group-hover:text-ink-2')} aria-hidden />
      <span className="truncate">{label}</span>
      {count ? <span key={count} data-count className={cn('ml-auto inline-block rounded-full px-1.5 text-[11px] font-medium tabular-nums', attention ? 'bg-attention-soft text-attention' : 'text-ink-3')}>{count}</span> : null}
    </Link>
  );
}

export function Sidebar({ data, onNavigate }: { data: ShellData; onNavigate?: () => void }) {
  const t = useTranslations('shell');
  const base = `/${data.org.slug}`;
  const palette = useCommandPalette();
  return (
    <nav aria-label={t('mainNav')} className="flex h-full flex-col gap-4 px-3 py-3" onClick={(e) => (e.target as HTMLElement).closest('a') && onNavigate?.()}>
      <Menu>
        <MenuTrigger asChild>
          <button type="button" className="flex h-10 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-surface-2">
            <LogoMark className="size-6" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-ink">{data.org.name}</span>
              {data.org.isDemo ? <span className="block text-[11px] text-attention">{t('demoWorkspace')}</span> : null}
            </span>
            <ChevronsUpDown className="size-4 text-ink-3" aria-hidden />
          </button>
        </MenuTrigger>
        <MenuContent className="w-64">
          <MenuLabel>{t('organizations')}</MenuLabel>
          {data.orgs.map((o) => (
            <MenuCheckItem key={o.slug} checked={o.slug === data.org.slug} onCheckedChange={() => (window.location.href = o.role === 'client' ? `/portal/${o.slug}` : `/${o.slug}`)}>
              <span className="truncate">{o.name}</span>
            </MenuCheckItem>
          ))}
          <MenuSeparator />
          <MenuItem onSelect={() => (window.location.href = '/onboarding')}>
            <Plus /> {t('newOrganization')}
          </MenuItem>
        </MenuContent>
      </Menu>

      <button type="button" onClick={() => palette.open()} className="flex h-8 items-center gap-2 rounded-md border border-line bg-surface px-2 text-[13px] text-ink-3 hover:border-line-strong hover:text-ink-2">
        <Search className="size-4" aria-hidden />
        <span className="flex-1 text-left">{t('searchPlaceholder')}</span>
        <Kbd>⌘K</Kbd>
      </button>

      <div className="flex flex-col gap-0.5">
        <NavItem href={base} exact icon={Home} label={t('home')} />
        <NavItem href={`${base}/my-work`} icon={CheckSquare} label={t('myWork')} />
        <NavItem href={`${base}/inbox`} icon={Inbox} label={t('inbox')} count={data.unread} attention />
      </div>

      <div className="flex flex-col gap-0.5">
        <p className="px-2 pb-1 text-[11px] font-medium tracking-wide text-ink-3 uppercase">{t('workspace')}</p>
        <NavItem href={`${base}/projects`} icon={FolderKanban} label={t('projects')} />
        <NavItem href={`${base}/documents`} icon={FileText} label={t('documents')} />
        <NavItem href={`${base}/requests`} icon={Briefcase} label={t('requests')} count={data.openRequests} />
        <NavItem href={`${base}/approvals`} icon={Stamp} label={t('approvals')} count={data.reviewsWaiting} attention />
        <NavItem href={`${base}/clients`} icon={Users} label={t('clients')} />
        {data.canSeeReports ? <NavItem href={`${base}/reports`} icon={BarChart3} label={t('reports')} /> : null}
      </div>

      {data.favorites.length ? (
        <div className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
          <p className="px-2 pb-1 text-[11px] font-medium tracking-wide text-ink-3 uppercase">{t('favorites')}</p>
          {data.favorites.map((f) => (
            <Link key={f.entityId} href={f.entityType === 'project' ? `${base}/projects/${f.key}` : `${base}/documents/${f.entityId}`} className="flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] text-ink-2 hover:bg-surface-2 hover:text-ink">
              {f.entityType === 'project' ? <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: toneInk(f.color) }} aria-hidden /> : <FileText className="size-4 text-ink-3" aria-hidden />}
              <span className="truncate">{f.title}</span>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="mt-auto flex flex-col gap-0.5">
        {data.canSeeSettings ? <NavItem href={`${base}/settings`} icon={Settings} label={t('settings')} /> : null}
        <AccountMenu user={data.user} orgSlug={data.org.slug}>
          <button type="button" className="flex h-10 w-full items-center gap-2.5 rounded-md px-2 text-left hover:bg-surface-2">
            <Avatar name={data.user.name} color={data.user.color} size="sm" title="" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-ink">{data.user.name}</span>
              <span className="block truncate text-[11px] text-ink-3">{data.user.email}</span>
            </span>
          </button>
        </AccountMenu>
      </div>
    </nav>
  );
}
