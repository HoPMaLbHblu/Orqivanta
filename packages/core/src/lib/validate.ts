import { z } from 'zod';
import { validation } from '../errors';

/** Parses input with a zod schema, converting failures into a field-keyed VALIDATION error. */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_form';
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  throw validation(fieldErrors);
}

export const zEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'Email is too long.')
  .pipe(z.email('Enter a valid email address.'));

export const zPassword = z
  .string()
  .min(10, 'Use at least 10 characters.')
  .max(200, 'Use at most 200 characters.')
  .refine((v) => /[a-zA-Z]/.test(v) && /[^a-zA-Z]/.test(v), 'Mix letters with numbers or symbols.');

export const zName = (label = 'Name', max = 80) =>
  z.string().trim().min(1, `${label} is required.`).max(max, `${label} must be ${max} characters or fewer.`);

export const zUuid = z.uuid('Invalid identifier.');

export const zDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date.')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Use a valid date.');

export const zOptionalDate = z.union([zDate, z.literal(''), z.null()]).optional().transform((v) => v || null);

export const zSlug = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Use at least 3 characters.')
  .max(40, 'Use at most 40 characters.')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single dashes.');

export const RESERVED_SLUGS = new Set([
  'api', 'app', 'admin', 'account', 'auth', 'dev', 'demo', 'docs', 'help', 'invite', 'legal',
  'login', 'logout', 'onboarding', 'portal', 'pricing', 'product', 'settings', 'sign-in',
  'sign-up', 'signin', 'signup', 'static', 'status', 'support', 'www', 'about', 'contact',
  'changelog', 'agencies', 'client-portal', 'accessibility', 'verify-email', 'reset-password',
  'forgot-password', 'link-expired', '_next', 'robots.txt', 'sitemap.xml', 'favicon.ico', 'search',
]);
