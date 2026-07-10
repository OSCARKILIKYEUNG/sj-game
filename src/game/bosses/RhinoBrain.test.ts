import { describe, expect, it } from 'vitest';
import { GAME_WIDTH } from '../constants';
import { RhinoBrain } from './RhinoBrain';

describe('Rhino counter window', () => {
  it('stops inside the screen and becomes vulnerable after charging right', () => {
    const brain = new RhinoBrain();
    brain.state = 'charge';
    brain.direction = 1;
    brain.x = GAME_WIDTH - 80;
    brain.update(0.1, GAME_WIDTH - 20, 360);
    expect(brain.state).toBe('dizzy');
    expect(brain.x).toBe(GAME_WIDTH - brain.wallInset);
    expect(brain.vulnerable).toBe(true);
  });

  it('stops inside the screen and becomes vulnerable after charging left', () => {
    const brain = new RhinoBrain();
    brain.state = 'charge';
    brain.direction = -1;
    brain.x = 80;
    brain.update(0.1, 20, 360);
    expect(brain.state).toBe('dizzy');
    expect(brain.x).toBe(brain.wallInset);
    expect(brain.vulnerable).toBe(true);
  });

  it('keeps the dizzy counter window open for at least 2.2 seconds', () => {
    const brain = new RhinoBrain();
    brain.state = 'dizzy';
    brain.stateTime = 0;
    brain.update(2.2, 240, 360);
    expect(brain.state).toBe('dizzy');
    brain.update(0.21, 240, 360);
    expect(brain.state).toBe('hover');
  });
});
