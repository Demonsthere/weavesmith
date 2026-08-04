import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App.js';
import { encodePattern } from '../../src/io/share.js';
import { autosave } from '../../src/io/storage.js';
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
