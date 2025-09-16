import type { MetadataRoute } from 'next';
import { config } from '@orqivanta/core';

/**
 * Only the public site is indexable. Organization addresses are not enumerable — a
 * workspace page returns 404 to anyone without a membership — so they need no rule here.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/portal/', '/dev/', '/account/', '/onboarding', '/invite/', '/verify-email', '/reset-password'],
      },
    ],
    sitemap: `${config.appUrl}/sitemap.xml`,
    host: config.appUrl,
  };
}
