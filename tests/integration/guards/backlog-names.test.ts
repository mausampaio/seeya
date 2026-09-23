import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PROJECT_ROOT } from './_support.js';

/**
 * D-048: the tasks and decisions live as one Markdown file each under `backlog/`, and Backlog.md
 * derives the FILE NAME from the title. Measured on this project's own Windows machine
 * (2026-09-23): a title written as a full sentence produced a 204-character file name, and
 * `git worktree add` — how every agent gets its isolated copy — failed outright with
 * `Filename too long` before a single line of work could start. `core.longpaths` is set now, but
 * the real fix is the one the maintainer asked for: a title is a NAME, and the sentence belongs in
 * the description.
 *
 * This guard exists because a rule that must always hold cannot depend on someone remembering it
 * (the maintainer's own principle, D-047 item 5): a title that creeps past the limit fails the gate
 * instead of surfacing months later as a path error on someone else's machine.
 *
 * The limits are deliberate, not arbitrary:
 * - **Title, 72 characters.** The longest title after the 2026-09-23 shortening pass was 68; 72
 *   leaves room for a slightly longer one without inviting a sentence back.
 * - **File name, 110 characters.** The longest was 79. A worktree path adds roughly 60 characters
 *   (`.claude/worktrees/agent-<id>/backlog/tasks/`) on top of the repository root, which keeps the
 *   whole path far from the 260-character ceiling Windows applies by default.
 */
const TITLE_LIMIT = 72;
const FILE_NAME_LIMIT = 110;

const BACKLOG_DIRECTORIES = ['tasks', 'decisions', 'docs', 'drafts', 'milestones'] as const;

interface BacklogFile {
  readonly directory: string;
  readonly fileName: string;
  readonly title: string;
}

function readTitle(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf8');
  const match = /^title:\s*(.+)$/m.exec(content);
  // Backlog.md quotes the title in YAML whenever it contains a character that would need it (a
  // colon, a `+`), with single or double quotes depending on the value — the quotes are the
  // format's, never part of the name.
  return (match?.[1]?.trim() ?? '').replace(/^['"]|['"]$/g, '');
}

function listBacklogFiles(): readonly BacklogFile[] {
  return BACKLOG_DIRECTORIES.flatMap((directory) => {
    const full = path.join(PROJECT_ROOT, 'backlog', directory);
    if (!fs.existsSync(full)) {
      return [];
    }
    return fs
      .readdirSync(full)
      .filter((fileName) => fileName.endsWith('.md'))
      .map((fileName) => ({
        directory,
        fileName,
        title: readTitle(path.join(full, fileName)),
      }));
  });
}

describe('backlog file and title names (D-048)', () => {
  const files = listBacklogFiles();

  it('finds backlog files to check — a silent empty pass would prove nothing', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it(`keeps every title at most ${String(TITLE_LIMIT)} characters`, () => {
    const tooLong = files
      .filter((file) => file.title.length > TITLE_LIMIT)
      .map((file) => `${file.directory}/${file.fileName}: ${String(file.title.length)} chars`);

    expect(tooLong, `titles over ${String(TITLE_LIMIT)} characters: ${tooLong.join('; ')}`).toEqual(
      [],
    );
  });

  it(`keeps every file name at most ${String(FILE_NAME_LIMIT)} characters`, () => {
    const tooLong = files
      .filter((file) => file.fileName.length > FILE_NAME_LIMIT)
      .map((file) => `${file.directory}/${file.fileName}: ${String(file.fileName.length)} chars`);

    expect(
      tooLong,
      `file names over ${String(FILE_NAME_LIMIT)} characters: ${tooLong.join('; ')}`,
    ).toEqual([]);
  });

  it('keeps the file name in sync with the title — Backlog.md renames neither on its own', () => {
    // Measured 2026-09-23: `backlog task edit <id> -t "<new title>"` rewrites the `title:` field and
    // leaves the file named after the OLD title. Renaming by hand (`git mv`) is part of retitling.
    const drifted = files
      .filter((file) => file.title !== '')
      .filter((file) => {
        // Compare with punctuation and case removed on both sides: Backlog.md builds the file name
        // from the title with its own rules (a `+` becomes a dash, a colon disappears), so an exact
        // slug match would fail on cosmetics instead of on a real drift.
        const normalize = (value: string): string =>
          value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
        return !normalize(file.fileName).includes(normalize(file.title));
      })
      .map((file) => `${file.directory}/${file.fileName} (title: ${file.title})`);

    expect(drifted, `file name and title disagree: ${drifted.join('; ')}`).toEqual([]);
  });
});
