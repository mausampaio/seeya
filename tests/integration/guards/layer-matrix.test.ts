import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import {
  SYNTHETIC_TEST_LAYER_NAME,
  PROJECT_ROOT,
  ENGINE_SRC_ROOT,
  CLI_SRC_ROOT,
  TEST_TIMEOUT_MS,
  deleteTempFile,
  guardFixturePath,
  srcRootForLayer,
  writeTempFile,
  cleanUpGuardResidue,
  runDependencyCruiser,
  violationsOfFixture,
} from './_support.js';
import { LAYERS, type Layer, type LayerPair, orderedPairs } from './_layer-matrix.js';

const GUARD_NAME = 'matriz-de-camadas';

/**
 * The guard of the guard (S0-T6). The three S0-T2 review rounds each found "one more pair nobody
 * listed" — because coverage lived in tests written pair by pair, and "no test" was ambiguous
 * between "forgotten" and "not needed". This file closes that gap: the 20 ordered pairs from
 * docs/ARQUITETURA.md are generated from a single data structure (`_layer-matrix.ts`), never
 * hand-written — and each generated pair runs the real dependency-cruiser against the real src/
 * tree.
 *
 * Two layers of protection:
 *
 * 1. src/'s real directories have to match `LAYERS` exactly. If someone creates a 6th layer in
 *    `src/` without updating `_layer-matrix.ts`, this test fails BEFORE generating any pair
 *    — there's no way for the matrix to stay silently incomplete.
 * 2. For each of the 20 pairs: if the matrix says forbidden, dependency-cruiser has to reject it;
 *    if it says allowed, it has to accept it. A missing rule (should reject and doesn't) and an
 *    overly tight rule (should accept and doesn't) are equally a bug here.
 *
 * S1-T0: each fixture lives in `src/<layer>/_guard-matriz-de-camadas/`, a subdirectory reserved
 * for THIS file (never shared with dependency-cruiser.test.ts), and dependency-cruiser is called
 * only with THAT fixture as input (`runDependencyCruiser([fixturePath])`), not all of `src/` — the
 * result only speaks to what this test wrote, never to what another test file is doing in
 * parallel in another layer. See `_support.ts` for the detail.
 */
describe('guard: the 20 ordered pairs of the docs/ARQUITETURA.md matrix have complete coverage', () => {
  const created: string[] = [];

  afterEach(() => {
    for (const createdPath of created.splice(0)) {
      deleteTempFile(createdPath);
    }
  });

  // Safety net: if the process is killed mid-test (CI timeout), the afterEach above doesn't
  // run. Deletes only THIS file's fixture subdirectory (S1-T0) — never the whole src/ tree,
  // which would delete another test file's in-flight fixture running in parallel.
  afterAll(() => {
    cleanUpGuardResidue(GUARD_NAME);
  });

  it('the declared layer list matches the real package layout (otherwise the matrix is stale)', () => {
    // S1-T0, third review round: dependency-cruiser.test.ts creates and deletes
    // packages/engine/src/application-legacy/ on its own (see SYNTHETIC_TEST_LAYER_NAME in
    // _support.ts) to test dependency-cruiser's segment anchoring. If this listing, running in
    // parallel, catches that directory mid-flight, the failure would point at the WRONG place
    // ("the matrix is stale, missing a 6th layer") when no layer is actually missing — just
    // another test file's fixture, in flight. That's why we filter by EXACT NAME before
    // comparing: never by prefix/regex, because this test exists precisely to catch a real 6th
    // layer, and a broad filter (`startsWith('application')`, for example) would blind the test
    // to a legitimate layer called `application-new` — we'd trade a rare race for a permanent
    // blind spot, which is worse. DO NOT generalize this filter.
    const engineDirectories = readdirSync(path.join(PROJECT_ROOT, ENGINE_SRC_ROOT), {
      withFileTypes: true,
    })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => name !== SYNTHETIC_TEST_LAYER_NAME)
      .sort();
    const declaredEngineLayers = LAYERS.filter((layer) => layer.name !== 'cli')
      .map((layer) => layer.name)
      .sort();

    expect(engineDirectories).toEqual(declaredEngineLayers);

    // cli is its own package (packages/cli/src), not a subdirectory of packages/engine/src
    // (V2-T1, D-043) — so it can't be folded into the listing comparison above. Its presence is
    // proven separately here; LAYERS declaring it is proven by the pair-count test below.
    expect(existsSync(path.join(PROJECT_ROOT, CLI_SRC_ROOT))).toBe(true);
  });

  it('the declared matrix has exactly 20 ordered pairs, 12 forbidden and 8 allowed (docs/ARQUITETURA.md)', () => {
    const pairs = orderedPairs();

    expect(pairs).toHaveLength(20);
    expect(pairs.filter((pair) => !pair.allowed)).toHaveLength(12);
    expect(pairs.filter((pair) => pair.allowed)).toHaveLength(8);
  });

  /**
   * Relative import path from the fixture (already inside its `_guard-matriz-de-camadas`
   * subdirectory, S1-T0) to `to`'s canonical `index.ts`, resolved against `to`'s OWN package src
   * root (`srcRootForLayer`, V2-T1) — `path.relative` computes however many `../` that takes
   * without this file needing to know or hardcode the depth, which is what lets this same
   * function keep working whether `to` is a subdirectory of packages/engine/src or, for `cli`,
   * packages/cli/src itself. Not used for a `cli`-outbound pair — see `importSpecifierFor`.
   */
  function importPath(fixturePath: string, to: Layer): string {
    const fromDirAbsolute = path.dirname(path.join(PROJECT_ROOT, fixturePath));
    const toDirAbsolute = path.join(PROJECT_ROOT, srcRootForLayer(to.name), to.targetDir);
    let relative = path.relative(fromDirAbsolute, toDirAbsolute).split(path.sep).join('/');
    if (!relative.startsWith('.')) {
      relative = `./${relative}`;
    }
    return `${relative}/index.js`;
  }

  /**
   * The import specifier a pair's fixture actually uses. Every pair except `cli`-outbound ones
   * uses a plain relative path (`importPath`, works across the package boundary too via
   * `path.relative` — the FORBIDDEN `cli`-inbound pairs, e.g. `core → cli`, still exercise a real
   * relative import landing in packages/cli/src, which is exactly what those rules match on).
   *
   * `cli`-outbound pairs (V2-T1, D-043) are the one case that can't: the new
   * `cli-only-imports-engine-public-subpaths` rule in .dependency-cruiser.cjs forbids a relative
   * path from packages/cli/src into packages/engine/src, so the only way to reach engine from cli
   * at all — legitimately or not — is through `@seeya-ai/engine`'s package export map. Resolving
   * this specifier needs packages/engine/dist to already exist (built) — see the module docstring.
   */
  function importSpecifierFor(fixturePath: string, pair: LayerPair): string {
    if (pair.from.name === 'cli' && pair.to.name !== 'cli') {
      return `@seeya-ai/engine/${pair.to.targetDir}/index.js`;
    }
    return importPath(fixturePath, pair.to);
  }

  function testPair(pair: LayerPair): void {
    const label = pair.allowed ? 'allowed' : 'forbidden';
    it(
      `${pair.from.name} → ${pair.to.name} is ${label} [generated from the matrix]`,
      () => {
        const fileName = `${pair.from.name}-to-${pair.to.name}.ts`;
        // guardFixturePath's routing (srcRootForLayer) keys on the literal 'cli', not on
        // fixtureDir (which is '' for the cli layer, V2-T1) — so cli's own layer name is passed
        // through as-is, and every other layer keeps using its concrete fixtureDir (e.g.
        // 'adapters/clock': adapters/ has no index.ts of its own, see the Layer interface docs).
        const fixturePath = guardFixturePath(
          GUARD_NAME,
          pair.from.name === 'cli' ? 'cli' : pair.from.fixtureDir,
          fileName,
        );
        const content = `import '${importSpecifierFor(fixturePath, pair)}';\nexport {};\n`;
        created.push(writeTempFile(fixturePath, content));

        const result = runDependencyCruiser([fixturePath]);
        expect(result.jsonValid, result.raw).toBe(true);
        const violations = violationsOfFixture(result.violations, fixturePath);

        if (pair.allowed) {
          expect(violations, result.raw).toEqual([]);
        } else {
          expect(violations, result.raw).not.toEqual([]);
        }
      },
      TEST_TIMEOUT_MS,
    );
  }

  for (const pair of orderedPairs()) {
    testPair(pair);
  }
});
