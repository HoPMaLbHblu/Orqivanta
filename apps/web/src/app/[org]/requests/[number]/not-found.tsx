import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Inbox } from 'lucide-react';
import { EmptyState } from '@/components/ui/primitives';

export default async function NotFound() {
  const t = await getTranslations('common');
  return (
    <div className="mx-auto max-w-[600px] px-6 py-20">
      <EmptyState icon={<Inbox />} title={t('notFoundTitle')} description={t('notFoundBody')} action={<Link href="/" className="text-[13px] font-medium text-accent hover:underline">{t('goHome')}</Link>} />
    </div>
  );
}
