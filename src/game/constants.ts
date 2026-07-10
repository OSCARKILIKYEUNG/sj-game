export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 720;
export const START_Y = 630;
export const PLAYER_MAX_LIVES = 3;
export const BOSS_MAX_HP = 3;
export const BOSS_INTERVAL = 10_000;
export const ENEMY_START_SCORE = 5_000;

export const COLORS = {
  paper: 0xf2ead6,
  paperLight: 0xfff8e8,
  ink: 0x241f1d,
  red: 0xc92f32,
  redDark: 0x8f1f28,
  navy: 0x173d73,
  blue: 0x3767b1,
  gold: 0xf2b844,
  green: 0x69a844,
  tan: 0xc59b62,
  grey: 0x8e9099,
  sky: 0xdde8e5,
  window: 0xf0bd5a,
} as const;

export const PHYSICS = {
  gravity: 2_050,
  bounceVelocity: -820,
  springVelocity: -1_280,
  acceleration: 2_450,
  maxVelocityX: 365,
  drag: 0.86,
  glideCap: 150,
  webVelocity: 900,
} as const;

export const FONT_FAMILY = '"Segoe Print", "Chalkboard SE", "Comic Sans MS", cursive';
