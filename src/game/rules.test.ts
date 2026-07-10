import { describe, expect, it } from 'vitest';
import { actorStartsAtScore, canDefeatActor } from './rules';

describe('street actor rules', () => {
  it('allows robbers to be defeated by one stomp or one web', () => {
    expect(canDefeatActor('robber', 'stomp')).toBe(true);
    expect(canDefeatActor('robber', 'web')).toBe(true);
  });

  it('does not allow police or civilians to be defeated', () => {
    expect(canDefeatActor('police', 'stomp')).toBe(false);
    expect(canDefeatActor('police', 'web')).toBe(false);
    expect(canDefeatActor('civilian', 'stomp')).toBe(false);
  });

  it('introduces robbers before police', () => {
    expect(actorStartsAtScore('robber')).toBe(5_000);
    expect(actorStartsAtScore('police')).toBeGreaterThan(actorStartsAtScore('robber'));
  });
});
