/**
 * Layer rules from docs/ARQUITETURA.md ("From → To" table, 5 layers x 20 ordered pairs, D-020),
 * enforced by dependency-cruiser. See S0-T2 and S0-T6 in docs/PLANO-DE-ENTREGA.md.
 *
 * `cli/` is the only composition root (D-020): only it names a concrete adapter and injects it
 * into application/ and scheduler/. That's why application/ and scheduler/ cannot import
 * adapters/ directly — only through the ports declared in core/ports.ts. And scheduler/ cannot
 * import cli/: cli/ is what builds and injects the scheduler, never the other way around —
 * importing cli/ from scheduler/ would be a composition-root dependency inversion.
 *
 * V2-T1 step (a) (D-043): the four layers moved into `packages/engine/src/*`. The matrix below
 * is unchanged and stays exhaustive INSIDE `packages/engine` — only the path prefixes did.
 * `packages/cli` (and its own dependency-cruiser rule, `cli → engine` only through the package's
 * public subpaths) lands in step (b)'s commit.
 *
 * `from`/`to` paths are anchored per segment (`($|/)` after the layer name): without this,
 * `^packages/engine/src/application` would also match a future `.../application-legacy/`, which
 * isn't the `application/` layer from the matrix. See
 * tests/integration/guards/dependency-cruiser.test.ts for the regression test of that anchor.
 *
 * File in CommonJS (`.cjs`) on purpose: the packages are `"type": "module"`, and
 * dependency-cruiser's config loader is more predictable with `module.exports` than with an ESM
 * `.js`.
 */
module.exports = {
  forbidden: [
    {
      name: 'core-does-not-import-other-layers',
      severity: 'error',
      comment:
        'core/ is pure: it cannot import adapters/, application/, cli/ or scheduler/. Declare ' +
        'a port in core/ports.ts and implement it in an adapter.',
      from: { path: '^packages/engine/src/core($|/)' },
      to: { path: '^packages/engine/src/(adapters|application|scheduler)($|/)' },
    },
    {
      name: 'core-does-not-import-node',
      severity: 'error',
      comment:
        'core/ cannot import Node built-in modules (node:*). Isolate I/O in an adapter behind ' +
        'a port declared in core/ports.ts.',
      from: { path: '^packages/engine/src/core($|/)' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'adapters-does-not-import-application-cli-or-scheduler',
      severity: 'error',
      comment:
        'adapters/ implements ports from the core; it cannot depend on application/, cli/ nor ' +
        'scheduler/. Invert the dependency: it is application/ (or scheduler/) that calls the ' +
        'adapter, never the other way around.',
      from: { path: '^packages/engine/src/adapters($|/)' },
      to: { path: '^packages/engine/src/(application|scheduler)($|/)' },
    },
    {
      name: 'application-does-not-import-adapters-cli-or-scheduler',
      severity: 'error',
      comment:
        'application/ defines the use cases; cli/ and scheduler/ are the ones that call them ' +
        '(the arrow points scheduler → application in ARQUITETURA.md, never the other way) — ' +
        'it cannot be the reverse. And application/ cannot import a concrete adapters/ (D-020): ' +
        'depend only on the port declared in core/ports.ts; cli/, the only composition root, ' +
        'is what injects the implementation.',
      from: { path: '^packages/engine/src/application($|/)' },
      to: { path: '^packages/engine/src/(adapters|scheduler)($|/)' },
    },
    {
      name: 'scheduler-does-not-import-adapters',
      severity: 'error',
      comment:
        'scheduler/ receives its dependencies injected by cli/ (D-020, the only composition ' +
        'root) — it cannot name a concrete adapter directly. Depend on the port declared in ' +
        'core/ports.ts.',
      from: { path: '^packages/engine/src/scheduler($|/)' },
      to: { path: '^packages/engine/src/adapters($|/)' },
    },
    {
      name: 'scheduler-does-not-import-cli',
      severity: 'error',
      comment:
        'cli/ is the only composition root (D-020): it is what builds the scheduler and injects ' +
        'it, never the other way around. scheduler/ importing cli/ is a dependency inversion — ' +
        'if scheduler/ needs something from cli/, receive it by parameter/constructor from cli/.',
      from: { path: '^packages/engine/src/scheduler($|/)' },
      to: { path: '^packages/cli/src($|/)' },
    },
    {
      name: 'no-circular-dependency',
      severity: 'error',
      comment:
        'Dependency cycle between project modules. Break the cycle by extracting the shared ' +
        'part into another module or by inverting one of the ends through the right port.',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.dependency-cruiser.json',
    },
    // Resolves enough to know a package is 'npm'/'core', but doesn't go into node_modules'
    // internal modules — otherwise an internal cycle in a dependency (e.g. zod) would trigger
    // the no-circular-dependency rule, which is for our code, not for third-party code.
    doNotFollow: {
      path: 'node_modules',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'node', 'default'],
    },
  },
};
