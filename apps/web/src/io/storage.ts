import { fromJSON, toJSON } from '@weavesmith/core';
import type { Pattern } from '@weavesmith/core';

const AUTOSAVE_KEY = 'weavesmith:autosave';
const SAVE_PREFIX = 'weavesmith:save:';

/** How long a burst of edits is allowed to run before it costs a write. */
export const AUTOSAVE_DELAY = 500;

/**
 * Every read path here returns `null` rather than throwing. A damaged
 * autosave should cost you the autosave, not the app: throwing on boot
 * would leave a weaver with a blank screen and no way back, and the
 * fallback (the default band) is always available.
 *
 * Writes are best-effort for the same reason — Safari's private mode and a
 * full quota both throw from `setItem`, and neither is a reason to take
 * down a session that is otherwise working fine.
 */
function readPattern(key: string): Pattern | null {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : fromJSON(raw);
  } catch {
    return null;
  }
}

function writePattern(key: string, pattern: Pattern): void {
  try {
    localStorage.setItem(key, toJSON(pattern));
  } catch {
    // Best-effort persistence; the in-memory pattern is unaffected.
  }
}

/** Writes the working pattern immediately. */
export function autosave(pattern: Pattern): void {
  writePattern(AUTOSAVE_KEY, pattern);
}

export function restore(): Pattern | null {
  return readPattern(AUTOSAVE_KEY);
}

let pending: ReturnType<typeof setTimeout> | null = null;

/**
 * Trailing-edge debounce around `autosave`. The debounce lives here rather
 * than inside `autosave` itself so the primitive stays synchronous and
 * directly testable: a pointer drag calls this on every move and wants one
 * write, but a caller that means "persist this now" should not have to
 * flush a timer to get it.
 */
export function autosaveSoon(pattern: Pattern): void {
  if (pending !== null) clearTimeout(pending);
  pending = setTimeout(() => {
    pending = null;
    autosave(pattern);
  }, AUTOSAVE_DELAY);
}

/** Named saves, keyed `weavesmith:save:<name>`. */
export function save(name: string, pattern: Pattern): void {
  writePattern(SAVE_PREFIX + name, pattern);
}

export function open(name: string): Pattern | null {
  return readPattern(SAVE_PREFIX + name);
}

export function listSaves(): string[] {
  try {
    return Object.keys(localStorage)
      .filter((key) => key.startsWith(SAVE_PREFIX))
      .map((key) => key.slice(SAVE_PREFIX.length));
  } catch {
    return [];
  }
}
