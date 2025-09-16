import { z } from 'zod';
import { contactMessages, withSystem } from '@orqivanta/db';
import { rateLimit } from '../lib/rate-limit';
import { parse, zEmail, zName } from '../lib/validate';

export const CONTACT_TOPICS = ['general', 'demo', 'feedback', 'accessibility', 'privacy'] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];

export const contactSchema = z.object({
  name: zName('Name', 120),
  email: zEmail,
  company: z
    .string()
    .trim()
    .max(160, 'Company must be 160 characters or fewer.')
    .optional()
    .transform((v) => v || null),
  topic: z.enum(CONTACT_TOPICS, 'Choose a topic.'),
  message: z
    .string()
    .trim()
    .min(10, 'Write at least 10 characters.')
    .max(5000, 'Message must be 5,000 characters or fewer.'),
  /** Honeypot: a field hidden from people. Bots that fill it are accepted silently and dropped. */
  website: z.string().max(500).optional(),
});

/**
 * Stores a message from the public contact form. Rate limited per IP and per email.
 * Submissions that fill the hidden honeypot field get the same response as real ones
 * but are never stored, so bots learn nothing.
 */
export async function submitContactMessage(input: unknown, meta: { ip?: string | null } = {}): Promise<{ received: true }> {
  const data = parse(contactSchema, input);
  await rateLimit(`contact:ip:${meta.ip ?? 'unknown'}`, 5, 3600);
  if (data.website && data.website.trim() !== '') return { received: true };
  await rateLimit(`contact:email:${data.email}`, 3, 3600);
  await withSystem((tx) =>
    tx.insert(contactMessages).values({
      name: data.name,
      email: data.email,
      company: data.company,
      topic: data.topic,
      message: data.message,
    }),
  );
  return { received: true };
}
