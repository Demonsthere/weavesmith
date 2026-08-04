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
      'https://buycoffee.to/demonsthere',
    );
  });

  it('serves the coffee logo from our own origin', () => {
    // The snippet buycoffee.to hands out hot-links their image. This app is
    // a PWA whose entire promise is opening at a loom with no network, where
    // a remote image is a broken box — and it would also be a third-party
    // request on every single page load. Same pixels, served by us and
    // precached with everything else.
    render(<Footer />);
    const image = screen.getByRole('img', { name: /buycoffee/i });
    expect(image.getAttribute('src')).not.toMatch(/^https?:/);
    expect(image.getAttribute('src')).toMatch(/buycoffee-logo\.png$/);
  });

  it('reserves space for the coffee logo so the footer does not jump', () => {
    // Width and height as attributes, not just CSS: without them the
    // footer reflows the moment the image decodes.
    render(<Footer />);
    const image = screen.getByRole('img', { name: /buycoffee/i });
    expect(image).toHaveAttribute('width');
    expect(image).toHaveAttribute('height');
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

  it('keeps every footer link an anchor, never a button', () => {
    // They navigate, so they stay anchors: middle-click, "copy link
    // address" and the browser's own focus order all come free that way,
    // and a `<button>` that calls `location.assign` throws every one of
    // those away for a shape that could have been CSS.
    render(<Footer />);
    for (const link of within(screen.getByRole('contentinfo')).getAllByRole('link')) {
      expect(link.tagName).toBe('A');
    }
  });

  it('gives the source link a button shape and a decorative icon', () => {
    // The glyph decorates the words, which carry the meaning: an unlabelled
    // inline SVG inside a link is a classic way to end up with a link named
    // "svg", or named nothing at all.
    render(<Footer />);
    const link = screen.getByRole('link', { name: /source|github/i });
    expect(link.className).toMatch(/footer-btn/);
    expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(link.textContent?.trim()).not.toBe('');
  });

  it('every footer link says where it goes', () => {
    render(<Footer />);
    for (const link of within(screen.getByRole('contentinfo')).getAllByRole('link')) {
      expect((link.textContent?.trim() || link.querySelector('img')?.alt || '').length)
        .toBeGreaterThan(0);
    }
  });

  it('appears once in the app, below the board', () => {
    render(<App />);
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
  });
});
