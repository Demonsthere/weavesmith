import { useCallback, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { Hole, Pattern, Threading, Turn } from '@weavesmith/core';
import { runCommand, setHole, setThreading, setTurn, toggleTurn } from '../state/commands.js';
import type { CommandResult } from '../state/commands.js';
import { useStore } from '../state/store.js';

export interface KeyboardBinding {
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  /** The last command's message (success or refusal), for the live region. */
  message: string;
}

/** Moves DOM focus to the cell now holding `selection.focus`, so the roving
 *  tabindex (Task 4's "exactly one tabbable cell") stays in step with the
 *  store after a keyboard-driven change. */
function focusCell(container: HTMLElement, pick: number, card: number): void {
  container.querySelector<HTMLElement>(`[data-pick="${pick}"][data-card="${card}"]`)
    ?.focus({ preventScroll: true });
}

/**
 * Translates keyboard events into calls on Task 3's command set and Task 2's
 * store — the keyboard counterpart to `usePointerBinding`. No editing logic
 * lives here: every mutation is computed by a command from `commands.ts` via
 * the shared `runCommand` helper; this hook only decides *which*
 * selection/direction/hole/threading to hand it, then surfaces the
 * command's `message` in the live region and moves DOM focus to match.
 *
 * Arrows are spatial, not semantic: they move the focus in the direction
 * pressed, so they swap axes with the layout — in `horizontal` orientation
 * cards run downward, so ArrowDown moves to the next *card*, not the next
 * pick (see the design spec's Orientation section). PageUp/PageDown (five
 * picks) and Home/End (first/last card) are the semantic counterpart and do
 * *not* swap — they mean the same thing in either orientation.
 */
export function useKeyboardBinding(): KeyboardBinding {
  const [message, setMessage] = useState('');

  const onKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    const {
      selection, pattern, orientation, moveFocus, setSelection, apply, undo, redo,
    } = useStore.getState();
    const cardCount = pattern.cards.length;
    const vertical = orientation === 'vertical';

    const refocus = () => {
      const { focus } = useStore.getState().selection;
      focusCell(container, focus.pick, focus.card);
    };

    const move = (dPick: number, dCard: number, extend: boolean) => {
      moveFocus(dPick, dCard, extend);
      refocus();
    };

    // A keyboard command is always single-shot (only a drag is a gesture),
    // so this always goes through `apply`. `runCommand` (shared with
    // `usePointerBinding`) runs `command(draft, ...args)` and folds the
    // result into the draft; the message it returns is what the live
    // region announces, refusals included.
    function run<Args extends unknown[]>(
      label: string,
      command: (p: Pattern, ...args: Args) => CommandResult,
      ...args: Args
    ) {
      let result = '';
      apply((draft) => {
        result = runCommand(draft, command, ...args);
      }, label);
      setMessage(result);
      refocus();
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      const label = event.shiftKey ? redo() : undo();
      setMessage(label ? `${event.shiftKey ? 'Redo' : 'Undo'}: ${label}` : 'Nothing to undo');
      refocus();
      return;
    }

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        vertical ? move(-1, 0, event.shiftKey) : move(0, -1, event.shiftKey);
        return;
      case 'ArrowDown':
        event.preventDefault();
        vertical ? move(1, 0, event.shiftKey) : move(0, 1, event.shiftKey);
        return;
      case 'ArrowLeft':
        event.preventDefault();
        vertical ? move(0, -1, event.shiftKey) : move(-1, 0, event.shiftKey);
        return;
      case 'ArrowRight':
        event.preventDefault();
        vertical ? move(0, 1, event.shiftKey) : move(1, 0, event.shiftKey);
        return;
      case 'PageUp':
        event.preventDefault();
        move(-5, 0, event.shiftKey);
        return;
      case 'PageDown':
        event.preventDefault();
        move(5, 0, event.shiftKey);
        return;
      case 'Home':
        event.preventDefault();
        move(0, -cardCount, event.shiftKey);
        return;
      case 'End':
        event.preventDefault();
        move(0, cardCount, event.shiftKey);
        return;
      case 'Escape':
        event.preventDefault();
        setSelection({ anchor: selection.focus, focus: selection.focus });
        setMessage('Selection collapsed');
        refocus();
        return;
      case ' ':
      case 'Enter':
        event.preventDefault();
        run('Toggle turn', toggleTurn, selection);
        return;
    }

    // The letter/digit commands are bare-key shortcuts, not chords — but
    // `f`/`b`/`s`/`z`/`e`/digits are also what Cmd/Ctrl+F/B/S/E and friends
    // type into, and the OS reserves those for Find/Bold/Save/etc. Swallow
    // nothing that isn't actually one of ours: any Ctrl/Meta/Alt held means
    // "let the browser handle it", full stop. Shift is exempt — it is
    // already meaningful for arrows and (via the branch above) for redo, and
    // none of these commands are case-sensitive.
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const key = event.key.toLowerCase();

    if (key === 'f' || key === 'b') {
      event.preventDefault();
      const dir: Turn = key === 'f' ? 1 : -1;
      run(`Set turn ${dir === 1 ? 'forward' : 'backward'}`, setTurn, selection, dir);
      return;
    }

    if (key === 's' || key === 'z') {
      event.preventDefault();
      const threading: Threading = key === 's' ? 'S' : 'Z';
      run(`Set threading ${threading}`, setThreading, selection, threading);
      return;
    }

    if (key === 'e') {
      event.preventDefault();
      // The card editor is Task 7's deliverable; there is nothing to open
      // yet, but the key is still handled (preventDefault) and announced so
      // this binding's contract does not change once it lands.
      setMessage(`Editing card ${selection.focus.card + 1}`);
      return;
    }

    if (event.key >= '1' && event.key <= '4') {
      event.preventDefault();
      const hole = (Number(event.key) - 1) as Hole;
      run(`Show hole ${event.key}`, setHole, selection, hole);
      return;
    }
  }, []);

  return { onKeyDown, message };
}
