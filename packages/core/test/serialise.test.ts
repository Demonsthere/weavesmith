import { describe, expect, it } from 'vitest';
import { fromJSON, PatternError, toJSON } from '../src/index.js';
import { buildPattern, card } from './helpers/build.js';

const valid = () => buildPattern([card([0, 1, 2, 3]), card([0, 1, 2, 3]),
                                  card([0, 1, 2, 3]), card([0, 1, 2, 3])], 4);

describe('toJSON / fromJSON', () => {
  it('round-trips a pattern unchanged', () => {
    const pattern = valid();
    expect(fromJSON(toJSON(pattern))).toEqual(pattern);
  });

  it('writes readable, diffable JSON', () => {
    expect(toJSON(valid())).toContain('\n');
  });

  it('throws PatternError listing every problem', () => {
    const broken = { ...valid(), version: 3 };
    try {
      fromJSON(JSON.stringify(broken));
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(PatternError);
      expect((error as PatternError).problems).toContain('unsupported version 3, expected 1');
    }
  });

  it('throws PatternError on text that is not JSON at all', () => {
    expect(() => fromJSON('not json')).toThrow(PatternError);
  });
});
