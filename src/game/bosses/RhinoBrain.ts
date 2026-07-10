import { GAME_WIDTH } from '../constants';

export type RhinoState = 'hover' | 'telegraph' | 'charge' | 'dizzy';

export class RhinoBrain {
  state: RhinoState = 'hover';
  x = GAME_WIDTH / 2;
  y = 220;
  direction: -1 | 1 = 1;
  stateTime = 0;
  attackCooldown = 1.8;
  targetY = 220;
  readonly wallInset = 58;

  update(deltaSeconds: number, playerX: number, playerY: number, loop = 0): void {
    this.stateTime += deltaSeconds;

    if (this.state === 'hover') {
      this.attackCooldown -= deltaSeconds;
      this.x += (GAME_WIDTH / 2 - this.x) * Math.min(1, deltaSeconds * 1.5);
      this.y += (220 - this.y) * Math.min(1, deltaSeconds * 2);
      if (this.attackCooldown <= 0) {
        this.state = 'telegraph';
        this.stateTime = 0;
        this.direction = playerX >= this.x ? 1 : -1;
        this.targetY = Math.max(155, Math.min(570, playerY + 40));
      }
      return;
    }

    if (this.state === 'telegraph') {
      this.y += (this.targetY - this.y) * Math.min(1, deltaSeconds * 6);
      if (this.stateTime >= 0.85) {
        this.state = 'charge';
        this.stateTime = 0;
      }
      return;
    }

    if (this.state === 'charge') {
      const speed = 690 + loop * 45;
      this.x += this.direction * speed * deltaSeconds;
      const reachedWall =
        (this.direction === 1 && this.x >= GAME_WIDTH - this.wallInset) ||
        (this.direction === -1 && this.x <= this.wallInset);
      if (reachedWall) {
        this.x = this.direction === 1 ? GAME_WIDTH - this.wallInset : this.wallInset;
        this.direction = this.direction === 1 ? -1 : 1;
        this.state = 'dizzy';
        this.stateTime = 0;
      }
      return;
    }

    if (this.stateTime >= 2.4) {
      this.state = 'hover';
      this.stateTime = 0;
      this.attackCooldown = Math.max(1.5, 2.8 - loop * 0.18);
    }
  }

  get vulnerable(): boolean {
    return this.state === 'dizzy';
  }
}
