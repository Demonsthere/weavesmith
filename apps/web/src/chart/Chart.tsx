import { HOLE_LABELS } from '@weavesmith/core';
import { useStore } from '../state/store.js';
import { Summary } from './Summary.js';
import { WOOL_NAMES } from '../editor/palette.js';
import './chart.css';

/**
 * ↑/↓ are the glyphs a weaver reads off a GTT chart, so they stay — but they
 * are decoration here: the direction is carried by the cell's `title`, in
 * words. A chart that encodes direction in glyph or colour alone is unusable
 * to a screen reader and marginal in a photocopy.
 */
const GLYPH = { 1: '↑', '-1': '↓' } as const;
const DIRECTION = { 1: 'Forward', '-1': 'Backward' } as const;

const colorName = (hex: string): string => WOOL_NAMES[hex] ?? hex;

const COFFEE = 'buycoffee.to/demonsthere';
/*
 * Print-only, and deliberately so. A QR bridges paper to screen; a reader
 * looking at this in the browser is already on the device and would need a
 * second phone to scan their own monitor. On paper it is the only way
 * across — and this sheet is made to leave the screen.
 *
 * Served from our own origin rather than hot-linked: the chart has to print
 * from a laptop at a loom with no network.
 */
const COFFEE_QR = { src: './buycoffee-qr.png', size: 96 };

/**
 * The printable sheet: turning chart, threading diagram and summary, one
 * component for screen and paper (the spec is explicit that these are not
 * two renderings). Everything on it is derived from core — this component
 * decides layout, never weaving.
 */
export function Chart() {
  const pattern = useStore((state) => state.pattern);
  const { cards, picks } = pattern;

  return (
    <div className="chart-sheet">
      <Summary />

      <table className="chart">
        <caption>Turning chart</caption>
        <thead>
          <tr>
            <th scope="col">Pick</th>
            {cards.map((card, cardIndex) => (
              <th key={cardIndex} scope="col">
                {cardIndex + 1}
                <span className="sz">{card.threading}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {picks.map((turns, pickIndex) => (
            <tr key={pickIndex}>
              {/* A `td`, not a row header: the pick number is an index into
                  the band, and the brief's chart test counts it among the
                  row's cells. */}
              <td className="pick-no">{pickIndex + 1}</td>
              {turns.map((turn, cardIndex) => (
                <td key={cardIndex} className="turn" title={DIRECTION[turn]}>
                  <span aria-hidden="true">{GLYPH[turn]}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <aside className="chart-qr print-only" data-testid="chart-qr">
        <img
          src={COFFEE_QR.src}
          width={COFFEE_QR.size}
          height={COFFEE_QR.size}
          alt={`QR code linking to ${COFFEE}`}
        />
        {/* The address in text as well as in the code: a printed sheet
            outlives any one phone, and someone should be able to type it. */}
        <p>
          Made with WeaveSmith. If it was useful, <span>{COFFEE}</span>
        </p>
      </aside>

      {/* The spec asks the chart to carry a threading diagram as well as the
          grid — without it the sheet says how to turn the cards but not how
          to warp them, which is the half you need first. */}
      <table className="threading">
        <caption>Threading</caption>
        <thead>
          <tr>
            <th scope="col">Hole</th>
            {cards.map((card, cardIndex) => (
              <th key={cardIndex} scope="col">
                {cardIndex + 1}
                <span className="sz">{card.threading}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {HOLE_LABELS.map((label, hole) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              {cards.map((card, cardIndex) => {
                const hex = pattern.palette[card.colors[hole]!] ?? '';
                return (
                  <td key={cardIndex} className="thread">
                    <span
                      className="summary-swatch"
                      style={{ background: hex }}
                      aria-hidden="true"
                    />
                    {/* The name, not only the swatch: this sheet is printed,
                        often in monochrome. */}
                    <span className="thread-name">{colorName(hex)}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
