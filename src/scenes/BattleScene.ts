import Phaser from 'phaser';
import { BattleSim, type BattleEvent } from '../core/battle';
import type { GameConfig } from '../core/config';
import { classifyStripGesture } from '../core/input';
import { battleToScreenY, computeLayout, type Layout } from '../core/layout';
import { AntView } from '../ui/antView';
import { BuildingView } from '../ui/buildingView';
import { StripView } from '../ui/stripView';
import { COLOR, FONT } from '../ui/theme';

export interface BattleSceneData {
  config: GameConfig;
  startStage: number;
  debug: boolean;
}

interface Debris {
  obj: Phaser.GameObjects.Rectangle;
  vx: number;
  vy: number;
  spin: number;
  restTimer: number | null;
}

const DEPTH = {
  sky: 0,
  battleInput: 5,
  building: 10,
  ant: 20,
  ground: 30,
  strip: 40,
  stripInput: 45,
  menu: 50,
  hud: 60,
  challenge: 70,
  fx: 80,
  debug: 90,
} as const;

const MENU_LABELS = ['강화', '장비', '굴', '상점'];

export class BattleScene extends Phaser.Scene {
  private cfg!: GameConfig;
  private sim!: BattleSim;
  private L!: Layout;
  private debug = false;

  private ant!: AntView;
  private buildingView: BuildingView | null = null;
  private buildingViewId = -1;
  private strip!: StripView;
  private debris: Debris[] = [];
  private clouds: Phaser.GameObjects.Ellipse[] = [];

  private hudStage!: Phaser.GameObjects.Text;
  private hudPips!: Phaser.GameObjects.Graphics;
  private hudHpFill!: Phaser.GameObjects.Rectangle;
  private hudHpText!: Phaser.GameObjects.Text;
  private hudAuto!: Phaser.GameObjects.Text;
  private challengeBtn!: Phaser.GameObjects.Container;
  private challengeZone!: Phaser.GameObjects.Zone;
  private challengeSub!: Phaser.GameObjects.Text;
  private toast: Phaser.GameObjects.Container | null = null;
  private debugText: Phaser.GameObjects.Text | null = null;

  private stripStart: { x: number; y: number; t: number } | null = null;
  private wasDown = false;
  private nestOpen = false;

  constructor() {
    super('battle');
  }

  init(data: BattleSceneData): void {
    this.cfg = data.config;
    this.debug = data.debug;
    this.sim = new BattleSim(this.cfg, data.startStage);
    this.L = computeLayout(this.cfg.layout, this.scale.width, this.scale.height);
  }

  create(): void {
    const { L, cfg } = this;
    this.drawSky();
    this.drawGround();

    // 개미
    const antH = cfg.battle.ant.height_ratio * L.battle.height;
    const antW = cfg.battle.ant.width_ratio * L.width;
    this.ant = new AntView(this, L.width / 2, L.groundY, antW, antH);
    this.ant.root.setDepth(DEPTH.ant);

    // 땅속 띠 + 메뉴
    this.strip = new StripView(this, cfg.strip, L.strip, L.width);
    this.strip.layer.setDepth(DEPTH.strip);
    this.createMenu();

    this.createHud();
    this.createChallengeButton();
    this.createInput();

    if (this.debug) {
      this.debugText = this.add
        .text(16, L.battle.top + 12, '', { fontFamily: 'monospace', fontSize: '26px', color: '#1b1a17', backgroundColor: '#ffffffaa' })
        .setDepth(DEPTH.debug);
    }

    this.handleEvents(this.sim.drainEvents());
    this.refreshHud();
  }

  update(_time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    this.sim.update(dt);
    this.handleEvents(this.sim.drainEvents());
    this.syncViews();
    this.updateDebris(dt);
    this.strip.update(dt);
    for (const c of this.clouds) {
      c.x += dt * 18 * (c.scaleX > 1 ? 1.4 : 1);
      if (c.x - c.width > this.L.width) c.x = -c.width;
    }
    this.refreshHud();
    if (this.debugText) this.debugText.setText(this.debugLines());
  }

  /** 개미굴(NestScene)에서 돌아올 때 */
  onNestClosed(): void {
    this.nestOpen = false;
    this.input.enabled = true;
  }

  // ── 그리기 ───────────────────────────────────────────────

  private drawSky(): void {
    const { L } = this;
    const g = this.add.graphics().setDepth(DEPTH.sky);
    const steps = 28;
    const top = Phaser.Display.Color.ValueToColor(COLOR.skyTop);
    const bottom = Phaser.Display.Color.ValueToColor(COLOR.skyBottom);
    for (let i = 0; i < steps; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, steps - 1, i);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
      const y0 = L.hud.top + (L.battle.bottom - L.hud.top) * (i / steps);
      g.fillRect(0, y0, L.width, (L.battle.bottom - L.hud.top) / steps + 1);
    }
    for (let i = 0; i < 4; i++) {
      const w = L.width * (0.22 + 0.08 * (i % 2));
      const c = this.add
        .ellipse(((i * 337) % 1000) / 1000 * L.width, L.battle.top + L.battle.height * (0.12 + 0.13 * i), w, w * 0.32, COLOR.cloud, 0.75)
        .setDepth(DEPTH.sky);
      if (i % 2) c.setScale(1.2);
      this.clouds.push(c);
    }
  }

  private drawGround(): void {
    const { L } = this;
    const g = this.add.graphics().setDepth(DEPTH.ground);
    g.fillStyle(COLOR.groundLine, 1);
    g.fillRect(0, L.groundY - 5, L.width, 10);
  }

  private createMenu(): void {
    const { L, cfg } = this;
    const h = L.strip.height * cfg.layout.strip_menu_height_ratio;
    const y = L.strip.top + (L.strip.height - h) / 2;
    const w = L.width * 0.17;
    const gap = L.width * 0.02;
    const x0 = L.width * 0.03;
    MENU_LABELS.forEach((label, i) => {
      const x = x0 + i * (w + gap);
      const g = this.add.graphics().setDepth(DEPTH.menu);
      g.fillStyle(COLOR.menuBg, 0.45);
      g.fillRoundedRect(x, y, w, h, 24);
      g.lineStyle(4, 0xffffff, 0.25);
      g.strokeRoundedRect(x, y, w, h, 24);
      this.add
        .text(x + w / 2, y + h / 2, label, { fontFamily: FONT, fontSize: `${Math.round(h * 0.34)}px`, color: COLOR.menuText, fontStyle: '900' })
        .setOrigin(0.5)
        .setDepth(DEPTH.menu);
      const zone = this.add.zone(x, y, w, h).setOrigin(0).setDepth(DEPTH.menu + 1).setInteractive();
      zone.on('pointerdown', () => g.setAlpha(0.6));
      zone.on('pointerout', () => g.setAlpha(1));
      zone.on('pointerup', () => {
        g.setAlpha(1);
        this.showToast(`[${label}] 준비 중 — 이번 프로토 범위 밖`);
      });
    });
  }

  private createHud(): void {
    const { L } = this;
    const h = L.hud.height;
    this.add.rectangle(0, 0, L.width, h, COLOR.hudBg).setOrigin(0).setDepth(DEPTH.hud);
    this.hudStage = this.add
      .text(36, h * 0.34, '', { fontFamily: FONT, fontSize: `${Math.round(h * 0.36)}px`, color: COLOR.hudText, fontStyle: '900' })
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.hud);
    this.hudPips = this.add.graphics().setDepth(DEPTH.hud);

    const barW = L.width * 0.36;
    const barH = h * 0.26;
    const barX = L.width - 36 - barW;
    const barY = h * 0.34;
    this.add.rectangle(barX, barY, barW, barH, COLOR.hpBack).setOrigin(0, 0.5).setDepth(DEPTH.hud);
    this.hudHpFill = this.add.rectangle(barX, barY, barW, barH, COLOR.hpFill).setOrigin(0, 0.5).setDepth(DEPTH.hud);
    this.hudHpText = this.add
      .text(barX + barW / 2, barY, '', { fontFamily: FONT, fontSize: `${Math.round(barH * 0.8)}px`, color: '#ffffff', fontStyle: '900', stroke: '#22201c', strokeThickness: 6 })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);
    this.add
      .text(barX - 14, barY, 'HP', { fontFamily: FONT, fontSize: `${Math.round(barH * 0.8)}px`, color: COLOR.hudText, fontStyle: '900' })
      .setOrigin(1, 0.5)
      .setDepth(DEPTH.hud);
    this.hudAuto = this.add
      .text(L.width - 36, h * 0.78, '', { fontFamily: FONT, fontSize: `${Math.round(h * 0.2)}px`, color: COLOR.autoOn, fontStyle: '900' })
      .setOrigin(1, 0.5)
      .setDepth(DEPTH.hud);
  }

  private createChallengeButton(): void {
    const { L, cfg } = this;
    const w = L.width * 0.34;
    const h = L.battle.height * 0.075;
    const cx = L.width - 36 - w / 2;
    const cy = L.battle.top + L.battle.height * cfg.layout.challenge_button_y_ratio + h / 2;
    const glow = this.add.graphics();
    glow.fillStyle(COLOR.challenge, 0.35);
    glow.fillRoundedRect(-w / 2 - 16, -h / 2 - 16, w + 32, h + 32, 40);
    const g = this.add.graphics();
    g.fillStyle(COLOR.challenge, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 32);
    g.lineStyle(6, 0xffffff, 0.9);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 32);
    const label = this.add
      .text(0, -h * 0.12, '도전!', { fontFamily: FONT, fontSize: `${Math.round(h * 0.42)}px`, color: COLOR.challengeText, fontStyle: '900', stroke: '#a2440f', strokeThickness: 8 })
      .setOrigin(0.5);
    this.challengeSub = this.add
      .text(0, h * 0.3, '', { fontFamily: FONT, fontSize: `${Math.round(h * 0.2)}px`, color: '#fff3e0', fontStyle: '900' })
      .setOrigin(0.5);
    this.challengeBtn = this.add.container(cx, cy, [glow, g, label, this.challengeSub]).setDepth(DEPTH.challenge).setVisible(false);
    // 강조 연출: 숨쉬기 + 빛 번짐
    this.tweens.add({ targets: this.challengeBtn, scale: { from: 1, to: 1.08 }, yoyo: true, repeat: -1, duration: 520, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: glow, alpha: { from: 0.2, to: 1 }, yoyo: true, repeat: -1, duration: 520, ease: 'Sine.easeInOut' });

    this.challengeZone = this.add.zone(cx, cy, w + 32, h + 32).setDepth(DEPTH.challenge + 1);
    this.challengeZone.on('pointerdown', () => {
      if (this.sim.challenge()) this.handleEvents(this.sim.drainEvents());
    });
  }

  private createInput(): void {
    const { L } = this;
    // 전투 구역 탭 = 강점프 (전투 구역에서만)
    const battleZone = this.add.zone(0, L.battle.top, L.width, L.battle.height).setOrigin(0).setDepth(DEPTH.battleInput).setInteractive();
    battleZone.on('pointerdown', () => {
      this.sim.tapStrongJump();
      this.handleEvents(this.sim.drainEvents());
    });
    // 땅속 띠 빈 영역: 탭 또는 아래로 스와이프 → 개미굴 (시작점이 띠 안일 때만)
    const stripZone = this.add.zone(0, L.strip.top, L.width, L.strip.height).setOrigin(0).setDepth(DEPTH.stripInput).setInteractive();
    stripZone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.stripStart = { x: p.x, y: p.y, t: p.downTime };
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const s = this.stripStart;
      this.stripStart = null;
      if (!s || this.nestOpen) return;
      const g = classifyStripGesture(this.L, this.cfg.input, { startX: s.x, startY: s.y, endX: p.x, endY: p.y, durationMs: p.upTime - s.t });
      if (g !== 'none') this.openNest();
    });
  }

  private openNest(): void {
    this.nestOpen = true;
    this.input.enabled = false;
    this.scene.launch('nest', { config: this.cfg, onClose: () => this.onNestClosed() });
  }

  // ── 이벤트 → 연출 ────────────────────────────────────────

  private handleEvents(events: BattleEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case 'stageStart':
          this.removeBuildingView(false);
          if (e.reason === 'retreat') this.showToast(`후퇴… 스테이지 ${e.stage} 반복 · 자동 진행 OFF`, COLOR.hurt);
          else if (e.reason === 'restart') this.showToast('다시 시작! 스테이지 1');
          else if (e.reason === 'challenge') this.showToast(`도전! 스테이지 ${e.stage}`);
          else if (e.reason === 'advance') this.showToast(`스테이지 ${e.stage}`);
          break;
        case 'stageClear':
          if (e.wasChallenge) this.showToast(`돌파! 자동 진행 ON`, COLOR.autoOn);
          break;
        case 'spawn': {
          this.removeBuildingView(false);
          const b = this.sim.building!;
          const bw = this.cfg.battle.building.width_ratio * this.L.width;
          const bh = this.cfg.battle.building.height_ratio * this.L.battle.height;
          this.buildingView = new BuildingView(this, this.L.width / 2, battleToScreenY(this.L, b.y), bw, bh, b.id, b.maxHp);
          this.buildingView.root.setDepth(DEPTH.building);
          this.buildingViewId = b.id;
          break;
        }
        case 'jump':
          this.ant.jump(e.kind === 'strong');
          if (e.kind === 'strong') this.dustRing();
          break;
        case 'strike': {
          this.ant.strike(e.arm);
          const b = this.sim.building;
          if (this.buildingView && b) {
            this.buildingView.shake();
            this.buildingView.setHp(e.hpLeft, b.maxHp);
          }
          const y = this.ant.root.y - this.cfg.battle.ant.height_ratio * this.L.battle.height;
          this.floatText(this.L.width / 2 + Phaser.Math.Between(-120, 120), y, `${e.damage}`, COLOR.damage, 44);
          break;
        }
        case 'destroy':
          this.burstDebris();
          this.removeBuildingView(false);
          this.cameras.main.shake(140, 0.006);
          this.floatText(this.L.width / 2, battleToScreenY(this.L, e.y) - 140, '와르르!', '#ffe08a', 110, 900);
          break;
        case 'land':
          this.ant.hit();
          this.cameras.main.shake(260, 0.014);
          this.floatText(this.L.width / 2, this.L.groundY - this.cfg.battle.ant.height_ratio * this.L.battle.height * 2.2, `-${e.damage}`, COLOR.hurt, 72, 900);
          break;
        case 'antDown':
          this.ant.setDown(true);
          this.wasDown = true;
          break;
        case 'autoAdvance':
        case 'tapIgnored':
          break;
      }
    }
  }

  private syncViews(): void {
    const { L, sim } = this;
    this.ant.setY(battleToScreenY(L, sim.ant.y));
    if (this.wasDown && sim.ant.phase !== 'down') {
      this.ant.setDown(false);
      this.wasDown = false;
    }
    const b = sim.building;
    if (this.buildingView) {
      if (!b || b.id !== this.buildingViewId) this.removeBuildingView(true);
      else this.buildingView.setY(battleToScreenY(L, b.y));
    }
  }

  private removeBuildingView(fade: boolean): void {
    const v = this.buildingView;
    if (!v) return;
    this.buildingView = null;
    this.buildingViewId = -1;
    if (!fade) {
      v.destroy();
      return;
    }
    this.tweens.add({ targets: v.root, alpha: 0, scaleY: 0.6, duration: 220, onComplete: () => v.destroy() });
  }

  private burstDebris(): void {
    const v = this.buildingView;
    if (!v) return;
    const n = this.cfg.strip.debris_pieces;
    const bw = this.cfg.battle.building.width_ratio * this.L.width;
    const bh = this.cfg.battle.building.height_ratio * this.L.battle.height;
    for (let i = 0; i < n; i++) {
      const size = Phaser.Math.Between(40, 80);
      const x = v.root.x + Phaser.Math.FloatBetween(-0.45, 0.45) * bw;
      const y = v.root.y - Phaser.Math.FloatBetween(0.1, 0.9) * bh;
      const obj = this.add.rectangle(x, y, size, size * 0.8, v.color).setStrokeStyle(5, COLOR.buildingDark).setDepth(DEPTH.building);
      this.debris.push({ obj, vx: Phaser.Math.FloatBetween(-520, 520), vy: Phaser.Math.FloatBetween(-900, -300), spin: Phaser.Math.FloatBetween(-8, 8), restTimer: null });
    }
  }

  private updateDebris(dt: number): void {
    const groundY = this.L.groundY;
    const gravity = 2600; // 연출 전용 (px/s²)
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i]!;
      if (d.restTimer === null) {
        d.vy += gravity * dt;
        d.obj.x = Phaser.Math.Clamp(d.obj.x + d.vx * dt, 40, this.L.width - 40);
        d.obj.y += d.vy * dt;
        d.obj.rotation += d.spin * dt;
        const floor = groundY - d.obj.height / 2;
        if (d.obj.y >= floor) {
          d.obj.y = floor;
          d.restTimer = this.cfg.strip.debris_pickup_s; // 지면에 닿음 → 잠깐 뒤 일개미가 집어감
        }
      } else {
        d.restTimer -= dt;
        if (d.restTimer <= 0) {
          const obj = d.obj;
          this.debris.splice(i, 1);
          this.tweens.add({ targets: obj, y: groundY + 30, scale: 0.3, alpha: 0, duration: 160, onComplete: () => obj.destroy() });
          this.strip.spawnCarrier(obj.x, this.cfg.strip.debris_carry_amount_per_piece);
        }
      }
    }
  }

  private dustRing(): void {
    const ring = this.add.ellipse(this.L.width / 2, this.L.groundY, 120, 36).setStrokeStyle(8, 0xffffff, 0.9).setDepth(DEPTH.ant - 1);
    this.tweens.add({ targets: ring, scaleX: 3, scaleY: 2, alpha: 0, duration: 320, onComplete: () => ring.destroy() });
  }

  private floatText(x: number, y: number, text: string, color: string, size: number, weight = 900): void {
    const t = this.add
      .text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: `${weight}`, stroke: COLOR.damageStroke, strokeThickness: Math.max(6, size / 7) })
      .setOrigin(0.5)
      .setDepth(DEPTH.fx);
    this.tweens.add({ targets: t, y: y - 110, alpha: { from: 1, to: 0 }, scale: { from: 1.25, to: 1 }, duration: 750, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }

  private showToast(text: string, color = '#ffffff'): void {
    this.toast?.destroy(true);
    const { L } = this;
    const t = this.add.text(0, 0, text, { fontFamily: FONT, fontSize: '46px', color, fontStyle: '900' }).setOrigin(0.5);
    const pad = 28;
    const bg = this.add.rectangle(0, 0, t.width + pad * 2, t.height + pad, COLOR.toastBg, 0.55);
    const c = this.add.container(L.width / 2, L.battle.top + L.battle.height * 0.2, [bg, t]).setDepth(DEPTH.fx);
    this.toast = c;
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 120 });
    this.tweens.add({
      targets: c,
      alpha: 0,
      delay: 1500,
      duration: 300,
      onComplete: () => {
        if (this.toast === c) this.toast = null;
        c.destroy(true);
      },
    });
  }

  private refreshHud(): void {
    const { sim, L } = this;
    const s = sim.stage;
    this.hudStage.setText(`STAGE ${s.stage}`);
    // 진행도 점
    const g = this.hudPips;
    g.clear();
    const r = L.hud.height * 0.07;
    for (let i = 0; i < s.toClear; i++) {
      g.fillStyle(i < s.destroyed ? COLOR.pipOn : COLOR.pipOff, 1);
      g.fillCircle(36 + r + i * r * 3, L.hud.height * 0.78, r);
    }
    const a = sim.ant;
    const ratio = a.hp / a.maxHp;
    this.hudHpFill.scaleX = Math.max(0, ratio);
    this.hudHpFill.fillColor = ratio > 0.3 ? COLOR.hpFill : COLOR.hpLow;
    this.hudHpText.setText(`${Math.ceil(a.hp)} / ${a.maxHp}`);
    this.hudAuto.setText(s.autoAdvance ? '자동 진행 ON ▶' : '자동 진행 OFF ■');
    this.hudAuto.setColor(s.autoAdvance ? COLOR.autoOn : COLOR.autoOff);

    const show = sim.challengeAvailable;
    if (this.challengeBtn.visible !== show) {
      this.challengeBtn.setVisible(show);
      if (show) this.challengeZone.setInteractive();
      else this.challengeZone.disableInteractive();
    }
    if (show) this.challengeSub.setText(`스테이지 ${s.stage + 1}`);
  }

  private debugLines(): string {
    const { sim } = this;
    const a = sim.ant;
    const b = sim.building;
    return [
      `t=${sim.time.toFixed(1)} stage=${sim.stage.stage} ${sim.stage.destroyed}/${sim.stage.toClear} auto=${sim.stage.autoAdvance} chal=${sim.stage.challenging}`,
      `ant ${a.phase} y=${a.y.toFixed(3)} hp=${a.hp} contact=${a.contact} nextArm=${a.nextArm + 1}`,
      b ? `bld#${b.id} ${b.state} y=${b.y.toFixed(3)} hp=${b.hp}/${b.maxHp}` : `bld - spawnIn=${sim.spawnTimer.toFixed(2)}`,
    ].join('\n');
  }
}
