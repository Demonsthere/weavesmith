import { MAX_CARDS, MIN_CARDS } from '@weavesmith/core';
import type { Threading } from '@weavesmith/core';
import { addCard, removalIndex, removeCard, runCommand } from '../state/commands.js';
import { useStore } from '../state/store.js';
import './cardStepper.css';

export interface CardStepperProps {
  /** Called with the index of the card just added, so the parent can open
   *  its editor — the natural next step after choosing a threading. */
  onAdded: (index: number) => void;
}

/**
 * The band-resizing control: `− | count | +S | +Z`. Threading is chosen at
 * creation (two buttons, not one plus a picker) so the button itself says
 * what it will produce — see the design spec's "Resizing the band".
 *
 * Both buttons delegate the actual editing decision to Task 3's commands:
 * `addCard` picks the S/Z-boundary insertion index itself, and `removalIndex`
 * (also in `commands.ts`, next to the `boundary` helper it shares logic
 * with) picks a removal index that is always just inside that boundary and
 * never a border card. Nothing about *which* card moves is decided here.
 */
export function CardStepper({ onAdded }: CardStepperProps) {
  const cardCount = useStore((state) => state.pattern.cards.length);
  const apply = useStore((state) => state.apply);

  const canAdd = cardCount < MAX_CARDS;
  const canRemove = cardCount > MIN_CARDS;

  const handleAdd = (threading: Threading) => {
    let index = -1;
    apply((draft) => {
      // addCard reports the index it chose alongside its CommandResult,
      // which doesn't fit runCommand's `(pattern, ...args) => CommandResult`
      // shape — fold its result into the draft the same way runCommand does.
      const added = addCard(draft, threading);
      Object.assign(draft, added.result.pattern);
      index = added.index;
    }, `Add ${threading}-threaded card`);
    if (index !== -1) onAdded(index);
  };

  const handleRemove = () => {
    apply((draft) => {
      runCommand(draft, removeCard, removalIndex(draft.cards));
    }, 'Remove a card');
  };

  return (
    <div className="stepper" role="group" aria-label="Number of cards">
      <button type="button" disabled={!canRemove} aria-label="Remove a card" onClick={handleRemove}>
        −
      </button>
      <span className="count">
        <span>{cardCount}</span>
        <small>cards</small>
      </span>
      <button
        type="button"
        className="add-s"
        disabled={!canAdd}
        aria-label="Add an S-threaded card"
        onClick={() => handleAdd('S')}
      >
        +S
      </button>
      <button
        type="button"
        className="add-z"
        disabled={!canAdd}
        aria-label="Add a Z-threaded card"
        onClick={() => handleAdd('Z')}
      >
        +Z
      </button>
    </div>
  );
}
