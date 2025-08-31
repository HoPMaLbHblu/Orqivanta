import { closeDb } from '@orqivanta/db';
import { resetDemo } from './seed';

/** `pnpm demo:reset` — removes the sample workspace and creates it again. */
resetDemo((m) => console.log(`✓ ${m}`))
  .then(() => closeDb())
  .catch(async (err) => {
    console.error(err);
    await closeDb();
    process.exit(1);
  });
