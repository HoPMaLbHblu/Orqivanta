import { randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';

// OWASP-recommended argon2id parameters (m=19 MiB, t=2, p=1).
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

// A real hash of random bytes, verified when the account doesn't exist so that
// response timing does not reveal whether an email is registered.
let dummyHash: Promise<string> | null = null;

export async function verifyPassword(passwordHash: string | null, password: string): Promise<boolean> {
  dummyHash ??= hash(randomBytes(16).toString('hex'), OPTIONS);
  try {
    const ok = await verify(passwordHash ?? (await dummyHash), password);
    return passwordHash !== null && ok;
  } catch {
    return false;
  }
}
