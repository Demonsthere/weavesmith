/**
 * Where-you-stopped, per pattern. Deliberately outside the `Pattern` object
 * and its own storage key (`weavesmith:position:<name>`, not folded into a
 * general document store) — sharing a pattern must not share where someone
 * happens to be weaving it, and renaming/editing the pattern must not lose
 * the position either (see the store's `currentPick`, which `apply` never
 * touches).
 *
 * Keyed by pattern name only, not an id — patterns don't have one yet, and
 * the brief's storage key is name-scoped. Two differently-named patterns
 * never collide; two same-named patterns share a position, which is the
 * same tradeoff the name-only key implies everywhere else in the app.
 */

const keyFor = (patternName: string): string => `weavesmith:position:${patternName}`;

/**
 * Persists the current pick for a pattern. `localStorage` can throw (Safari
 * private mode, quota exceeded) — that's not a reason to lose the user's
 * place in the *running* app, just to fail at surviving a reload, so the
 * error is swallowed rather than propagated.
 */
export function savePosition(patternName: string, pick: number): void {
  try {
    localStorage.setItem(keyFor(patternName), String(pick));
  } catch {
    // Best-effort persistence only; the in-memory position (the store's
    // currentPick) is unaffected either way.
  }
}

/**
 * Reads back the saved pick for a pattern, or 0 if there is none, the value
 * is unreadable, or storage access itself throws.
 */
export function loadPosition(patternName: string): number {
  try {
    const raw = localStorage.getItem(keyFor(patternName));
    if (raw === null) return 0;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

/**
 * Forgets the saved position for one pattern. Scoped to a single name on
 * purpose: starting over on this band must not wipe where the weaver had
 * got to on every other band they have open.
 */
export function clearPosition(patternName: string): void {
  try {
    localStorage.removeItem(keyFor(patternName));
  } catch {
    // Best-effort, as above.
  }
}

/**
 * Moves a saved position when the pattern is renamed. Without this, the
 * name-keyed store would strand the entry: a weaver who renames a band
 * mid-weave would come back to pick 1 and an orphaned key that nothing ever
 * reads again.
 *
 * Does nothing when there is no saved position — renaming a band you have
 * never woven must not invent a position for it, which is the same
 * distinction `hasSavedPosition` exists to make.
 */
export function renamePosition(oldName: string, newName: string): void {
  if (oldName === newName) return;
  try {
    const raw = localStorage.getItem(keyFor(oldName));
    if (raw === null) return;
    localStorage.setItem(keyFor(newName), raw);
    localStorage.removeItem(keyFor(oldName));
  } catch {
    // Same best-effort contract as savePosition: failing to carry the
    // position across is not a reason to fail the rename.
  }
}

/**
 * Whether a position has actually been saved for this pattern, as opposed
 * to `loadPosition` defaulting to 0. The distinction matters to callers
 * that only want to *hydrate* a stored position, never to impose 0 onto a
 * `currentPick` nothing has ever been saved for.
 */
export function hasSavedPosition(patternName: string): boolean {
  try {
    return localStorage.getItem(keyFor(patternName)) !== null;
  } catch {
    return false;
  }
}
