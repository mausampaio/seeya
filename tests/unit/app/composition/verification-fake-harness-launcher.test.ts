import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { VerificationFakeHarnessLauncher } from '../../../../packages/app/src/composition/verification-fake-harness-launcher.js';

describe('VerificationFakeHarnessLauncher (V2-T82)', () => {
  let dir: string | undefined;
  afterEach(async () => {
    if (dir !== undefined) {
      await rm(dir, { recursive: true, force: true });
      dir = undefined;
    }
  });

  it('appends one JSON line per open() call and reports the harness as opened', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'seeya-fake-harness-'));
    const logPath = path.join(dir, 'harness.log');
    const launcher = new VerificationFakeHarnessLauncher(logPath);

    const first = await launcher.open('/work/a', [], { kind: 'fresh', sessionId: 'sid-1' }, null);
    await launcher.open('/work/b', ['/x'], { kind: 'resume', sessionId: 'sid-2' }, 'append');

    expect(first).toEqual({ kind: 'opened', exitCode: 0 });
    const lines = (await readFile(logPath, 'utf8')).trim().split('\n');
    expect(lines.map((line) => JSON.parse(line) as unknown)).toEqual([
      { opened: '/work/a', launch: 'fresh', sessionId: 'sid-1', systemPromptAppendSent: false },
      { opened: '/work/b', launch: 'resume', sessionId: 'sid-2', systemPromptAppendSent: true },
    ]);
  });
});
