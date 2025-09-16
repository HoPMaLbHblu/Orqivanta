'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, CircleAlert } from 'lucide-react';
import { checkSlugAction } from '@/actions/settings';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Workspace address with a live availability check (debounced). */
export function SlugField({ value, onChange, current, error, onAvailability }: { value: string; onChange: (v: string) => void; current?: string; error?: string; onAvailability?: (ok: boolean | null) => void }) {
  const t = useTranslations('settings.slug');
  const [host, setHost] = useState('');
  useEffect(() => setHost(window.location.host), []);
  const [state, setState] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');

  useEffect(() => {
    const v = value.trim().toLowerCase();
    if (!v || v === current) {
      setState('idle');
      onAvailability?.(v ? true : null);
      return;
    }
    if (v.length < 3 || v.length > 40 || !SLUG.test(v)) {
      setState('invalid');
      onAvailability?.(false);
      return;
    }
    setState('checking');
    const id = setTimeout(async () => {
      const res = await checkSlugAction(v, current);
      const ok = res.ok && res.data;
      setState(ok ? 'available' : 'taken');
      onAvailability?.(ok);
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, current]);

  const status =
    state === 'checking' ? (
      <span className="flex items-center gap-1.5 text-[12px] text-ink-3" role="status">
        <Spinner className="size-3.5" /> {t('checking')}
      </span>
    ) : state === 'available' ? (
      <span className="flex items-center gap-1.5 text-[12px] text-success" role="status">
        <Check className="size-3.5" aria-hidden /> {t('available')}
      </span>
    ) : state === 'taken' ? (
      <span className="flex items-center gap-1.5 text-[12px] text-danger" role="status">
        <CircleAlert className="size-3.5" aria-hidden /> {t('taken')}
      </span>
    ) : state === 'invalid' ? (
      <span className="flex items-center gap-1.5 text-[12px] text-danger" role="status">
        <CircleAlert className="size-3.5" aria-hidden /> {t('invalid')}
      </span>
    ) : null;

  return (
    <div className="flex flex-col gap-1.5">
      <Field label={t('label')} hint={t('hint')} error={error}>
        <Input value={value} onChange={(e) => onChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40))} autoComplete="off" spellCheck={false} className="font-mono text-[13px]" maxLength={40} />
      </Field>
      <div className="flex min-h-4 flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[12px] text-ink-3">{host}/{value || '…'}</span>
        {status}
      </div>
    </div>
  );
}

export function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}
