import { getTranslations } from 'next-intl/server';
import { Github, Send } from 'lucide-react';
import { cn } from '@/lib/cn';

export const AUTHOR_LINKS = [
  { key: 'github', href: 'https://github.com/HoPMaLbHblu', handle: 'HoPMaLbHblu', Icon: Github },
  { key: 'telegram', href: 'https://t.me/ny_da_ny_daaa', handle: '@ny_da_ny_daaa', Icon: Send },
] as const;

/** The author's GitHub and Telegram. Both open in a new tab. */
export async function AuthorLinks({ className, showHandles }: { className?: string; showHandles?: boolean }) {
  const t = await getTranslations('marketing.author');
  return (
    <ul className={cn('flex flex-wrap gap-2', className)}>
      {AUTHOR_LINKS.map(({ key, href, handle, Icon }) => (
        <li key={key}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={showHandles ? undefined : t(key, { handle })}
            title={t(key, { handle })}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-line px-2.5 text-[14px] text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
          >
            <Icon className="size-4" aria-hidden />
            {showHandles ? <span>{t(key, { handle })}</span> : null}
          </a>
        </li>
      ))}
    </ul>
  );
}
