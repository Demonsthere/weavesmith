import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { HOLE_LABELS, MIN_CARDS } from '@weavesmith/core';
import type { Hole, Threading } from '@weavesmith/core';
import { removeCard, runCommand, setHoleColor, setThreading } from '../state/commands.js';
import { useStore } from '../state/store.js';
import type { GestureToken } from '../state/store.js';
import { WOOL_NAMES, WOOL_PRESETS } from './palette.js';
import '../styles/controls.css';
import './cardEditor.css';

/** A wool name plus its hex where one is known (the dyed presets and
 *  anything else that happens to match one), otherwise just the hex —
 *  used for swatch accessible names so a screen-reader user hears "woad
 *  #2F5F8F" rather than a bare, indistinguishable colour code. */
function describeColor(hex: string): string {
  const name = WOOL_NAMES[hex];
  return name ? `${name} ${hex}` : hex;
}

export interface CardEditorProps {
  /** The card this dialog is open for, or null to render nothing. */
  cardIndex: number | null;
  onClose: () => void;
}

/**
 * The per-card editor: threading and the four hole colours. A real
 * `<dialog>` opened with `showModal()`, so focus trapping and Escape come
 * from the platform rather than being reimplemented here — this component
 * only reacts to the dialog's own `close` event (fired by Done, by Delete,
 * and by the browser's native Escape handling alike) to call `onClose`.
 *
 * No colour handling lives here: every hole assignment goes through Task
 * 3's `setHoleColor`, which re-points the hole at a palette entry (adding
 * one if the colour is new) and never edits an entry in place — editing in
 * place would recolour every other card sharing it. Threading and delete
 * go through `setThreading`/`removeCard` the same way.
 */
export function CardEditor({ cardIndex, onClose }: CardEditorProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedHole, setSelectedHole] = useState<Hole>(0);
  const pattern = useStore((state) => state.pattern);
  const apply = useStore((state) => state.apply);
  // The open colour-wheel drag, with the palette length it started from.
  // Null between drags. See `handleWheelChange` for why both halves matter.
  const wheelRef = useRef<{ token: GestureToken; baseLen: number } | null>(null);

  // `App` renders this component unconditionally (no `key`), so the
  // component instance — and its `useState` — survives across a change in
  // which card is open, even though the JSX collapses to `null` while
  // `cardIndex` is null: React only remounts on a type or `key` change,
  // neither of which happens here. So the reset has to happen in the
  // state, not rely on a mount that may not occur — every change of
  // `cardIndex` (including a different card opened without the dialog
  // ever fully unmounting) goes back to hole A.
  useEffect(() => {
    setSelectedHole(0);
  }, [cardIndex]);

  // A drag belongs to one hole of one card. Ending it here is what keeps
  // `baseLen` honest: the truncation below must never reach back past a
  // colour an earlier hole was given, or that hole's index would dangle past
  // the end of the palette.
  useEffect(() => {
    wheelRef.current = null;
  }, [cardIndex, selectedHole]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && cardIndex !== null && !dialog.open) dialog.showModal();
  }, [cardIndex]);

  if (cardIndex === null) return null;
  const card = pattern.cards[cardIndex];
  if (!card) return null;

  const canDelete = pattern.cards.length > MIN_CARDS;
  const singleCard = { anchor: { pick: 0, card: cardIndex }, focus: { pick: 0, card: cardIndex } };
  const usedInBand = pattern.palette.filter((hex) => !WOOL_PRESETS.includes(hex));

  const applyColor = (hex: string) => {
    apply((draft) => {
      runCommand(draft, setHoleColor, cardIndex, selectedHole, hex);
    }, `Set card ${cardIndex + 1} hole ${HOLE_LABELS[selectedHole]} to ${hex}`);
  };

  const setCardThreading = (threading: Threading) => {
    apply((draft) => {
      runCommand(draft, setThreading, singleCard, threading);
    }, `Set card ${cardIndex + 1} to ${threading} threading`);
  };

  const handleDelete = () => {
    apply((draft) => {
      runCommand(draft, removeCard, cardIndex);
    }, `Remove card ${cardIndex + 1}`);
    dialogRef.current?.close();
  };

  /**
   * One drag of the native colour wheel, not one edit per pointer move.
   *
   * React's `onChange` rides the DOM `input` event, which the picker fires
   * continuously while the pointer moves — so a single drag arrives here
   * dozens of times. Treated as dozens of edits (which it was), every colour
   * the pointer merely passed over became a permanent palette entry and its
   * own undo step; a band in the wild reached 113 entries that way.
   *
   * So the drag is one gesture — one undo entry — and each step first winds
   * the palette back to the length it had when the drag began, discarding the
   * entry the previous step appended before adding this one. Only colours at
   * or above `baseLen` are ever dropped, and the only thing pointing there is
   * the hole being edited.
   *
   * Re-checking `openGesture` rather than trusting the ref is what makes this
   * self-healing: anything else touching history (a preset swatch, an undo)
   * closes the gesture, and the next move simply opens a fresh one instead of
   * throwing.
   */
  const handleWheelChange = (event: ChangeEvent<HTMLInputElement>) => {
    const hex = event.target.value.toUpperCase();
    const store = useStore.getState();
    const open = wheelRef.current;

    if (open !== null && store.openGesture === open.token) {
      store.continueGesture(open.token, (draft) => {
        draft.palette.length = open.baseLen;
        runCommand(draft, setHoleColor, cardIndex, selectedHole, hex);
      });
      return;
    }

    const baseLen = store.pattern.palette.length;
    const token = store.beginGesture((draft) => {
      runCommand(draft, setHoleColor, cardIndex, selectedHole, hex);
      // Label without the hex: it is fixed when the drag starts, and the
      // colour it started on is not the one the weaver chose.
    }, `Set card ${cardIndex + 1} hole ${HOLE_LABELS[selectedHole]} colour`);
    wheelRef.current = { token, baseLen };
  };

  return (
    <dialog ref={dialogRef} aria-labelledby="editor-title" onClose={onClose}>
      <h2 id="editor-title">Card {cardIndex + 1}</h2>
      <p className="dsub">Threading and hole colours</p>

      <div
        className="segmented"
        role="group"
        aria-label="Threading direction"
        style={{ marginBottom: '1rem' }}
      >
        <button
          type="button"
          aria-pressed={card.threading === 'S'}
          onClick={() => setCardThreading('S')}
        >
          S threaded
        </button>
        <button
          type="button"
          aria-pressed={card.threading === 'Z'}
          onClick={() => setCardThreading('Z')}
        >
          Z threaded
        </button>
      </div>

      <h3 className="dlabel">Holes</h3>
      <div className="holes-edit">
        {card.colors.map((paletteIndex, hole) => {
          const label = HOLE_LABELS[hole as Hole];
          const hex = pattern.palette[paletteIndex]!;
          return (
            <div
              key={hole}
              className="hole-row"
              role="button"
              tabIndex={0}
              aria-selected={hole === selectedHole}
              aria-label={`Hole ${label}: ${hex}`}
              onClick={() => setSelectedHole(hole as Hole)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelectedHole(hole as Hole);
                }
              }}
            >
              <span className="label">{label}</span>
              <span className="swatch" style={{ background: hex }} />
              <span className="hex">{hex}</span>
            </div>
          );
        })}
      </div>

      <h3 className="dlabel">Dyed wool</h3>
      <div className="swatches">
        {WOOL_PRESETS.map((hex) => (
          <button
            key={hex}
            type="button"
            style={{ background: hex }}
            aria-label={`Set the selected hole to ${describeColor(hex)}`}
            onClick={() => applyColor(hex)}
          />
        ))}
      </div>

      {usedInBand.length > 0 && (
        <>
          <h3 className="dlabel">In this band</h3>
          <div className="swatches">
            {usedInBand.map((hex) => (
              <button
                key={hex}
                type="button"
                style={{ background: hex }}
                aria-label={`Set the selected hole to ${describeColor(hex)}`}
                onClick={() => applyColor(hex)}
              />
            ))}
          </div>
        </>
      )}

      <div className="wheel-row">
        <input
          type="color"
          aria-label="Custom colour"
          value={pattern.palette[card.colors[selectedHole]]!}
          onChange={handleWheelChange}
        />
        <label>Custom — applies to the selected hole</label>
      </div>

      <div className="dialog-actions">
        <button type="button" className="btn ghost" disabled={!canDelete} onClick={handleDelete}>
          Delete card
        </button>
        <button type="button" className="btn" onClick={() => dialogRef.current?.close()}>
          Done
        </button>
      </div>
    </dialog>
  );
}
