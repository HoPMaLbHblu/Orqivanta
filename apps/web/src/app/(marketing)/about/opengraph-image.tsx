import { getTranslations } from 'next-intl/server';
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/components/marketing/og';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'A careful tool, honestly described. · Orqivanta';

export default async function OpengraphImage() {
  const t = await getTranslations('marketing.about');
  return renderOgImage({ title: 'A careful tool, honestly described.', subtitle: t('metaDescription') });
}
