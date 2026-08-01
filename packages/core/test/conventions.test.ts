import { describe, expect, it } from 'vitest';
import { advance, holeAt, leanOf } from '../src/index.js';
import type { Rotation } from '../src/index.js';

const ROTATIONS: Rotation[] = [0, 1, 2, 3];

describe('advance', () => {
  it('wraps forward through four positions', () => {
    expect([0, 1, 2, 3].map((r) => advance(r as Rotation, 1))).toEqual([1, 2, 3, 0]);
  });

  it('wraps backward through four positions', () => {
    expect([0, 1, 2, 3].map((r) => advance(r as Rotation, -1))).toEqual([3, 0, 1, 2]);
  });

  it('returns to the start after four turns in one direction', () => {
    let pos: Rotation = 0;
    for (let i = 0; i < 4; i++) pos = advance(pos, 1);
    expect(pos).toBe(0);
  });
});

describe('holeAt', () => {
  it('shows every hole exactly once per full rotation', () => {
    for (const threading of ['S', 'Z'] as const) {
      const seen = ROTATIONS.map((r) => holeAt(r, threading));
      expect([...seen].sort()).toEqual([0, 1, 2, 3]);
    }
  });

  it('runs Z through the holes in the opposite direction to S', () => {
    // Z is S mirrored: turning a Z card forward walks the hole cycle the way
    // turning an S card backward does, from the same start.
    for (const rotation of ROTATIONS) {
      const mirrored = ((4 - rotation) % 4) as Rotation;
      expect(holeAt(rotation, 'Z')).toBe(holeAt(mirrored, 'S'));
    }
  });

  it('starts both threadings on hole A at rotation 0', () => {
    expect(holeAt(0, 'S')).toBe(0);
    expect(holeAt(0, 'Z')).toBe(0);
  });
});

describe('leanOf', () => {
  it('reverses when the turn reverses', () => {
    for (const threading of ['S', 'Z'] as const) {
      expect(leanOf(threading, 1)).not.toBe(leanOf(threading, -1));
    }
  });

  it('reverses when the threading reverses', () => {
    for (const turn of [1, -1] as const) {
      expect(leanOf('S', turn)).not.toBe(leanOf('Z', turn));
    }
  });

  it('is symmetric: flipping both threading and turn gives the same lean', () => {
    expect(leanOf('S', 1)).toBe(leanOf('Z', -1));
    expect(leanOf('Z', 1)).toBe(leanOf('S', -1));
  });
});
