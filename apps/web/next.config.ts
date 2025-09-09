import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// The monorepo keeps one .env at the root; load it for the web app too (already-set variables win).
try {
  process.loadEnvFile(new URL('../../.env', import.meta.url).pathname);
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
  poweredByHeader: false,
  // Workspace packages ship TypeScript source.
  transpilePackages: ['@orqivanta/core', '@orqivanta/db'],
  serverExternalPackages: ['@node-rs/argon2', 'sharp', 'pg', 'nodemailer'],
  experimental: {
    serverActions: { bodySizeLimit: '2mb' },
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default withNextIntl(config);
