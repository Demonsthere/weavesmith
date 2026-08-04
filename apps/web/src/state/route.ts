import { useSyncExternalStore } from 'react';

/**
 * The two screens the design spec allows: Board and Chart. Weave mode is a
 * *mode* of the board, not a third screen, so it is deliberately absent
 * here — it lives in the store as `mode`.
 */
export type Route = 'board' | 'chart';

/**
 * Hash routing, because GitHub Pages serves no SPA rewrites: a real path
 * would 404 on reload or on a shared link.
 *
 * Anything unrecognised is the board. That is not just tidiness — Task 11
 * puts share payloads on the hash as `#p=<encoded>`, and those must open
 * the pattern on the board rather than on a blank screen.
 */
export function routeFromHash(hash: string): Route {
  const path = hash.replace(/^#/, '').split(/[?&]/)[0];
  return path === '/chart' ? 'chart' : 'board';
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

const getSnapshot = (): Route => routeFromHash(window.location.hash);

/**
 * `useSyncExternalStore` rather than `useState` + `useEffect`: the hash can
 * change between render and effect-attach, and this reads it at render time
 * so there is no window in which the component shows a stale screen.
 */
export function useRoute(): Route {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
