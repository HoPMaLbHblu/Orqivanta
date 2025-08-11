import nodemailer from 'nodemailer';
import { emailLog, outbox, withSystem, type Tx } from '@orqivanta/db';
import { config } from '../config';
import { renderEmail, type EmailTemplate, type Locale } from './templates';

export type EmailJob = EmailTemplate & { to: string; locale?: Locale };

/** Records an email in the transactional outbox. It is sent only if the transaction commits. */
export async function queueEmail(tx: Tx, job: EmailJob, orgId: string | null = null) {
  await tx.insert(outbox).values({ orgId, type: 'email', payload: job as unknown as Record<string, unknown> });
}

let transporter: nodemailer.Transporter | null = null;

/** Delivers one email. Called by the worker; every attempt is copied to email_log. */
export async function deliverEmail(job: EmailJob): Promise<void> {
  const rendered = renderEmail(job, job.locale ?? 'en');
  const transport = config.mailTransport;
  let status = 'sent';
  let error: string | null = null;
  try {
    if (transport === 'smtp') {
      transporter ??= nodemailer.createTransport(config.smtpUrl);
      await transporter.sendMail({ from: config.mailFrom, to: job.to, subject: rendered.subject, html: rendered.html, text: rendered.text });
    } else if (transport === 'resend') {
      if (!config.resendApiKey) throw new Error('RESEND_API_KEY is not configured');
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: config.mailFrom, to: [job.to], subject: rendered.subject, html: rendered.html, text: rendered.text }),
      });
      if (!res.ok) throw new Error(`Resend responded ${res.status}`);
    } else {
      status = 'logged';
    }
  } catch (err) {
    status = 'failed';
    error = err instanceof Error ? err.message : String(err);
  }
  await withSystem((tx) =>
    tx.insert(emailLog).values({ to: job.to, subject: rendered.subject, html: rendered.html, text: rendered.text, transport, status, error }),
  );
  if (status === 'failed') throw new Error(error ?? 'Email delivery failed');
}
