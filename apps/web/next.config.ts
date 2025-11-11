import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { fileURLToPath } from 'node:url';

// The monorepo keeps one .env at the root; load it for the web app too (already-set variables win).
try {
  // fileURLToPath, not URL.pathname: on Windows the pathname is "/C:/..." and fails to load.
  process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)));
} catch {
  // No root .env: rely on the environment.
}

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const config: NextConfig = {
  reactStrictMode: true,
  // The floating dev badge sits on top of the sidebar's account menu; keep it out of the way.
  devIndicators: false,
  // Lets several dev servers share one checkout without clobbering each other's build output.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  // Workspace packages ship TypeScript source.
  transpilePackages: ['@orqivanta/core', '@orqivanta/db'],
  serverExternalPackages: ['@node-rs/argon2', 'sharp', 'pg', 'nodemailer'],
  experimental: {
    serverActions: { bodySizeLimit: '2mb' },
    // Browser-side router cache: revisiting a page within these seconds is instant. It lives in the
    // tab's memory only (never shared between people), and live updates and every mutation refresh it.
    staleTimes: { dynamic: 30, static: 300 },
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Build assets under /_next/static are already cached forever by Next.js (their names change on
      // every build). These generated images don't carry a hash, so they get a day plus revalidation.
      {
        source: '/:file(icon.svg|opengraph-image|robots.txt|sitemap.xml)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
      },
    ];
  },
};

export default withNextIntl(config);
