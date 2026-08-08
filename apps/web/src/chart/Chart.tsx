import { HOLE_LABELS } from '@weavesmith/core';
import { useStore } from '../state/store.js';
import { Summary } from './Summary.js';
import { useT } from '../i18n/useT.js';
import { useColorName } from '../i18n/useColorName.js';
import type { MessageKey } from '../i18n/messages/en.js';
import '../styles/controls.css';
import './chart.css';

/**
 * ↑/↓ are the glyphs a weaver reads off a GTT chart, so they stay — but they
 * are decoration here: the direction is carried by the cell's `title`, in
 * words. A chart that encodes direction in glyph or colour alone is unusable
 * to a screen reader and marginal in a photocopy.
 */
const GLYPH = { 1: '↑', '-1': '↓' } as const;
const DIRECTION_KEY: Record<1 | -1, MessageKey> = { 1: 'chart.forward', '-1': 'chart.backward' };

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
const COFFEE_QR = { src: './buycoffee-qr.png', size: 84 };

/**
 * The printable sheet: turning chart, threading diagram and summary, one
 * component for screen and paper (the spec is explicit that these are not
 * two renderings). Everything on it is derived from core — this component
 * decides layout, never weaving.
 */
export function Chart() {
  const t = useT();
  const pattern = useStore((state) => state.pattern);
  const { cards, picks } = pattern;
  const colorName = useColorName();

  return (
    <div className="chart-sheet" data-testid="chart-sheet">
      {/* Print masthead. The app chrome's banner is hidden on paper (see
          print.css), because a printed sheet wants its own heading: what
          made it on the left, which band it is underneath, and the QR
          tucked into the corner where it closes nothing and interrupts
          nothing. */}
      {/* Screen-only, and the counterpart to the masthead above: a weaver on
          a phone should not have to find "print to PDF" in a browser menu,
          which is where this sheet is least discoverable and most wanted.
          `window.print()` is the whole implementation — the print
          stylesheet already decides what a page looks like. */}
      <div className="chart-actions screen-only">
        <button type="button" className="btn" onClick={() => window.print()}>
          {t('chart.print')}
        </button>
      </div>

      <header className="chart-masthead print-only" data-testid="chart-masthead">
        <div className="masthead-titles">
          <p className="masthead-app">
            Weave<em>Smith</em>
          </p>
          {/* The band's name is the document's real title — without it a
              printed chart cannot be filed, handed on, or matched back to
              the file it came from. */}
          <h1 className="masthead-band">{pattern.meta.name}</h1>
        </div>
        <div className="masthead-coffee" data-testid="chart-qr">
          <img
            src={COFFEE_QR.src}
            width={COFFEE_QR.size}
            height={COFFEE_QR.size}
            alt={t('chart.qrAlt', { url: COFFEE })}
          />
          <span>{COFFEE}</span>
        </div>
      </header>

      <Summary />

      {/* The spec asks the chart to carry a threading diagram as well as the
          grid — without it the sheet says how to turn the cards but not how
          to warp them, which is the half you need first. */}
      <table className="threading" data-testid="chart-threading">
        <caption>{t('chart.threading')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('chart.hole')}</th>
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

      <table className="chart" data-testid="chart-turning">
        <caption>{t('chart.turningChart')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('chart.pick')}</th>
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
                <td key={cardIndex} className="turn" title={t(DIRECTION_KEY[turn])}>
                  <span aria-hidden="true">{GLYPH[turn]}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
