/**
 * `collapseCwdRuns`/`readCwdHistory` (V2-T9 item 1). `FakeStorage`/`FakeDirectoryExistence` come
 * from `_fakes.ts`, same doubles the rest of `tests/unit/application` already uses
 * (docs/TESTES.md: "duplo de I/O é classe/objeto nomeado implementando a porta").
 *
 * `platformHint` is passed explicitly everywhere below, from BOTH `'win32'` and `'posix'` where it
 * matters (Q-079's own correction: an earlier version of this module read `process.platform`
 * directly, so its own case-folding example passed on Windows and failed on Linux —
 * `verificar:linux` caught it). Same discipline `tests/unit/core/cwd-normalization.test.ts`
 * already uses for the exact same reason.
 */
import { describe, expect, it } from 'vitest';
import { collapseCwdRuns, readCwdHistory } from '@seeya-ai/engine/application/cwd-history.js';
import { createHandoff } from '../core/_fixtures.js';
import { DEFAULT_TEST_CONFIG, FakeDirectoryExistence, FakeStorage } from './_fakes.js';

describe('collapseCwdRuns — the pure recorte', () => {
  it('a single directory across every sample collapses into one run', () => {
    const runs = collapseCwdRuns(
      [
        { day: '2026-09-12', cwd: 'C:\\code' },
        { day: '2026-09-14', cwd: 'C:\\code' },
      ],
      'win32',
    );
    expect(runs).toEqual([
      { cwd: 'C:\\code', firstDay: '2026-09-12', lastDay: '2026-09-14', exists: false },
    ]);
  });

  it('a change in directory produces two runs, the first keeping its own last day', () => {
    const runs = collapseCwdRuns(
      [
        { day: '2026-09-12', cwd: 'C:\\code' },
        { day: '2026-09-14', cwd: 'C:\\code' },
        { day: '2026-09-16', cwd: 'C:\\code\\seeya' },
      ],
      'win32',
    );
    expect(runs).toEqual([
      { cwd: 'C:\\code', firstDay: '2026-09-12', lastDay: '2026-09-14', exists: false },
      { cwd: 'C:\\code\\seeya', firstDay: '2026-09-16', lastDay: '2026-09-16', exists: false },
    ]);
  });

  /**
   * Two spellings of the same directory — separator AND case AND trailing slash all at once —
   * run against BOTH platform hints explicitly (docs/QUESTOES.md Q-079): `core/cwd-normalization.ts`
   * folds case only on `'win32'`, so the same pair of samples has to merge into one run on the
   * `'win32'` hint and stay two SEPARATE runs on `'posix'`. Exercising both from whichever OS this
   * suite happens to run on is what `cwd-normalization.test.ts` already does for the normalization
   * function itself — this is the same discipline applied to its one caller in this module.
   */
  it('two spellings of the same directory (separator/case/trailing slash) merge on win32...', () => {
    const runs = collapseCwdRuns(
      [
        { day: '2026-09-12', cwd: 'C:\\code\\project' },
        { day: '2026-09-14', cwd: 'c:/code/project/' },
      ],
      'win32',
    );
    expect(runs).toEqual([
      {
        cwd: 'C:\\code\\project',
        firstDay: '2026-09-12',
        lastDay: '2026-09-14',
        exists: false,
      },
    ]);
  });

  it('...but stay two separate runs on posix, where case is never folded', () => {
    const runs = collapseCwdRuns(
      [
        { day: '2026-09-12', cwd: 'C:\\code\\project' },
        { day: '2026-09-14', cwd: 'c:/code/project/' },
      ],
      'posix',
    );
    expect(runs.map((run) => run.cwd)).toEqual(['C:\\code\\project', 'c:/code/project/']);
  });

  it('a directory revisited after an intervening change is a THIRD, separate run, not merged back', () => {
    const runs = collapseCwdRuns(
      [
        { day: '2026-09-10', cwd: 'C:\\code' },
        { day: '2026-09-12', cwd: 'C:\\other' },
        { day: '2026-09-14', cwd: 'C:\\code' },
      ],
      'win32',
    );
    expect(runs.map((run) => run.cwd)).toEqual(['C:\\code', 'C:\\other', 'C:\\code']);
  });

  it('no samples at all is no runs, never a fabricated one', () => {
    expect(collapseCwdRuns([], 'win32')).toEqual([]);
  });
});

describe('readCwdHistory — the I/O half', () => {
  it('a session captured in the same directory every day has a single, existing entry', async () => {
    const storage = new FakeStorage(DEFAULT_TEST_CONFIG);
    const handoff = createHandoff({ cwd: 'C:\\code\\seeya' });
    await storage.saveHandoff('2026-09-16', handoff);
    const directoryExistence = new FakeDirectoryExistence(new Set(['C:\\code\\seeya']));

    const history = await readCwdHistory(
      { storage, directoryExistence, platformHint: 'win32' },
      handoff.sessionId,
      '2026-09-16',
      5,
    );

    expect(history).toEqual([
      { cwd: 'C:\\code\\seeya', firstDay: '2026-09-16', lastDay: '2026-09-16', exists: true },
    ]);
  });

  it('a day with no capture for this session leaves no sample — the walk skips it, never invents one', async () => {
    const storage = new FakeStorage(DEFAULT_TEST_CONFIG);
    const handoff = createHandoff({ cwd: 'C:\\code' });
    // Captured on day 0 and day 2 only — day 1 has nothing for this session.
    await storage.saveHandoff('2026-09-14', handoff);
    await storage.saveHandoff('2026-09-16', handoff);
    const directoryExistence = new FakeDirectoryExistence(new Set(['C:\\code']));

    const history = await readCwdHistory(
      { storage, directoryExistence, platformHint: 'win32' },
      handoff.sessionId,
      '2026-09-16',
      2,
    );

    expect(history).toEqual([
      { cwd: 'C:\\code', firstDay: '2026-09-14', lastDay: '2026-09-16', exists: true },
    ]);
  });

  /** The exact case that motivated V2-T9 (docs/PLANO-DE-ENTREGA.md's own "o achado"): a session
   * ran in one directory, then moved to another — the earlier one deleted since, the current one
   * still there. */
  it("the maintainer's own case: an earlier directory that no longer exists, the current one that does", async () => {
    const storage = new FakeStorage(DEFAULT_TEST_CONFIG);
    const sessionId = createHandoff().sessionId;
    await storage.saveHandoff('2026-09-14', createHandoff({ sessionId, cwd: 'C:\\code' }));
    await storage.saveHandoff('2026-09-16', createHandoff({ sessionId, cwd: 'C:\\code\\seeya' }));
    const directoryExistence = new FakeDirectoryExistence(new Set(['C:\\code\\seeya']));

    const history = await readCwdHistory(
      { storage, directoryExistence, platformHint: 'win32' },
      sessionId,
      '2026-09-16',
      5,
    );

    expect(history).toEqual([
      { cwd: 'C:\\code', firstDay: '2026-09-14', lastDay: '2026-09-14', exists: false },
      { cwd: 'C:\\code\\seeya', firstDay: '2026-09-16', lastDay: '2026-09-16', exists: true },
    ]);
  });

  it('never scans past maxScanDays — the same I/O ceiling findPendingBriefing already respects', async () => {
    const storage = new FakeStorage(DEFAULT_TEST_CONFIG);
    const handoff = createHandoff({ cwd: 'C:\\too-far-back' });
    await storage.saveHandoff('2026-09-01', handoff);

    const history = await readCwdHistory(
      { storage, directoryExistence: new FakeDirectoryExistence(), platformHint: 'win32' },
      handoff.sessionId,
      '2026-09-16',
      2,
    );

    expect(history).toEqual([]);
  });

  it('no capture at all for this session within range is an empty history, never an error (D-025)', async () => {
    const storage = new FakeStorage(DEFAULT_TEST_CONFIG);

    const history = await readCwdHistory(
      { storage, directoryExistence: new FakeDirectoryExistence(), platformHint: 'win32' },
      '99999999-9999-4999-8999-999999999999',
      '2026-09-16',
      5,
    );

    expect(history).toEqual([]);
  });
});
