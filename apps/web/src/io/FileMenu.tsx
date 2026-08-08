import { useId, useRef, useState } from 'react';
import { PatternError, fromJSON, toJSON } from '@weavesmith/core';
import { useStore } from '../state/store.js';
import { defaultPattern } from '../state/defaultPattern.js';
import { clearPosition } from '../weave/position.js';
import { PatternName } from './PatternName.js';
import { SHARE_LIMIT, encodePattern, linkFor } from './share.js';
import { clearAutosave } from './storage.js';
import { downloadBlob, fileNameFor } from './download.js';
import { SVG_TYPE, bandToSVG, svgToPNG } from './exportImage.js';
import { useT } from '../i18n/useT.js';
import '../styles/controls.css';
import './fileMenu.css';

/**
 * A message the app itself writes, kept as the FACT of which sentence and
 * (where one applies) its interpolation argument — never as already-resolved
 * text. `resolveMessage` below is what turns this into words, at render
 * time, so a language switch while a report is on screen re-renders it
 * rather than leaving it frozen in whichever locale was active when the
 * report was created (the bug Task 6 fixed for the boot alert).
 */
type ReportMessage =
  | { kind: 'pngFailed' }
  | { kind: 'notAPattern'; name: string }
  | { kind: 'backToDefault' }
  | { kind: 'cannotShare' }
  | { kind: 'tooLargeToShare' }
  | { kind: 'noClipboard' }
  | { kind: 'linkCopied' };

/**
 * One `report.problems` entry. `{ text }` is rendered verbatim — either
 * `PatternError.problems` (core's own words) or a raw `Error.message` from
 * the browser — and is never translated. `{ key }` marks one of this app's
 * *own* fallback sentences, which are translated like any other of our
 * words; storing the key rather than calling `t` here is what keeps it out
 * of the frozen-string trap above.
 */
type Problem = { text: string } | { key: 'file.unreadable' | 'file.unknownReason' };

interface Report {
  message: ReportMessage;
  problems: Problem[];
  /** Something to read or copy by hand, rather than a fault to fix. */
  detail?: string;
}

// `problemsOf` is module-scope, not a component, so it cannot call `useT` —
// it returns the FACT of which problems to show (core's verbatim list, or
// our own fallback's key) and leaves resolving the fallback's words to
// `resolveMessage`/render, exactly as `bootPattern` (io/boot.ts) defers its
// own "unreadable" fact to the caller instead of translating it up front.
const problemsOf = (error: unknown): Problem[] =>
  error instanceof PatternError
    ? error.problems.map((text) => ({ text }))
    : [{ key: 'file.unreadable' }];

/** Turns a `ReportMessage` fact into words, at render time. */
function resolveMessage(t: ReturnType<typeof useT>, message: ReportMessage): string {
  switch (message.kind) {
    case 'pngFailed':
      return t('file.pngFailed');
    case 'notAPattern':
      return t('file.notAPattern', { name: message.name });
    case 'backToDefault':
      return t('file.backToDefault');
    case 'cannotShare':
      return t('file.cannotShare');
    case 'tooLargeToShare':
      return t('file.tooLargeToShare');
    case 'noClipboard':
      return t('file.noClipboard');
    case 'linkCopied':
      return t('file.linkCopied');
  }
}

/**
 * Save, open and share. Every failure path here ends in the same place: a
 * `role="alert"` listing `PatternError.problems` verbatim. The core writes
 * those messages for a weaver rather than for a log, and rewording them in
 * the UI would mean two places to keep honest.
 */
export function FileMenu() {
  const t = useT();
  const pattern = useStore((state) => state.pattern);
  const load = useStore((state) => state.load);
  const resetStore = useStore((state) => state.reset);
  const [report, setReport] = useState<Report | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const download = () => {
    downloadBlob(
      new Blob([toJSON(pattern)], { type: 'application/json' }),
      fileNameFor(pattern.meta.name, 'json'),
    );
    setReport(null);
  };

  const exportSVG = () => {
    downloadBlob(
      new Blob([bandToSVG(pattern)], { type: SVG_TYPE }),
      fileNameFor(pattern.meta.name, 'svg'),
    );
    setReport(null);
  };

  /**
   * PNG is the only export that can fail on the browser's side: it needs an
   * image decoder and a canvas, and a large band can exceed what the canvas
   * will rasterise. Say so rather than handing over an empty file.
   */
  const exportPNG = async () => {
    try {
      downloadBlob(await svgToPNG(bandToSVG(pattern)), fileNameFor(pattern.meta.name, 'png'));
      setReport(null);
    } catch (error) {
      setReport({
        message: { kind: 'pngFailed' },
        problems: [
          error instanceof Error ? { text: error.message } : { key: 'file.unknownReason' },
        ],
      });
    }
  };

  const openFile = async (file: File) => {
    try {
      load(fromJSON(await file.text()));
      setReport(null);
    } catch (error) {
      setReport({ message: { kind: 'notAPattern', name: file.name }, problems: problemsOf(error) });
    }
    // Clear the input so choosing the *same* file again still fires a change
    // event — otherwise a failed import cannot be retried after fixing it.
    if (fileInput.current) fileInput.current.value = '';
  };

  /**
   * Back to the default band, and back to a genuinely clean slate: the
   * autosave, the share link in the address bar and this band's loom
   * position all have to go, or the next reload quietly restores the very
   * thing that was just discarded.
   *
   * Confirmed in the UI rather than through `window.confirm` — a native
   * modal blocks the page, which makes this unusable from a test or an
   * automated run, and this button exists partly to serve those.
   */
  const reset = () => {
    const previousName = pattern.meta.name;
    resetStore();
    clearAutosave();
    clearPosition(defaultPattern().meta.name);
    // The band being discarded, if it was not the default one.
    clearPosition(previousName);
    if (window.location.hash.startsWith('#p=')) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    setConfirmingReset(false);
    setReport({ message: { kind: 'backToDefault' }, problems: [] });
  };

  const copyLink = async () => {
    let encoded: string;
    try {
      // `encodePattern` runs `gcPalette`, which throws on a corrupt palette
      // or an out-of-range colour index. Uncaught, that would take out the
      // button instead of saying what is wrong with the band.
      encoded = encodePattern(pattern);
    } catch (error) {
      setReport({ message: { kind: 'cannotShare' }, problems: problemsOf(error) });
      return;
    }

    if (encoded.length > SHARE_LIMIT) {
      setReport({ message: { kind: 'tooLargeToShare' }, problems: [] });
      return;
    }

    const link = linkFor(encoded);
    try {
      // The Clipboard API is not available over plain HTTP and can be
      // refused by permissions even when it is. Neither is a reason to lose
      // the link — showing it is a worse experience than copying it, but a
      // far better one than a button that silently does nothing.
      await navigator.clipboard.writeText(link);
    } catch {
      setReport({ message: { kind: 'noClipboard' }, problems: [], detail: link });
      return;
    }
    setReport({ message: { kind: 'linkCopied' }, problems: [] });
  };

  return (
    <div className="filemenu">
      <PatternName />

      <button type="button" className="btn ghost" onClick={download}>
        {t('file.download')}
      </button>

      {/* Input before label so the label can carry the input's focus ring
          (`input:focus-visible ~ .file-open` in fileMenu.css) — the input
          itself is off-screen, but it is the focusable thing. */}
      <input
        id={inputId}
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void openFile(file);
        }}
      />
      <label className="btn ghost file-open" htmlFor={inputId}>
        {t('file.open')}
      </label>

      <button type="button" className="btn ghost" onClick={exportSVG}>
        {t('file.exportSVG')}
      </button>

      <button type="button" className="btn ghost" onClick={() => void exportPNG()}>
        {t('file.exportPNG')}
      </button>

      <button type="button" className="btn ghost" onClick={() => void copyLink()}>
        {t('file.copyLink')}
      </button>

      {confirmingReset ? (
        <span className="reset-confirm" role="group" aria-label={t('file.confirmResetGroup')}>
          <button type="button" className="btn" onClick={reset}>
            {t('file.discardAndReset')}
          </button>
          <button type="button" className="btn ghost" onClick={() => setConfirmingReset(false)}>
            {t('file.cancel')}
          </button>
        </span>
      ) : (
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            setReport(null);
            setConfirmingReset(true);
          }}
        >
          {t('file.resetToDefault')}
        </button>
      )}

      {report && (
        <div role="alert" className="filemenu-report">
          <p>{resolveMessage(t, report.message)}</p>
          {report.problems.length > 0 && (
            <ul>
              {/* `problem.text` is rendered verbatim — core's own words, or a
                  raw browser Error.message — never translated. `problem.key`
                  is one of our own fallback sentences, resolved here so it
                  follows a language switch. */}
              {report.problems.map((problem, index) => (
                <li key={index}>{'text' in problem ? problem.text : t(problem.key)}</li>
              ))}
            </ul>
          )}
          {report.detail && <code className="filemenu-detail">{report.detail}</code>}
        </div>
      )}
    </div>
  );
}
