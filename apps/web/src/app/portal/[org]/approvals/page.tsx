import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Stamp } from 'lucide-react';
import { listApprovals } from '@orqivanta/core';
import { ApprovalStatusBadge } from '@/components/domain/badges';
import { DueDate, RelativeTime } from '@/components/domain/dates';
import { PortalCard, PortalEmpty, PortalPageHeader, PortalSection } from '@/components/portal/portal-ui';
import { requirePortal } from '@/components/portal/portal-session';

export async function generateMetadata() {
  const t = await getTranslations('portal.approvals');
  return { title: t('title') };
}

export default async function PortalApprovalsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const { viewer } = await requirePortal(org);
  const t = await getTranslations('portal.approvals');
  const base = `/portal/${org}`;
  const all = await listApprovals(viewer, { view: 'all' });
  const waiting = all.filter((a) => a.status === 'pending' && a.amReviewer && !a.myDecision);
  const rest = all.filter((a) => !waiting.includes(a));

  function Row({ a, attention }: { a: (typeof all)[number]; attention?: boolean }) {
    return (
      <li>
        <Link href={`${base}/approvals/${a.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 hover:bg-surface-2">
          <span className="min-w-0 flex-1 basis-full sm:basis-0">
            <span className="block text-[15px] font-medium text-ink">{a.title}</span>
            <span className="mt-0.5 block text-[12px] text-ink-3">
              {a.projectName} · {a.subjectName}
              {a.round > 1 ? ` · ${t('round', { round: a.round })}` : ''}
            </span>
          </span>
          {attention ? null : <ApprovalStatusBadge status={a.status} />}
          {a.dueDate ? <DueDate date={a.dueDate} /> : <RelativeTime date={a.createdAt} className="text-[12px] text-ink-3" />}
        </Link>
      </li>
    );
  }

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <PortalPageHeader title={t('title')} description={t('intro')} />

      <PortalSection title={t('waiting')} className="mt-10">
        <PortalCard className={waiting.length ? 'border-attention/40' : undefined}>
          {waiting.length ? (
            <ul className="divide-y divide-line">
              {waiting.map((a) => (
                <Row key={a.id} a={a} attention />
              ))}
            </ul>
          ) : (
            <PortalEmpty icon={<Stamp />} title={t('emptyWaiting')} />
          )}
        </PortalCard>
      </PortalSection>

      <PortalSection title={t('others')} className="mt-10">
        <PortalCard>
          {rest.length ? (
            <ul className="divide-y divide-line">
              {rest.map((a) => (
                <Row key={a.id} a={a} />
              ))}
            </ul>
          ) : (
            <PortalEmpty icon={<Stamp />} title={waiting.length ? t('emptyOthers') : t('empty')} description={waiting.length ? t('emptyOthersHint') : t('emptyHint')} />
          )}
        </PortalCard>
      </PortalSection>
    </div>
  );
}
