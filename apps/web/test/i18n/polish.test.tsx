import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App.js';
import { useStore } from '../../src/state/store.js';

describe('the app in Polish', () => {
  beforeEach(() => {
    localStorage.clear();
    // App's own boot effect (App.tsx's useBoot) reads a stored locale on
    // every mount and calls setLocale itself, falling back to the browser
    // preference (jsdom always reports 'en-US') when nothing is stored —
    // that would stomp a bare `setLocale('pl')` call the instant <App />
    // mounts. Pre-seeding the same storage key the toggle persists to
    // (test/i18n/toggle.test.tsx's "restores a stored choice" test) is what
    // makes the boot effect itself land on Polish, the same way a returning
    // weaver's stored choice does.
    localStorage.setItem('weavesmith:locale', 'pl');
    useStore.getState().setLocale('pl');
  });

  it('renders its chrome in Polish', () => {
    render(<App />);
    expect(screen.getByRole('navigation', { name: 'Ekrany' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Plansza' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Tryb ekranu' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Źródło na GitHubie' })).toBeInTheDocument();
  });

  // Two different destructive actions, both reachable at once, and a screen
  // reader or voice-control user has nothing but the accessible name to tell
  // them apart. Both were 'Usuń tabliczkę' in Polish while English
  // distinguished "Remove a card" from "Delete card". `getByRole` with an
  // exact name is the assertion: it throws on an ambiguous match.
  it('names the two destructive actions distinguishably', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /^Tabliczka 1, przewleczona/ }));
    // The stepper's −, which removes a card the code chooses.
    expect(screen.getByRole('button', { name: 'Usuń jedną tabliczkę' })).toBeInTheDocument();
    // The editor's, which deletes the card being edited.
    expect(screen.getByRole('button', { name: 'Usuń tę tabliczkę' })).toBeInTheDocument();
  });

  // A documented gap, pinned rather than described: commands.ts is out of
  // scope, so the live region still announces English under a Polish board.
  // Closing that later must fail this test loudly — that is the whole point
  // of asserting it. The coupling to commands.ts wording is deliberate: the
  // wording IS the gap.
  it('still announces the live region in English (known gap)', async () => {
    const user = userEvent.setup();
    render(<App />);
    // Space flips the focused cell; toggleTurn's message is English-only.
    await user.click(screen.getByLabelText(/Tabliczka 1, przeplot 1,/));
    await user.keyboard(' ');
    expect(screen.getByRole('status')).toHaveTextContent('Flipped 1 cell');
  });
});
