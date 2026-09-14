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
