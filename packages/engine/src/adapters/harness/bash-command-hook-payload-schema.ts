/**
 * The `PreToolUse` hook payload Claude Code pipes to `seeya project verify-bash-command` on stdin
 * (`https://code.claude.com/docs/en/hooks.md`) — external, untrusted-shape data, so it goes through
 * a schema before this project reads anything out of it (AGENTS.md § "Dados de fora"). Tolerant of
 * everything except the one field this hook actually reads: `tool_input.command`.
 */
import { z } from 'zod';

const payloadSchema = z
  .object({
    tool_input: z
      .object({
        command: z.string(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

/**
 * `null` for anything that doesn't parse as JSON, doesn't match the schema, or parses but carries
 * no `tool_input.command` string — same "never block on a payload we can't judge" fallback the
 * hook itself already applies (D-025: absence of a readable command is not evidence of a forbidden
 * one).
 *
 * @example
 * parseBashCommandFromHookPayload('{"tool_name":"Bash","tool_input":{"command":"git commit"}}')
 * // 'git commit'
 * parseBashCommandFromHookPayload('not json')
 * // null
 */
export function parseBashCommandFromHookPayload(raw: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = payloadSchema.safeParse(parsed);
  if (!result.success) {
    return null;
  }
  return result.data.tool_input?.command ?? null;
}
