import { getTranslations } from 'next-intl/server';
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/components/marketing/og';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Free while it’s in preview. · Orqivanta';

export default async function OpengraphImage() {
  const t = await getTranslations('marketing.pricing');
  return renderOgImage({ title: 'Free while it’s in preview.', subtitle: t('metaDescription') });
}
