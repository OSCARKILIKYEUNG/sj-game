import { describe, expect, it } from 'vitest';
import { SeededRng } from './rng';

describe('deterministic world generation RNG', () => {
  it('returns the same sequence for the same seed', () => {
    const first = new SeededRng(42);
    const second = new SeededRng(42);
    expect(Array.from({ length: 20 }, () => first.next())).toEqual(
      Array.from({ length: 20 }, () => second.next()),
    );
  });

  it('returns a different sequence for a different seed', () => {
    const first = new SeededRng(42);
    const second = new SeededRng(43);
    expect(first.next()).not.toBe(second.next());
  });
});
