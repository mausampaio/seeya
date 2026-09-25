/**
 * V2-T27: the content of a freshly created, empty project — `docs/PLANO-DE-ENTREGA.md`'s own
 * words: "o conteúdo inicial é curto e honesto: diz o que é o projeto, que está vazio, e por onde
 * um agente deve começar. Nada de texto inventado sobre o trabalho — quem preenche é a V2-T29 ou
 * a pessoa." Pure and in `core/`: nothing here reads a clock or touches disk, only strings built
 * from `projectId` — `adapters/workspace/index.ts#FsWorkspaceRepository.writeProjectSkeleton` is
 * what actually writes the result.
 *
 * **English, not Portuguese (D-028/D-033).** This text is `seeya`'s own frame — nobody's session
 * content is in it yet — and D-033 draws exactly this line: "a moldura é nossa e é pública:
 * inglês... o conteúdo gerado espelha o idioma da sessão" applies to model-generated
 * `understanding`/`pendingItems`/`tomorrowPlan`, never to a static template `seeya` writes itself.
 * A later session filling `status/`/`decisions/` is free to write in whatever language the work
 * happens in — this skeleton doesn't constrain that.
 *
 * **Only `AGENTS.md` — no `CLAUDE.md` (D-030, V2-T44).** An earlier version of this skeleton also
 * wrote a one-line `CLAUDE.md` pointing at `AGENTS.md`, on the theory that harness-specific files
 * are a convention worth mirroring. That was a `core/` module writing a file path that names a
 * specific harness — exactly what D-030's third consequence rules out ("o núcleo pode citar um
 * harness em texto para humano; nunca em... caminho de arquivo"). The maintainer also measured
 * that it doesn't buy anything today: the current Claude Code already reads `AGENTS.md` directly,
 * so the pointer file has no reader left to serve. Projects created before this fix keep whatever
 * `CLAUDE.md` they already have — `seeya` never deletes a file a person might have edited.
 *
 * **`AGENTS.md` names the project by id, and carries a "Working in this project" section
 * (V2-T34 item 6).** Found by the maintainer's own test that motivated this task: a session called
 * its project "the seeya project," generic, because that's literally what the old text said — and
 * separately rewrote `AGENTS.md` entirely during an adoption, which is exactly why the SAME rules
 * are also delivered live on every `open` (`core/project-working-rules.ts`'s own docstring on why
 * one static file was never going to be enough on its own). This section is a summary for a person
 * reading the file, or a session that hasn't been told yet (before the first `open`) — the one
 * source that "valer sempre" actually depends on is the live delivery.
 *
 * **The Claude Code project hook (V2-T34 item 2, `core/harness-hook-config.ts`) is NOT written
 * here.** An earlier version of this skeleton wrote a static `.claude/settings.json` here, once, at
 * creation time — the maintainer's own review found that wrong on two counts (embedding a `node`
 * dependency the harness might not have, and baking a machine-specific absolute `seeya` path into
 * TRACKED content that would go stale). `application/harness-hook.ts#ensureHarnessHookInstalled`
 * writes it fresh at the start of every `openProject` instead — never committed, same "reinstalled
 * by every open" discipline `core/workspace-hooks.ts`'s own git hook already has — so it's simply
 * not part of this skeleton at all (`core/harness-hook-config.ts`'s own docstring has the full
 * story).
 */
import type { ProjectManifest, ProjectSkeleton, WorkspaceProjectFile } from './types.js';
import { buildProjectWorkingRulesText } from './project-working-rules.js';

/** `docs/V2-RUMO.md` § "Projeto persistente" — the six subdirectories every project starts with,
 * even though each is empty until `pause`/`checkpoint` (later tasks) or a person writes into one. */
const PROJECT_DIRECTORIES: readonly string[] = [
  'context',
  'decisions',
  'plans',
  'status',
  'journal',
  'references',
];

function buildAgentsMd(projectId: string): string {
  return (
    `# ${projectId}\n\n` +
    `This is seeya project "${projectId}": a context repository for one line of work, ` +
    'independent of any single Claude Code, Codex, Gemini or other harness session (see ' +
    'seeya.json for the machine-readable record).\n\n' +
    'Start at INDEX.md.\n\n' +
    '## Layout\n\n' +
    '- `context/` — system, constraints, glossary\n' +
    '- `decisions/` — decisions and why, including superseded ones\n' +
    '- `plans/` — current plan and backlog\n' +
    '- `status/` — current state, open questions, resume point\n' +
    '- `journal/` — what each session/close produced\n' +
    '- `references/` — associated repositories and trackers\n\n' +
    '## Working in this project\n\n' +
    `${buildProjectWorkingRulesText(projectId)}\n\n` +
    'This project was just created and has no content yet beyond this skeleton.\n'
  );
}

function buildIndexMd(projectId: string): string {
  return (
    `# ${projectId}\n\n` +
    'Empty project, just created by "seeya project create". No decisions, plan or status ' +
    'recorded yet.\n\n' +
    'Read AGENTS.md for how this project is organized, then start filling `status/` with what ' +
    'this project is about and what the next step is.\n'
  );
}

/**
 * @example
 * const skeleton = buildProjectSkeleton('auth-hardening');
 * skeleton.manifest.id; // 'auth-hardening'
 * skeleton.files.map((f) => f.relativePath); // ['AGENTS.md', 'INDEX.md']
 *
 * Callers are expected to have already validated `projectId` with
 * `core/project-id.ts#isValidProjectId` — this function doesn't re-check it (it only builds
 * strings, never touches a filesystem, so an invalid id here is a caller bug, not a runtime
 * failure this function is positioned to catch).
 */
export function buildProjectSkeleton(projectId: string): ProjectSkeleton {
  const manifest: ProjectManifest = {
    id: projectId,
    // No separate display name is collected at creation time (`seeya project create <id>` takes
    // only the id) — the id itself, verbatim, is the least-invented value to start from (D-025):
    // it's what the person typed, not a guess about what the project is "really" called.
    name: projectId,
    defaultHarness: null,
    repositories: [],
    trackers: [],
  };
  const files: WorkspaceProjectFile[] = [
    { relativePath: 'AGENTS.md', content: buildAgentsMd(projectId) },
    { relativePath: 'INDEX.md', content: buildIndexMd(projectId) },
  ];
  return { manifest, files, directories: PROJECT_DIRECTORIES };
}
