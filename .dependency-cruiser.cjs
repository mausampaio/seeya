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
 * V2-T1 (D-043): the layers moved into `packages/engine/src/*`, and `cli/` became
 * `packages/cli/src`. The matrix above is unchanged and stays exhaustive INSIDE
 * `packages/engine` — only the path prefixes did. `cli-only-imports-engine-public-subpaths` is
 * the one rule added for the monorepo split: `packages/cli/src` may only reach
 * `@seeya-ai/engine`'s package boundary (which resolves through its package.json "exports" into
 * `packages/engine/dist/**`, see this file's own `tsConfig.fileName` below), never a relative
 * path landing inside `packages/engine/src` directly. A raw relative import bypassing the
 * package boundary resolves to a `to.path` matching `^packages/engine/src`; a legitimate
 * `@seeya-ai/engine/<layer>/...` import resolves to `packages/engine/dist/**` once built, which
 * this rule doesn't touch — that's the whole distinction, and it's why `npm run verificar`
 * builds before running `dependencias` (package.json).
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
      to: {
        path: '^packages/engine/src/(adapters|application|scheduler)($|/)|^packages/cli/src($|/)',
      },
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
      to: {
        path: '^packages/engine/src/(application|scheduler)($|/)|^packages/cli/src($|/)',
      },
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
      to: {
        path: '^packages/engine/src/(adapters|scheduler)($|/)|^packages/cli/src($|/)',
      },
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
      name: 'cli-only-imports-engine-public-subpaths',
      severity: 'error',
      comment:
        'packages/cli/src can only reach @seeya-ai/engine through its package export map ' +
        '(the same @seeya-ai/engine/<layer>/... subpath imports it already uses), never a raw ' +
        "relative path into packages/engine/src (D-043's amendment to D-020: cli is a " +
        'composition root, but it still may not reach past the engine package boundary).',
      from: { path: '^packages/cli/src($|/)' },
      to: { path: '^packages/engine/src($|/)' },
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
    // tsconfig.dependency-cruiser.json (own file, own comment): the root tsconfig.json's "paths"
    // redirects @seeya-ai/engine/* to packages/engine/src for type-checking/tests, which would
    // make dependency-cruiser resolve EVERY @seeya-ai/engine import into packages/engine/src too
    // — exactly the path `cli-only-imports-engine-public-subpaths` above needs to tell apart from
    // a real export-map import into packages/engine/dist. This config carries no such override,
    // so resolution here matches what Node does at runtime.
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
