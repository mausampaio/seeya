import { describe, expect, it } from 'vitest';
import {
  AUTOSTART_TASK_NAME,
  buildQueryScript,
  buildRegisterScript,
  buildUnregisterScript,
} from '@seeya-ai/engine/adapters/autostart/windows-scripts.js';

describe('buildQueryScript', () => {
  it('queries the fixed task name and prints found/registeredPath as compact JSON', () => {
    const script = buildQueryScript();
    expect(script).toContain(`Get-ScheduledTask -TaskName '${AUTOSTART_TASK_NAME}'`);
    expect(script).toContain('ConvertTo-Json -Compress');
    expect(script).toContain('found = $true');
    expect(script).toContain('found = $false');
  });
});

describe('buildRegisterScript', () => {
  it('wraps the launch command in conhost.exe --headless, with both paths quoted', () => {
    const script = buildRegisterScript(
      'C:\\Program Files\\nodejs\\node.exe',
      'C:\\code\\seeya\\dist\\cli\\index.js',
    );
    expect(script).toContain("Execute 'conhost.exe'");
    expect(script).toContain(
      '--headless "C:\\Program Files\\nodejs\\node.exe" "C:\\code\\seeya\\dist\\cli\\index.js" daemon',
    );
  });

  it('registers AtLogOn for the current user, Interactive logon type (Q-067: the toast needs the interactive session)', () => {
    const script = buildRegisterScript('node.exe', 'script.js');
    expect(script).toContain('New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME');
    expect(script).toContain('-LogonType Interactive -RunLevel Limited');
  });

  it('stores the registered path in -Description, not only inside -Argument', () => {
    const script = buildRegisterScript('node.exe', 'C:\\code\\seeya\\dist\\cli\\index.js');
    expect(script).toContain("-Description 'C:\\code\\seeya\\dist\\cli\\index.js'");
  });

  it('unregisters any previous task with the same name before registering (idempotent, never duplicates)', () => {
    const script = buildRegisterScript('node.exe', 'script.js');
    const unregisterIndex = script.indexOf('Unregister-ScheduledTask');
    const registerIndex = script.indexOf('Register-ScheduledTask -TaskName');
    expect(unregisterIndex).toBeGreaterThan(-1);
    expect(registerIndex).toBeGreaterThan(unregisterIndex);
  });

  it('escapes a single quote in the path for the PowerShell single-quoted string literal', () => {
    const script = buildRegisterScript("C:\\it's\\node.exe", "C:\\it's\\index.js");
    expect(script).toContain("C:\\it''s\\node.exe");
    expect(script).toContain("C:\\it''s\\index.js");
  });

  // V2-T13, D-045 item 4: the app's own daemon needs ELECTRON_RUN_AS_NODE=1 set for its Electron
  // binary to behave as plain Node — New-ScheduledTaskAction has no environment parameter, so a
  // cmd.exe wrapper is what actually carries it into the registered task.
  it('with env: wraps the launch in cmd.exe /c "set VAR=... && ...", never bare conhost.exe', () => {
    const script = buildRegisterScript('C:\\seeya\\seeya.exe', 'C:\\seeya\\dist\\cli\\index.js', {
      ELECTRON_RUN_AS_NODE: '1',
    });
    expect(script).toContain("Execute 'cmd.exe'");
    expect(script).toContain(
      '/c "set ELECTRON_RUN_AS_NODE=1&& conhost.exe --headless "C:\\seeya\\seeya.exe" "C:\\seeya\\dist\\cli\\index.js" daemon"',
    );
  });

  it('with multiple env entries: chains them with &&, one "set" per entry', () => {
    const script = buildRegisterScript('node.exe', 'script.js', { A: '1', B: '2' });
    expect(script).toContain('set A=1&& set B=2&&');
  });

  it("without env (undefined): identical to the two-argument call — the CLI's own path never changes", () => {
    const withoutOptionsArg = buildRegisterScript('node.exe', 'script.js');
    const withUndefinedEnv = buildRegisterScript('node.exe', 'script.js', undefined);
    expect(withoutOptionsArg).toBe(withUndefinedEnv);
    expect(withoutOptionsArg).toContain("Execute 'conhost.exe'");
  });

  it('an empty env object behaves exactly like no env at all', () => {
    const script = buildRegisterScript('node.exe', 'script.js', {});
    expect(script).toContain("Execute 'conhost.exe'");
  });
});

describe('buildUnregisterScript', () => {
  it('reports ABSENT when nothing is registered, without erroring', () => {
    const script = buildUnregisterScript();
    expect(script).toContain('-ErrorAction SilentlyContinue');
    expect(script).toContain("Write-Output 'ABSENT'");
  });

  it('unregisters and reports REMOVED when the task exists', () => {
    const script = buildUnregisterScript();
    expect(script).toContain(
      `Unregister-ScheduledTask -TaskName '${AUTOSTART_TASK_NAME}' -Confirm:$false`,
    );
    expect(script).toContain("Write-Output 'REMOVED'");
  });
});
