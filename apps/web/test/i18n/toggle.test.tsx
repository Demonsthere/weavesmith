import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App.js';
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
});
