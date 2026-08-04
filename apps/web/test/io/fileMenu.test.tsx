import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toJSON } from '@weavesmith/core';
import type { Pattern, Turn } from '@weavesmith/core';
import { FileMenu } from '../../src/io/FileMenu.js';
import { SHARE_LIMIT, encodePattern } from '../../src/io/share.js';
import { useStore } from '../../src/state/store.js';
import { defaultPattern } from '../../src/state/defaultPattern.js';

const patternFile = (pattern: Pattern, name = 'band.json') =>
  new File([toJSON(pattern)], name, { type: 'application/json' });

/**
 * A band too big to fit in a URL. Turns alternate on a long, irregular
 * period so deflate cannot collapse the whole thing to nothing — a
 * uniformly-forward band of any size compresses to a few dozen bytes.
 */
function oversizedPattern(): Pattern {
  const base = defaultPattern();
  const cards = Array.from({ length: 40 }, (_, i) => ({
    ...base.cards[i % base.cards.length]!,
  }));
  const picks = Array.from({ length: 700 }, (_, pick) =>
    cards.map((_, card) => (((pick * 7 + card * 13) % 5) < 2 ? -1 : 1) as Turn),
  );
  return { ...base, cards, picks };
}

describe('FileMenu', () => {
  beforeEach(() => {
    useStore.getState().reset();
    window.history.replaceState(null, '', '/');
  });

  it('downloads the current pattern as JSON', async () => {
    const user = userEvent.setup();
    const created = vi.spyOn(URL, 'createObjectURL');
    const revoked = vi.spyOn(URL, 'revokeObjectURL');
    // Intercepting the click keeps jsdom from logging "Not implemented:
    // navigation" for the blob href, and lets the download *name* be
    // asserted — the thing that lands in the weaver's Downloads folder.
    const clicked = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    render(<FileMenu />);

    await user.click(screen.getByRole('button', { name: /download|save file/i }));

    expect(created).toHaveBeenCalledTimes(1);
    const blob = created.mock.calls[0]![0] as Blob;
    expect(JSON.parse(await blob.text())).toEqual(defaultPattern());
    expect((clicked.mock.instances[0] as HTMLAnchorElement).download).toBe('Chevron.json');
    expect(revoked).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });

  it('opens a pattern from a file', async () => {
    const user = userEvent.setup();
    render(<FileMenu />);
    const imported = { ...defaultPattern(), meta: { name: 'From disk' } };

    await user.upload(screen.getByLabelText(/open/i), patternFile(imported));

    await waitFor(() => expect(useStore.getState().pattern.meta.name).toBe('From disk'));
  });

  it('lists what is wrong with a file it cannot read, and keeps the current band', async () => {
    const user = userEvent.setup();
    render(<FileMenu />);

    await user.upload(
      screen.getByLabelText(/open/i),
      new File(['{ "nonsense": true }'], 'bad.json', { type: 'application/json' }),
    );

    const alert = await screen.findByRole('alert');
    expect(within(alert).getAllByRole('listitem').length).toBeGreaterThan(0);
    expect(useStore.getState().pattern).toEqual(defaultPattern());
  });

  it('copies a share link for the current pattern', async () => {
    const user = userEvent.setup();
    render(<FileMenu />);

    await user.click(screen.getByRole('button', { name: /link/i }));

    const copied = await navigator.clipboard.readText();
    expect(copied).toContain(`#p=${encodePattern(defaultPattern())}`);
  });

  it('refuses a link for a band too large for a URL and offers the file instead', async () => {
    const user = userEvent.setup();
    const pattern = oversizedPattern();
    // Guards the fixture itself: if compression ever improves enough that
    // this band fits, the test below would pass for the wrong reason.
    expect(encodePattern(pattern).length).toBeGreaterThan(SHARE_LIMIT);
    useStore.getState().load(pattern);
    render(<FileMenu />);
    // Asserted on the write, not on a later read: userEvent's clipboard stub
    // outlives a single test, so "the clipboard is empty" would be a claim
    // about whatever ran before this.
    const write = vi.spyOn(navigator.clipboard, 'writeText');

    await user.click(screen.getByRole('button', { name: /link/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/too large|too big/i);
    expect(alert).toHaveTextContent(/download|file/i);
    expect(write).not.toHaveBeenCalled();
    write.mockRestore();
  });

  it('reports a corrupt palette instead of the share button crashing', async () => {
    const user = userEvent.setup();
    // `encodePattern` runs `gcPalette`, which throws PatternError on an
    // out-of-range colour index rather than silently laundering it.
    const broken = defaultPattern();
    useStore.getState().load({
      ...broken,
      cards: broken.cards.map((card, i) =>
        i === 0 ? { ...card, colors: [99, 0, 0, 0] as [number, number, number, number] } : card,
      ),
    });
    render(<FileMenu />);

    await user.click(screen.getByRole('button', { name: /link/i }));

    const alert = await screen.findByRole('alert');
    expect(within(alert).getAllByRole('listitem').length).toBeGreaterThan(0);
  });
});
