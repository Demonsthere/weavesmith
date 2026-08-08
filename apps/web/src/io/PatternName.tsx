import { useEffect, useId, useState } from 'react';
import { useStore } from '../state/store.js';
import { renamePosition } from '../weave/position.js';
import { useT } from '../i18n/useT.js';

/**
 * The band's name, editable in place. It is document state — it rides along
 * in the file, the share link and the autosave — so it goes through `apply`
 * and is undoable like any other edit.
 *
 * The edit is buffered in local state and committed on blur or Enter rather
 * than on every keystroke: typing "Snartemo" is one rename, not eight, and
 * an undo stack with a step per character is useless. The effect below
 * re-syncs the field whenever the *stored* name changes under it — an undo,
 * a file opened, a share link followed — without fighting an edit in
 * progress, because those all change `name` and typing does not.
 */
export function PatternName() {
  const name = useStore((state) => state.pattern.meta.name);
  const apply = useStore((state) => state.apply);
  const [draft, setDraft] = useState(name);
  const inputId = useId();
  const t = useT();

  useEffect(() => setDraft(name), [name]);

  const commit = () => {
    const next = draft.trim();
    // A blank name is not a rename, it is a slip: an unnamed band would
    // download as `band.json` and lose its place in the position store.
    if (next === '' || next === name) {
      setDraft(name);
      return;
    }
    apply((pattern) => {
      pattern.meta.name = next;
    }, 'rename');
    // The loom position is keyed by name (weave/position.ts), so a rename
    // has to take it along or a weaver who renames mid-band loses the one
    // thing the tracker exists to remember.
    renamePosition(name, next);
  };

  return (
    <span className="pattern-name">
      <label htmlFor={inputId}>{t('name.label')}</label>
      <input
        id={inputId}
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          } else if (event.key === 'Escape') {
            // Abandon the edit. No commit, and nothing to undo.
            event.preventDefault();
            setDraft(name);
          }
        }}
      />
    </span>
  );
}
