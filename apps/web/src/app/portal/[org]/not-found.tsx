import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { FileQuestion } from 'lucide-react';
import { PortalCard, PortalEmpty } from '@/components/portal/portal-ui';

/** A client asking for something that isn't theirs, or isn't shared, lands here. */
export default async function PortalNotFound() {
  const t = await getTranslations('common');
  return (
    <div className="mx-auto max-w-[680px] px-4 py-20 sm:px-6">
      <PortalCard>
        <PortalEmpty
          icon={<FileQuestion />}
          title={t('notFoundTitle')}
          description={t('notFoundBody')}
          action={
            <Link href="/" className="text-[14px] font-medium text-accent hover:underline">
              {t('goHome')}
            </Link>
          }
        />
      </PortalCard>
    </div>
  );
}
