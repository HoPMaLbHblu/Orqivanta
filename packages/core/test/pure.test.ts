import { describe, expect, it } from 'vitest';
import { AppError } from '../src/errors';
import { extractMentions, isSafeUrl, plainToRichText, richTextToPlain, sanitizeRichText } from '../src/lib/richtext';
import { evaluateApproval } from '../src/services/approvals-core';
import { toCsv } from '../src/services/reports';
import { toPrefixQuery } from '../src/services/search';

describe('approval rules', () => {
  it('"all" needs every reviewer', () => {
    expect(evaluateApproval('all', ['approved', null])).toBe('pending');
    expect(evaluateApproval('all', ['approved', 'approved'])).toBe('approved');
    expect(evaluateApproval('all', ['approved', 'changes_requested'])).toBe('changes_requested');
    expect(evaluateApproval('all', ['changes_requested', 'rejected'])).toBe('rejected');
  });

  it('"any" approves on the first approval', () => {
    expect(evaluateApproval('any', [null, 'approved'])).toBe('approved');
    expect(evaluateApproval('any', ['rejected', null])).toBe('pending');
    expect(evaluateApproval('any', ['rejected', 'changes_requested'])).toBe('changes_requested');
    expect(evaluateApproval('any', ['rejected', 'rejected'])).toBe('rejected');
  });

  it('stays pending with no reviewers', () => {
    expect(evaluateApproval('all', [])).toBe('pending');
    expect(evaluateApproval('any', [])).toBe('pending');
  });
});

describe('rich text sanitizing', () => {
  it('drops unknown nodes, marks and attributes', () => {
    const out = sanitizeRichText({
      type: 'doc',
      content: [
        { type: 'script', content: [{ type: 'text', text: 'alert(1)' }] },
        { type: 'paragraph', attrs: { onclick: 'x' }, content: [{ type: 'text', text: 'hi', marks: [{ type: 'bold' }, { type: 'evil' }] }] },
      ],
    });
    const json = JSON.stringify(out);
    expect(json).not.toContain('script');
    expect(json).not.toContain('onclick');
    expect(json).not.toContain('evil');
    expect(json).toContain('bold');
  });

  it('removes unsafe links', () => {
    const out = sanitizeRichText({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }],
    });
    expect(JSON.stringify(out)).not.toContain('javascript');
    expect(isSafeUrl('https://example.com')).toBe(true);
    expect(isSafeUrl('/northwind/tasks/HPC-1')).toBe(true);
    expect(isSafeUrl('//evil.example')).toBe(false);
    expect(isSafeUrl('data:text/html,hi')).toBe(false);
  });

  it('rejects things that are not documents', () => {
    expect(() => sanitizeRichText({ type: 'paragraph' })).toThrow(AppError);
  });

  it('round-trips plain text and finds mentions', () => {
    const d = plainToRichText('First paragraph\n\nSecond');
    expect(richTextToPlain(d)).toContain('Second');
    const id = '7f6f52a0-2582-428b-ad31-f74d1ce43b70';
    const mention = (mid: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'mention', attrs: { id: mid, label: 'Leo' } }] }] });
    expect(extractMentions(sanitizeRichText(mention(id)))).toEqual([id]);
    // Mentions must point at a real id format; anything else is dropped.
    expect(extractMentions(sanitizeRichText(mention('not-a-user')))).toEqual([]);
  });
});

describe('search queries', () => {
  it('turns words into prefix terms and strips operators', () => {
    expect(toPrefixQuery('Home page')).toBe('home:* & page:*');
    expect(toPrefixQuery("menu & !drop | ('x')")).toBe('menu:* & drop:* & x:*');
    expect(toPrefixQuery('   ')).toBeNull();
    expect(toPrefixQuery('кофе')).toBe('кофе:*');
  });
});

describe('CSV export', () => {
  it('quotes values and neutralizes formulas', () => {
    const csv = toCsv([{ name: 'A, B', note: '=HYPERLINK("x")', n: 3 }]);
    expect(csv).toBe('name,note,n\n"A, B","\'=HYPERLINK(""x"")",3\n');
  });
});
