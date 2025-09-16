'use client';

import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { NAMED_COLORS } from '@/components/domain/tone';
import { cn } from '@/lib/cn';

/** Colour choice from the named palette; never a free-form hex, so contrast stays safe. */
export function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const t = useTranslations('settings.colors');
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-[13px] font-medium text-ink">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {NAMED_COLORS.map((c) => {
          const active = value === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              aria-pressed={active}
              title={t(c)}
              className={cn('flex size-7 items-center justify-center rounded-full border-2 transition-colors', active ? 'border-ink' : 'border-transparent hover:border-line-strong')}
              style={{ background: `var(--c-${c})` }}
            >
              {active ? <Check className="size-3.5" style={{ color: `var(--c-${c}-ink)` }} aria-hidden /> : null}
              <span className="sr-only">{t(c)}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
