import { getTranslations } from 'next-intl/server';
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/components/marketing/og';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'What’s new in Orqivanta. · Orqivanta';

export default async function OpengraphImage() {
  const t = await getTranslations('marketing.changelog');
  return renderOgImage({ title: 'What’s new in Orqivanta.', subtitle: t('metaDescription') });
}
