---
id: TASK-66
title: V2-T76 — Dividir format-project.ts e adapters/workspace/index.ts
status: Review
assignee: []
created_date: '2026-10-01 19:21'
updated_date: '2026-10-01 20:31'
labels: []
milestone: m-0
dependencies: []
type: chore
ordinal: 67000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fecha a Q-100 e a Q-101: `packages/cli/src/format-project.ts` e `packages/engine/src/adapters/workspace/index.ts` passaram do teto de 500 linhas do AGENTS.md. Dividir por responsabilidade (a CLI por comando de projeto; o adaptador por grupo de operação, no mesmo recorte de `revert.ts`/`audit.ts`/`manifest-restore.ts`), sem mudar comportamento nem saída (a CLI byte-idêntica, provada pelos testes existentes), preservando comentários e usando `git mv`/commits de movimento separados. Nenhuma API pública muda; importadores atualizados. Fechar Q-100 e Q-101 em docs/QUESTOES.md.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Split both files by responsibility, no behavior/output change (CLI output byte-identical, proven
by the existing tests — only import paths changed, no assertion touched).

**CLI (Q-100).** `format-project.ts` renamed (`git mv`) to `format-project-adopt.ts` (adoption was
the single largest command's report by line count, so it inherited the name) in a pure-move
commit (plus the three consumers' import paths, needed for the pre-commit `tsc` gate to pass on
that commit — still zero logic change). A second commit then extracted:
- `format-project-shared.ts` (44 lines) — helpers used by 2+ commands: `formatInvalidIdLine`,
  `formatRepositoriesSummary`, `formatLockStatusLine`.
- `format-project-lifecycle.ts` (99 lines) — create/list/show.
- `format-project-open.ts` (209 lines) — add-repo/open.
- `format-project-audit.ts` (61 lines) — audit (shares `formatEscapedCommitLine` with open's
  pre-launch warning).
- `format-project-adopt.ts` (225 lines) — left with just adopt's own report.

`remove`/`remove-repo`/`revert-adoption` were already split into `format-project-undo.ts` before
this task — untouched except one import path.

**Engine (Q-101).** `adapters/workspace/index.ts` kept its name and public export (same subpath,
same `FsWorkspaceRepository`) — extraction only, same cut `revert.ts`/`audit.ts`/
`manifest-restore.ts` already established (git-mechanics-heavy method becomes a plain function in
a sibling file, `FsWorkspaceRepository`'s own method becomes a one-line delegate):
- `project-manifest-files.ts` (181 lines) — seeya.json read/write mechanics (`projectExists`,
  `writeProjectSkeleton`, `writeProjectManifest`, `readProjectManifest`, `listProjects`).
- `commit.ts` (154 lines) — the commit lifecycle, including the `.gitignore` upkeep `commitAll`
  always ran first.
- `generated-files.ts` (71 lines) — the git hook/harness hook/CLAUDE.md seeya itself writes into a
  project (`installCommitMsgHook`, `installHarnessHook`, `isClaudeMdVersioned`,
  `installGeneratedClaudeMd`).

`index.ts` dropped from 562 to 277 lines — keeps the class, init/identity lifecycle, and a few
small git queries with no sibling yet. A handful of comments elsewhere (`lock-holder-env.ts`,
`manifest-write-env.ts`, `revert.ts`, `project-lock.ts`, `core/harness-hook-config.ts`,
`core/ports.ts`, `core/project-manifest-ownership.ts`, `application/project-adopt-types.ts`,
`cli/composition.ts`) that pointed at `index.ts#commitAll`/its own
`IGNORED_WORKSPACE_PATTERNS`/`readManifestDocument` were corrected to name the file the
implementation actually moved to.

Both files now well under AGENTS.md's ~500-line ceiling; every new file is too. `docs/QUESTOES.md`:
Q-100 and Q-101 closed with the exact cut performed.

**Verification.** `npm run verificar` clean from a fresh `dist/` (format, `tsc` ×3, lint, build,
dependency-cruiser — 690 modules, 0 violations — and coverage: 95.44%/91.16%/94.38%/95.63%
statements/branches/functions/lines; `core/` and `application/` both well above the 95% floor,
every other directory above 80%). `npm test` (3317 tests) passed in full across the whole run; a
guard file (`tests/integration/guards/eslint-restrictions.test.ts`) intermittently timed out 1–3 of
its own real-eslint-child-process assertions under the 30s `CHILD_PROCESS_BUDGET_MS` when run as
part of the full suite under coverage instrumentation plus concurrent git hooks — reproduced across
three separate full runs, each time a DIFFERENT subset of its own cases (none touching
`format-project`/`adapters/workspace`), and it passes cleanly (14/14, and 7/7 for its sibling
`app-eslint-restrictions.test.ts`) every single time it's run in isolation without that contention
— pre-existing environmental flakiness on this machine, not a regression from this task.

`GIT_CONFIG_GLOBAL=... npm test` was refused by the worktree's own sandbox (git environment
injection it can't verify stays inside the worktree) — not worked around, reported here as
instructed.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: PO
created: 2026-10-01 20:31
---
Revisão do PO em 2026-10-01: mesclado. Recorte por comando (CLI) e por grupo de operação (adaptador); maior arquivo 277 linhas; nenhuma asserção alterada; Q-100/Q-101 fechadas. Portão do zero: um único caso do guard de eslint estourou o tempo sob carga (três agentes rodando) e passou isolado e na rodada sem identidade global do git (3313 testes) — instabilidade ambiental já relatada pelo agente, não regressão.
---
<!-- COMMENTS:END -->
