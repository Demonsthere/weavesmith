// Typed by ../nodeBuiltins.d.ts — this project has no `@types/node`
// dependency, see that file for why.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Read the actual source files straight off disk — not via a module import
// (Vite's CSS pipeline stubs `.css` content to an empty string under this
// project's vitest config, `?raw` included, so importing the stylesheets
// wouldn't actually exercise their contents) and, more importantly, not by
// rendering a component. This file must never import `WeaveBar.tsx` or
// `weaveBar.css`, anywhere, even transitively: the whole point is proving
// CardEditor's `.btn`/`.btn.ghost` styling is reachable from CardEditor's
// own sources, not merely because something else in the app happens to
// load `weaveBar.css` first.
const read = (relativePath: string): string =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

const cardEditorSource = read('../../src/editor/CardEditor.tsx');
const controlsCss = read('../../src/styles/controls.css');
const weaveBarCss = read('../../src/weave/weaveBar.css');

describe('CardEditor button styling does not depend on WeaveBar being imported', () => {
  it('imports the shared button stylesheet itself, rather than relying on another feature to load it first', () => {
    expect(cardEditorSource).toContain("import '../styles/controls.css';");
  });

  it('keeps `.btn` in the shared stylesheet, not duplicated into (or left only in) the weave-bar-specific file', () => {
    expect(controlsCss).toMatch(/^\.btn\s*\{/m);
    expect(controlsCss).toMatch(/^\.btn\.ghost/m);
    // `^` anchors to an actual rule, not merely a mention of `.btn` in a
    // comment (the file's header explains why the rule moved out).
    expect(weaveBarCss).not.toMatch(/^\.btn\b/m);
  });
});
