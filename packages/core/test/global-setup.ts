import './env';
import { runMigrations } from '@orqivanta/db/migrate';

export async function setup() {
  await runMigrations();
}
