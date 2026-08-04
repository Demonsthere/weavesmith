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
    // that grows into a call to action has outgrown its welcome.
    render(<Footer />);
    expect(within(screen.getByRole('contentinfo')).queryAllByRole('button')).toHaveLength(0);
    expect(within(screen.getByRole('contentinfo')).queryAllByRole('heading')).toHaveLength(0);
  });

  it('appears once in the app, below the board', () => {
    render(<App />);
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
  });
});
