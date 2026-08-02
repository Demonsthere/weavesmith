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

// jsdom (25.x) parses `<dialog>` but implements none of its interactive
// API: no `showModal`, no `close`, and no native Escape → cancel → close
// chain. The card editor (Task 7) relies on all three for focus trapping
// and Escape-to-dismiss, so the stub below reproduces the real algorithm
// with actual bookkeeping — an `open` attribute that really flips, a
// `cancel` event fired first and cancelable, `close` firing only when
// `cancel` was not prevented — rather than a no-op that would let tests
// pass without the dialog ever really opening or closing.
if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
  // The stack of dialogs currently open via `showModal`, topmost last —
  // real browsers only send Escape to the topmost modal dialog.
  const openModals: HTMLDialogElement[] = [];

  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
    if (!openModals.includes(this)) openModals.push(this);
  };

  HTMLDialogElement.prototype.close = function (
    this: HTMLDialogElement,
    returnValue?: string,
  ) {
    if (!this.hasAttribute('open')) return;
    if (returnValue !== undefined) this.returnValue = returnValue;
    this.removeAttribute('open');
    const index = openModals.indexOf(this);
    if (index !== -1) openModals.splice(index, 1);
    this.dispatchEvent(new Event('close'));
  };

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const top = openModals.at(-1);
    if (!top) return;
    const notCancelled = top.dispatchEvent(new Event('cancel', { cancelable: true }));
    if (notCancelled) top.close();
  });
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
