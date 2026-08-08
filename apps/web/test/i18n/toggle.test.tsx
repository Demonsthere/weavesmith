import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App.js';
import * as boot from '../../src/io/boot.js';
import { defaultPattern } from '../../src/state/defaultPattern.js';
import { useStore } from '../../src/state/store.js';

describe('language toggle', () => {
  const originalHash = window.location.hash;

  beforeEach(() => {
    localStorage.clear();
    useStore.getState().setLocale('en');
    document.documentElement.lang = 'en';
  });

  // Carried-forward fix: the hash mutation and vi.spyOn mock below were
  // previously restored only at the end of the test body, so an assertion
  // failure above the restore would leak both into every later test in this
  // file. Restoring here runs regardless of how the test body exits.
  afterEach(() => {
    vi.restoreAllMocks();
    window.location.hash = originalHash;
  });

  it('switches the UI to Polish', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Polski' }));
    expect(screen.getByRole('link', { name: 'Plansza' })).toBeInTheDocument();
  });

  // Drives screen-reader voice selection and hyphenation. index.html
  // hardcodes lang="en", which would be a lie in Polish mode.
  it('updates the document language', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Polski' }));
    expect(document.documentElement.lang).toBe('pl');
  });

  it('marks the active language pressed', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Polski' }));
    expect(screen.getByRole('button', { name: 'Polski' })).toHaveAttribute(
      'aria-pressed', 'true',
    );
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute(
      'aria-pressed', 'false',
    );
  });

  // "PL" spoken aloud is not a language name, and a screen reader should
  // pronounce "Polski" with Polish phonemes rather than read it as English.
  it('names each language in its own language, and tags it', async () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'Polski' })).toHaveAttribute('lang', 'pl');
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('lang', 'en');
  });

  it('persists the choice', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Polski' }));
    expect(localStorage.getItem('weavesmith:locale')).toBe('pl');
  });

  it('restores a stored choice on a fresh mount', () => {
    localStorage.setItem('weavesmith:locale', 'pl');
    render(<App />);
    expect(screen.getByRole('link', { name: 'Plansza' })).toBeInTheDocument();
  });

  it('translates the control groups', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Polski' }));
    expect(screen.getByRole('group', { name: 'Orientacja' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Krajka pionowa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tkanie' })).toBeInTheDocument();
  });

  // Regression for a mixed-language boot alert: the fallback for an
  // unreadable share link must not be resolved before the boot effect's own
  // `setLocale` call has run, or it freezes in whatever locale was active
  // before that — English, since `beforeEach` above pins the store to it.
  // decodePattern currently converts every real failure into a PatternError
  // before bootPattern ever sees it (verified directly against
  // `bootPattern`/`decodePattern` — no hash reaches the `unreadable` arm),
  // so `bootPattern` itself is stubbed here to return that shape; everything
  // downstream — `useBoot`'s effect, `setLocale`, and the alert's render —
  // runs for real.
  it('shows an unreadable share link in the browser-preferred language, not frozen in the boot-time one', async () => {
    window.location.hash = '#p=corrupt-share-link';
    localStorage.setItem('weavesmith:locale', 'pl');
    vi.spyOn(boot, 'bootPattern').mockReturnValue({
      pattern: defaultPattern(),
      problems: null,
      unreadable: true,
    });

    render(<App />);
    const alert = await screen.findByRole('alert');

    expect(within(alert).getByText('nie udało się odczytać tego linku')).toBeInTheDocument();
    expect(within(alert).queryByText('this link could not be read')).not.toBeInTheDocument();
    expect(within(alert).getByText('Nie udało się otworzyć tego linku:')).toBeInTheDocument();
  });

  it('translates the board and its cells', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Polski' }));
    expect(screen.getByRole('grid', { name: 'Plansza tkania' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Liczba tabliczek' })).toBeInTheDocument();
    // The default band ("Chevron", state/defaultPattern.ts) is 8 cards x 24
    // picks with every turn forward, so this cell is deterministic.
    expect(
      screen.getByRole('gridcell', { name: 'Tabliczka 1, przeplot 1, obrót do przodu' }),
    ).toBeInTheDocument();
  });

  it('translates the card editor, including the dye names', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Polski' }));
    await userEvent.click(screen.getByRole('button', { name: /^Tabliczka 1, przewleczona/ }));
    expect(screen.getByRole('button', { name: 'Gotowe' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Ustaw wybrany otwór na marzanna #B4402C' }),
    ).toBeInTheDocument();
  });

  it('translates the weave bar', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Polski' }));
    await userEvent.click(screen.getByRole('button', { name: 'Tkanie' }));
    expect(screen.getByRole('button', { name: 'Następny przeplot' })).toBeInTheDocument();
  });
});
