import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// @testing-library/react's auto-cleanup relies on detecting a global
// `afterEach` (e.g. via vitest's `test.globals: true`). This project uses
// explicit vitest imports instead, so cleanup is wired up by hand — without
// it, DOM from one test's render() leaks into the next.
afterEach(() => {
  cleanup();
});

// jsdom (as of 25.x) does not implement the Pointer Events capture trio at
// all — not even as no-op stubs — so any code that calls
// `setPointerCapture`/`hasPointerCapture`/`releasePointerCapture` throws
// "not a function" under jsdom. The pointer binding relies on real capture
// semantics (a drag must keep receiving events even once the pointer leaves
// the board), so the fix belongs here — a small but real bookkeeping
// implementation, not a no-op that would hide a dropped feature.
if (typeof Element.prototype.setPointerCapture !== 'function') {
  const captured = new WeakMap<Element, Set<number>>();

  Element.prototype.setPointerCapture = function (pointerId: number) {
    let ids = captured.get(this);
    if (!ids) {
      ids = new Set();
      captured.set(this, ids);
    }
    ids.add(pointerId);
  };

  Element.prototype.releasePointerCapture = function (pointerId: number) {
    captured.get(this)?.delete(pointerId);
  };

  Element.prototype.hasPointerCapture = function (pointerId: number) {
    return captured.get(this)?.has(pointerId) ?? false;
  };
}

// jsdom also has no `window.matchMedia`. Default to "fine pointer with
// hover" (a desktop mouse) so the hover-preview path is exercised by
// default; tests that want to simulate a touch/coarse device override this
// per-test with their own `matchMedia` mock.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;
}
