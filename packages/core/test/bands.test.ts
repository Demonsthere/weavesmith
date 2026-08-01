import { describe, expect, it } from 'vitest';
import { simulate, targetOf } from '../src/index.js';
import type { Pattern } from '../src/index.js';
import type { Fixture } from './helpers/fixture.js';
import chevron from './fixtures/chevron-8.json' with { type: 'json' };
import published from './fixtures/oseberg-narrow.json' with { type: 'json' };

function bandOf(pattern: Pattern): string[] {
  return targetOf(simulate(pattern)).map((row) => row.join(''));
}

describe('chevron-8', () => {
  const fixture = chevron as unknown as Fixture;

  it('mirrors the two halves of the band', () => {
    for (const row of bandOf(fixture.pattern)) {
      expect(row).toBe([...row].reverse().join(''));
    }
  });

  it('holds the border cards at a solid colour', () => {
    for (const row of bandOf(fixture.pattern)) {
      expect(row[0]).toBe('0');
      expect(row[row.length - 1]).toBe('0');
    }
  });

  it('leans the two halves of the band in opposite directions', () => {
    const [first] = simulate(fixture.pattern);
    expect(first![1]!.lean).not.toBe(first![6]!.lean);
  });
});

describe('oseberg-narrow (published)', () => {
  const fixture = published as unknown as Fixture;

  it('reproduces the band as published', () => {
    expect(bandOf(fixture.pattern)).toEqual(fixture.expected);
  });
});
