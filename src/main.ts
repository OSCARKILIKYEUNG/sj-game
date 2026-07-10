import Phaser from 'phaser';
import './style.css';
import { GAME_HEIGHT, GAME_WIDTH, PHYSICS } from './game/constants';
import { GameScene } from './game/scenes/GameScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-shell',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#f2ead6',
  transparent: false,
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: true,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: PHYSICS.gravity },
      debug: false,
    },
  },
  scene: [GameScene],
};

const game = new Phaser.Game(config);

function scene(): GameScene | null {
  try {
    return game.scene.getScene('Game') as GameScene;
  } catch {
    return null;
  }
}

const pauseButton = requiredButton('#pause-button');
const muteButton = requiredButton('#mute-button');
const resumeButton = requiredButton('#resume-button');

pauseButton.addEventListener('click', (event) => {
  event.stopPropagation();
  scene()?.toggleManualPause();
});

muteButton.addEventListener('click', (event) => {
  event.stopPropagation();
  const muted = scene()?.toggleMute() ?? false;
  syncMuteButton(muted);
});

resumeButton.addEventListener('click', (event) => {
  event.stopPropagation();
  scene()?.resumeFromOverlay();
});

document.addEventListener('visibilitychange', () => {
  scene()?.setPause('background', document.hidden);
});

window.addEventListener('blur', () => scene()?.setPause('background', true));
window.addEventListener('focus', () => {
  // Focus alone never resumes a run. The visible Resume button makes the state explicit.
});

const landscapeQuery = window.matchMedia('(orientation: landscape)');
const coarsePointerQuery = window.matchMedia('(pointer: coarse)');
const forcedTouch = new URLSearchParams(window.location.search).get('touch') === '1';
const syncRotation = (): void => {
  const shouldRotate = landscapeQuery.matches
    && (coarsePointerQuery.matches || navigator.maxTouchPoints > 0 || forcedTouch);
  document.querySelector('#rotate-overlay')?.classList.toggle('is-visible', shouldRotate);
  scene()?.setPause('rotate', shouldRotate);
};
landscapeQuery.addEventListener('change', syncRotation);
coarsePointerQuery.addEventListener('change', syncRotation);
window.addEventListener('orientationchange', syncRotation);
window.setTimeout(syncRotation, 150);
window.setTimeout(() => syncMuteButton(scene()?.isMuted() ?? false), 150);

document.addEventListener('contextmenu', (event) => event.preventDefault());

window.addEventListener('error', (event) => {
  const fatal = document.querySelector<HTMLElement>('#fatal');
  if (!fatal) return;
  fatal.hidden = false;
  fatal.textContent = `JS ERROR: ${event.message}\n${event.filename}:${event.lineno}`;
});

window.addEventListener('unhandledrejection', (event) => {
  const fatal = document.querySelector<HTMLElement>('#fatal');
  if (!fatal) return;
  fatal.hidden = false;
  fatal.textContent = `PROMISE ERROR: ${String(event.reason)}`;
});

function requiredButton(selector: string): HTMLButtonElement {
  const element = document.querySelector<HTMLButtonElement>(selector);
  if (!element) throw new Error(`Missing required button: ${selector}`);
  return element;
}

function syncMuteButton(muted: boolean): void {
  muteButton.textContent = muted ? '×' : '♪';
  muteButton.setAttribute('aria-label', muted ? 'Unmute game' : 'Mute game');
}
