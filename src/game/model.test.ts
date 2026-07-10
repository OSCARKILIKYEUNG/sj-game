import { describe, expect, it } from 'vitest';
import { BOSS_MAX_HP, PLAYER_MAX_LIVES } from './constants';
import { RunState, isImmediateGameOver } from './model';

describe('run life and boss contracts', () => {
  it('starts with three persistent player lives', () => {
    expect(new RunState().lives).toBe(PLAYER_MAX_LIVES);
  });

  it('loses one life per attack and ends on the third hit', () => {
    const run = new RunState();
    expect(run.damage()).toBe('life-lost');
    expect(run.lives).toBe(2);
    expect(run.damage()).toBe('life-lost');
    expect(run.lives).toBe(1);
    expect(run.damage()).toBe('game-over');
    expect(run.lives).toBe(0);
  });

  it('does not reset player lives when a boss begins', () => {
    const run = new RunState();
    run.damage();
    run.beginBoss();
    expect(run.lives).toBe(2);
    expect(run.bossHp).toBe(BOSS_MAX_HP);
  });

  it('bosses always take exactly three successful stomps', () => {
    const run = new RunState();
    run.beginBoss();
    expect(run.hitBoss()).toBe(false);
    expect(run.hitBoss()).toBe(false);
    expect(run.hitBoss()).toBe(true);
    expect(run.bossHp).toBe(0);
  });

  it('civilian rescue heals one life but never exceeds three', () => {
    const run = new RunState();
    expect(run.rescueCivilian()).toBe('already-full');
    run.damage();
    expect(run.rescueCivilian()).toBe('healed');
    expect(run.lives).toBe(3);
    expect(run.rescueCivilian()).toBe('already-full');
    expect(run.lives).toBe(3);
  });

  it('falling is immediate game over while ordinary damage is not', () => {
    expect(isImmediateGameOver('fall')).toBe(true);
    expect(isImmediateGameOver('damage')).toBe(false);
  });
});
