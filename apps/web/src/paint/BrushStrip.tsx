import { useState } from 'react';
import { runCommand, clearTarget, paintTarget, solveTarget } from '../state/commands.js';
import { useStore } from '../state/store.js';
import { WOOL_NAMES } from '../editor/palette.js';
import '../styles/controls.css';
import './brushStrip.css';

/** A palette entry's name if it is one of the dyed-wool presets, else its hex. */
const colorName = (hex: string): string => WOOL_NAMES[hex] ?? hex;

/**
 * Paint mode's chrome: which colour the brush lays down, and the Solve that
 * turns the painting into turns.
 *
 * A swatch click both sets the brush and paints the current selection, so a
 * select-then-colour weaver and a drag-with-a-brush weaver each get one
 * gesture instead of two.
 *
 * The report is a visible `role="status"` line rather than the board's live
 * region: "3 unreachable" is something you read while deciding what to do
 * about it, not something that should flash past.
 */
export function BrushStrip() {
  const pattern = useStore((state) => state.pattern);
  const brush = useStore((state) => state.brush);
  const setBrush = useStore((state) => state.setBrush);
  const [report, setReport] = useState('');

  const pick = (index: number | null) => {
    setBrush(index);
    const { selection, apply } = useStore.getState();
    let message = '';
    apply((draft) => {
      message = index === null
        ? runCommand(draft, clearTarget, selection)
        : runCommand(draft, paintTarget, selection, index);
    }, index === null ? 'Clear target' : 'Paint target');
    setReport(message);
  };

  const solve = () => {
    let message = '';
    useStore.getState().apply((draft) => {
      message = runCommand(draft, solveTarget);
    }, 'Solve target');
    setReport(message);
  };

  return (
    <div className="brushstrip">
      <div className="swatches" role="group" aria-label="Brush colour">
        {/* Keyed by index, not by hex: nothing forbids a palette from
            carrying the same colour twice — validate only requires strings,
            and gcPalette dedupes by index rather than by value — so a hex
            key could collide. */}
        {pattern.palette.map((hex, index) => (
          <button
            key={index}
            type="button"
            className="swatch"
            style={{ background: hex }}
            aria-pressed={brush === index}
            aria-label={`Brush ${index + 1}, ${colorName(hex)}`}
            onClick={() => pick(index)}
          />
        ))}
        <button
          type="button"
          className="swatch erase"
          aria-pressed={brush === null}
          aria-label="Erase brush"
          onClick={() => pick(null)}
        >
          ⌧
        </button>
      </div>
      <button type="button" className="btn" onClick={solve}>
        Solve
      </button>
      <p className="brush-report" role="status">
        {report}
      </p>
    </div>
  );
}
