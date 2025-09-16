import { getTranslations } from 'next-intl/server';
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/components/marketing/og';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Everything a client project needs. · Orqivanta';

export default async function OpengraphImage() {
  const t = await getTranslations('marketing.product');
  return renderOgImage({ title: 'Everything a client project needs.', subtitle: t('metaDescription') });
}
