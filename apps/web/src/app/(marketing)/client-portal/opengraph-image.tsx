import { getTranslations } from 'next-intl/server';
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/components/marketing/og';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Give clients a window, not the whole house. · Orqivanta';

export default async function OpengraphImage() {
  const t = await getTranslations('marketing.portal');
  return renderOgImage({ title: 'Give clients a window, not the whole house.', subtitle: t('metaDescription') });
}
