import { getTranslations } from 'next-intl/server';
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/components/marketing/og';

export const alt = 'Orqivanta — client work, without the chasing';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/** Default social preview for every page that doesn’t define its own. */
export default async function OpengraphImage() {
  const t = await getTranslations('marketing.home');
  return renderOgImage({ title: 'Client work, without the chasing.', subtitle: t('metaDescription') });
}
