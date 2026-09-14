/**
 * The tab model — pure, no Electron, no node-pty (D-041: "tudo que tiver lógica fica fora de
 * electron/"). A tab is one embedded terminal (D-042): a command, a working directory, and,
 * once launched, the pid of the process behind it. `electron/main.ts` only wires IPC events to
 * the functions below; nothing here touches a real process or the DOM.
 *
 * **`TabStatus` is a discriminated union, not a boolean `running` flag with an optional
 * `exitCode`** (AGENTS.md § "Tipos", D-024): the two shapes below make "exited with no code" and
 * "running with a code" both unrepresentable, instead of relying on a comment to say when
 * `exitCode` is meaningful.
 */
export type TabStatus =
  { readonly kind: 'running' } | { readonly kind: 'exited'; readonly exitCode: number };

/**
 * One tab. `pid` is `null` until the pty backing it has actually spawned (`main.ts` creates the
 * `Tab` record first, at the moment the user submits the command bar, then fills `pid` in once
 * `PtySpawner.spawn` returns — the two happen in the same synchronous IPC handler in practice, but
 * the type doesn't assume that ordering can never change).
 */
export interface Tab {
  readonly id: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly pid: number | null;
  readonly status: TabStatus;
}

export interface NewTabRequest {
  readonly id: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
}

/** A tab freshly created, before its pty has spawned (`pid: null`) — see `Tab`'s own docstring. */
export function createTab(request: NewTabRequest): Tab {
  return {
    id: request.id,
    command: request.command,
    args: request.args,
    cwd: request.cwd,
    pid: null,
    status: { kind: 'running' },
  };
}

/** `tab` with its pid filled in, once `PtySpawner.spawn` returns one — see `Tab`'s own docstring
 * for why this is a separate step from `createTab`. */
export function withPid(tab: Tab, pid: number): Tab {
  return { ...tab, pid };
}

/**
 * Marks `tab` exited, with the code its process actually reported. **Closing a tab never removes
 * it from the list** (docs/PLANO-DE-ENTREGA.md V2-T2, item 3: "o `onExit` do processo marca a
 * aba como encerrada (com o código) em vez de sumir com ela") — the person can still read what a
 * finished session printed; only closing the WINDOW tab-chrome element in the renderer (a UI
 * concern, not a model concern) hides it.
 */
export function markExited(tab: Tab, exitCode: number): Tab {
  return { ...tab, status: { kind: 'exited', exitCode } };
}

export function isRunning(tab: Tab): boolean {
  return tab.status.kind === 'running';
}

/**
 * An immutable ordered collection of tabs, keyed by `id` — the renderer's whole tab list state.
 * Insertion order is preserved (a `Map` over `id`, not an object with numeric reindexing) so tabs
 * never visually reorder just because an earlier one exited.
 */
export type TabCollection = ReadonlyMap<string, Tab>;

export function emptyTabs(): TabCollection {
  return new Map();
}

export function addTab(tabs: TabCollection, tab: Tab): TabCollection {
  const next = new Map(tabs);
  next.set(tab.id, tab);
  return next;
}

/**
 * Applies `updater` to the tab named `id`, or returns `tabs` unchanged if no such tab exists —
 * never throws. A pty `onExit`/`onData` callback firing after the tab was already removed from a
 * future "close tab" action (not implemented by this task, but the model doesn't assume it never
 * will be) is exactly the case this silently-no-op behavior protects against.
 */
export function updateTab(
  tabs: TabCollection,
  id: string,
  updater: (tab: Tab) => Tab,
): TabCollection {
  const existing = tabs.get(id);
  if (existing === undefined) {
    return tabs;
  }
  const next = new Map(tabs);
  next.set(id, updater(existing));
  return next;
}

export function listTabs(tabs: TabCollection): readonly Tab[] {
  return [...tabs.values()];
}

export function findTabByPid(tabs: TabCollection, pid: number): Tab | null {
  for (const tab of tabs.values()) {
    if (tab.pid === pid) {
      return tab;
    }
  }
  return null;
}
