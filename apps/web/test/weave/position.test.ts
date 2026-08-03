import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hasSavedPosition, loadPosition, savePosition } from '../../src/weave/position.js';

describe('position', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns 0 for a pattern with no saved position', () => {
    expect(loadPosition('Chevron')).toBe(0);
    expect(hasSavedPosition('Chevron')).toBe(false);
  });

  it('round-trips a saved pick', () => {
    savePosition('Chevron', 7);
    expect(loadPosition('Chevron')).toBe(7);
    expect(hasSavedPosition('Chevron')).toBe(true);
  });

  it('keys position by pattern name, exactly as documented', () => {
    savePosition('Chevron', 3);
    expect(localStorage.getItem('weavesmith:position:Chevron')).toBe('3');
  });

  it('keeps positions for differently-named patterns separate', () => {
    savePosition('Chevron', 3);
    savePosition('Diamond', 9);
    expect(loadPosition('Chevron')).toBe(3);
    expect(loadPosition('Diamond')).toBe(9);
  });

  it('does not throw when localStorage.setItem throws (Safari private mode, quota)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => savePosition('Chevron', 4)).not.toThrow();
    spy.mockRestore();
  });

  it('falls back to 0 when localStorage.getItem throws', () => {
    savePosition('Chevron', 4);
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(loadPosition('Chevron')).toBe(0);
    expect(hasSavedPosition('Chevron')).toBe(false);
    spy.mockRestore();
  });
});
