import { describe, expect, it } from 'vitest';
import { detectLocale } from '../../src/i18n/detect.js';

describe('detectLocale', () => {
  it('matches on the primary subtag, so pl-PL is Polish', () => {
    expect(detectLocale(['pl-PL', 'en-GB'])).toBe('pl');
  });

  it('takes the first supported entry, not the first entry', () => {
    expect(detectLocale(['de-DE', 'pl'])).toBe('pl');
  });

  it('falls back to English when nothing is supported', () => {
    expect(detectLocale(['de', 'fr'])).toBe('en');
  });

  it('falls back to English on an empty list', () => {
    expect(detectLocale([])).toBe('en');
  });

  it('is case-insensitive', () => {
    expect(detectLocale(['PL'])).toBe('pl');
  });
});
