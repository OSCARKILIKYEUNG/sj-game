import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from './constants';

function texture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (graphics: Phaser.GameObjects.Graphics) => void,
): void {
  if (scene.textures.exists(key)) return;
  const graphics = scene.add.graphics();
  draw(graphics);
  graphics.generateTexture(key, width, height);
  graphics.destroy();
}

function inkRect(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: number,
  radius = 4,
): void {
  graphics.fillStyle(fill, 1);
  graphics.fillRoundedRect(x, y, width, height, radius);
  graphics.lineStyle(3, COLORS.ink, 1);
  graphics.strokeRoundedRect(x, y, width, height, radius);
}

export function createGameTextures(scene: Phaser.Scene): void {
  texture(scene, 'spidey', 42, 58, (g) => {
    g.fillStyle(COLORS.red, 1).fillCircle(21, 14, 12);
    g.lineStyle(3, COLORS.ink, 1).strokeCircle(21, 14, 12);
    g.fillStyle(COLORS.paperLight, 1);
    g.fillTriangle(12, 10, 18, 7, 18, 15);
    g.fillTriangle(30, 10, 24, 7, 24, 15);
    g.lineStyle(2, COLORS.ink, 1);
    g.strokeTriangle(12, 10, 18, 7, 18, 15);
    g.strokeTriangle(30, 10, 24, 7, 24, 15);
    g.fillStyle(COLORS.red, 1).fillRoundedRect(11, 25, 20, 21, 6);
    g.lineStyle(3, COLORS.ink, 1).strokeRoundedRect(11, 25, 20, 21, 6);
    g.fillStyle(COLORS.navy, 1).fillRect(12, 39, 8, 15).fillRect(23, 39, 8, 15);
    g.lineStyle(3, COLORS.ink, 1);
    g.strokeLineShape(new Phaser.Geom.Line(12, 30, 3, 42));
    g.strokeLineShape(new Phaser.Geom.Line(30, 30, 39, 42));
    g.lineStyle(1, COLORS.ink, 0.8);
    g.strokeLineShape(new Phaser.Geom.Line(21, 3, 21, 23));
    g.strokeCircle(21, 14, 7);
  });

  texture(scene, 'life-mask', 24, 24, (g) => {
    g.fillStyle(COLORS.red, 1).fillCircle(12, 12, 10);
    g.lineStyle(2, COLORS.ink, 1).strokeCircle(12, 12, 10);
    g.fillStyle(COLORS.paperLight, 1);
    g.fillTriangle(5, 10, 10, 7, 10, 14);
    g.fillTriangle(19, 10, 14, 7, 14, 14);
  });

  const platformColors: ReadonlyArray<readonly [string, number]> = [
    ['platform-normal', COLORS.green],
    ['platform-moving', COLORS.blue],
    ['platform-crumble', COLORS.tan],
    ['platform-rotten', COLORS.grey],
    ['platform-arena', COLORS.redDark],
  ];
  for (const [key, color] of platformColors) {
    texture(scene, key, 92, 18, (g) => {
      inkRect(g, 2, 3, 88, 12, color, 5);
      g.lineStyle(1, COLORS.paperLight, 0.55);
      g.strokeLineShape(new Phaser.Geom.Line(12, 7, 74, 8));
      if (key === 'platform-rotten') {
        g.lineStyle(2, COLORS.ink, 1);
        g.strokeLineShape(new Phaser.Geom.Line(32, 3, 42, 15));
        g.strokeLineShape(new Phaser.Geom.Line(42, 15, 54, 4));
      }
    });
  }

  texture(scene, 'pickup-web', 32, 32, (g) => {
    g.fillStyle(COLORS.paperLight, 1).fillCircle(16, 16, 13);
    g.lineStyle(2, COLORS.red, 1).strokeCircle(16, 16, 13);
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      g.strokeLineShape(new Phaser.Geom.Line(16, 16, 16 + Math.cos(angle) * 12, 16 + Math.sin(angle) * 12));
    }
    g.strokeCircle(16, 16, 6);
  });

  texture(scene, 'pickup-wing', 34, 30, (g) => {
    g.fillStyle(COLORS.blue, 1);
    g.fillTriangle(17, 15, 1, 4, 8, 25);
    g.fillTriangle(17, 15, 33, 4, 26, 25);
    g.lineStyle(2, COLORS.ink, 1);
    g.strokeTriangle(17, 15, 1, 4, 8, 25);
    g.strokeTriangle(17, 15, 33, 4, 26, 25);
  });

  texture(scene, 'pickup-iron', 38, 38, (g) => {
    g.fillStyle(COLORS.red, 1).fillCircle(19, 19, 17);
    g.lineStyle(3, COLORS.ink, 1).strokeCircle(19, 19, 17);
    g.fillStyle(COLORS.gold, 1).fillCircle(19, 19, 9);
    g.lineStyle(2, COLORS.paperLight, 1).strokeCircle(19, 19, 7);
    g.fillStyle(0xbfeaff, 1).fillCircle(19, 19, 4);
  });

  texture(scene, 'ironman', 48, 64, (g) => {
    g.fillStyle(COLORS.gold, 1).fillRoundedRect(13, 2, 22, 20, 6);
    g.lineStyle(3, COLORS.ink, 1).strokeRoundedRect(13, 2, 22, 20, 6);
    g.fillStyle(COLORS.red, 1).fillRect(14, 20, 20, 29);
    g.lineStyle(3, COLORS.ink, 1).strokeRect(14, 20, 20, 29);
    g.fillStyle(0xc9f7ff, 1).fillCircle(24, 31, 5);
    g.fillStyle(COLORS.red, 1).fillRect(4, 22, 10, 28).fillRect(34, 22, 10, 28);
    g.fillStyle(COLORS.gold, 1).fillRect(15, 48, 8, 14).fillRect(26, 48, 8, 14);
    g.fillStyle(0xd8faff, 0.9).fillTriangle(15, 61, 23, 61, 19, 54);
    g.fillTriangle(26, 61, 34, 61, 30, 54);
  });

  texture(scene, 'robber', 46, 54, (g) => {
    g.fillStyle(0xd5a77c, 1).fillCircle(21, 13, 10);
    g.fillStyle(COLORS.ink, 1).fillRoundedRect(10, 2, 22, 9, 4);
    g.fillStyle(0x403b43, 1).fillRect(10, 24, 23, 22);
    g.lineStyle(3, COLORS.ink, 1).strokeRect(10, 24, 23, 22);
    g.lineStyle(3, COLORS.paperLight, 1);
    g.strokeLineShape(new Phaser.Geom.Line(12, 29, 31, 29));
    g.strokeLineShape(new Phaser.Geom.Line(12, 36, 31, 36));
    g.fillStyle(COLORS.grey, 1).fillTriangle(35, 28, 45, 20, 39, 34);
    g.lineStyle(2, COLORS.ink, 1).strokeTriangle(35, 28, 45, 20, 39, 34);
    g.fillStyle(COLORS.ink, 1).fillRect(11, 45, 8, 9).fillRect(25, 45, 8, 9);
  });

  texture(scene, 'police', 44, 56, (g) => {
    g.fillStyle(0xb47b5e, 1).fillCircle(22, 14, 10);
    g.fillStyle(COLORS.navy, 1).fillRect(9, 3, 26, 8);
    g.fillTriangle(10, 10, 34, 10, 30, 15);
    g.fillRoundedRect(10, 24, 24, 24, 4);
    g.lineStyle(3, COLORS.ink, 1).strokeRoundedRect(10, 24, 24, 24, 4);
    g.fillStyle(COLORS.gold, 1).fillCircle(22, 32, 4);
    g.fillStyle(COLORS.ink, 1).fillRect(11, 47, 8, 9).fillRect(25, 47, 8, 9);
    g.fillStyle(COLORS.grey, 1).fillRect(34, 29, 10, 5);
  });

  texture(scene, 'civilian', 40, 52, (g) => {
    g.fillStyle(0xc68b64, 1).fillCircle(20, 12, 10);
    g.fillStyle(COLORS.gold, 1).fillCircle(20, 5, 9);
    g.fillStyle(0x7d4f98, 1).fillRoundedRect(9, 23, 22, 21, 5);
    g.lineStyle(3, COLORS.ink, 1).strokeRoundedRect(9, 23, 22, 21, 5);
    g.lineStyle(4, COLORS.ink, 1);
    g.strokeLineShape(new Phaser.Geom.Line(10, 27, 1, 17));
    g.strokeLineShape(new Phaser.Geom.Line(30, 27, 38, 15));
    g.fillStyle(COLORS.ink, 1).fillRect(10, 43, 7, 9).fillRect(24, 43, 7, 9);
  });

  texture(scene, 'web-shot', 12, 26, (g) => {
    g.lineStyle(3, COLORS.paperLight, 1);
    g.strokeLineShape(new Phaser.Geom.Line(6, 25, 6, 4));
    g.strokeCircle(6, 5, 4);
    g.lineStyle(1, COLORS.ink, 0.75).strokeCircle(6, 5, 4);
  });

  texture(scene, 'bullet', 12, 12, (g) => {
    g.fillStyle(COLORS.gold, 1).fillCircle(6, 6, 5);
    g.lineStyle(2, COLORS.ink, 1).strokeCircle(6, 6, 5);
  });

  texture(scene, 'sand-glob', 20, 20, (g) => {
    g.fillStyle(COLORS.tan, 1).fillCircle(10, 10, 9);
    g.lineStyle(2, COLORS.ink, 1).strokeCircle(10, 10, 9);
  });

  texture(scene, 'sandman', 82, 92, (g) => {
    g.fillStyle(COLORS.tan, 1).fillCircle(41, 27, 22);
    g.fillRoundedRect(12, 43, 58, 43, 18);
    g.lineStyle(4, COLORS.ink, 1).strokeCircle(41, 27, 22);
    g.strokeRoundedRect(12, 43, 58, 43, 18);
    g.fillStyle(COLORS.ink, 1).fillCircle(33, 23, 3).fillCircle(49, 23, 3);
    g.lineStyle(3, COLORS.ink, 1).strokeLineShape(new Phaser.Geom.Line(33, 36, 49, 36));
    g.lineStyle(3, 0x8e653e, 0.9);
    g.strokeLineShape(new Phaser.Geom.Line(22, 55, 60, 74));
    g.strokeLineShape(new Phaser.Geom.Line(60, 53, 25, 78));
  });

  texture(scene, 'rhino', 96, 78, (g) => {
    g.fillStyle(COLORS.grey, 1).fillRoundedRect(9, 18, 72, 51, 18);
    g.lineStyle(4, COLORS.ink, 1).strokeRoundedRect(9, 18, 72, 51, 18);
    g.fillStyle(0xc9ccd2, 1).fillTriangle(76, 26, 95, 38, 75, 43);
    g.lineStyle(3, COLORS.ink, 1).strokeTriangle(76, 26, 95, 38, 75, 43);
    g.fillStyle(COLORS.ink, 1).fillCircle(66, 31, 3);
    g.fillStyle(COLORS.grey, 1).fillRect(17, 62, 14, 15).fillRect(59, 62, 14, 15);
    g.lineStyle(4, COLORS.ink, 1);
    g.strokeLineShape(new Phaser.Geom.Line(22, 17, 28, 5));
    g.strokeLineShape(new Phaser.Geom.Line(68, 18, 61, 4));
  });
}

export type ComicBackdrop = {
  far: Phaser.GameObjects.Container;
  near: Phaser.GameObjects.Container;
};

export function createComicBackdrop(scene: Phaser.Scene): ComicBackdrop {
  const sky = scene.add.graphics().setScrollFactor(0).setDepth(-50);
  sky.fillStyle(COLORS.paper, 1).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  sky.fillStyle(COLORS.sky, 0.52).fillRect(0, 0, GAME_WIDTH, 430);
  sky.lineStyle(1, COLORS.navy, 0.1);
  for (let x = 0; x <= GAME_WIDTH; x += 24) sky.strokeLineShape(new Phaser.Geom.Line(x, 0, x, GAME_HEIGHT));
  for (let y = 0; y <= GAME_HEIGHT; y += 24) sky.strokeLineShape(new Phaser.Geom.Line(0, y, GAME_WIDTH, y));
  sky.fillStyle(COLORS.red, 0.12);
  for (let y = 28; y < 250; y += 18) {
    for (let x = 20 + ((y / 18) % 2) * 8; x < GAME_WIDTH; x += 20) sky.fillCircle(x, y, 1.5);
  }

  const far = scene.add.container(0, 0).setScrollFactor(0).setDepth(-40);
  const farGraphics = scene.add.graphics();
  farGraphics.fillStyle(COLORS.navy, 0.22);
  const widths = [52, 68, 44, 80, 58, 66, 54, 76];
  let bx = -10;
  widths.forEach((width, index) => {
    const height = 110 + ((index * 47) % 135);
    farGraphics.fillRect(bx, 430 - height, width, height + 220);
    farGraphics.fillStyle(COLORS.window, 0.35);
    for (let wy = 430 - height + 16; wy < 420; wy += 24) {
      for (let wx = bx + 10; wx < bx + width - 8; wx += 18) farGraphics.fillRect(wx, wy, 7, 10);
    }
    farGraphics.fillStyle(COLORS.navy, 0.22);
    bx += width - 3;
  });
  far.add(farGraphics);

  const near = scene.add.container(0, 0).setScrollFactor(0).setDepth(-30);
  const nearGraphics = scene.add.graphics();
  nearGraphics.fillStyle(COLORS.redDark, 0.2).fillRect(0, 565, GAME_WIDTH, 155);
  nearGraphics.lineStyle(2, COLORS.ink, 0.22);
  for (let y = 580; y < 720; y += 18) nearGraphics.strokeLineShape(new Phaser.Geom.Line(0, y, GAME_WIDTH, y));
  for (let y = 580; y < 720; y += 36) {
    for (let x = y % 72 === 4 ? 0 : 24; x < GAME_WIDTH; x += 48) {
      nearGraphics.strokeLineShape(new Phaser.Geom.Line(x, y, x, y + 18));
    }
  }
  nearGraphics.fillStyle(COLORS.ink, 0.3).fillRect(66, 500, 8, 65).fillRect(124, 500, 8, 65);
  nearGraphics.lineStyle(3, COLORS.ink, 0.3).strokeEllipse(99, 496, 66, 34);
  nearGraphics.strokeLineShape(new Phaser.Geom.Line(72, 516, 128, 516));
  nearGraphics.strokeLineShape(new Phaser.Geom.Line(405, 570, 405, 670));
  for (let y = 580; y < 660; y += 22) nearGraphics.strokeRect(365, y, 80, 16);
  near.add(nearGraphics);

  const web = scene.add.graphics().setScrollFactor(0).setDepth(-20);
  web.lineStyle(2, COLORS.paperLight, 0.38);
  for (let i = 0; i < 6; i += 1) {
    web.strokeLineShape(new Phaser.Geom.Line(0, 0, i * 34, 130));
    web.strokeLineShape(new Phaser.Geom.Line(GAME_WIDTH, 0, GAME_WIDTH - i * 34, 130));
  }
  for (let radius = 28; radius <= 130; radius += 25) {
    web.beginPath();
    web.arc(0, 0, radius, 0, Math.PI / 2);
    web.strokePath();
    web.beginPath();
    web.arc(GAME_WIDTH, 0, radius, Math.PI / 2, Math.PI);
    web.strokePath();
  }

  return { far, near };
}
