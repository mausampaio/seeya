import { describe, expect, it } from 'vitest';
import { summarizeFailureReason } from '../../../../packages/app/src/state/end-day-failure-reason.js';

describe('summarizeFailureReason (V2-T69, PO review round 1 item 5)', () => {
  it('a short reason with no home path passes through unchanged, fullText identical', () => {
    const result = summarizeFailureReason('claude binary not found', '/home/x', 'posix');
    expect(result).toEqual({
      text: 'claude binary not found',
      fullText: 'claude binary not found',
    });
  });

  it('abbreviates every occurrence of homeDir with ~ on posix', () => {
    const reason = '/home/x/.seeya/days/x.json is not valid JSON, see /home/x/.seeya/config.json';
    const result = summarizeFailureReason(reason, '/home/x', 'posix');
    expect(result.text).toBe('~/.seeya/days/x.json is not valid JSON, see ~/.seeya/config.json');
    expect(result.fullText).toBe(reason);
  });

  it('abbreviates homeDir case-insensitively on win32 (Windows paths are case-insensitive)', () => {
    const reason = 'C:\\Users\\x\\.seeya\\days\\x.json is not valid JSON';
    const result = summarizeFailureReason(reason, 'c:\\users\\x', 'win32');
    expect(result.text).toBe('~\\.seeya\\days\\x.json is not valid JSON');
  });

  it('never abbreviates on posix with a different case (posix paths ARE case-sensitive)', () => {
    const reason = '/Home/X/.seeya/days/x.json is not valid JSON';
    const result = summarizeFailureReason(reason, '/home/x', 'posix');
    expect(result.text).toBe(reason);
  });

  it('truncates a long abbreviated message with an ellipsis, keeping the full text intact', () => {
    const longTail = 'is not valid JSON: '.padEnd(120, 'x');
    const reason = `/home/x/.seeya/days/2026-09-30/sessions/s1.json ${longTail}`;
    const result = summarizeFailureReason(reason, '/home/x', 'posix');
    expect(result.text.length).toBe(100);
    expect(result.text.endsWith('…')).toBe(true);
    expect(result.text.startsWith('~/.seeya/days/')).toBe(true);
    expect(result.fullText).toBe(reason);
  });

  it('an empty homeDir never rewrites anything (never abbreviates against an unknown home)', () => {
    const reason = '/home/x/.seeya/days/x.json is not valid JSON';
    const result = summarizeFailureReason(reason, '', 'posix');
    expect(result.text).toBe(reason);
  });

  it('a reason exactly at the length threshold is left untouched (boundary)', () => {
    const reason = 'x'.repeat(100);
    const result = summarizeFailureReason(reason, '/home/x', 'posix');
    expect(result.text).toBe(reason);
    expect(result.text.endsWith('…')).toBe(false);
  });

  it('a reason one character past the threshold is truncated (boundary)', () => {
    const reason = 'x'.repeat(101);
    const result = summarizeFailureReason(reason, '/home/x', 'posix');
    expect(result.text).toHaveLength(100);
    expect(result.text.endsWith('…')).toBe(true);
  });
});
