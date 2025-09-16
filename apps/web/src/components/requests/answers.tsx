import { getTranslations } from 'next-intl/server';
import type { RequestFormField } from './form-fields';

/** The answers to a request form's fields, in the form's own order. */
export async function RequestAnswers({ fields, answers }: { fields: RequestFormField[]; answers: Record<string, unknown> }) {
  const t = await getTranslations('requests');
  const shown = fields.filter((f) => answers[f.key] !== undefined && answers[f.key] !== null && answers[f.key] !== '');
  const extra = Object.keys(answers).filter((k) => !fields.some((f) => f.key === k));
  if (!shown.length && !extra.length) return null;
  return (
    <dl className="grid gap-x-6 gap-y-3 border-t border-line pt-4 sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)]">
      {shown.map((f) => {
        const value = String(answers[f.key]);
        return (
          <div key={f.key} className="contents">
            <dt className="text-[13px] text-ink-3">{f.label}</dt>
            <dd className="text-[13px] break-words text-ink">
              {f.type === 'url' ? (
                <a href={value} target="_blank" rel="noopener noreferrer nofollow" className="text-accent hover:underline">
                  {value}
                </a>
              ) : (
                value
              )}
            </dd>
          </div>
        );
      })}
      {extra.length ? (
        <div className="contents">
          <dt className="text-[13px] text-ink-3">{t('otherAnswers')}</dt>
          <dd className="text-[13px] text-ink-2">{extra.map((k) => `${k}: ${String(answers[k])}`).join(' · ')}</dd>
        </div>
      ) : null}
    </dl>
  );
}
