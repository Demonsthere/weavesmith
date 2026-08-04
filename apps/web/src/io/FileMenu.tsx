import { useId, useRef, useState } from 'react';
import { PatternError, fromJSON, toJSON } from '@weavesmith/core';
import { useStore } from '../state/store.js';
import { defaultPattern } from '../state/defaultPattern.js';
import { clearPosition } from '../weave/position.js';
import { PatternName } from './PatternName.js';
import { SHARE_LIMIT, encodePattern, linkFor } from './share.js';
import { clearAutosave } from './storage.js';
import '../styles/controls.css';
import './fileMenu.css';

interface Report {
  message: string;
  problems: string[];
  /** Something to read or copy by hand, rather than a fault to fix. */
  detail?: string;
}

const problemsOf = (error: unknown): string[] =>
  error instanceof PatternError ? error.problems : ['this file could not be read'];

/** A pattern name that is safe to hand to a filesystem. */
const fileNameFor = (name: string): string =>
  `${name.replace(/[^A-Za-z0-9 _-]/g, '').trim() || 'band'}.json`;

/**
 * Save, open and share. Every failure path here ends in the same place: a
 * `role="alert"` listing `PatternError.problems` verbatim. The core writes
 * those messages for a weaver rather than for a log, and rewording them in
 * the UI would mean two places to keep honest.
 */
export function FileMenu() {
  const pattern = useStore((state) => state.pattern);
  const load = useStore((state) => state.load);
  const resetStore = useStore((state) => state.reset);
  const [report, setReport] = useState<Report | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const download = () => {
    const url = URL.createObjectURL(new Blob([toJSON(pattern)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileNameFor(pattern.meta.name);
    link.click();
    URL.revokeObjectURL(url);
    setReport(null);
  };

  const openFile = async (file: File) => {
    try {
      load(fromJSON(await file.text()));
      setReport(null);
    } catch (error) {
      setReport({ message: `${file.name} is not a WeaveSmith pattern:`, problems: problemsOf(error) });
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
    setReport({ message: 'Back to the default band.', problems: [] });
  };

  const copyLink = async () => {
    let encoded: string;
    try {
      // `encodePattern` runs `gcPalette`, which throws on a corrupt palette
      // or an out-of-range colour index. Uncaught, that would take out the
      // button instead of saying what is wrong with the band.
      encoded = encodePattern(pattern);
    } catch (error) {
      setReport({ message: 'This band cannot be shared yet:', problems: problemsOf(error) });
      return;
    }

    if (encoded.length > SHARE_LIMIT) {
      setReport({
        message:
          'This band is too large to put in a link. Use Download and send the file instead.',
        problems: [],
      });
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
      setReport({
        message: 'The clipboard is not available here. Copy this link by hand:',
        problems: [],
        detail: link,
      });
      return;
    }
    setReport({ message: 'Share link copied.', problems: [] });
  };

  return (
    <div className="filemenu">
      <PatternName />

      <button type="button" className="btn ghost" onClick={download}>
        Download
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
        Open a pattern file
      </label>

      <button type="button" className="btn ghost" onClick={() => void copyLink()}>
        Copy link
      </button>

      {confirmingReset ? (
        <span className="reset-confirm" role="group" aria-label="Confirm reset">
          <button type="button" className="btn" onClick={reset}>
            Discard and reset
          </button>
          <button type="button" className="btn ghost" onClick={() => setConfirmingReset(false)}>
            Cancel
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
          Reset to default
        </button>
      )}

      {report && (
        <div role="alert" className="filemenu-report">
          <p>{report.message}</p>
          {report.problems.length > 0 && (
            <ul>
              {report.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
          {report.detail && <code className="filemenu-detail">{report.detail}</code>}
        </div>
      )}
    </div>
  );
}
