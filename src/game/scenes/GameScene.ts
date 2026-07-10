import Phaser from 'phaser';
import {
  BOSS_INTERVAL,
  COLORS,
  ENEMY_START_SCORE,
  FONT_FAMILY,
  GAME_HEIGHT,
  GAME_WIDTH,
  PHYSICS,
  START_Y,
} from '../constants';
import { createComicBackdrop, createGameTextures } from '../art';
import { MobileTilt } from '../input/MobileTilt';
import { type ActorKind, actorStartsAtScore, canDefeatActor } from '../rules';
import { type BossKind, type GamePhase, RunState, isImmediateGameOver } from '../model';
import { SeededRng } from '../rng';
import { RhinoBrain } from '../bosses/RhinoBrain';

type PlatformKind = 'normal' | 'moving' | 'crumble' | 'rotten' | 'arena';
type PickupKind = 'web' | 'wing' | 'iron';
type RobberState = 'idle' | 'telegraph' | 'lunge' | 'return';
type SandState = 'hover' | 'windup' | 'recover';

type CarryState = {
  ironMan: Phaser.Physics.Arcade.Sprite;
  startY: number;
  targetY: number;
  elapsed: number;
  duration: number;
};

const textStyle = (size: number, color = '#241f1d'): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: FONT_FAMILY,
  fontSize: `${size}px`,
  fontStyle: 'bold',
  color,
  stroke: '#fff8e8',
  strokeThickness: Math.max(2, Math.round(size / 7)),
  align: 'center',
});

export class GameScene extends Phaser.Scene {
  private readonly run = new RunState();
  private rng = new SeededRng();
  private readonly tilt: MobileTilt;
  private phase: GamePhase = 'title';
  private player!: Phaser.Physics.Arcade.Sprite;
  private platforms!: Phaser.Physics.Arcade.Group;
  private pickups!: Phaser.Physics.Arcade.Group;
  private actors!: Phaser.Physics.Arcade.Group;
  private webShots!: Phaser.Physics.Arcade.Group;
  private projectiles!: Phaser.Physics.Arcade.Group;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyP!: Phaser.Input.Keyboard.Key;
  private keyM!: Phaser.Input.Keyboard.Key;
  private titleLayer!: Phaser.GameObjects.Container;
  private scoreText!: Phaser.GameObjects.Text;
  private hudPanel!: Phaser.GameObjects.Graphics;
  private ammoText!: Phaser.GameObjects.Text;
  private bossHpText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;
  private livesIcons: Phaser.GameObjects.Image[] = [];
  private fallbackLeft!: Phaser.GameObjects.Arc;
  private fallbackRight!: Phaser.GameObjects.Arc;
  private fallbackLeftText!: Phaser.GameObjects.Text;
  private fallbackRightText!: Phaser.GameObjects.Text;
  private manualLeft = false;
  private manualRight = false;
  private pointerHold: { id: number; startedAt: number; gliding: boolean; rightClick: boolean } | null = null;
  private pauseReasons = new Set<string>();
  private genY = START_Y + 20;
  private lastSafeX = GAME_WIDTH / 2;
  private minPlayerY = START_Y;
  private nextItemHeight = 650;
  private nextIronHeight = 2_800;
  private nextActorHeight = ENEMY_START_SCORE;
  private nextBossAt = BOSS_INTERVAL;
  private bossCount = 0;
  private best = 0;
  private webAmmo = 3;
  private glideAmmo = 3;
  private gliding = false;
  private zipTarget: Phaser.Physics.Arcade.Sprite | null = null;
  private carry: CarryState | null = null;
  private invulnerableUntil = 0;
  private deadAt = 0;
  private bossSprite: Phaser.Physics.Arcade.Sprite | null = null;
  private bossKind: BossKind = 'sandman';
  private rhinoBrain: RhinoBrain | null = null;
  private sandState: SandState = 'hover';
  private sandTimer = 1.8;
  private bossInvulnerableUntil = 0;
  private weakText: Phaser.GameObjects.Text | null = null;
  private gameOverText: Phaser.GameObjects.Text | null = null;
  private bodyKnockUntil = 0;
  private muted = false;

  constructor() {
    super('Game');
    const forceTouch = new URLSearchParams(window.location.search).get('touch') === '1';
    this.tilt = new MobileTilt(forceTouch);
  }

  create(): void {
    createGameTextures(this);
    createComicBackdrop(this);
    this.best = readNumber('sjBest');
    this.createGroups();
    this.createPlayer();
    this.createHud();
    this.createFallbackControls();
    this.createTitle();
    this.bindInput();
    this.bindPhysics();
    this.muted = readBoolean('sjMute');
    this.sound.setMute(this.muted);
    this.enterTitle();

    const query = new URLSearchParams(window.location.search);
    if (query.has('start') || query.has('score') || query.has('boss')) {
      this.startGame();
      const requestedScore = Number.parseInt(query.get('score') ?? '0', 10);
      if (Number.isFinite(requestedScore) && requestedScore > 0) this.jumpToScore(requestedScore);
      const boss = query.get('boss');
      if (boss === '1' || boss === 'sandman') this.triggerBoss('sandman');
      if (boss === '2' || boss === 'rhino') this.triggerBoss('rhino');
    }
  }

  update(_time: number, deltaMs: number): void {
    const delta = Math.min(0.033, deltaMs / 1_000);
    this.updateHud();
    this.updateFallbackVisibility();
    this.updateInvulnerability();
    if (this.pauseReasons.size > 0 || this.phase === 'title' || this.phase === 'dead') return;

    if (this.pointerHold && !this.pointerHold.gliding && this.time.now - this.pointerHold.startedAt >= 220) {
      this.pointerHold.gliding = this.tryGlide();
    }

    if (this.carry) {
      this.updateCarry(delta);
      this.updateCameraAndWorld();
      return;
    }

    this.updatePlayer(delta);
    this.updatePlatforms();
    this.updateActors(delta);
    this.updateProjectiles(delta);
    this.updateCameraAndWorld();

    if (this.phase === 'boss-intro' || this.phase === 'boss') this.updateBoss(delta);
    if (this.phase === 'play' && this.score >= this.nextBossAt) this.triggerBoss();

    if (this.player.y - this.cameras.main.scrollY > GAME_HEIGHT + 80) this.endRun('fall');
  }

  get score(): number {
    return Math.floor(Math.max(0, START_Y - this.minPlayerY)) + this.run.bonus;
  }

  setPause(reason: 'manual' | 'background' | 'rotate', paused: boolean): void {
    if (this.phase === 'title' || this.phase === 'dead') return;
    if (paused) this.pauseReasons.add(reason);
    else this.pauseReasons.delete(reason);
    if (this.pauseReasons.size > 0) {
      this.physics.world.pause();
    } else {
      this.physics.world.resume();
    }
    this.syncPauseOverlay();
  }

  toggleManualPause(): void {
    this.setPause('manual', !this.pauseReasons.has('manual'));
  }

  resumeFromOverlay(): void {
    this.pauseReasons.delete('manual');
    this.pauseReasons.delete('background');
    if (this.pauseReasons.size === 0) this.physics.world.resume();
    this.syncPauseOverlay();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    this.sound.setMute(this.muted);
    try {
      localStorage.setItem('sjMute', this.muted ? '1' : '0');
    } catch {
      // Storage can be unavailable in private browsing. The game still works.
    }
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  private createGroups(): void {
    this.platforms = this.physics.add.group({ allowGravity: false, immovable: true });
    this.pickups = this.physics.add.group({ allowGravity: false, immovable: true });
    this.actors = this.physics.add.group({ allowGravity: false, immovable: true });
    this.webShots = this.physics.add.group({ allowGravity: false });
    this.projectiles = this.physics.add.group({ allowGravity: false });
  }

  private createPlayer(): void {
    this.player = this.physics.add.sprite(GAME_WIDTH / 2, START_Y - 42, 'spidey');
    this.player.setDepth(20);
    this.player.setCollideWorldBounds(false);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(25, 46).setOffset(8, 7);
    body.setMaxVelocity(PHYSICS.maxVelocityX, 1_500);
  }

  private createHud(): void {
    this.hudPanel = this.add.graphics().setScrollFactor(0).setDepth(80);
    this.hudPanel.fillStyle(COLORS.paperLight, 0.92).fillRoundedRect(10, 10, 144, 91, 9);
    this.hudPanel.lineStyle(3, COLORS.ink, 0.9).strokeRoundedRect(10, 10, 144, 91, 9);
    this.scoreText = this.add.text(22, 16, 'SCORE\n0', textStyle(18)).setOrigin(0).setScrollFactor(0).setDepth(82);
    this.ammoText = this.add.text(286, 17, 'WEB 3  •  GLIDE 3', textStyle(14)).setOrigin(0.5, 0).setScrollFactor(0).setDepth(82);
    this.bossHpText = this.add.text(GAME_WIDTH / 2, 56, '', textStyle(18, '#c92f32')).setOrigin(0.5, 0).setScrollFactor(0).setDepth(82);
    this.messageText = this.add.text(GAME_WIDTH / 2, 122, '', textStyle(18)).setOrigin(0.5).setScrollFactor(0).setDepth(90).setAlpha(0);
    this.livesIcons = Array.from({ length: 3 }, (_, index) =>
      this.add.image(28 + index * 34, 84, 'life-mask').setScrollFactor(0).setDepth(83),
    );
  }

  private createFallbackControls(): void {
    const make = (x: number, label: string): [Phaser.GameObjects.Arc, Phaser.GameObjects.Text] => {
      const circle = this.add.circle(x, GAME_HEIGHT - 66, 45, COLORS.ink, 0.28)
        .setScrollFactor(0)
        .setDepth(75)
        .setInteractive({ useHandCursor: true });
      const text = this.add.text(x, GAME_HEIGHT - 68, label, textStyle(32, '#fff8e8'))
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(76);
      return [circle, text];
    };
    [this.fallbackLeft, this.fallbackLeftText] = make(56, '‹');
    [this.fallbackRight, this.fallbackRightText] = make(GAME_WIDTH - 56, '›');
    this.fallbackLeft.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      this.manualLeft = true;
    });
    this.fallbackLeft.on('pointerup', () => { this.manualLeft = false; });
    this.fallbackLeft.on('pointerout', () => { this.manualLeft = false; });
    this.fallbackRight.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      this.manualRight = true;
    });
    this.fallbackRight.on('pointerup', () => { this.manualRight = false; });
    this.fallbackRight.on('pointerout', () => { this.manualRight = false; });
  }

  private createTitle(): void {
    const panel = this.add.graphics();
    panel.fillStyle(COLORS.paperLight, 0.96).fillRoundedRect(40, 55, 400, 570, 14);
    panel.lineStyle(4, COLORS.ink, 1).strokeRoundedRect(40, 55, 400, 570, 14);
    panel.lineStyle(2, COLORS.red, 0.55);
    for (let y = 74; y < 610; y += 24) panel.strokeLineShape(new Phaser.Geom.Line(50, y, 430, y));
    const title = this.add.text(GAME_WIDTH / 2, 100, 'SPIDEY', textStyle(48, '#c92f32')).setOrigin(0.5);
    const jump = this.add.text(GAME_WIDTH / 2, 154, 'JUMP', textStyle(40, '#173d73')).setOrigin(0.5);
    const subtitle = this.add.text(GAME_WIDTH / 2, 218, 'A NEW YORK COMIC CLIMB', textStyle(15)).setOrigin(0.5);
    const instructions = this.add.text(
      GAME_WIDTH / 2,
      350,
      'TILT / A D   move\nTAP / CLICK   web upward\nHOLD / RIGHT CLICK   glide\n\nSAVE CIVILIANS • DODGE POLICE\nSTOMP OR WEB ROBBERS\nBOSSES GO DOWN IN 3 STOMPS',
      { ...textStyle(16), lineSpacing: 9 },
    ).setOrigin(0.5);
    const start = this.add.text(GAME_WIDTH / 2, 572, 'TAP • CLICK • SPACE TO START', textStyle(20, '#c92f32')).setOrigin(0.5);
    this.tweens.add({ targets: start, alpha: 0.45, duration: 650, yoyo: true, repeat: -1 });
    this.titleLayer = this.add.container(0, 0, [panel, title, jump, subtitle, instructions, start])
      .setScrollFactor(0)
      .setDepth(120);
  }

  private bindInput(): void {
    this.input.addPointer(2);
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.phase === 'title') {
        this.startGame();
        return;
      }
      if (this.phase === 'dead') {
        if (this.time.now - this.deadAt > 600) this.startGame();
        return;
      }
      if (this.pauseReasons.size > 0) {
        this.resumeFromOverlay();
        return;
      }
      if (this.fallbackVisible && pointer.y > GAME_HEIGHT - 128 && (pointer.x < 118 || pointer.x > GAME_WIDTH - 118)) return;
      if (!this.pointerHold) {
        const rightClick = pointer.rightButtonDown();
        this.pointerHold = {
          id: pointer.id,
          startedAt: this.time.now,
          gliding: rightClick ? this.tryGlide() : false,
          rightClick,
        };
      } else if (pointer.id !== this.pointerHold.id) {
        this.tryWeb();
      }
    });
    const release = (pointer: Phaser.Input.Pointer): void => {
      if (!this.pointerHold || pointer.id !== this.pointerHold.id) return;
      const duration = this.time.now - this.pointerHold.startedAt;
      if (!this.pointerHold.rightClick && !this.pointerHold.gliding && duration < 220) this.tryWeb();
      this.gliding = false;
      this.pointerHold = null;
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
    this.input.mouse?.disableContextMenu();

    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    this.cursors = keyboard.createCursorKeys();
    this.keyA = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyP = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    this.keyM = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.SPACE,
    ]);
    this.keyP.on('down', () => this.toggleManualPause());
    this.keyM.on('down', () => this.toggleMute());
    this.cursors.space.on('down', () => {
      if (this.phase === 'title') this.startGame();
      else if (this.phase === 'dead' && this.time.now - this.deadAt > 600) this.startGame();
    });
  }

  private bindPhysics(): void {
    this.physics.add.collider(
      this.player,
      this.platforms,
      (_player, platform) => this.landOnPlatform(platform as Phaser.Physics.Arcade.Sprite),
      (_player, platform) => this.canLandOnPlatform(platform as Phaser.Physics.Arcade.Sprite),
    );
    this.physics.add.overlap(this.player, this.pickups, (_player, pickup) => this.collectPickup(pickup as Phaser.Physics.Arcade.Sprite));
    this.physics.add.overlap(this.player, this.actors, (_player, actor) => this.touchActor(actor as Phaser.Physics.Arcade.Sprite));
    this.physics.add.overlap(this.player, this.projectiles, (_player, projectile) => this.hitByProjectile(projectile as Phaser.Physics.Arcade.Sprite));
    this.physics.add.overlap(this.webShots, this.actors, (shot, actor) => this.webHitsActor(
      shot as Phaser.Physics.Arcade.Sprite,
      actor as Phaser.Physics.Arcade.Sprite,
    ));
    this.physics.add.overlap(this.webShots, this.platforms, (shot, platform) => this.webHitsPlatform(
      shot as Phaser.Physics.Arcade.Sprite,
      platform as Phaser.Physics.Arcade.Sprite,
    ));
  }

  private enterTitle(): void {
    this.phase = 'title';
    this.titleLayer.setVisible(true);
    this.player.setVisible(false).setActive(false);
    (this.player.body as Phaser.Physics.Arcade.Body).setEnable(false);
    this.clearWorld();
    this.pauseReasons.clear();
    this.physics.world.resume();
    this.syncPauseOverlay();
  }

  private startGame(): void {
    this.clearWorld();
    this.run.reset();
    this.rng = new SeededRng(0x51d3_2026);
    this.phase = 'play';
    this.gameOverText?.destroy();
    this.gameOverText = null;
    this.titleLayer.setVisible(false);
    this.player.setVisible(true).setActive(true).setPosition(GAME_WIDTH / 2, START_Y - 46).clearTint().setAlpha(1);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setEnable(true).setAllowGravity(true).setVelocity(0, -480);
    this.genY = START_Y + 20;
    this.lastSafeX = GAME_WIDTH / 2;
    this.minPlayerY = START_Y;
    this.nextItemHeight = 650;
    this.nextIronHeight = 2_800;
    this.nextActorHeight = ENEMY_START_SCORE;
    this.nextBossAt = BOSS_INTERVAL;
    this.bossCount = 0;
    this.webAmmo = 3;
    this.glideAmmo = 3;
    this.gliding = false;
    this.zipTarget = null;
    this.carry = null;
    this.invulnerableUntil = this.time.now + 900;
    this.cameras.main.scrollY = 0;
    this.createPlatform(GAME_WIDTH / 2, START_Y, 'normal');
    this.generateWorld(-400);
    this.showMessage('3 LIVES • FALLING IS FINAL', '#173d73', 1_700);
  }

  private clearWorld(): void {
    for (const actor of this.actorSprites) this.destroyActor(actor);
    this.platforms?.clear(true, true);
    this.pickups?.clear(true, true);
    this.actors?.clear(true, true);
    this.webShots?.clear(true, true);
    this.projectiles?.clear(true, true);
    this.bossSprite?.destroy();
    this.bossSprite = null;
    this.weakText?.destroy();
    this.weakText = null;
  }

  private createPlatform(x: number, y: number, kind: PlatformKind): Phaser.Physics.Arcade.Sprite {
    const platform = this.platforms.create(x, y, `platform-${kind}`) as Phaser.Physics.Arcade.Sprite;
    platform.setDepth(5).setData('kind', kind);
    const body = platform.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false).setImmovable(true).setSize(88, 10).setOffset(2, 4);
    if (kind === 'moving') {
      body.setVelocityX(this.rng.chance(0.5) ? 72 : -72);
    }
    return platform;
  }

  private generateWorld(limitY: number): void {
    while (this.genY > limitY) {
      const height = Math.max(0, START_Y - this.genY);
      const difficulty = Math.min(1, height / 18_000);
      const gap = this.rng.between(62, 82 + difficulty * 34);
      this.genY -= gap;
      const maxStep = 125 + difficulty * 55;
      let x = this.lastSafeX + this.rng.between(-maxStep, maxStep);
      if (x < 52 || x > GAME_WIDTH - 52) x = Phaser.Math.Clamp(GAME_WIDTH - this.lastSafeX + this.rng.between(-45, 45), 48, GAME_WIDTH - 48);
      let kind: PlatformKind = 'normal';
      if (height > 900) {
        const roll = this.rng.next();
        if (roll < 0.15 + difficulty * 0.1) kind = 'moving';
        else if (roll < 0.27 + difficulty * 0.13) kind = 'crumble';
      }
      const safe = this.createPlatform(x, this.genY, kind);
      this.lastSafeX = x;

      if (height >= this.nextIronHeight && kind === 'normal') {
        this.createPickup('iron', x, this.genY - 36);
        this.nextIronHeight = height + this.rng.between(4_200, 5_600);
      } else if (height >= this.nextItemHeight && kind !== 'crumble') {
        this.createPickup(this.rng.chance(0.52) ? 'web' : 'wing', x, this.genY - 32);
        this.nextItemHeight = height + this.rng.between(720, 1_120);
      }

      if (height >= this.nextActorHeight && kind === 'normal') {
        this.spawnActorForHeight(height, safe);
        this.nextActorHeight = height + this.rng.between(height < 7_500 ? 760 : 560, height < 7_500 ? 1_050 : 860);
      }

      if (height > 700 && this.rng.chance(0.34)) {
        const extraX = this.rng.between(48, GAME_WIDTH - 48);
        if (Math.abs(extraX - x) > 88) {
          const extraKind: PlatformKind = this.rng.chance(0.5) ? 'rotten' : 'crumble';
          this.createPlatform(extraX, this.genY - gap * 0.45, extraKind);
        }
      }
    }
  }

  private createPickup(kind: PickupKind, x: number, y: number): void {
    const pickup = this.pickups.create(x, y, `pickup-${kind}`) as Phaser.Physics.Arcade.Sprite;
    pickup.setDepth(10).setData('kind', kind);
    (pickup.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setCircle(15);
    this.tweens.add({ targets: pickup, y: y - 6, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  private spawnActorForHeight(height: number, platform: Phaser.Physics.Arcade.Sprite): void {
    let kind: ActorKind;
    if (height < 5_400) kind = 'robber';
    else {
      const options: ActorKind[] = ['robber', 'civilian'];
      if (height >= actorStartsAtScore('police')) options.push('police');
      kind = this.rng.pick(options);
    }
    const actor = this.actors.create(platform.x, platform.y - 37, kind) as Phaser.Physics.Arcade.Sprite;
    actor.setDepth(14).setDataEnabled();
    actor.setData('kind', kind);
    actor.setData('homeX', actor.x);
    actor.setData('homeY', actor.y);
    actor.setData('timer', kind === 'robber' ? 1.2 : this.rng.between(1.4, 2.8));
    actor.setData('state', 'idle');
    const alert = this.add.text(actor.x, actor.y - 43, '!', textStyle(24, '#c92f32')).setOrigin(0.5).setDepth(16).setVisible(false);
    actor.setData('alert', alert);
    const body = actor.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false).setImmovable(true).setSize(kind === 'civilian' ? 26 : 30, 44).setOffset(7, 7);
  }

  private canLandOnPlatform(platform: Phaser.Physics.Arcade.Sprite): boolean {
    if (this.phase === 'dead' || this.carry || this.zipTarget) return false;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (body.velocity.y <= 0 || this.player.y > platform.y - 16) return false;
    const kind = platform.getData('kind') as PlatformKind;
    if (kind === 'rotten') {
      this.burst(platform.x, platform.y, COLORS.grey, 7);
      platform.destroy();
      return false;
    }
    return true;
  }

  private landOnPlatform(platform: Phaser.Physics.Arcade.Sprite): void {
    const kind = platform.getData('kind') as PlatformKind;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocityY(kind === 'normal' && platform.getData('spring') ? PHYSICS.springVelocity : PHYSICS.bounceVelocity);
    this.gliding = false;
    this.burst(this.player.x, platform.y, COLORS.paperLight, 4);
    if (kind === 'crumble') {
      platform.setTexture('platform-rotten');
      this.time.delayedCall(90, () => {
        if (platform.active) {
          this.burst(platform.x, platform.y, COLORS.tan, 8);
          platform.destroy();
        }
      });
    }
  }

  private collectPickup(pickup: Phaser.Physics.Arcade.Sprite): void {
    if (!pickup.active || this.phase === 'dead') return;
    const kind = pickup.getData('kind') as PickupKind;
    pickup.destroy();
    if (kind === 'web') {
      this.webAmmo = Math.min(12, this.webAmmo + 5);
      this.showMessage('+5 WEB', '#c92f32');
      return;
    }
    if (kind === 'wing') {
      this.glideAmmo = Math.min(12, this.glideAmmo + 5);
      this.showMessage('+5 GLIDE', '#173d73');
      return;
    }
    this.startIronManCarry();
  }

  private startIronManCarry(): void {
    if (this.carry) return;
    const targetY = this.player.y - 900;
    this.generateWorld(targetY - 500);
    this.createPlatform(GAME_WIDTH / 2, targetY + 84, 'normal');
    const ironMan = this.physics.add.sprite(this.player.x, this.player.y + 38, 'ironman').setDepth(19);
    (ironMan.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setEnable(false);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false).setVelocity(0, 0);
    this.zipTarget = null;
    this.gliding = false;
    this.invulnerableUntil = this.time.now + 2_500;
    this.carry = { ironMan, startY: this.player.y, targetY, elapsed: 0, duration: 1.65 };
    this.showMessage('IRON MAN AIRLIFT!', '#c92f32', 1_800);
  }

  private updateCarry(delta: number): void {
    const carry = this.carry;
    if (!carry) return;
    carry.elapsed += delta;
    const progress = Phaser.Math.Clamp(carry.elapsed / carry.duration, 0, 1);
    const eased = 1 - Math.pow(1 - progress, 4);
    const y = Phaser.Math.Linear(carry.startY, carry.targetY, eased);
    const sway = Math.sin(progress * Math.PI * 5) * 10;
    this.player.setPosition(GAME_WIDTH / 2 + sway, y - 18);
    carry.ironMan.setPosition(GAME_WIDTH / 2 + sway, y + 28);
    this.burst(carry.ironMan.x, carry.ironMan.y + 26, 0xc9f7ff, 1);
    this.minPlayerY = Math.min(this.minPlayerY, this.player.y);
    if (progress < 1) return;
    carry.ironMan.destroy();
    this.carry = null;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(true).setVelocity(0, -430);
  }

  private updatePlayer(delta: number): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (this.zipTarget?.active) {
      body.setAllowGravity(false);
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.zipTarget.x, this.zipTarget.y - 24);
      if (distance < 32) {
        this.zipTarget = null;
        body.setAllowGravity(true).setVelocity(0, -730);
      } else {
        const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, this.zipTarget.x, this.zipTarget.y - 24);
        body.setVelocity(Math.cos(angle) * 760, Math.sin(angle) * 760);
      }
      return;
    }
    if (!this.zipTarget) body.setAllowGravity(true);

    const left = this.cursors?.left.isDown || this.keyA?.isDown || this.manualLeft;
    const right = this.cursors?.right.isDown || this.keyD?.isDown || this.manualRight;
    let axis = (right ? 1 : 0) - (left ? 1 : 0);
    if (axis === 0 && this.tilt.active && Math.abs(this.tilt.value) > 0.02) axis = this.tilt.value;
    if (axis !== 0) {
      body.setAccelerationX(PHYSICS.acceleration * axis);
      this.player.setFlipX(axis < 0);
    } else {
      body.setAccelerationX(0);
      body.setVelocityX(body.velocity.x * Math.pow(PHYSICS.drag, delta * 60));
    }
    body.setVelocityX(Phaser.Math.Clamp(body.velocity.x, -PHYSICS.maxVelocityX, PHYSICS.maxVelocityX));
    if (this.gliding && body.velocity.y > PHYSICS.glideCap) body.setVelocityY(PHYSICS.glideCap);
    if (this.player.x < -20) this.player.x = GAME_WIDTH + 20;
    if (this.player.x > GAME_WIDTH + 20) this.player.x = -20;
  }

  private updatePlatforms(): void {
    for (const platform of this.platformSprites) {
      const kind = platform.getData('kind') as PlatformKind;
      const body = platform.body as Phaser.Physics.Arcade.Body;
      if (kind === 'moving') {
        if (platform.x < 54) body.setVelocityX(Math.abs(body.velocity.x));
        if (platform.x > GAME_WIDTH - 54) body.setVelocityX(-Math.abs(body.velocity.x));
      }
      if (platform.y > this.cameras.main.scrollY + GAME_HEIGHT + 120 && kind !== 'arena') platform.destroy();
    }
  }

  private updateActors(delta: number): void {
    for (const actor of this.actorSprites) {
      const kind = actor.getData('kind') as ActorKind;
      const alert = actor.getData('alert') as Phaser.GameObjects.Text;
      alert.setPosition(actor.x, actor.y - 43);
      const screenY = actor.y - this.cameras.main.scrollY;
      if (screenY > GAME_HEIGHT + 120) {
        this.destroyActor(actor);
        continue;
      }
      if (kind === 'civilian') {
        const homeY = actor.getData('homeY') as number;
        actor.y = homeY + Math.sin(this.time.now / 240 + actor.x) * 3;
        continue;
      }
      let timer = (actor.getData('timer') as number) - delta;
      actor.setData('timer', timer);
      if (kind === 'police') {
        if (timer <= 0 && screenY > 70 && screenY < GAME_HEIGHT - 70) {
          const state = actor.getData('state') as string;
          if (state !== 'telegraph') {
            actor.setData('state', 'telegraph').setData('timer', 0.58).setTint(COLORS.red);
            alert.setVisible(true);
          } else {
            this.firePoliceBullet(actor);
            actor.setData('state', 'idle').setData('timer', this.rng.between(2.3, 3.1)).clearTint();
            alert.setVisible(false);
          }
        }
        continue;
      }

      const state = actor.getData('state') as RobberState;
      const body = actor.body as Phaser.Physics.Arcade.Body;
      if (state === 'idle') {
        body.setVelocity(0, 0);
        if (timer <= 0 && Math.abs(actor.y - this.player.y) < 260) {
          actor.setData('state', 'telegraph').setData('timer', 0.52).setTint(COLORS.red);
          alert.setVisible(true);
        }
      } else if (state === 'telegraph' && timer <= 0) {
        const angle = Phaser.Math.Angle.Between(actor.x, actor.y, this.player.x, this.player.y);
        body.setVelocity(Math.cos(angle) * 280, Math.sin(angle) * 220);
        actor.setData('state', 'lunge').setData('timer', 0.58).clearTint();
        alert.setVisible(false);
      } else if (state === 'lunge' && timer <= 0) {
        actor.setData('state', 'return').setData('timer', 1.2);
      } else if (state === 'return') {
        const homeX = actor.getData('homeX') as number;
        const homeY = actor.getData('homeY') as number;
        const angle = Phaser.Math.Angle.Between(actor.x, actor.y, homeX, homeY);
        body.setVelocity(Math.cos(angle) * 150, Math.sin(angle) * 150);
        if (Phaser.Math.Distance.Between(actor.x, actor.y, homeX, homeY) < 10 || timer <= 0) {
          actor.setPosition(homeX, homeY);
          body.setVelocity(0, 0);
          actor.setData('state', 'idle').setData('timer', this.rng.between(1.4, 2.2));
        }
      }
    }
  }

  private touchActor(actor: Phaser.Physics.Arcade.Sprite): void {
    if (!actor.active || this.phase === 'dead' || this.carry) return;
    const kind = actor.getData('kind') as ActorKind;
    if (kind === 'civilian') {
      const result = this.run.rescueCivilian();
      this.run.award(250);
      this.showMessage(result === 'healed' ? 'CIVILIAN SAVED • +1 LIFE' : 'CIVILIAN SAVED • LIVES FULL', '#173d73', 1_500);
      this.destroyActor(actor);
      return;
    }
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const stomp = body.velocity.y > 90 && this.player.y + 14 < actor.y - 8;
    if (stomp) {
      body.setVelocityY(PHYSICS.bounceVelocity);
      if (canDefeatActor(kind, 'stomp')) {
        this.defeatActor(actor, 'STOMP! +300');
      } else {
        this.showMessage('POLICE ARE NOT TARGETS', '#173d73', 950);
      }
      return;
    }
    this.damagePlayer(kind === 'robber' ? 'KNIFE HIT!' : 'SHOT!');
  }

  private webHitsActor(shot: Phaser.Physics.Arcade.Sprite, actor: Phaser.Physics.Arcade.Sprite): void {
    if (!shot.active || !actor.active) return;
    const kind = actor.getData('kind') as ActorKind;
    shot.destroy();
    if (canDefeatActor(kind, 'web')) this.defeatActor(actor, 'WEBBED! +300');
    else if (kind === 'police') this.showMessage('WEB DOES NOT HURT POLICE', '#173d73', 900);
  }

  private defeatActor(actor: Phaser.Physics.Arcade.Sprite, message: string): void {
    this.run.award(300);
    this.burst(actor.x, actor.y, COLORS.paperLight, 12);
    this.showMessage(message, '#c92f32', 900);
    this.destroyActor(actor);
  }

  private destroyActor(actor: Phaser.Physics.Arcade.Sprite): void {
    const alert = actor.getData('alert') as Phaser.GameObjects.Text | undefined;
    alert?.destroy();
    actor.destroy();
  }

  private firePoliceBullet(actor: Phaser.Physics.Arcade.Sprite): void {
    const bullet = this.projectiles.create(actor.x, actor.y, 'bullet') as Phaser.Physics.Arcade.Sprite;
    bullet.setDepth(17).setData('kind', 'bullet').setData('accelerationY', 0);
    const angle = Phaser.Math.Angle.Between(actor.x, actor.y, this.player.x, this.player.y);
    (bullet.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setVelocity(Math.cos(angle) * 330, Math.sin(angle) * 330);
  }

  private updateProjectiles(delta: number): void {
    for (const projectile of this.projectileSprites) {
      const body = projectile.body as Phaser.Physics.Arcade.Body;
      const accelerationY = projectile.getData('accelerationY') as number | undefined;
      if (accelerationY) body.setVelocityY(body.velocity.y + accelerationY * delta);
      const screenY = projectile.y - this.cameras.main.scrollY;
      if (projectile.x < -60 || projectile.x > GAME_WIDTH + 60 || screenY < -80 || screenY > GAME_HEIGHT + 100) projectile.destroy();
    }
    for (const shot of this.webShotSprites) {
      if (shot.y - this.cameras.main.scrollY < -70) shot.destroy();
    }
  }

  private hitByProjectile(projectile: Phaser.Physics.Arcade.Sprite): void {
    if (!projectile.active) return;
    projectile.destroy();
    this.damagePlayer('DIRECT HIT!');
  }

  private tryWeb(): void {
    if (this.phase !== 'play' && this.phase !== 'boss' && this.phase !== 'boss-win') return;
    if (this.webAmmo <= 0 || this.carry) {
      this.showMessage('OUT OF WEB', '#c92f32', 650);
      return;
    }
    const targetActor = this.actorSprites
      .filter((actor) => actor.getData('kind') === 'robber' && actor.y < this.player.y && this.player.y - actor.y < 360 && Math.abs(actor.x - this.player.x) < 45)
      .sort((a, b) => b.y - a.y)[0];
    const targetPlatform = this.platformSprites
      .filter((platform) => platform.y < this.player.y - 45 && this.player.y - platform.y < 360 && Math.abs(platform.x - this.player.x) < 58)
      .sort((a, b) => b.y - a.y)[0];
    if (!targetActor && !targetPlatform) {
      this.showMessage('NO WEB TARGET', '#8f1f28', 650);
      return;
    }
    this.webAmmo -= 1;
    const shot = this.webShots.create(this.player.x, this.player.y - 32, 'web-shot') as Phaser.Physics.Arcade.Sprite;
    shot.setDepth(18).setData('anchor', targetPlatform ?? null);
    (shot.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setVelocityY(-PHYSICS.webVelocity);
  }

  private webHitsPlatform(shot: Phaser.Physics.Arcade.Sprite, platform: Phaser.Physics.Arcade.Sprite): void {
    if (!shot.active || !platform.active) return;
    const anchor = shot.getData('anchor') as Phaser.Physics.Arcade.Sprite | null;
    if (anchor !== platform) return;
    shot.destroy();
    this.zipTarget = platform;
    this.gliding = false;
  }

  private tryGlide(): boolean {
    if ((this.phase !== 'play' && this.phase !== 'boss') || this.glideAmmo <= 0 || this.carry) {
      if (this.glideAmmo <= 0) this.showMessage('OUT OF GLIDE', '#173d73', 650);
      return false;
    }
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (body.velocity.y < -260) return false;
    this.glideAmmo -= 1;
    this.gliding = true;
    return true;
  }

  private updateCameraAndWorld(): void {
    this.minPlayerY = Math.min(this.minPlayerY, this.player.y);
    const target = this.player.y - 300;
    if (target < this.cameras.main.scrollY) {
      this.cameras.main.scrollY += (target - this.cameras.main.scrollY) * 0.18;
    }
    this.generateWorld(this.cameras.main.scrollY - 520);
  }

  private damagePlayer(message: string): void {
    if (this.phase === 'dead' || this.carry || this.time.now < this.invulnerableUntil) return;
    if (isImmediateGameOver('damage')) {
      this.endRun('damage');
      return;
    }
    const result = this.run.damage();
    this.burst(this.player.x, this.player.y, COLORS.red, 16);
    if (result === 'game-over') {
      this.endRun('damage');
      return;
    }
    this.showMessage(`${message} • ${this.run.lives} LEFT`, '#c92f32', 1_200);
    this.invulnerableUntil = this.time.now + 1_800;
    this.zipTarget = null;
    this.gliding = false;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(true).setVelocity(0, -520);
    this.player.setPosition(GAME_WIDTH / 2, this.cameras.main.scrollY + 520);
  }

  private endRun(reason: 'fall' | 'damage'): void {
    if (this.phase === 'dead') return;
    if (reason === 'fall' || isImmediateGameOver(reason)) this.run.lives = 0;
    this.phase = 'dead';
    this.deadAt = this.time.now;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setAcceleration(0, 0).setVelocity(body.velocity.x * 0.3, 360);
    this.bossSprite?.destroy();
    this.bossSprite = null;
    this.weakText?.destroy();
    this.weakText = null;
    if (this.score > this.best) {
      this.best = this.score;
      try { localStorage.setItem('sjBest', String(this.best)); } catch { /* no-op */ }
    }
    this.showMessage(reason === 'fall' ? 'FALLING IS FINAL' : 'ALL LIVES LOST', '#c92f32', 2_400);
    this.gameOverText = this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      `THWIPPED OUT!\nSCORE ${this.score.toLocaleString()}\nBEST ${this.best.toLocaleString()}\n\nTAP TO TRY AGAIN`,
      { ...textStyle(26), lineSpacing: 10 },
    ).setOrigin(0.5).setScrollFactor(0).setDepth(110).setData('game-over', true);
  }

  private triggerBoss(forcedKind?: BossKind): void {
    if (this.phase === 'boss' || this.phase === 'boss-intro' || this.phase === 'dead') return;
    this.phase = 'boss-intro';
    this.run.beginBoss();
    this.projectiles.clear(true, true);
    for (const actor of this.actorSprites) this.destroyActor(actor);
    this.bossKind = forcedKind ?? (this.bossCount % 2 === 0 ? 'sandman' : 'rhino');
    const top = this.cameras.main.scrollY;
    const arena = [
      [92, 650], [388, 650], [240, 558], [86, 458], [394, 458], [240, 350],
    ] as const;
    for (const [x, y] of arena) this.createPlatform(x, top + y, 'arena');
    this.player.setPosition(GAME_WIDTH / 2, top + 570);
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, -520);
    this.invulnerableUntil = this.time.now + 1_500;
    this.bossSprite = this.physics.add.sprite(GAME_WIDTH / 2, top + 205, this.bossKind).setDepth(15);
    (this.bossSprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setImmovable(true).setEnable(false);
    this.weakText = this.add.text(this.bossSprite.x, this.bossSprite.y - 65, 'STOMP!', textStyle(18, '#c92f32'))
      .setOrigin(0.5)
      .setDepth(30)
      .setVisible(false);
    this.rhinoBrain = this.bossKind === 'rhino' ? new RhinoBrain() : null;
    this.sandState = 'hover';
    this.sandTimer = 1.8;
    this.showMessage(this.bossKind === 'rhino' ? 'THE RHINO • DODGE THEN STOMP ×3' : 'SANDMAN • DODGE THEN STOMP ×3', '#c92f32', 1_600);
    this.time.delayedCall(1_350, () => {
      if (this.phase === 'boss-intro') this.phase = 'boss';
    });
  }

  private updateBoss(delta: number): void {
    const boss = this.bossSprite;
    if (!boss) return;
    if (this.phase === 'boss-intro') {
      boss.y = Phaser.Math.Linear(boss.y, this.cameras.main.scrollY + 220, Math.min(1, delta * 3));
      return;
    }
    if (this.bossKind === 'rhino') this.updateRhinoBoss(delta, boss);
    else this.updateSandmanBoss(delta, boss);
    this.checkBossStomp(boss);
    this.checkBossBody(boss);
  }

  private updateRhinoBoss(delta: number, boss: Phaser.Physics.Arcade.Sprite): void {
    const brain = this.rhinoBrain;
    if (!brain) return;
    brain.update(delta, this.player.x, this.player.y - this.cameras.main.scrollY, Math.floor(this.bossCount / 2));
    boss.setPosition(brain.x, this.cameras.main.scrollY + brain.y).setFlipX(brain.direction < 0);
    const vulnerable = brain.vulnerable;
    this.setWeakPoint(vulnerable, boss.x + brain.direction * 22, boss.y - 53);
    if (brain.state === 'telegraph') boss.setTint(this.time.now % 220 < 110 ? COLORS.red : COLORS.paperLight);
    else if (vulnerable) boss.setTint(COLORS.gold);
    else boss.clearTint();
    if (brain.state === 'charge') {
      const hornX = boss.x + brain.direction * 43;
      if (Math.abs(this.player.x - hornX) < 24 && Math.abs(this.player.y - boss.y) < 30) this.damagePlayer('RHINO HORN!');
    }
  }

  private updateSandmanBoss(delta: number, boss: Phaser.Physics.Arcade.Sprite): void {
    this.sandTimer -= delta;
    if (this.sandState === 'hover') {
      boss.x = GAME_WIDTH / 2 + Math.sin(this.time.now / 760) * 105;
      boss.y = this.cameras.main.scrollY + 218 + Math.sin(this.time.now / 430) * 10;
      boss.clearTint();
      this.setWeakPoint(false, boss.x, boss.y - 60);
      if (this.sandTimer <= 0) {
        this.sandState = 'windup';
        this.sandTimer = 0.68;
      }
    } else if (this.sandState === 'windup') {
      boss.setTint(this.time.now % 180 < 90 ? COLORS.red : COLORS.gold);
      if (this.sandTimer <= 0) {
        this.throwSand(boss);
        this.sandState = 'recover';
        this.sandTimer = 1.15;
        boss.setTint(COLORS.gold);
      }
    } else {
      this.setWeakPoint(true, boss.x, boss.y - 62);
      if (this.sandTimer <= 0) {
        this.sandState = 'hover';
        this.sandTimer = Math.max(1.5, 2.45 - Math.floor(this.bossCount / 2) * 0.15);
      }
    }
  }

  private throwSand(boss: Phaser.Physics.Arcade.Sprite): void {
    for (const spread of [-0.18, 0, 0.18]) {
      const angle = Phaser.Math.Angle.Between(boss.x, boss.y, this.player.x, this.player.y) + spread;
      const glob = this.projectiles.create(boss.x, boss.y - 10, 'sand-glob') as Phaser.Physics.Arcade.Sprite;
      glob.setDepth(18).setData('kind', 'sand').setData('accelerationY', 460);
      (glob.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setVelocity(Math.cos(angle) * 300, Math.sin(angle) * 300);
    }
  }

  private checkBossStomp(boss: Phaser.Physics.Arcade.Sprite): void {
    if (this.time.now < this.bossInvulnerableUntil || this.phase !== 'boss') return;
    const vulnerable = this.bossKind === 'rhino' ? Boolean(this.rhinoBrain?.vulnerable) : this.sandState === 'recover';
    if (!vulnerable) return;
    const direction = this.rhinoBrain?.direction ?? 1;
    const headX = this.bossKind === 'rhino' ? boss.x + direction * 22 : boss.x;
    const headY = boss.y - (this.bossKind === 'rhino' ? 39 : 46);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const stomp = body.velocity.y > 80 && Math.abs(this.player.x - headX) < 48 && this.player.y + 25 > headY - 12 && this.player.y < headY;
    if (!stomp) return;
    body.setVelocityY(-900);
    this.bossInvulnerableUntil = this.time.now + 650;
    this.run.award(250);
    this.burst(headX, headY, COLORS.gold, 16);
    if (this.run.hitBoss()) {
      this.winBoss();
    } else {
      this.showMessage(`BOSS HIT • ${this.run.bossHp} LEFT`, '#c92f32', 850);
      if (this.rhinoBrain) {
        this.rhinoBrain.state = 'hover';
        this.rhinoBrain.stateTime = 0;
        this.rhinoBrain.attackCooldown = 1.5;
      } else {
        this.sandState = 'hover';
        this.sandTimer = 1.45;
      }
    }
  }

  private checkBossBody(boss: Phaser.Physics.Arcade.Sprite): void {
    if (this.phase !== 'boss' || this.time.now < this.bodyKnockUntil) return;
    if (Phaser.Math.Distance.Between(this.player.x, this.player.y, boss.x, boss.y) > 54) return;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const direction = this.player.x >= boss.x ? 1 : -1;
    body.setVelocity(direction * 360, -360);
    this.bodyKnockUntil = this.time.now + 420;
  }

  private winBoss(): void {
    this.phase = 'boss-win';
    this.run.award(1_500);
    this.webAmmo = Math.min(12, this.webAmmo + 5);
    this.glideAmmo = Math.min(12, this.glideAmmo + 5);
    this.showMessage('BOSS DOWN! +1500 • AMMO +5/+5', '#173d73', 1_800);
    if (this.bossSprite) this.burst(this.bossSprite.x, this.bossSprite.y, COLORS.red, 30);
    this.bossSprite?.destroy();
    this.bossSprite = null;
    this.weakText?.destroy();
    this.weakText = null;
    this.projectiles.clear(true, true);
    this.bossCount += 1;
    this.nextBossAt = this.score + BOSS_INTERVAL;
    this.time.delayedCall(1_650, () => {
      if (this.phase === 'boss-win') {
        for (const platform of this.platformSprites) {
          if (platform.getData('kind') === 'arena') platform.destroy();
        }
        this.createPlatform(this.player.x, this.player.y + 72, 'normal');
        this.phase = 'play';
      }
    });
  }

  private setWeakPoint(visible: boolean, x: number, y: number): void {
    if (!this.weakText) return;
    this.weakText.setVisible(visible).setPosition(x, y);
    if (visible) this.weakText.setScale(1 + Math.sin(this.time.now / 90) * 0.08);
  }

  private updateHud(): void {
    const visible = this.phase !== 'title';
    this.hudPanel.setVisible(visible);
    this.scoreText.setVisible(visible);
    this.ammoText.setVisible(visible);
    this.livesIcons.forEach((icon) => icon.setVisible(visible));
    this.scoreText.setText(`SCORE\n${this.score.toLocaleString()}`);
    this.ammoText.setText(`WEB ${this.webAmmo}  •  GLIDE ${this.glideAmmo}`);
    this.bossHpText.setText(this.phase === 'boss' || this.phase === 'boss-intro' ? `BOSS ${'●'.repeat(this.run.bossHp)}${'○'.repeat(3 - this.run.bossHp)}` : '');
    this.livesIcons.forEach((icon, index) => icon.setAlpha(index < this.run.lives ? 1 : 0.18));
  }

  private updateInvulnerability(): void {
    if (!this.player.visible) return;
    if (this.time.now < this.invulnerableUntil) this.player.setAlpha(this.time.now % 180 < 90 ? 0.28 : 1);
    else this.player.setAlpha(1);
  }

  private updateFallbackVisibility(): void {
    const visible = this.fallbackVisible;
    this.fallbackLeft.setVisible(visible);
    this.fallbackRight.setVisible(visible);
    this.fallbackLeftText.setVisible(visible);
    this.fallbackRightText.setVisible(visible);
  }

  private get fallbackVisible(): boolean {
    return this.tilt.touchDevice && !this.tilt.active && (this.phase === 'play' || this.phase === 'boss' || this.phase === 'boss-intro') && this.pauseReasons.size === 0;
  }

  private showMessage(message: string, color = '#241f1d', duration = 1_000): void {
    this.messageText.setText(message).setColor(color).setAlpha(1).setScale(0.92);
    this.tweens.killTweensOf(this.messageText);
    this.tweens.add({ targets: this.messageText, alpha: 0, scale: 1, delay: Math.max(250, duration - 450), duration: 450, ease: 'Quad.Out' });
  }

  private burst(x: number, y: number, color: number, count: number): void {
    const graphics = this.add.graphics().setDepth(25);
    graphics.lineStyle(2, color, 0.9);
    for (let index = 0; index < count; index += 1) {
      const angle = this.rng.between(0, Math.PI * 2);
      const length = this.rng.between(6, 24);
      graphics.strokeLineShape(new Phaser.Geom.Line(x, y, x + Math.cos(angle) * length, y + Math.sin(angle) * length));
    }
    this.tweens.add({ targets: graphics, alpha: 0, duration: 320, onComplete: () => graphics.destroy() });
  }

  private syncPauseOverlay(): void {
    const overlay = document.querySelector<HTMLElement>('#resume-overlay');
    const pauseButton = document.querySelector<HTMLButtonElement>('#pause-button');
    const visible = this.pauseReasons.has('manual') || this.pauseReasons.has('background');
    if (overlay) overlay.hidden = !visible;
    if (pauseButton) {
      pauseButton.textContent = visible ? '▶' : 'Ⅱ';
      pauseButton.setAttribute('aria-label', visible ? 'Resume game' : 'Pause game');
    }
  }

  private jumpToScore(requestedScore: number): void {
    const height = Math.max(0, requestedScore);
    const playerY = START_Y - height;
    this.generateWorld(playerY - 700);
    this.player.setPosition(GAME_WIDTH / 2, playerY);
    this.createPlatform(GAME_WIDTH / 2, playerY + 56, 'normal');
    this.minPlayerY = START_Y - height;
    this.cameras.main.scrollY = playerY - 300;
  }

  private get platformSprites(): Phaser.Physics.Arcade.Sprite[] {
    return this.platforms.getChildren() as Phaser.Physics.Arcade.Sprite[];
  }

  private get actorSprites(): Phaser.Physics.Arcade.Sprite[] {
    return this.actors.getChildren() as Phaser.Physics.Arcade.Sprite[];
  }

  private get webShotSprites(): Phaser.Physics.Arcade.Sprite[] {
    return this.webShots.getChildren() as Phaser.Physics.Arcade.Sprite[];
  }

  private get projectileSprites(): Phaser.Physics.Arcade.Sprite[] {
    return this.projectiles.getChildren() as Phaser.Physics.Arcade.Sprite[];
  }
}

function readNumber(key: string): number {
  try {
    const value = Number.parseInt(localStorage.getItem(key) ?? '0', 10);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function readBoolean(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}
