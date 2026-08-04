import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App.js';
import { Footer } from '../../src/Footer.js';
import { useStore } from '../../src/state/store.js';

describe('Footer', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    useStore.getState().reset();
  });

  it('names the project', () => {
    render(<Footer />);
    expect(screen.getByRole('contentinfo')).toHaveTextContent(/weavesmith/i);
  });

  it('links to the source', () => {
    render(<Footer />);
    const link = screen.getByRole('link', { name: /source|github/i });
    expect(link).toHaveAttribute('href', 'https://github.com/Demonsthere/weavesmith');
  });

  it('links to the coffee page', () => {
    render(<Footer />);
    expect(screen.getByRole('link', { name: /coffee/i })).toHaveAttribute(
      'href',
      expect.stringContaining('buycoffee.to'),
    );
  });

  it('sends outbound links away safely', () => {
    // `target="_blank"` without `rel="noopener"` hands the opened page a
    // handle on this one. Both links leave the app, so both need it.
    render(<Footer />);
    for (const link of within(screen.getByRole('contentinfo')).getAllByRole('link')) {
      if (link.getAttribute('target') === '_blank') {
        expect(link.getAttribute('rel') ?? '').toMatch(/noopener/);
      }
    }
  });

  it('is one line, not a banner', () => {
    // The plan is explicit: hosting is free, so this is goodwill. Anything
    // that grows into a call to action has outgrown its welcome. The
    // button-styled chips are still links; nothing here is a `<button>`.
    render(<Footer />);
    expect(within(screen.getByRole('contentinfo')).queryAllByRole('button')).toHaveLength(0);
    expect(within(screen.getByRole('contentinfo')).queryAllByRole('heading')).toHaveLength(0);
  });

  it('styles the links as buttons without making them buttons', () => {
    // They navigate, so they stay anchors: middle-click, "copy link
    // address" and the browser's own focus order all come free that way,
    // and a `<button>` that calls `location.assign` throws every one of
    // those away for a shape that could have been CSS.
    render(<Footer />);
    for (const link of within(screen.getByRole('contentinfo')).getAllByRole('link')) {
      expect(link.tagName).toBe('A');
      expect(link.className).toMatch(/footer-btn/);
    }
  });

  it('leaves the icons out of the accessible name', () => {
    // The glyphs are decoration; the words carry the meaning. An unlabelled
    // inline SVG inside a link is a classic way to end up with a link whose
    // name is empty or, worse, "svg".
    render(<Footer />);
    const links = within(screen.getByRole('contentinfo')).getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.querySelector('svg')).not.toBeNull();
      expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
      expect(link.textContent?.trim()).not.toBe('');
    }
  });

  it('appears once in the app, below the board', () => {
    render(<App />);
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
  });
});
