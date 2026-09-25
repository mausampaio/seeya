/**
 * `adapters/harness/bash-command-hook-payload-schema.ts` (V2-T34 item 2, PO review). Pure parsing.
 */
import { describe, expect, it } from 'vitest';
import { parseBashCommandFromHookPayload } from '@seeya-ai/engine/adapters/harness/bash-command-hook-payload-schema.js';

describe('parseBashCommandFromHookPayload', () => {
  it('extracts tool_input.command from a real-shaped PreToolUse payload', () => {
    const raw = JSON.stringify({
      session_id: 'abc',
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'git commit -m "x"', description: 'commit' },
    });
    expect(parseBashCommandFromHookPayload(raw)).toBe('git commit -m "x"');
  });

  it('tolerates unknown top-level fields (D-021)', () => {
    const raw = JSON.stringify({
      tool_input: { command: 'echo hi' },
      some_future_field: { nested: true },
    });
    expect(parseBashCommandFromHookPayload(raw)).toBe('echo hi');
  });

  it('is null for unparseable JSON — never blocks on a payload it cannot judge (D-025)', () => {
    expect(parseBashCommandFromHookPayload('not json at all')).toBeNull();
  });

  it('is null when tool_input is missing entirely', () => {
    expect(parseBashCommandFromHookPayload(JSON.stringify({ tool_name: 'Bash' }))).toBeNull();
  });

  it('is null when tool_input.command is missing or not a string', () => {
    expect(
      parseBashCommandFromHookPayload(JSON.stringify({ tool_input: { description: 'x' } })),
    ).toBeNull();
    expect(
      parseBashCommandFromHookPayload(JSON.stringify({ tool_input: { command: 42 } })),
    ).toBeNull();
  });
});
