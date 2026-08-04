import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { FileMenu } from '../../src/io/FileMenu.js';
import { encodePattern } from '../../src/io/share.js';
import { autosave, restore } from '../../src/io/storage.js';
import { useStore } from '../../src/state/store.js';
import { defaultPattern } from '../../src/state/defaultPattern.js';
import { loadPosition, savePosition } from '../../src/weave/position.js';

const uploaded = { ...defaultPattern(), meta: { name: 'Someone elses band' } };
const resetButton = () => screen.getByRole('button', { name: /^reset/i });
const confirmButton = () => screen.getByRole('button', { name: /discard/i });

describe('reset to the default band', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    useStore.getState().reset();
  });

  it('asks before discarding, and leaves the band alone if you decline', async () => {
    const user = userEvent.setup();
    useStore.getState().load(uploaded);
    render(<FileMenu />);

    await user.click(resetButton());
    await user.click(screen.getByRole('button', { name: /cancel|keep/i }));

    expect(useStore.getState().pattern.meta.name).toBe('Someone elses band');
    expect(screen.queryByRole('button', { name: /discard/i })).not.toBeInTheDocument();
  });

  it('restores the default band once confirmed', async () => {
    const user = userEvent.setup();
    useStore.getState().load(uploaded);
    render(<FileMenu />);

    await user.click(resetButton());
    await user.click(confirmButton());

    expect(useStore.getState().pattern).toEqual(defaultPattern());
  });

  it('forgets the autosave, so a reload does not bring the old band back', async () => {
    const user = userEvent.setup();
    autosave(uploaded);
    useStore.getState().load(uploaded);
    render(<FileMenu />);

    await user.click(resetButton());
    await user.click(confirmButton());

    expect(restore()?.meta.name ?? null).not.toBe('Someone elses band');
  });

  it('drops a share link from the URL, so a reload does not reopen it', async () => {
    // The whole point of the reset is a clean slate to upload onto again.
    // Leaving `#p=…` in the address bar means the next reload silently
    // reopens the band that was just discarded.
    const user = userEvent.setup();
    window.history.replaceState(null, '', `#p=${encodePattern(uploaded)}`);
    useStore.getState().load(uploaded);
    render(<FileMenu />);

    await user.click(resetButton());
    await user.click(confirmButton());

    expect(window.location.hash).not.toContain('#p=');
  });

  it('forgets where the loom had got to on the default band', async () => {
    // `reset` means a blank slate; without this the position store would
    // hydrate the old pick straight back into the fresh band.
    const user = userEvent.setup();
    savePosition(defaultPattern().meta.name, 11);
    render(<FileMenu />);

    await user.click(resetButton());
    await user.click(confirmButton());

    expect(localStorage.getItem('weavesmith:position:Chevron')).toBeNull();
    expect(loadPosition('Chevron')).toBe(0);
  });

  it('leaves other bands positions alone', async () => {
    // Reset discards the current band, not every band you have ever woven.
    const user = userEvent.setup();
    savePosition('Snartemo', 4);
    render(<FileMenu />);

    await user.click(resetButton());
    await user.click(confirmButton());

    expect(loadPosition('Snartemo')).toBe(4);
  });

  it('keeps the board on screen rather than routing away', async () => {
    const user = userEvent.setup();
    render(<FileMenu />);

    await user.click(resetButton());
    await user.click(confirmButton());

    expect(screen.getByLabelText(/pattern name/i)).toHaveValue('Chevron');
  });
});
