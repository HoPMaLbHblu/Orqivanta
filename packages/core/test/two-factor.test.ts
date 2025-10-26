import { describe, expect, it } from 'vitest';
import { eq, users, withSystem } from '@orqivanta/db';
import {
  beginTwoFactorSetup,
  completeTwoFactorSignIn,
  confirmTwoFactorSetup,
  currentTotpStep,
  disableTwoFactor,
  signIn,
  totpCode,
  twoFactorStatus,
} from '../src';
import { hashPassword } from '../src/auth/password';
import { expectCode } from './helpers';

const PASSWORD = 'correct horse battery';

async function makeAccount() {
  const email = `${crypto.randomUUID()}@test.example`;
  const [u] = await withSystem(async (tx) =>
    tx
      .insert(users)
      .values({ email, name: 'Two Factor', emailVerifiedAt: new Date(), passwordHash: await hashPassword(PASSWORD) })
      .returning({ id: users.id }),
  );
  return { id: u!.id, email };
}

describe('two-factor sign-in', () => {
  it('matches the RFC 6238 SHA-1 test vector', () => {
    // Secret "12345678901234567890" in base32; T = 59s is step 1, expected 94287082 → last 6 digits.
    expect(totpCode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 1)).toBe('287082');
  });

  it('sets up, asks for a code at sign-in, accepts recovery codes once, and turns off', async () => {
    const acct = await makeAccount();
    const { secret } = await beginTwoFactorSetup(acct.id);
    await expectCode(confirmTwoFactorSetup(acct.id, { code: '000000' }), 'VALIDATION');
    const { recoveryCodes } = await confirmTwoFactorSetup(acct.id, { code: totpCode(secret, currentTotpStep()) });
    expect(recoveryCodes).toHaveLength(10);
    expect((await twoFactorStatus(acct.id)).enabled).toBe(true);

    const first = await signIn({ email: acct.email, password: PASSWORD });
    expect(first.status).toBe('two_factor');
    const challenge = (first as { challenge: string }).challenge;
    await expectCode(completeTwoFactorSignIn({ challenge, code: '123456' }), 'VALIDATION');
    // The setup code's step was consumed, so only a later step would work by app; use a recovery code.
    const ok = await completeTwoFactorSignIn({ challenge, code: recoveryCodes[0]!.toUpperCase() });
    expect(ok.token).toBeTruthy();
    expect(ok.recoveryCodesLeft).toBe(9);
    // The challenge is single-use.
    await expectCode(completeTwoFactorSignIn({ challenge, code: recoveryCodes[1]! }), 'CONFLICT');

    const second = (await signIn({ email: acct.email, password: PASSWORD })) as { challenge: string };
    await expectCode(completeTwoFactorSignIn({ challenge: second.challenge, code: recoveryCodes[0]! }), 'VALIDATION');

    await expectCode(disableTwoFactor(acct.id, { password: 'wrong password' }), 'VALIDATION');
    await disableTwoFactor(acct.id, { password: PASSWORD });
    expect((await signIn({ email: acct.email, password: PASSWORD })).status).toBe('ok');
    const [row] = await withSystem((tx) => tx.select().from(users).where(eq(users.id, acct.id)));
    expect(row!.totpSecret).toBeNull();
    expect(row!.recoveryCodeHashes).toEqual([]);
  });

  it('is not available for shared demo accounts', async () => {
    const acct = await makeAccount();
    await withSystem((tx) => tx.update(users).set({ isDemo: true }).where(eq(users.id, acct.id)));
    await expectCode(beginTwoFactorSetup(acct.id), 'FORBIDDEN');
  });
});
