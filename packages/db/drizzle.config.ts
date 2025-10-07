import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  dbCredentials: {
    url: process.env.DATABASE_ADMIN_URL ?? 'postgres://orqivanta_owner:orqivanta_owner@localhost:5433/orqivanta',
  },
  strict: true,
});
