import { describe, expect, it } from 'vitest';
import { summarizeErrorReason } from '../../../../packages/app/src/state/error-reason-summary.js';

describe('summarizeErrorReason (V2-T69 PO review rounds 1-2; moved to a neutral name by V2-T67 PO review)', () => {
  it('a short reason with no home path passes through unchanged, fullText identical', () => {
    const result = summarizeErrorReason('claude binary not found', '/home/x', 'posix');
    expect(result).toEqual({
      text: 'claude binary not found',
      fullText: 'claude binary not found',
    });
  });

  // PO review round 2 (item 2): abbreviation now goes through `collapseHomeDirectory`, never a
  // third implementation — the real `CaptureFailure` shape this module exists for always has the
  // path LEADING the message (`adapters/storage/index.ts`'s own `${filePath} is not valid JSON:
  // ...`), which is exactly what `collapseHomeDirectory` matches (a whole-string prefix).
  it('abbreviates the home-rooted path that leads the message, posix', () => {
    const reason = '/home/x/.seeya/days/x.json is not valid JSON: SyntaxError';
    const result = summarizeErrorReason(reason, '/home/x', 'posix');
    expect(result.text).toBe('~/.seeya/days/x.json is not valid JSON: SyntaxError');
    expect(result.fullText).toBe(reason);
  });

  // Where this guard rail ends (AGENTS.md: "diga onde o guarda-corpo termina"): `collapseHomeDirectory`
  // only matches a prefix of the WHOLE string — a home-rooted path embedded further inside the
  // sentence (not at the start) passes through unabbreviated, never garbled. No known
  // `CaptureFailure` shape in this codebase does this today (the path always leads), so this is a
  // documented limitation, not an observed defect.
  it('a home-rooted path that is NOT at the start of the message is left unabbreviated', () => {
    const reason = 'while reading /home/x/.seeya/days/x.json: unexpected token';
    const result = summarizeErrorReason(reason, '/home/x', 'posix');
    expect(result.text).toBe(reason);
    expect(result.fullText).toBe(reason);
  });

  it('abbreviates homeDir case-insensitively on win32 (Windows paths are case-insensitive)', () => {
    const reason = 'C:\\Users\\x\\.seeya\\days\\x.json is not valid JSON';
    const result = summarizeErrorReason(reason, 'c:\\users\\x', 'win32');
    expect(result.text).toBe('~\\.seeya\\days\\x.json is not valid JSON');
  });

  it('never abbreviates on posix with a different case (posix paths ARE case-sensitive)', () => {
    const reason = '/Home/X/.seeya/days/x.json is not valid JSON';
    const result = summarizeErrorReason(reason, '/home/x', 'posix');
    expect(result.text).toBe(reason);
  });

  it('truncates a long abbreviated message with an ellipsis, keeping the full text intact', () => {
    const longTail = 'is not valid JSON: '.padEnd(120, 'x');
    const reason = `/home/x/.seeya/days/2026-09-30/sessions/s1.json ${longTail}`;
    const result = summarizeErrorReason(reason, '/home/x', 'posix');
    expect(result.text.length).toBe(100);
    expect(result.text.endsWith('…')).toBe(true);
    expect(result.text.startsWith('~/.seeya/days/')).toBe(true);
    expect(result.fullText).toBe(reason);
  });

  it('an empty homeDir never rewrites anything (never abbreviates against an unknown home)', () => {
    const reason = '/home/x/.seeya/days/x.json is not valid JSON';
    const result = summarizeErrorReason(reason, '', 'posix');
    expect(result.text).toBe(reason);
  });

  it('a reason exactly at the length threshold is left untouched (boundary)', () => {
    const reason = 'x'.repeat(100);
    const result = summarizeErrorReason(reason, '/home/x', 'posix');
    expect(result.text).toBe(reason);
    expect(result.text.endsWith('…')).toBe(false);
  });

  it('a reason one character past the threshold is truncated (boundary)', () => {
    const reason = 'x'.repeat(101);
    const result = summarizeErrorReason(reason, '/home/x', 'posix');
    expect(result.text).toHaveLength(100);
    expect(result.text.endsWith('…')).toBe(true);
  });
});
