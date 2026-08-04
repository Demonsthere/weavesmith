import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App.js';
import { encodePattern } from '../../src/io/share.js';
import { autosave, restore } from '../../src/io/storage.js';
import { useStore } from '../../src/state/store.js';
import { defaultPattern } from '../../src/state/defaultPattern.js';

const named = (name: string) => ({ ...defaultPattern(), meta: { name } });

describe('App boot', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    useStore.getState().reset();
  });

  it('picks up where the last session stopped', async () => {
    autosave(named('Interrupted'));
    render(<App />);
    await waitFor(() => expect(useStore.getState().pattern.meta.name).toBe('Interrupted'));
  });

  it('opens a shared band from the hash', async () => {
    window.history.replaceState(null, '', `#p=${encodePattern(named('Shared'))}`);
    render(<App />);
    await waitFor(() => expect(useStore.getState().pattern.meta.name).toBe('Shared'));
  });

  it('says so when a share link is damaged', async () => {
    window.history.replaceState(null, '', '#p=not-a-real-hash');
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/damaged|not made by/i);
  });

  it('autosaves an edit', async () => {
    render(<App />);
    useStore.getState().apply((draft) => (draft.meta.name = 'Edited'), 'rename');
    await waitFor(() => expect(useStore.getState().pattern.meta.name).toBe('Edited'), {
      timeout: 2000,
    });
    // The subscription debounces, so this is a real wait, not an assertion
    // about the same tick.
    await waitFor(
      () => expect(JSON.parse(localStorage.getItem('weavesmith:autosave')!).meta.name).toBe('Edited'),
      { timeout: 2000 },
    );
  });
});

describe('reset in the running app', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    useStore.getState().reset();
  });

  it('does not let the autosave subscription resurrect the discarded band', async () => {
    // The reset clears the autosave, but resetting *is* a pattern change,
    // so App's subscription schedules another write half a second later.
    // What must not survive that write is the band being discarded.
    autosave(named('Uploaded'));
    render(<App />);
    await waitFor(() => expect(useStore.getState().pattern.meta.name).toBe('Uploaded'));

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^reset/i }));
    await user.click(screen.getByRole('button', { name: /discard/i }));

    // Checked *before* the debounce can fire: afterwards the subscription
    // writes the default band, which would make "not Uploaded" true whether
    // or not the reset actually cleared anything.
    expect(restore()).toBeNull();

    await waitFor(() => expect(restore()?.meta.name ?? 'Chevron').toBe('Chevron'), {
      timeout: 2000,
    });
  });
});
