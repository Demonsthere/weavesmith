// Minimal ambient types for the two Node built-ins that
// `test/editor/cardEditorButtonStyle.test.ts` uses to read source files
// directly off disk. This project carries no `@types/node` dependency
// (apps/web's tsconfig only declares `vite/client` types, and this app
// follows core's zero-dependency lead) — declaring only the two function
// signatures actually used avoids pulling in a package for one test file.
// Node provides both for real at runtime regardless; this only satisfies
// the type checker, which — unlike core's — does cover `test/`.
//
// Must live in its own ambient (no top-level import/export) `.d.ts` file:
// a `declare module` written inside an ordinary module file is treated as
// an *augmentation* of an existing module, not a fresh declaration, and
// fails because neither module is otherwise known to TypeScript here.
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
}
declare module 'node:url' {
  export function fileURLToPath(url: URL): string;
}
