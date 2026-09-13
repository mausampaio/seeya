#!/usr/bin/env node
// Dependency vulnerability report for the CI security gate (S5-T6, docs/QUESTOES.md Q-068).
//
// Default behavior is REPORT, not FAIL: printing every finding (severity, title, advisory URL,
// whether a fix is available) never blocks the build on its own — a moderate finding, or a
// critical one with no fix yet, is something the maintainer needs to see, not something the CI
// run should turn red for (docs/PLANO-DE-ENTREGA.md S5-T6: "reprovar por vulnerabilidade
// transitiva que não tem correção disponível trava o projeto por algo fora do alcance dele").
//
// The one exception, decided by the maintainer ahead of the first real finding (S5-T6): a
// CRITICAL vulnerability that already HAS a fix available exits 1. There is no excuse to ship
// that — the fix is a version bump away. Q-068 records this script's reasoning for whoever
// disagrees; change the exception there first, not silently here.
//
// Deliberately not part of `npm run verificar` (see the comment in .github/workflows/ci.yml):
// `npm audit`'s result depends on the npm advisory database at run time, not on this task's
// diff, and needs network access that the rest of the local gate never requires.

import { spawnSync } from 'node:child_process';

/**
 * @typedef {{ name: string, severity: string, title: string, url: string, fixAvailable: boolean }} Finding
 */

/**
 * `npm audit --json`'s `via` array mixes plain package-name strings (a vulnerability inherited
 * from a dependency, described in that dependency's own entry) with advisory objects (the
 * vulnerability's own entry). Only the object form carries a human-readable title/url.
 * @param {unknown} via
 * @returns {via is { title: unknown, url: unknown }}
 */
function isAdvisoryObject(via) {
  return typeof via === 'object' && via !== null && 'title' in via && 'url' in via;
}

/**
 * Reads one vulnerability entry from `npm audit --json`'s `vulnerabilities` map, tolerating a
 * shape that doesn't match (D-022's spirit: a malformed item is skipped with its reason logged,
 * never silently coerced into a false positive or a crash).
 * @param {unknown} entry
 * @returns {Finding | { skippedReason: string }}
 */
function parseVulnerability(entry) {
  if (typeof entry !== 'object' || entry === null) {
    return { skippedReason: `expected an object, got ${JSON.stringify(entry)}` };
  }
  if (
    !('name' in entry) ||
    typeof entry.name !== 'string' ||
    !('severity' in entry) ||
    typeof entry.severity !== 'string' ||
    !('via' in entry) ||
    !Array.isArray(entry.via)
  ) {
    return { skippedReason: `missing name/severity/via: ${JSON.stringify(entry)}` };
  }

  const advisory = entry.via.find(isAdvisoryObject);
  return {
    name: entry.name,
    severity: entry.severity,
    title:
      advisory !== undefined && typeof advisory.title === 'string'
        ? advisory.title
        : '(no advisory details — via a transitive package range)',
    url: advisory !== undefined && typeof advisory.url === 'string' ? advisory.url : '',
    fixAvailable: 'fixAvailable' in entry && Boolean(entry.fixAvailable),
  };
}

/**
 * Runs `npm audit --json` and parses it into one finding per vulnerable package.
 *
 * `npm audit` exits non-zero whenever it finds anything at all, regardless of severity — so the
 * exit code is never used as the signal here. Only the parsed content decides what happens next.
 * @returns {Finding[]}
 */
function collectFindings() {
  // Windows has no bare `npm` executable, only the `npm.cmd` shim, and Node's own child_process
  // refuses to run a .cmd/.bat file with `shell: false` (EINVAL, measured on this machine) — a
  // documented Node-on-Windows limitation, not something specific to this script. `shell: true`
  // is the one exception to D-015's "spawn com array e shell:false" in this codebase: D-015 is
  // about *content of variable size* (a transcript, a prompt) reaching a shell and getting
  // mangled or injected. There is no variable content here — `'audit'`/`'--json'` are two fixed
  // literals, nothing this script assembles from external input ever reaches this command line.
  const result = spawnSync('npm', ['audit', '--json'], {
    shell: process.platform === 'win32',
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024, // same generous ceiling as scripts/verificar-termos-locais.mjs
  });

  if (result.error !== undefined) {
    console.error(`Could not run "npm audit": ${result.error.message}`);
    process.exitCode = 1;
    return [];
  }

  /** @type {unknown} */
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch (error) {
    console.error(
      `"npm audit --json" produced output that is not valid JSON: ${String(error)}\n` +
        `Raw stdout:\n${result.stdout}`,
    );
    process.exitCode = 1;
    return [];
  }

  const rawVulnerabilities =
    typeof report === 'object' && report !== null && 'vulnerabilities' in report
      ? report.vulnerabilities
      : {};
  const entries =
    typeof rawVulnerabilities === 'object' && rawVulnerabilities !== null
      ? Object.values(rawVulnerabilities)
      : [];

  /** @type {Finding[]} */
  const findings = [];
  for (const entry of entries) {
    const parsed = parseVulnerability(entry);
    if ('skippedReason' in parsed) {
      console.error(`npm audit: ignoring one entry — ${parsed.skippedReason}`);
      continue;
    }
    findings.push(parsed);
  }
  return findings;
}

/**
 * @param {Finding[]} findings
 */
function printReport(findings) {
  if (findings.length === 0) {
    console.log('npm audit: no known vulnerabilities in the dependency tree.');
    return;
  }

  console.log(`npm audit: ${findings.length} finding(s).`);
  for (const finding of findings) {
    console.log(
      `  - [${finding.severity}] ${finding.name}: ${finding.title}` +
        `${finding.url ? ` (${finding.url})` : ''} — fix available: ${finding.fixAvailable}`,
    );
  }
}

/**
 * @param {Finding[]} findings
 * @returns {boolean}
 */
function hasCriticalWithFix(findings) {
  return findings.some((finding) => finding.severity === 'critical' && finding.fixAvailable);
}

function main() {
  const findings = collectFindings();
  if (process.exitCode === 1) {
    return; // collectFindings() already reported why it couldn't produce a result.
  }

  printReport(findings);

  if (hasCriticalWithFix(findings)) {
    console.error(
      '\nFailing the build: at least one CRITICAL vulnerability above has a fix available.\n' +
        'Run "npm audit fix" (or update the named package directly) and commit the lockfile.',
    );
    process.exitCode = 1;
  }
}

main();
