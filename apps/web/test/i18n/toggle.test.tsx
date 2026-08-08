import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App.js';
import * as boot from '../../src/io/boot.js';
import { defaultPattern } from '../../src/state/defaultPattern.js';
import { useStore } from '../../src/state/store.js';

describe('language toggle', () => {
  beforeEach(() => {
    localStorage.clear();
    useStore.getState().setLocale('en');
    document.documentElement.lang = 'en';
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
    const originalHash = window.location.hash;
    window.location.hash = '#p=corrupt-share-link';
    localStorage.setItem('weavesmith:locale', 'pl');
    const bootPattern = vi.spyOn(boot, 'bootPattern').mockReturnValue({
      pattern: defaultPattern(),
      problems: null,
      unreadable: true,
    });

    render(<App />);
    const alert = await screen.findByRole('alert');

    expect(within(alert).getByText('nie udało się odczytać tego linku')).toBeInTheDocument();
    expect(within(alert).queryByText('this link could not be read')).not.toBeInTheDocument();
    expect(within(alert).getByText('Nie udało się otworzyć tego linku:')).toBeInTheDocument();

    bootPattern.mockRestore();
    window.location.hash = originalHash;
  });
});
