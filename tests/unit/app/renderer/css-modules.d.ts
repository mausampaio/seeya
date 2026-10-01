/**
 * D-052 (V2-T75): mirrors `packages/app/src/renderer/css-modules.d.ts` — this directory's own
 * `tsconfig.json` is a SEPARATE TypeScript program from the one that type-checks
 * `packages/app/src/renderer/**` (that file's own docstring explains why two programs exist at
 * all), so an ambient module declaration living only in the other one is invisible here: a test
 * that imports a component which imports a `*.module.css` file needs its OWN copy of this
 * declaration to resolve that import at all.
 */
declare module '*.module.css' {
  const classes: Record<string, string | undefined>;
  export default classes;
}
