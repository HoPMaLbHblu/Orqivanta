import { getTranslations } from 'next-intl/server';
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/components/marketing/og';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Made for studios that answer to clients. · Orqivanta';

export default async function OpengraphImage() {
  const t = await getTranslations('marketing.agencies');
  return renderOgImage({ title: 'Made for studios that answer to clients.', subtitle: t('metaDescription') });
}
