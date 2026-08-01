import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { HOLE_LABELS, MIN_CARDS } from '@weavesmith/core';
import type { Hole, Threading } from '@weavesmith/core';
import { removeCard, runCommand, setHoleColor, setThreading } from '../state/commands.js';
import { useStore } from '../state/store.js';
import { WOOL_PRESETS } from './palette.js';
import './cardEditor.css';

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

  // A fresh mount happens every time the dialog goes from closed to open
  // (see the early return below), so `selectedHole`'s initial value already
  // covers "reset to hole A for a newly opened card" — this effect only
  // needs to call `showModal`.
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

  const handleWheelChange = (event: ChangeEvent<HTMLInputElement>) => {
    applyColor(event.target.value.toUpperCase());
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
            aria-label={`Set to ${hex}`}
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
                aria-label={`Set to ${hex}`}
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
