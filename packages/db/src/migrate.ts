import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Applies SQL migrations as the schema owner, then grants the application role
 * data access (but not ownership, so row-level security always applies to it).
 */
export async function runMigrations(url = process.env.DATABASE_ADMIN_URL) {
  if (!url) throw new Error('DATABASE_ADMIN_URL is not set');
  const appRole = process.env.DATABASE_APP_ROLE ?? 'orqivanta_app';
  if (!/^[a-z_][a-z0-9_]*$/.test(appRole)) throw new Error('Invalid DATABASE_APP_ROLE');
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  try {
    const db = drizzle(pool);
    const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations');
    await migrate(db, { migrationsFolder });
    await pool.query(`
      GRANT USAGE ON SCHEMA public TO ${appRole};
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${appRole};
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${appRole};
    `);
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runMigrations()
    .then(() => console.log('✓ Migrations applied'))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
