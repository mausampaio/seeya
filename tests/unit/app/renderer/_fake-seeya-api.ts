/**
 * D-052 (V2-T75): a named double for the whole preload bridge (`SeeyaApi`,
 * `packages/app/src/main/preload.ts`) — AGENTS.md's own "duplo de I/O é classe/objeto nomeado
 * implementando a porta, não stub inline". Every method starts as a harmless no-op/never-called
 * default; a test overrides only the handful it actually exercises
 * (`createFakeSeeyaApi({ onProjectsUpdate: (listener) => { ... } })`).
 */
import { vi } from 'vitest';
import type { SeeyaApi } from '../../../../packages/app/src/main/preload.js';

function neverCalled(name: string): () => never {
  return () => {
    throw new Error(`FakeSeeyaApi#${name} was not expected to be called by this test`);
  };
}

function noopUnsubscribe(): () => void {
  return () => {};
}

export function createFakeSeeyaApi(overrides: Partial<SeeyaApi> = {}): SeeyaApi {
  const base: SeeyaApi = {
    platform: 'linux',
    createTab: neverCalled('createTab'),
    writeTab: vi.fn(),
    resizeTab: vi.fn(),
    closeTab: vi.fn(),
    removeTab: vi.fn(),
    // V2-T64: `useTabStrip` now calls this unconditionally on mount (gates the "+" button until
    // it resolves) — every test that mounts `<TabStrip/>`/`useTabStrip` needs a real value, not
    // `neverCalled`, the same reasoning `getProjectsPanel`/`getTodayPanel` below already follow.
    getTerminalFontConfig: vi.fn(() => Promise.resolve({ fontFamily: 'monospace', fontSize: 14 })),
    onTabData: vi.fn(),
    onTabExit: vi.fn(),
    onSessionsUpdate: vi.fn(),
    onStatusUpdate: vi.fn(),
    onConfirmFallbackRequest: vi.fn(),
    answerFallbackConfirm: vi.fn(),
    getTodayPanel: vi.fn(() => Promise.resolve({ kind: 'noBriefing' as const, message: '' })),
    onTodayUpdate: vi.fn(noopUnsubscribe),
    resumeSelected: neverCalled('resumeSelected'),
    onResumeProgress: vi.fn(),
    onResumeTabOpened: vi.fn(),
    endDayPreview: neverCalled('endDayPreview'),
    endDayRun: neverCalled('endDayRun'),
    onEndDayProgress: vi.fn(),
    onScheduleUpdate: vi.fn(noopUnsubscribe),
    snoozeToday: neverCalled('snoozeToday'),
    skipToday: neverCalled('skipToday'),
    onDaemonAvailabilityUpdate: vi.fn(noopUnsubscribe),
    daemonControl: neverCalled('daemonControl'),
    getSettingsPanel: neverCalled('getSettingsPanel'),
    saveSetting: neverCalled('saveSetting'),
    onAutostartAvailabilityUpdate: vi.fn(noopUnsubscribe),
    autostartControl: neverCalled('autostartControl'),
    getDaemonOwnershipTransitionOffer: neverCalled('getDaemonOwnershipTransitionOffer'),
    answerDaemonOwnershipTransition: neverCalled('answerDaemonOwnershipTransition'),
    onProjectsUpdate: vi.fn(noopUnsubscribe),
    getProjectsPanel: vi.fn(() =>
      Promise.resolve({ projects: [], otherSessionsByDirectory: [], ignoredProjects: [] }),
    ),
    createProject: neverCalled('createProject'),
    openProject: vi.fn(() => Promise.resolve({ outcomeText: '' })),
    onConfirmProjectLockOpenRequest: vi.fn(),
    answerProjectLockOpenConfirm: vi.fn(),
    onConfirmLeftoverChangesOpenRequest: vi.fn(),
    answerLeftoverChangesOpenConfirm: vi.fn(),
    adoptSession: neverCalled('adoptSession'),
    onConfirmAdoptionLaunchRequest: vi.fn(),
    answerAdoptionLaunchConfirm: vi.fn(),
    onConfirmAdoptionCommitRequest: vi.fn(),
    answerAdoptionCommitConfirm: vi.fn(),
    findSessionById: neverCalled('findSessionById'),
    getEffectiveTheme: neverCalled('getEffectiveTheme'),
    onThemeUpdate: vi.fn(noopUnsubscribe),
    toggleFavoriteProject: vi.fn(() => Promise.resolve()),
    pickDirectory: neverCalled('pickDirectory'),
  };
  return { ...base, ...overrides };
}
