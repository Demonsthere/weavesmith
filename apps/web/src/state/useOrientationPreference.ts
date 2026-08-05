import { useLayoutEffect } from 'react';
import { clearOrientation, readOrientation, writeOrientation } from '../io/preferences.js';
import { useStore } from './store.js';
import type { Orientation } from './store.js';

/**
 * Where the viewport stops being wide enough for cards-across. 720px is the
 * prototype's own breakpoint (`docs/mockups/board.html:525`), kept so the
 * shipped app flips where the mockup flipped.
 */
export const NARROW_WIDTH = 720;

/**
 * The orientation a viewport of this width asks for. Horizontal on a narrow
 * screen: a phone is tall and thin, so laying cards along the *long* axis
 * keeps the whole band width on screen and leaves "further along the pattern"
 * as the only scrolling axis — which is also the direction the work goes.
 */
export function orientationForWidth(width: number): Orientation {
  return width <= NARROW_WIDTH ? 'horizontal' : 'vertical';
}

/**
 * Wires the store's orientation to the two things outside it that have an
 * opinion: the viewport, and whatever the weaver chose last time.
 *
 * Precedence is the spec's — the override wins, and it sticks. A stored
 * choice is replayed as a real choice (so it pins), and the viewport only
 * ever speaks through `autoOrientation`, which a pin silences.
 *
 * A `resize` listener rather than a one-shot read at boot: a desktop window
 * dragged narrow is the same situation as a phone, and there is no reason for
 * the app to be right about it only until the first resize. `matchMedia`
 * would be the more idiomatic tool for a breakpoint, but the automatic choice
 * is a function of width and this keeps it testable as one.
 *
 * The write-back is a subscription rather than something the click handler
 * does, so the store stays the single source of truth for what is persisted:
 * pinned means "remember this", unpinned (`reset`, i.e. start over) means
 * "forget it", and localStorage simply mirrors that.
 *
 * A layout effect, not a plain one: the board it decides the shape of is the
 * largest thing on screen, and a `useEffect` would paint it vertical and then
 * transpose it on the exact devices the automatic choice exists for. Running
 * before paint means a phone's first frame is already horizontal.
 */
export function useOrientationPreference(): void {
  useLayoutEffect(() => {
    const stored = readOrientation();
    if (stored) useStore.getState().setOrientation(stored);

    const follow = () => {
      useStore.getState().autoOrientation(orientationForWidth(window.innerWidth));
    };
    follow();
    window.addEventListener('resize', follow);

    const unsubscribe = useStore.subscribe((state, previous) => {
      if (state.orientationPinned) {
        const changed = !previous.orientationPinned
          || state.orientation !== previous.orientation;
        if (changed) writeOrientation(state.orientation);
      } else if (previous.orientationPinned) {
        clearOrientation();
      }
    });

    return () => {
      window.removeEventListener('resize', follow);
      unsubscribe();
    };
  }, []);
}
