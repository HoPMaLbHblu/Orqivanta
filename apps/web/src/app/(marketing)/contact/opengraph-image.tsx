import { getTranslations } from 'next-intl/server';
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/components/marketing/og';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Get in touch. · Orqivanta';

export default async function OpengraphImage() {
  const t = await getTranslations('marketing.contact');
  return renderOgImage({ title: 'Get in touch.', subtitle: t('metaDescription') });
}
