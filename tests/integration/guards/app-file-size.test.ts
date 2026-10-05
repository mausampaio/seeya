import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { APP_SRC_ROOT, PROJECT_ROOT } from './_support.js';

/**
 * V2-T51: no source file of `packages/app/src` goes past 500 lines (AGENTS.md § "Estilo de código":
 * "Arquivo: abaixo de 500 linhas"). Before this task `main/main.ts` alone had 3622 lines, and the
 * rule was only a sentence — nothing failed when a file crossed it, so the next task that needed a
 * new `SEEYA_APP_*` flag simply appended to the pile. A file that wants to grow past the limit has
 * gained a second responsibility: split it (the way `main/verification/`, `ipc/channel-types-*.ts`,
 * `composition/*` and `text/messages-*.ts` were) instead of raising the number here.
 *
 * No exceptions list: the whole tree was under the limit when this guard landed. Where this
 * guard stops: it counts physical lines, so it cannot tell a dense 500-line file from a sparse one
 * — it covers "this file keeps growing", not "this file is well designed".
 */

/** The limit AGENTS.md states: "abaixo de 500 linhas" — a file of exactly 500 passes, 501 fails. */
const MAX_LINES = 500;

const CHECKED_EXTENSIONS = ['.ts', '.tsx', '.css'];

interface OversizedFile {
  readonly path: string;
  readonly lines: number;
}

function countLines(content: string): number {
  if (content === '') {
    return 0;
  }
  const lines = content.split('\n').length;
  return content.endsWith('\n') ? lines - 1 : lines;
}

function listCheckedFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return listCheckedFiles(fullPath);
    }
    return CHECKED_EXTENSIONS.includes(path.extname(entry.name)) ? [fullPath] : [];
  });
}

/** Every checked file under `directory` with more than `maxLines` lines, longest first. */
function findOversizedFiles(directory: string, maxLines: number): OversizedFile[] {
  return listCheckedFiles(directory)
    .map((filePath) => ({
      path: filePath,
      lines: countLines(fs.readFileSync(filePath, 'utf8')),
    }))
    .filter((file) => file.lines > maxLines)
    .sort((left, right) => right.lines - left.lines);
}

function describeOversized(files: readonly OversizedFile[], root: string): string {
  return files
    .map((file) => `${path.relative(root, file.path)}: ${file.lines} lines (limit ${MAX_LINES})`)
    .join('\n');
}

describe('packages/app/src file size (V2-T51)', () => {
  describe('the real tree', () => {
    it('has no source file over 500 lines', () => {
      const appSrc = path.join(PROJECT_ROOT, APP_SRC_ROOT);
      const oversized = findOversizedFiles(appSrc, MAX_LINES);
      expect(describeOversized(oversized, PROJECT_ROOT)).toBe('');
    });
  });

  describe('the guard itself', () => {
    let scratchDirectory: string;

    beforeEach(() => {
      scratchDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'seeya-file-size-guard-'));
    });

    afterEach(() => {
      fs.rmSync(scratchDirectory, { recursive: true, force: true });
    });

    function writeLines(relativePath: string, lineCount: number): void {
      const fullPath = path.join(scratchDirectory, relativePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, 'const x = 1;\n'.repeat(lineCount));
    }

    it('accepts a file of exactly 500 lines (the allowed boundary)', () => {
      writeLines('exactly-limit.ts', 500);
      expect(findOversizedFiles(scratchDirectory, MAX_LINES)).toEqual([]);
    });

    it('rejects a file of 501 lines and names it with its line count', () => {
      writeLines('nested/too-long.tsx', 501);
      writeLines('short.ts', 3);
      const oversized = findOversizedFiles(scratchDirectory, MAX_LINES);
      expect(describeOversized(oversized, scratchDirectory)).toBe(
        `${path.join('nested', 'too-long.tsx')}: 501 lines (limit 500)`,
      );
    });

    it('ignores files whose extension is not checked', () => {
      writeLines('data.json', 900);
      expect(findOversizedFiles(scratchDirectory, MAX_LINES)).toEqual([]);
    });

    it('counts a last line with no trailing newline', () => {
      const fullPath = path.join(scratchDirectory, 'no-final-newline.ts');
      fs.writeFileSync(fullPath, 'x\n'.repeat(500) + 'y');
      expect(findOversizedFiles(scratchDirectory, MAX_LINES).map((file) => file.lines)).toEqual([
        501,
      ]);
    });
  });
});
