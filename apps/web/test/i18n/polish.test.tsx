import { render, screen, within } from '@testing-library/react';
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

  // The stepper's − and the editor's delete share one Polish label, which is a
  // decision rather than a collision: English distinguishes "Remove a card"
  // from "Delete card" because it has no case to lean on, and Polish says the
  // plain thing once. What makes that safe is the editor being a modal
  // `<dialog>` — while its button exists, the stepper's is inert, so the two
  // names are never live in the same breath. This test holds both halves of
  // that: each button carries the plain label, and the only reason a
  // document-wide query would be ambiguous is the dialog, so each is asserted
  // in its own scope.
  it('gives both destructive actions the same plain Polish label', async () => {
    const user = userEvent.setup();
    render(<App />);
    // Before the dialog opens, the stepper's is the only one in the document.
    expect(screen.getByRole('button', { name: 'Usuń tabliczkę' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Tabliczka 1, przewleczona/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Usuń tabliczkę' })).toBeInTheDocument();
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
