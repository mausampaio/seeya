/**
 * V2-T29's own named doubles — kept out of `_fakes.ts` (already 800+ lines) rather than growing
 * that shared file further for two ports only `project-adopt.test.ts` exercises
 * (docs/TESTES.md: "duplo de I/O é classe/objeto nomeado implementando a porta").
 */
import type {
  ForkRegistration,
  HarnessOpenResult,
  SessionAdoptionLauncher,
} from '@seeya-ai/engine/core/ports.js';

/** `core/ports.ts#ForkRegistration` — an in-memory `forks.json`, minus any real filesystem. Records
 * every `register`/`unregister` call so a test can assert the exact ordering `adoptSession` is
 * supposed to follow (registered before the harness launches; unregistered on decline OR accept,
 * never left dangling). */
export class FakeForkRegistration implements ForkRegistration {
  private readonly registered = new Set<string>();
  readonly registerCalls: string[] = [];
  readonly unregisterCalls: string[] = [];

  register(sessionId: string, createdAt: Date): Promise<void> {
    void createdAt;
    this.registered.add(sessionId);
    this.registerCalls.push(sessionId);
    return Promise.resolve();
  }

  unregister(sessionId: string): Promise<void> {
    this.registered.delete(sessionId);
    this.unregisterCalls.push(sessionId);
    return Promise.resolve();
  }

  isRegistered(sessionId: string): boolean {
    return this.registered.has(sessionId);
  }
}

/** `core/ports.ts#SessionAdoptionLauncher` — records every `adopt` call's full argument list, the
 * same shape `_fakes.ts#FakeHarnessLauncher` already gives `HarnessLauncher.open`. */
export class FakeSessionAdoptionLauncher implements SessionAdoptionLauncher {
  readonly calls: {
    readonly originalCwd: string;
    readonly addDirs: readonly string[];
    readonly originalSessionId: string;
    readonly forkSessionId: string;
  }[] = [];

  constructor(private readonly result: HarnessOpenResult = { kind: 'opened', exitCode: 0 }) {}

  adopt(
    originalCwd: string,
    addDirs: readonly string[],
    originalSessionId: string,
    forkSessionId: string,
  ): Promise<HarnessOpenResult> {
    this.calls.push({ originalCwd, addDirs, originalSessionId, forkSessionId });
    return Promise.resolve(this.result);
  }
}
