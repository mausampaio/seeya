/**
 * D-052 (V2-T75): ambient module typing for `*.module.css` imports — esbuild's own native CSS
 * Modules support (`scripts/build.mjs`'s own comment on the renderer `esbuild.build` call) turns
 * `import styles from './X.module.css'` into a plain object mapping each LOCAL class name to its
 * scoped, bundled one (`{ root: 'X_root' }`, no camelCasing of the class name — the key is
 * exactly what the `.module.css` file wrote). TypeScript has no built-in knowledge of this; this
 * declaration is what lets every component under `renderer/` import one without `--noEmit`
 * complaining "cannot find module".
 */
declare module '*.module.css' {
  // `| undefined` (not plain `string`): this project's own `noUncheckedIndexedAccess` makes any
  // string-indexed lookup possibly-missing, honestly — `css-class.ts#cx`/`requiredClass` is the
  // one place that turns that into either a real `string` or a loud, named error.
  const classes: Record<string, string | undefined>;
  export default classes;
}
