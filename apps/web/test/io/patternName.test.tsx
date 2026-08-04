import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { PatternName } from '../../src/io/PatternName.js';
import { useStore } from '../../src/state/store.js';
import { defaultPattern } from '../../src/state/defaultPattern.js';
import { loadPosition, savePosition } from '../../src/weave/position.js';

const nameOf = () => useStore.getState().pattern.meta.name;
const field = () => screen.getByLabelText(/pattern name/i);

describe('PatternName', () => {
  beforeEach(() => {
    localStorage.clear();
    useStore.getState().reset();
  });

  it('shows the current name', () => {
    render(<PatternName />);
    expect(field()).toHaveValue('Chevron');
  });

  it('commits on blur', async () => {
    const user = userEvent.setup();
    render(<PatternName />);

    await user.clear(field());
    await user.type(field(), 'Snartemo');
    await user.tab();

    expect(nameOf()).toBe('Snartemo');
  });

  it('commits on Enter', async () => {
    const user = userEvent.setup();
    render(<PatternName />);

    await user.clear(field());
    await user.type(field(), 'Birka{Enter}');

    expect(nameOf()).toBe('Birka');
  });

  it('does not rename on every keystroke', async () => {
    // Typing eight characters must not cost eight undo steps.
    const user = userEvent.setup();
    render(<PatternName />);

    await user.clear(field());
    await user.type(field(), 'Snartemo');
    expect(nameOf()).toBe('Chevron');

    await user.tab();
    act(() => void useStore.getState().undo());
    expect(nameOf()).toBe('Chevron');
  });

  it('trims surrounding space', async () => {
    const user = userEvent.setup();
    render(<PatternName />);

    await user.clear(field());
    await user.type(field(), '  Birka  {Enter}');

    expect(nameOf()).toBe('Birka');
  });

  it('refuses a blank name and puts the old one back', async () => {
    const user = userEvent.setup();
    render(<PatternName />);

    await user.clear(field());
    await user.tab();

    expect(nameOf()).toBe('Chevron');
    expect(field()).toHaveValue('Chevron');
  });

  it('abandons the edit on Escape', async () => {
    const user = userEvent.setup();
    render(<PatternName />);

    await user.clear(field());
    await user.type(field(), 'Mistake{Escape}');

    expect(field()).toHaveValue('Chevron');
    expect(nameOf()).toBe('Chevron');
  });

  it('follows the name when a different pattern is loaded', () => {
    render(<PatternName />);
    act(() => useStore.getState().load({ ...defaultPattern(), meta: { name: 'From disk' } }));
    expect(field()).toHaveValue('From disk');
  });

  it('follows the name back on undo', async () => {
    const user = userEvent.setup();
    render(<PatternName />);

    await user.clear(field());
    await user.type(field(), 'Birka{Enter}');
    act(() => void useStore.getState().undo());

    expect(field()).toHaveValue('Chevron');
  });

  it('carries the loom position across a rename', async () => {
    // Position is keyed by pattern name (weave/position.ts). Without a
    // migration, renaming mid-band silently loses where the weaver had got
    // to — the one thing the at-loom tracker exists to remember.
    const user = userEvent.setup();
    savePosition('Chevron', 7);
    render(<PatternName />);

    await user.clear(field());
    await user.type(field(), 'Birka{Enter}');

    expect(loadPosition('Birka')).toBe(7);
    expect(localStorage.getItem('weavesmith:position:Chevron')).toBeNull();
  });
});
