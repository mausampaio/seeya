// ESLint config (flat config). See docs/PLANO-DE-ENTREGA.md S0-T2: type-aware rules
// (recommendedTypeChecked) plus the boundary guards dependency-cruiser doesn't cover on its
// own — banning node:* in core/; outside adapters/clock/, non-deterministic time sources
// (D-019: argument-less `new Date()`, `Date.now()`, setTimeout/setInterval); and, outside
// adapters/process/spawn.ts and its three declared exceptions, `spawn` imported straight from
// node:child_process (D-038, S4-T9). `new Date(valor)` and `Date.parse` stay free anywhere —
// they aren't a read of "now", they're a deterministic transformation of data already in hand.
import tseslint from 'typescript-eslint';

const NODE_IN_CORE_MESSAGE =
  'core/ is pure and cannot import Node modules (node:*). Isolate I/O in an adapter behind a ' +
  'port declared in core/ports.ts.';

const CLOCK_MESSAGE = (name) =>
  `${name} can only be used in packages/engine/src/adapters/clock/. Anywhere else, use the ` +
  'Clock port (core/ports.ts) to get the current instant or schedule something.';

const SPAWN_MESSAGE =
  'spawn from node:child_process can only be imported in adapters/process/spawn.ts (the ' +
  'spawnHidden wrapper, D-038) or in one of its three declared exceptions ' +
  '(adapters/process/daemon-launch.ts, adapters/process/termination-posix.ts, ' +
  'adapters/resumption/spawn-interactive.ts — each with its own comment explaining why). Import ' +
  'spawnHidden from adapters/process/spawn.ts instead, so the process stays invisible by default.';

export default tseslint.config(
  {
    // .dependency-cruiser.cjs is CommonJS on purpose (see the file itself) and isn't part of
    // the project's TypeScript program — it's out of the type-aware ESLint's scope.
    // '**/dist/**'/'**/coverage/**' (not just the root ones, V2-T1): every workspace package now
    // has its own dist/, and the fixtures in tests/fixtures/guards/ generate their own coverage/
    // when they run.
    // tests/fixtures/**/*.mjs: plain Node scripts spawned as real child processes by
    // integration tests (e.g. tests/fixtures/process/), never imported nor compiled — they
    // aren't part of the TypeScript program (tsconfig.json's "include" doesn't reach them) and
    // `allowDefaultProject` only covers the two root-level .js config files, not a whole
    // directory of them.
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      'node_modules/**',
      '.dependency-cruiser.cjs',
      'tests/fixtures/**/*.mjs',
      // `.claude/worktrees/**`: agents run in git worktrees created INSIDE the repo, so
      // `eslint .` from the root would lint every sibling agent's checkout as if it were ours.
      // Measured while three agents ran in parallel: 1077 .ts files under worktrees against 38
      // in src/. Worse than slow — those files are being written and deleted right now, so a
      // lint can hit ENOENT on a fixture another agent's test just cleaned up. That is exactly
      // the failure that made a gate run red here, and it looked like host contention.
      '.claude/**',
    ],
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        // allowJs is off (on purpose: we don't want stray .js in src/), so no .js at the root
        // actually enters the tsc program even though it's listed in tsconfig.json's "include".
        // The project's two .js config files enter here.
        projectService: {
          allowDefaultProject: ['eslint.config.js', 'lint-staged.config.js'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // node:* is forbidden only in the core — in any other directory it's normal and necessary.
    // Engine-only (V2-T1): packages/cli has no core/ layer of its own.
    files: ['packages/engine/src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['node:*'],
              message: NODE_IN_CORE_MESSAGE,
            },
          ],
        },
      ],
    },
  },
  {
    // The non-deterministic time source only exists in adapters/clock/, which implements the
    // Clock port (D-019). setTimeout/setInterval are banned outright — they have no
    // deterministic form. Date is finer-grained: argument-less `new Date()` and `Date.now()`
    // read "now" (forbidden); `new Date(valor)`, `Date.parse(valor)` and instance methods only
    // transform data already in hand (allowed anywhere) — that's why no-restricted-globals
    // (which doesn't distinguish arity) doesn't work for Date, and we turn to
    // no-restricted-syntax with selectors that actually look at the arguments.
    files: ['packages/*/src/**/*.ts'],
    ignores: ['packages/engine/src/adapters/clock/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'setTimeout', message: CLOCK_MESSAGE('setTimeout') },
        { name: 'setInterval', message: CLOCK_MESSAGE('setInterval') },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: CLOCK_MESSAGE('argument-less new Date()'),
        },
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: CLOCK_MESSAGE('Date.now()'),
        },
      ],
    },
  },
  {
    // D-038 (S4-T9, closing Q-059 item 3): `spawn` from node:child_process is banned outside the
    // wrapper and its three declared exceptions — the same inversion-of-onus technique as the
    // clock guard above, this time for "every process the seeya launches is invisible by
    // default". packages/engine/src/core/ is excluded from this list on purpose, not left off by
    // accident: it already can't import ANY node:* module at all (the core-only block above), so
    // a spawn-specific rule there would be redundant — and, worse, since this block's `files`
    // matches packages/*/src/**/*.ts (a superset of packages/engine/src/core/**/*.ts), NOT
    // excluding core here would make ESLint's flat-config merge (last matching config wins per
    // rule name) silently REPLACE the core block's broader `no-restricted-imports` setting for
    // every file under packages/engine/src/core/, undoing "core/ can't import node:* at all" and
    // narrowing it down to just this one function. Measured while writing this rule, not
    // theoretical: without that exclusion, `tests/integration/guards/eslint-restrictions.test.ts`'s
    // existing "rejects node:* imported in src/core/" test goes red.
    files: ['packages/*/src/**/*.ts'],
    ignores: [
      'packages/engine/src/core/**/*.ts',
      'packages/engine/src/adapters/process/spawn.ts',
      'packages/engine/src/adapters/process/daemon-launch.ts',
      'packages/engine/src/adapters/process/termination-posix.ts',
      'packages/engine/src/adapters/resumption/spawn-interactive.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'node:child_process',
              importNames: ['spawn'],
              message: SPAWN_MESSAGE,
            },
          ],
        },
      ],
    },
  },
);
