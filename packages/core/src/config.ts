import { existsSync } from 'node:fs';
import path from 'node:path';

function bool(v: string | undefined, fallback: boolean) {
  if (v === undefined || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

/** Runtime configuration, read lazily so tests can override process.env. */
export const config = {
  get appUrl() {
    return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  },
  get isProduction() {
    return process.env.NODE_ENV === 'production';
  },
  get demoMode() {
    return bool(process.env.DEMO_MODE, false);
  },
  get mailTransport(): 'smtp' | 'resend' | 'log' {
    const t = process.env.MAIL_TRANSPORT ?? 'log';
    return t === 'smtp' || t === 'resend' ? t : 'log';
  },
  get smtpUrl() {
    return process.env.SMTP_URL ?? 'smtp://localhost:1025';
  },
  get mailFrom() {
    return process.env.MAIL_FROM ?? 'Orqivanta <hello@orqivanta.local>';
  },
  get resendApiKey() {
    return process.env.RESEND_API_KEY ?? '';
  },
  get storageDir() {
    // Relative paths resolve from the repository root, so the web app, worker and seed share one folder.
    return path.resolve(workspaceRoot(), process.env.STORAGE_DIR ?? '.storage');
  },
  get maxUploadBytes() {
    return Number(process.env.MAX_UPLOAD_MB ?? 25) * 1024 * 1024;
  },
  sessionDays: 30,
  /** Sessions idle longer than this are rejected even before expiry. */
  sessionIdleDays: 14,
  invitationDays: 7,
  verifyEmailHours: 48,
  resetPasswordMinutes: 60,
};

let root: string | undefined;
function workspaceRoot() {
  if (root) return root;
  let dir = process.cwd();
  while (!existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
    const up = path.dirname(dir);
    if (up === dir) return (root = process.cwd());
    dir = up;
  }
  return (root = dir);
}
