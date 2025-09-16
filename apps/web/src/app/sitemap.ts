import type { MetadataRoute } from 'next';
import { config } from '@orqivanta/core';
import { LATEST_CHANGE_DATE } from '../../content/changelog';

/** Public pages only. Workspace and portal addresses are private and never listed. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = config.appUrl;
  const changed = new Date(`${LATEST_CHANGE_DATE}T12:00:00Z`);
  const pages: { path: string; priority: number; frequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
    { path: '/', priority: 1, frequency: 'monthly' },
    { path: '/product', priority: 0.9, frequency: 'monthly' },
    { path: '/client-portal', priority: 0.8, frequency: 'monthly' },
    { path: '/agencies', priority: 0.8, frequency: 'monthly' },
    { path: '/pricing', priority: 0.7, frequency: 'monthly' },
    { path: '/changelog', priority: 0.6, frequency: 'weekly' },
    { path: '/about', priority: 0.5, frequency: 'yearly' },
    { path: '/contact', priority: 0.5, frequency: 'yearly' },
    { path: '/accessibility', priority: 0.4, frequency: 'yearly' },
    { path: '/legal/privacy', priority: 0.3, frequency: 'yearly' },
    { path: '/legal/terms', priority: 0.3, frequency: 'yearly' },
    { path: '/sign-up', priority: 0.6, frequency: 'yearly' },
    { path: '/sign-in', priority: 0.4, frequency: 'yearly' },
  ];
  return pages.map((p) => ({
    url: `${base}${p.path === '/' ? '' : p.path}`,
    lastModified: changed,
    changeFrequency: p.frequency,
    priority: p.priority,
  }));
}
