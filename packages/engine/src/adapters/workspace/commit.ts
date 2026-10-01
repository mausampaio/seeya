/**
 * `WorkspaceRepository.commitAll`'s own git mechanics (V2-T76, Q-101) — split out of `index.ts`
 * the same way `revert.ts`/`audit.ts`/`manifest-restore.ts` already are: this file is about
 * committing a project's own pending change, including the `.gitignore` upkeep that has to happen
 * first. `FsWorkspaceRepository.commitAll` is left as a one-line delegate, same shape as
 * `findSessionCommits`/`revertCommits`/`listCommitsForAudit`/`restoreProjectManifestIfChanged`.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { LockHolderProcess } from '../../core/lock-holder-process.js';
import { runGit } from '../git/run-git.js';
import { writeFileAtomic } from '../storage/atomic-write.js';
import { isEnoent } from './fs-errors.js';
import { buildLockHolderEnv } from './lock-holder-env.js';
import { buildManifestWriteEnv } from './manifest-write-env.js';
import { PROJECT_LOCK_FILE_NAME } from './project-lock.js';
import { PROJECT_AUDIT_FILE_NAME } from './project-audit-marker.js';

/** `seeya`'s own author/committer identity for every commit it makes in the workspace — never the
 * operator's real `git config user.*` (this file's own module comment; same technique
 * `tests/integration/git/_fixtures.ts#commitAt` uses for the identical reason). `.localhost` is an
 * RFC 6761 reserved suffix — deliberately not a real, ownable address (`scripts/
 * verificar-termos-locais.mjs`'s own reserved-domain exception documents why that matters for a
 * value that lives in versioned source, not just in a test fixture).
 *
 * `SEEYA_IDENTITY_NAME`/`SEEYA_IDENTITY_EMAIL` (V2-T58, D-047 emendment): the same two values,
 * named separately so `index.ts#FsWorkspaceRepository.configureIdentity` can write them into the
 * repository's own LOCAL git config too — "num lugar só" (the task's own words), rather than a
 * second, independently spelled `'seeya'`/`'seeya@localhost'` pair. */
export const SEEYA_IDENTITY_NAME = 'seeya';
export const SEEYA_IDENTITY_EMAIL = 'seeya@localhost';

const COMMIT_IDENTITY_ENV: NodeJS.ProcessEnv = {
  GIT_AUTHOR_NAME: SEEYA_IDENTITY_NAME,
  GIT_AUTHOR_EMAIL: SEEYA_IDENTITY_EMAIL,
  GIT_COMMITTER_NAME: SEEYA_IDENTITY_NAME,
  GIT_COMMITTER_EMAIL: SEEYA_IDENTITY_EMAIL,
};

const GITIGNORE_FILE_NAME = '.gitignore';

/** V2-T34 item 3: `.seeya-audit` (the audit marker, `adapters/workspace/project-audit-marker.ts`)
 * is device bookkeeping, not project content — same "never committed" discipline as the lock file
 * right above it, and reasserted the exact same way, at the exact same call site.
 *
 * `**\/.claude/` (V2-T34 item 2, PO review): the Claude Code project hook config
 * (`core/harness-hook-config.ts`), regenerated fresh by every `openProject` — same reasoning, but a
 * DIRECTORY pattern, not a bare name: a plain `.claude/settings.json` line here would only match at
 * the workspace ROOT (git anchors any pattern containing a `/` to the `.gitignore`'s own
 * directory), never inside `<projectId>/.claude/settings.json` one level down. Confirmed for real:
 * `git status --porcelain --ignored=matching` against a disposable fixture with this exact line
 * reported `<project>/.claude/` as `!!` (ignored). */
const IGNORED_OPERATIONAL_FILE_NAMES: readonly string[] = [
  PROJECT_LOCK_FILE_NAME,
  PROJECT_AUDIT_FILE_NAME,
];
/** D-050/V2-T61: `CLAUDE.md` (bare, no slash — matches at any depth, the same rule
 * `PROJECT_LOCK_FILE_NAME` already relies on above, unlike `**\/.claude/`'s own directory-pattern
 * exception) — every project's own generated `CLAUDE.md` bridge is device/session bookkeeping the
 * same way the lock and audit marker are, never workspace content. A project whose `CLAUDE.md`
 * predates this task and is ALREADY tracked keeps being tracked regardless of this line — a
 * `.gitignore` pattern only stops git from adding a NEW, untracked file; it never un-tracks one git
 * already knows about (confirmed for real in `tests/integration/workspace/
 * fs-workspace-repository.test.ts`, same `git status --porcelain --ignored=matching` technique the
 * `.claude/` pattern above was confirmed with). */
const IGNORED_WORKSPACE_PATTERNS: readonly string[] = [
  ...IGNORED_OPERATIONAL_FILE_NAMES,
  '**/.claude/',
  'CLAUDE.md',
];

/**
 * D-047 item 2: "o lock nunca é commitado: entra no `.gitignore` do espaço de trabalho, criado ou
 * atualizado pelo próprio seeya." Called at the start of every `commitAll`, not only once at
 * `initialize()` — a workspace created before this task never got the line, and `.gitignore`
 * without a leading/trailing slash on `PROJECT_LOCK_FILE_NAME` matches that name at ANY depth
 * (git's own pattern rule), so one line covers every project's own `.seeya-lock`, present or
 * future. Idempotent: a `.gitignore` that already has the line is left untouched (no rewrite, no
 * extra commit).
 */
async function ensureWorkspaceGitignoreIgnoresProjectLock(root: string): Promise<void> {
  const gitignorePath = path.join(root, GITIGNORE_FILE_NAME);
  let current: string;
  try {
    current = await readFile(gitignorePath, 'utf8');
  } catch (error) {
    if (!isEnoent(error)) {
      throw new Error(`reading ${gitignorePath} failed: ${String(error)}`);
    }
    current = '';
  }
  const lines = current.split('\n').map((line) => line.trim());
  const missing = IGNORED_WORKSPACE_PATTERNS.filter((name) => !lines.includes(name));
  if (missing.length === 0) {
    return;
  }
  const withTrailingNewline =
    current.length === 0 || current.endsWith('\n') ? current : `${current}\n`;
  await writeFileAtomic(gitignorePath, `${withTrailingNewline}${missing.join('\n')}\n`);
}

export async function commitAll(
  root: string,
  projectId: string,
  message: string,
  lockHolder?: LockHolderProcess,
  manifestWriteAuthorized?: boolean,
): Promise<void> {
  // D-047 item 3's own bug fix: `git add <projectId> .gitignore`, never `-A` — a second
  // project's own pending change must never ride along on this commit (see this method's own
  // regression test, "commitAll only ever stages the one project it was called for").
  await ensureWorkspaceGitignoreIgnoresProjectLock(root);
  const add = await runGit(root, ['add', projectId, GITIGNORE_FILE_NAME]);
  if (!add.ran || add.exitCode !== 0) {
    throw new Error(
      `git add failed in workspace at "${root}": ${add.ran ? `exit ${add.exitCode}` : add.reason}`,
    );
  }
  // Exit 0: nothing staged differs from HEAD — a no-op, never an empty commit (this port's own
  // docstring on `commitAll`). Exit 1: something IS staged, proceed to commit. Anything else
  // (`ran: false`) is a real failure to surface.
  const diff = await runGit(root, ['diff', '--cached', '--quiet']);
  if (diff.ran && diff.exitCode === 0) {
    return;
  }
  if (!diff.ran) {
    throw new Error(`git diff failed in workspace at "${root}": ${diff.reason}`);
  }
  // V2-T34 hotfix (PO review, 2026-09-25): folds SEEYA_LOCK_HOLDER_PID/_PROC_START into the
  // commit's own env when `lockHolder` is given, so the workspace's own commit-msg hook can
  // authorize a commit `seeya` makes while holding this project's lock even though it never runs
  // inside a Claude Code session whose CLAUDE_CODE_SESSION_ID matches the lock's own sessionId.
  // V2-T73 item 1: folds SEEYA_MANIFEST_WRITE_AUTHORIZED into the commit's own env when this
  // call is one of seeya's own four legitimate writes to the project's `seeya.json` — the
  // workspace's own commit-msg hook refuses any OTHER commit that touches that path
  // (`core/workspace-commit-guard.ts`'s own new check), a session's edit riding along included.
  const commit = await runGit(root, ['commit', '-m', message], {
    ...process.env,
    ...COMMIT_IDENTITY_ENV,
    ...buildLockHolderEnv(lockHolder),
    ...buildManifestWriteEnv(manifestWriteAuthorized ?? false),
  });
  if (!commit.ran || commit.exitCode !== 0) {
    // V2-T34 production defect (PO review, 2026-09-25): the commit-msg hook's own refusal
    // reason (`core/workspace-commit-guard.ts#decideCommitGuard`) lands on git's stderr — the
    // ONE piece of information a caller (`seeya project open`/`adopt`/... ) needs to show the
    // person instead of a bare exit code nobody could act on. `run-git.ts#runGit` now captures
    // it; this is the one call site that actually writes a commit, so it's the one that matters.
    throw new Error(
      `git commit failed in workspace at "${root}": ` +
        `${commit.ran ? `exit ${commit.exitCode}: ${commit.stderr.trim()}` : commit.reason}`,
    );
  }
}
