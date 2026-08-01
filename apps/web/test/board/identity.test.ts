import { describe, expect, it } from 'vitest';
import { identityColor, isLandmark } from '../../src/board/identity.js';
import { defaultPattern } from '../../src/state/defaultPattern.js';

describe('identityColor', () => {
  const cards = defaultPattern().cards;

  it('gives every S card the same hue and every Z card another', () => {
    const s = cards.map((c, i) => ({ c, i })).filter(({ c }) => c.threading === 'S');
    const z = cards.map((c, i) => ({ c, i })).filter(({ c }) => c.threading === 'Z');
    const sColors = new Set(s.map(({ c, i }) => identityColor(c, i, cards.length, 'threading')));
    const zColors = new Set(z.map(({ c, i }) => identityColor(c, i, cards.length, 'threading')));
    expect(sColors.size).toBe(1);
    expect(zColors.size).toBe(1);
    expect([...sColors][0]).not.toBe([...zColors][0]);
  });

  it('gives every card a distinct hue under the index scheme', () => {
    const colors = cards.map((c, i) => identityColor(c, i, cards.length, 'index'));
    expect(new Set(colors).size).toBe(cards.length);
  });
});

describe('isLandmark', () => {
  it('marks every fifth card, one-indexed', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(isLandmark))
      .toEqual([false, false, false, false, true, false, true]);
  });
});
