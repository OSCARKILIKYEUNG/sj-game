import { BOSS_MAX_HP, PLAYER_MAX_LIVES } from './constants';

export type GamePhase = 'title' | 'play' | 'boss-intro' | 'boss' | 'boss-win' | 'dead';
export type DamageResult = 'life-lost' | 'game-over';
export type HealResult = 'healed' | 'already-full';
export type BossKind = 'sandman' | 'rhino';

export class RunState {
  lives = PLAYER_MAX_LIVES;
  bonus = 0;
  bossHp = BOSS_MAX_HP;
  rescued = 0;

  reset(): void {
    this.lives = PLAYER_MAX_LIVES;
    this.bonus = 0;
    this.bossHp = BOSS_MAX_HP;
    this.rescued = 0;
  }

  beginBoss(): void {
    this.bossHp = BOSS_MAX_HP;
  }

  damage(): DamageResult {
    this.lives = Math.max(0, this.lives - 1);
    return this.lives === 0 ? 'game-over' : 'life-lost';
  }

  rescueCivilian(): HealResult {
    this.rescued += 1;
    if (this.lives >= PLAYER_MAX_LIVES) return 'already-full';
    this.lives += 1;
    return 'healed';
  }

  hitBoss(): boolean {
    this.bossHp = Math.max(0, this.bossHp - 1);
    return this.bossHp === 0;
  }

  award(points: number): void {
    this.bonus += Math.max(0, Math.floor(points));
  }
}

export function isImmediateGameOver(reason: 'fall' | 'damage'): boolean {
  return reason === 'fall';
}
