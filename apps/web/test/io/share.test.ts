import { describe, expect, it } from 'vitest';
import { PatternError } from '@weavesmith/core';
import { decodePattern, encodePattern, SHARE_LIMIT } from '../../src/io/share.js';
import { defaultPattern } from '../../src/state/defaultPattern.js';

describe('share links', () => {
  it('round-trips a pattern through the hash', () => {
    const pattern = defaultPattern();
    expect(decodePattern(encodePattern(pattern))).toEqual(pattern);
  });

  it('produces URL-safe output', () => {
    expect(encodePattern(defaultPattern())).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('compresses well below the raw JSON size', () => {
    const pattern = defaultPattern();
    expect(encodePattern(pattern).length).toBeLessThan(JSON.stringify(pattern).length);
  });

  it('keeps a default band under the share limit', () => {
    expect(encodePattern(defaultPattern()).length).toBeLessThan(SHARE_LIMIT);
  });

  it('rejects a corrupted hash with a PatternError', () => {
    expect(() => decodePattern('not-a-real-hash')).toThrow(PatternError);
  });
});
