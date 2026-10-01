/**
 * The embedded terminal (V2-T64, `docs/INTERFACE.md` § 2) — replaces the imperative
 * `mountTerminalTab` of `renderer/legacy/tabs-view.ts` (apagado by this task). The `@xterm/xterm`
 * instance is mounted by `ref`, inside this component's own mount effect — the one place in the
 * tab strip that touches a real DOM node directly, same sanctioned exception `Popover`'s own
 * `.showModal()` call is: a third-party terminal emulator has no Preact binding of its own to
 * reach for.
 *
 * **Self-spawning, or just attaching — `spawnRequest` decides which.** A tab opened from the New
 * tab popover has no pty yet (`spawnRequest` is set); this component calls `CHANNELS.createTab`
 * ITSELF once it has measured its own `cols`/`rows`, and reports the resulting pid back via
 * `onSpawned` — no round trip through the parent hook needed just to spawn. A tab opened by a
 * resume/`project open`/adopt already has a pty by the time its own `StripTab` exists
 * (`CHANNELS.resumeTabOpened`); `spawnRequest` is `null` for those, and this component only
 * corrects the pty's initial 80x24 size (`main/main.ts`'s own fixed starting size — it has to
 * spawn before any pane exists to measure) to its real, mounted size.
 *
 * `onRegister`/`onUnregister` hand the parent a small `TerminalHandle` (write/fit/focus) keyed by
 * `id` — how `useTabStrip.ts` routes incoming pty data and cross-cutting actions (switching tabs,
 * a window resize) to the right instance, without lifting the instance itself into React state
 * (AGENTS.md: inject by parameter, never a global — the registry pattern
 * `terminal-theme-registry.ts` already uses for the one truly cross-feature concern, theme).
 */
import { useEffect, useRef } from 'preact/hooks';
import type { JSX } from 'preact';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import styles from './TerminalPane.module.css';
import { cx } from '../../../components/css-class.js';
import { getSeeyaApi } from '../../../ipc/client.js';
import {
  currentActiveTerminalTheme,
  registerTerminalForTheme,
  unregisterTerminalForTheme,
} from '../terminal-theme-registry.js';
import type { TerminalSpawnRequest } from '../../../../state/tab-strip.js';

export interface TerminalHandle {
  readonly write: (data: string) => void;
  readonly fit: () => void;
  readonly focus: () => void;
}

export interface TerminalPaneProps {
  readonly id: string;
  readonly hidden: boolean;
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly spawnRequest: TerminalSpawnRequest | null;
  readonly onRegister: (id: string, handle: TerminalHandle) => void;
  readonly onUnregister: (id: string) => void;
  readonly onSpawned: (id: string, pid: number) => void;
}

function writeSpawnError(terminal: Terminal, error: unknown): void {
  // Command resolution failed (e.g. "claude" isn't on PATH) — main.ts's own resolveHarnessOrThrow
  // already names exactly what it searched (AGENTS.md's error-message rule); show it in the
  // terminal itself rather than leaving a silently empty pane (mirrors the old command-bar
  // `openTab`'s own catch block, `renderer/legacy/tabs-view.ts` before this task).
  const message = error instanceof Error ? error.message : String(error);
  terminal.write(`\x1b[31m${message}\x1b[0m\r\n`);
}

/** Mounts the `@xterm/xterm` instance into `container` and wires it to `props` — extracted out of
 * the effect body only to keep that effect under AGENTS.md's ~20-line guideline. */
function mountTerminal(container: HTMLDivElement, props: TerminalPaneProps): () => void {
  const api = getSeeyaApi();
  const terminal = new Terminal({
    convertEol: true,
    fontFamily: props.fontFamily,
    fontSize: props.fontSize,
    theme: currentActiveTerminalTheme(),
  });
  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open(container);
  fitAddon.fit();
  registerTerminalForTheme(props.id, terminal, (color) => {
    container.style.backgroundColor = color;
  });
  terminal.onData((data) => api.writeTab({ id: props.id, data }));

  const handle: TerminalHandle = {
    write: (data) => terminal.write(data),
    fit: () => {
      fitAddon.fit();
      api.resizeTab({ id: props.id, cols: terminal.cols, rows: terminal.rows });
      // V2-T6: measured defect — a full repaint forces xterm.js to redraw every row from its own
      // buffer, fixing orphaned characters a ConPTY/xterm.js row-wrap disagreement right after a
      // resize otherwise leaves behind.
      terminal.refresh(0, terminal.rows - 1);
    },
    focus: () => terminal.focus(),
  };
  props.onRegister(props.id, handle);

  if (props.spawnRequest === null) {
    handle.fit();
  } else {
    void api
      .createTab({ id: props.id, ...props.spawnRequest, cols: terminal.cols, rows: terminal.rows })
      .then((response) => props.onSpawned(props.id, response.pid))
      .catch((error: unknown) => writeSpawnError(terminal, error));
  }

  return () => {
    props.onUnregister(props.id);
    unregisterTerminalForTheme(props.id);
    terminal.dispose();
  };
}

export function TerminalPane(props: TerminalPaneProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  // Mounts once: `props.id` is always a fresh id for the life of this component (a closed tab is
  // never reopened under the same id, `tabs/tab-model.ts`'s own docstring) — font/spawnRequest
  // never change afterwards either, so there is no later prop change this effect needs to react
  // to.
  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    return mountTerminal(container, props);
  }, []);

  return <div ref={containerRef} hidden={props.hidden} class={cx(styles, 'pane')} />;
}
