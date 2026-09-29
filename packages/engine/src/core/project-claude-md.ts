/**
 * D-050/V2-T61: the text of the `CLAUDE.md` bridge every `seeya project open` (re)writes for a
 * project. Pure and in `core/` — same split `core/harness-hook-config.ts` already draws for the
 * OTHER Claude-Code-specific project file this project generates: the CONTENT lives here, the
 * actual file PATH (`<root>/<projectId>/CLAUDE.md`) is a decision made only where the write
 * happens (`adapters/workspace/index.ts#FsWorkspaceRepository.installGeneratedClaudeMd`) — D-030's
 * own line, "o núcleo pode citar um harness em texto para humano; nunca em... caminho de arquivo,"
 * applies to this text exactly the way it already applies to `harness-hook-config.ts`'s own
 * `.claude/settings.json` content.
 *
 * **Why this exists at all, on top of `AGENTS.md` (D-030, V2-T44).** The V2-T44 decision removed
 * `CLAUDE.md` from the project skeleton because the current Claude Code already reads `AGENTS.md`
 * directly at the start of a session. What stayed undocumented (`docs/spikes/
 * O-gancho-antes-da-compactacao.md`'s own "silêncio relevante") is what happens to `AGENTS.md`
 * AFTER a compaction: Claude Code's own documentation guarantees only that the root `CLAUDE.md` is
 * reread from disk and reinjected post-compaction — nothing is written about `AGENTS.md` doing the
 * same. D-050 closes that gap with the smallest possible bridge: a `CLAUDE.md` whose entire content
 * is the `@AGENTS.md` import, so `AGENTS.md` keeps being the one place the content actually lives
 * (D-030: "o `AGENTS.md` continua sendo a fonte").
 *
 * **The second part, `## Compact Instructions`, is the documented mechanism for steering a
 * compaction summary** (same spike, its own "Complemento: leitura de documentação" appendix,
 * `https://code.claude.com/docs/en/memory.md`) — not a hook, not code that runs, just text the
 * summarizing model is told to read. `docs/spikes/O-gancho-antes-da-compactacao.md`'s own findings
 * (pergunta 1) already measured that a `PreCompact` hook never makes a session act on an
 * instruction; this section makes no stronger a claim than "orienta o resumo, não o obriga"
 * (D-050's own "Onde o guarda-corpo termina").
 *
 * Regenerated on every `open`, never hand-edited (`application/claude-md-bridge.ts`'s own
 * docstring) — a project with its OWN, already-versioned `CLAUDE.md` (predating V2-T44) is never
 * touched by this (item 2's own "não sobrescreve nem apaga").
 */

/** The whole point of the import line: the ONE place `AGENTS.md`'s content lives stays `AGENTS.md`
 * itself (D-030) — this file never repeats or paraphrases it. */
const AGENTS_MD_IMPORT_LINE = '@AGENTS.md';

/**
 * @example
 * buildGeneratedClaudeMd().startsWith('@AGENTS.md') // true
 * buildGeneratedClaudeMd().includes('## Compact Instructions') // true
 * buildGeneratedClaudeMd().length < 1500 // true — short, D-050's own "Curta"
 */
export function buildGeneratedClaudeMd(): string {
  return (
    `${AGENTS_MD_IMPORT_LINE}\n\n` +
    '## Compact Instructions\n\n' +
    'When summarizing this conversation, keep:\n' +
    '- the task currently in progress and the next step;\n' +
    '- decisions made this session that are not yet written into `decisions/`;\n' +
    '- files changed but not yet committed;\n' +
    '- anything learned about tools, access or environment that is not yet in ' +
    '`context/know-how.md`.\n\n' +
    'After compacting, re-read `INDEX.md` and `status/` before continuing.\n'
  );
}
