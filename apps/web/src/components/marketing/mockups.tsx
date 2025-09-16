import { useTranslations } from 'next-intl';
import { Check, CircleDot, Clock, Eye, FileText, Link2, MessageSquare, Paperclip, Stamp } from 'lucide-react';
import { cn } from '@/lib/cn';

/*
 * Decorative illustrations: small, honest mock-ups of real Orqivanta screens, built from the
 * same design tokens as the app. They are not screenshots and hold no real data, so every
 * one is rendered inside an aria-hidden frame (see Plate) and nothing here is focusable.
 */

const chip = 'inline-flex h-[18px] items-center gap-1 rounded-full border px-1.5 text-[10px] font-medium whitespace-nowrap';

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('rounded-lg border border-line bg-surface p-2.5', className)}>{children}</div>;
}

/** Task board: three columns of cards, like the project board view. */
interface MockCard {
  key: string;
  title: string;
  label: string;
  tone: string;
  due?: string | null;
  started?: boolean;
  blocked?: boolean;
  review?: boolean;
}

export function BoardMock({ className }: { className?: string }) {
  const t = useTranslations('marketing.mock.board');
  const columns: { name: string; count: number; cards: MockCard[] }[] = [
    {
      name: t('todo'),
      count: 6,
      cards: [
        { key: 'HPC-24', title: t('t1'), label: t('content'), tone: 'moss', due: t('dueFri') },
        { key: 'HPC-27', title: t('t5'), label: t('dev'), tone: 'ocean', due: null },
      ],
    },
    {
      name: t('doing'),
      count: 3,
      cards: [
        { key: 'HPC-21', title: t('t2'), label: t('dev'), tone: 'ocean', due: t('dueThu'), started: true },
        { key: 'HPC-19', title: t('t4'), label: t('design'), tone: 'plum', due: t('dueMon'), started: true, blocked: true },
      ],
    },
    {
      name: t('review'),
      count: 1,
      cards: [{ key: 'HPC-18', title: t('t3'), label: t('design'), tone: 'plum', due: null, review: true }],
    },
  ];
  return (
    <div className={cn('grid grid-cols-3 gap-2 text-ink', className)}>
      {columns.map((col) => (
        <div key={col.name} className="min-w-0">
          <div className="mb-2 flex items-center gap-1.5 px-0.5">
            <span className="truncate text-[11px] font-medium text-ink-2">{col.name}</span>
            <span className="text-[11px] text-ink-3 tabular-nums">{col.count}</span>
          </div>
          <div className="flex flex-col gap-2">
            {col.cards.map((c) => (
              <Card key={c.key}>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] text-ink-3">{c.key}</span>
                  {c.review ? <Eye className="ml-auto size-3 text-attention" /> : c.started ? <CircleDot className="ml-auto size-3 text-info" /> : null}
                </div>
                <p className="mt-1 text-[11px] leading-snug font-medium">{c.title}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  <span className={chip} style={{ background: `var(--c-${c.tone})`, color: `var(--c-${c.tone}-ink)`, borderColor: 'transparent' }}>
                    {c.label}
                  </span>
                  {c.blocked ? <span className={cn(chip, 'border-danger/25 bg-danger-soft text-danger')}>{t('blocked')}</span> : null}
                  {c.due ? <span className="ml-auto text-[10px] text-ink-3">{c.due}</span> : null}
                </div>
                {c.review ? <p className={cn(chip, 'mt-2 border-attention/25 bg-attention-soft text-attention')}>{t('inApproval')}</p> : null}
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Approval card, in its second round, with the decision history underneath. */
export function ApprovalMock({ className }: { className?: string }) {
  const t = useTranslations('marketing.mock.approval');
  return (
    <div className={cn('rounded-lg border border-line bg-surface text-ink', className)}>
      <div className="flex items-start gap-2 border-b border-line px-3 py-2.5">
        <Stamp className="mt-0.5 size-3.5 text-attention" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] tracking-[0.1em] text-ink-3 uppercase">{t('label')}</p>
          <p className="mt-0.5 text-[12px] font-medium">{t('title')}</p>
        </div>
        <span className={cn(chip, 'border-attention/25 bg-attention-soft text-attention')}>{t('round')}</span>
      </div>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink-3">
          <FileText className="size-3.5" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-mono text-[11px]">{t('file')}</p>
          <p className="text-[10px] text-ink-3">{t('version')}</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-ink-3">
          <Clock className="size-3" />
          {t('due')}
        </span>
      </div>
      <div className="border-t border-line px-3 py-2.5">
        <p className="text-[10px] text-ink-3">{t('rule')}</p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {[
            { name: 'Maya Okafor', tone: 'verdigris', state: 'approved' as const },
            { name: 'Hannah Cole', tone: 'amber', state: 'waiting' as const, client: true },
          ].map((r) => (
            <li key={r.name} className="flex items-center gap-2">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-medium" style={{ background: `var(--c-${r.tone})`, color: `var(--c-${r.tone}-ink)` }}>
                {r.name
                  .split(' ')
                  .map((p) => p[0])
                  .join('')}
              </span>
              <span className="min-w-0 flex-1 truncate text-[11px]">{r.name}</span>
              {r.client ? <span className="text-[10px] text-ink-3">{t('client')}</span> : null}
              {r.state === 'approved' ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-success">
                  <Check className="size-3" />
                  {t('approved')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] text-attention">
                  <Clock className="size-3" />
                  {t('waiting')}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-center gap-2 border-t border-line px-3 py-2.5">
        <span className="inline-flex h-6 items-center rounded-md bg-accent px-2 text-[10px] font-medium text-accent-ink">{t('approve')}</span>
        <span className="inline-flex h-6 items-center rounded-md border border-line-strong px-2 text-[10px] font-medium text-ink-2">{t('requestChanges')}</span>
      </div>
      <div className="border-t border-line bg-surface-2 px-3 py-2 text-[10px] text-ink-3">
        <span className="font-medium text-ink-2">{t('round1')}</span> · {t('changesRequested')}
      </div>
    </div>
  );
}

/** Portal request timeline: what a client sees after sending a request. */
export function RequestTimelineMock({ className }: { className?: string }) {
  const t = useTranslations('marketing.mock.portal');
  const steps = [
    { text: t('s1'), when: t('mon'), icon: Paperclip, done: true },
    { text: t('s2'), when: t('mon'), icon: MessageSquare, done: true },
    { text: t('s3'), when: t('tue'), icon: Link2, done: true },
    { text: t('s4'), when: t('wed'), icon: CircleDot, current: true },
    { text: t('s5'), when: null, icon: Check },
  ];
  return (
    <div className={cn('rounded-lg border border-line bg-surface text-ink', className)}>
      <div className="border-b border-line px-3 py-2.5">
        <p className="font-mono text-[10px] text-ink-3">{t('label')}</p>
        <p className="mt-0.5 text-[12px] font-medium">{t('title')}</p>
        <p className="mt-0.5 text-[10px] text-ink-3">{t('client')}</p>
      </div>
      <ol className="px-3 py-3">
        {steps.map((s, i) => (
          <li key={s.text} className="flex gap-2.5">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full border',
                  s.current ? 'border-accent bg-accent text-accent-ink' : s.done ? 'border-line-strong bg-surface-2 text-ink-3' : 'border-dashed border-line-strong text-ink-3',
                )}
              >
                <s.icon className="size-2.5" />
              </span>
              {i < steps.length - 1 ? <span className={cn('w-px flex-1', s.done ? 'bg-line-strong' : 'bg-line')} /> : null}
            </div>
            <div className={cn('min-w-0 flex-1 pb-3', i === steps.length - 1 && 'pb-0')}>
              <p className={cn('text-[11px] leading-snug', s.current ? 'font-medium text-ink' : s.done ? 'text-ink-2' : 'text-ink-3')}>{s.text}</p>
              <p className="mt-0.5 text-[10px] text-ink-3">{s.when ?? '—'}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Document with autosave and a version number. */
export function DocumentMock({ className }: { className?: string }) {
  const t = useTranslations('marketing.mock.doc');
  return (
    <div className={cn('rounded-lg border border-line bg-surface text-ink', className)}>
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <FileText className="size-3.5 text-ink-3" />
        <span className="text-[10px] text-ink-3">{t('collection')}</span>
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-success">
          <Check className="size-3" />
          {t('saved')}
        </span>
      </div>
      <div className="px-3 py-3">
        <p className="font-serif text-[15px] leading-tight">{t('title')}</p>
        <p className="mt-2.5 text-[11px] font-semibold">{t('h')}</p>
        <p className="mt-1 text-[11px] leading-[1.6] text-ink-2">{t('p')}</p>
        <ul className="mt-2.5 flex flex-col gap-1.5">
          {[t('c1'), t('c2'), t('c3')].map((c, i) => (
            <li key={c} className="flex items-start gap-1.5 text-[11px] text-ink-2">
              <span className={cn('mt-[1px] flex size-3 shrink-0 items-center justify-center rounded-[3px] border', i < 2 ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong')}>
                {i < 2 ? <Check className="size-2" /> : null}
              </span>
              <span className={i < 2 ? 'text-ink-3 line-through' : undefined}>{c}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
