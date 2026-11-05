import Phaser from 'phaser';
import { BattleSim, type BattleEvent } from '../core/battle';
import type { GameConfig } from '../core/config';
import { type InputAction, InputRouter } from '../core/inputRouter';
import { battleToScreenY, computeLayout, type Layout, nestBackButtonRect } from '../core/layout';
import { AntView } from './antView';
import { ART_FILE_URLS, artTextureKey } from './artFiles';
import { createArtPanel } from './artPanel';
import { ART_DATA, type ArtPlan, type ArtSettings, loadArtSettings, neededFiles, resolveArtPlan } from './artPlan';
import { BuildingView } from './buildingView';
import { StripView } from './stripView';
import { COLOR, FONT } from './theme';
import { t } from './text';
import { FX, type FxToggles, loadToggles } from './fx';
import { createFxPanel } from './fxPanel';
import { HitstopClock } from './hitstop';
import { dropsChunks, hitstopMs, impactScale, type StrikeKind, strikeKind } from './hitFeel';
import { Sfx } from './sfx';
import type { NestScene } from './NestScene';

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
  /** 이 조각을 나르는 일개미 팝업 숫자 (연출) */
  amount: number;
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

// 하단 메뉴 — 문구 키 · [굴]은 개미굴 진입 (H-01 #9 · 기획서 v0.4 §6)
const MENU = [
  { key: 'menu.upgrade', nest: false },
  { key: 'menu.equip', nest: false },
  { key: 'menu.nest', nest: true },
  { key: 'menu.shop', nest: false },
] as const;
/** 그림 상수(px)는 PR #2의 1080폭 기준값 — 지금 프레임 폭에 비례해 줄인다 (view 전용) */
const DESIGN_WIDTH = 1080;

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
  private challengeSub!: Phaser.GameObjects.Text;
  private toast: Phaser.GameObjects.Container | null = null;
  private debugText: Phaser.GameObjects.Text | null = null;

  private router!: InputRouter;
  private readonly menuGfx = new Map<string, Phaser.GameObjects.Graphics>();
  private wasDown = false;
  private frames = 0;
  // ── M2 타격감 (I-10) — 끄면 M1 모습 그대로 ──
  private fxOn!: FxToggles;
  private readonly hitstop = new HitstopClock();
  private readonly sfx = new Sfx();
  private comboText: Phaser.GameObjects.Text | null = null;
  private comboHideAt = 0;
  /** M2 연출 객체 · 호출 수 (전부 끔이면 0이어야 함 — 완료 조건 ③) */
  fxCount = 0;
  private scaleK = 1;
  // ── M3 아트 (I-11 · H-12) — 그림이 없거나 끄면 도형 (= M2 화면) ──
  private artSettings!: ArtSettings;
  /** 지금 그리는 계획 (smoke · 검수용으로 읽음) */
  artPlan!: ArtPlan;
  /** 실제로 텍스처가 올라간 그림 파일 이름 */
  artLoaded: string[] = [];
  /** PR #2 1080폭 기준 px → 지금 프레임 px */
  private px(n: number): number {
    return n * this.scaleK;
  }

  constructor() {
    super('battle');
  }

  init(data: BattleSceneData): void {
    this.cfg = data.config;
    this.debug = data.debug;
    this.sim = new BattleSim(this.cfg, data.startStage);
    this.L = computeLayout(this.cfg.layout, this.scale.width, this.scale.height);
    this.router = new InputRouter(this.L, this.cfg.input);
    this.scaleK = this.L.width / DESIGN_WIDTH;
    this.fxOn = loadToggles();
    this.artSettings = loadArtSettings();
    this.menuGfx.clear();
  }

  /** art/game 그림 불러오기 — 목록(빌드에 묶인 파일)에 있는 것만. 못 읽은 파일은 텍스처가 없어서 폴백 */
  preload(): void {
    for (const file of neededFiles()) {
      const url = ART_FILE_URLS[file];
      if (url && !this.textures.exists(artTextureKey(file))) this.load.image(artTextureKey(file), url);
    }
    // M3-D 충격 별 그림 (있으면 — 없으면 도형 별)
    const impact = ART_DATA.config.impact_file;
    if (impact && ART_FILE_URLS[impact] && !this.textures.exists(artTextureKey(impact))) this.load.image(artTextureKey(impact), ART_FILE_URLS[impact]);
  }

  private applyArt(): void {
    this.artLoaded = neededFiles().filter((f) => this.textures.exists(artTextureKey(f)));
    this.artPlan = resolveArtPlan(ART_DATA, this.artSettings, new Set(this.artLoaded));
    this.ant.setArt(this.artPlan);
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
    createFxPanel(this.fxOn, (t) => {
      this.fxOn = t;
      this.ant.setMotion(t.motion);
    }, () => this.sfx.unlock());
    this.applyArt();
    this.ant.setMotion(this.fxOn.motion);
    const artPanel = createArtPanel(
      ART_DATA,
      this.artSettings,
      () => {
        this.applyArt();
        artPanel.showPlan(this.artPlan);
      },
      () => this.sfx.unlock(),
    );
    artPanel.showPlan(this.artPlan);

    if (this.debug) {
      this.debugText = this.add
        .text(this.px(16), L.battle.top + this.px(12), '', { fontFamily: 'monospace', fontSize: `${Math.round(this.px(26))}px`, color: '#1b1a17', backgroundColor: '#ffffffaa' })
        .setDepth(DEPTH.debug);
    }

    this.handleEvents(this.sim.drainEvents());
    this.refreshHud();
  }

  update(_time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    // M2 A 히트스톱: 멈춘 동안 core에 시간을 넘기지 않음 (core 시계 통째로 정지 — 결과 그대로)
    this.sim.update(this.hitstop.consume(deltaMs) / 1000);
    this.handleEvents(this.sim.drainEvents());
    // M3-C 모션 — core 상태를 읽어 자세만 그림 (히트스톱 중엔 공격 모션도 멈춤 · 땅에 닿으면 먼지 고리)
    if (this.ant.updateMotion(deltaMs, this.sim.ant, this.sim.building?.state === 'falling', this.fxOn.hitstop && this.hitstop.stopped, this.hangGap(), this.sim.ant.y / this.cfg.battle.ant.height_ratio)) {
      this.dustRing();
      this.fxCount += 1;
    }
    if (this.comboText?.visible && this.time.now >= this.comboHideAt) this.comboText.setVisible(false);
    this.syncViews();
    this.updateDebris(dt);
    this.strip.update(dt);
    for (const c of this.clouds) {
      c.x += dt * 18 * (c.scaleX > 1 ? 1.4 : 1);
      if (c.x - c.width > this.L.width) c.x = -c.width;
    }
    this.refreshHud();
    if (this.debugText) this.debugText.setText(this.debugLines());
    this.markForSmoke();
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
    g.fillRect(0, L.groundY - this.px(5), L.width, this.px(10));
  }

  private createMenu(): void {
    const { L, cfg } = this;
    const h = L.strip.height * cfg.layout.strip_menu_height_ratio;
    const y = L.strip.top + (L.strip.height - h) / 2;
    const w = L.width * 0.17;
    const gap = L.width * 0.02;
    const x0 = L.width * 0.03;
    MENU.forEach(({ key, nest }, i) => {
      const label = t(key);
      const x = x0 + i * (w + gap);
      const g = this.add.graphics().setDepth(DEPTH.menu);
      g.fillStyle(COLOR.menuBg, 0.45);
      g.fillRoundedRect(x, y, w, h, this.px(24));
      g.lineStyle(this.px(4), 0xffffff, 0.25);
      g.strokeRoundedRect(x, y, w, h, this.px(24));
      this.add
        .text(x + w / 2, y + h / 2, label, { fontFamily: FONT, fontSize: `${Math.round(h * 0.34)}px`, color: COLOR.menuText, fontStyle: '900' })
        .setOrigin(0.5)
        .setDepth(DEPTH.menu);
      this.menuGfx.set(label, g);
      const action = nest ? ({ type: 'openNest', via: 'button' } as const) : ({ type: 'menu', id: label } as const);
      this.router.addButton({ id: `menu:${label}`, rect: { x, y, w, h }, mode: 'battle', action, priority: 10 });
    });
  }

  private createHud(): void {
    const { L } = this;
    const h = L.hud.height;
    this.add.rectangle(0, 0, L.width, h, COLOR.hudBg).setOrigin(0).setDepth(DEPTH.hud);
    this.hudStage = this.add
      .text(this.px(36), h * 0.34, '', { fontFamily: FONT, fontSize: `${Math.round(h * 0.36)}px`, color: COLOR.hudText, fontStyle: '900' })
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.hud);
    this.hudPips = this.add.graphics().setDepth(DEPTH.hud);

    const barW = L.width * 0.36;
    const barH = h * 0.26;
    const barX = L.width - this.px(36) - barW;
    const barY = h * 0.34;
    this.add.rectangle(barX, barY, barW, barH, COLOR.hpBack).setOrigin(0, 0.5).setDepth(DEPTH.hud);
    this.hudHpFill = this.add.rectangle(barX, barY, barW, barH, COLOR.hpFill).setOrigin(0, 0.5).setDepth(DEPTH.hud);
    this.hudHpText = this.add
      .text(barX + barW / 2, barY, '', { fontFamily: FONT, fontSize: `${Math.round(barH * 0.8)}px`, color: '#ffffff', fontStyle: '900', stroke: '#22201c', strokeThickness: this.px(6) })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);
    this.add
      .text(barX - this.px(14), barY, t('hud.hp'), { fontFamily: FONT, fontSize: `${Math.round(barH * 0.8)}px`, color: COLOR.hudText, fontStyle: '900' })
      .setOrigin(1, 0.5)
      .setDepth(DEPTH.hud);
    this.hudAuto = this.add
      .text(L.width - this.px(36), h * 0.78, '', { fontFamily: FONT, fontSize: `${Math.round(h * 0.2)}px`, color: COLOR.autoOn, fontStyle: '900' })
      .setOrigin(1, 0.5)
      .setDepth(DEPTH.hud);
  }

  private createChallengeButton(): void {
    const { L, cfg } = this;
    const w = L.width * 0.34;
    const h = L.battle.height * 0.075;
    const cx = L.width - this.px(36) - w / 2;
    const cy = L.battle.top + L.battle.height * cfg.layout.challenge_button_y_ratio + h / 2;
    const glow = this.add.graphics();
    glow.fillStyle(COLOR.challenge, 0.35);
    glow.fillRoundedRect(-w / 2 - this.px(16), -h / 2 - this.px(16), w + this.px(32), h + this.px(32), this.px(40));
    const g = this.add.graphics();
    g.fillStyle(COLOR.challenge, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, this.px(32));
    g.lineStyle(this.px(6), 0xffffff, 0.9);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, this.px(32));
    const label = this.add
      .text(0, -h * 0.12, t('challenge.title'), { fontFamily: FONT, fontSize: `${Math.round(h * 0.42)}px`, color: COLOR.challengeText, fontStyle: '900', stroke: '#a2440f', strokeThickness: this.px(8) })
      .setOrigin(0.5);
    this.challengeSub = this.add
      .text(0, h * 0.3, '', { fontFamily: FONT, fontSize: `${Math.round(h * 0.2)}px`, color: '#fff3e0', fontStyle: '900' })
      .setOrigin(0.5);
    this.challengeBtn = this.add.container(cx, cy, [glow, g, label, this.challengeSub]).setDepth(DEPTH.challenge).setVisible(false);
    // 강조 연출: 숨쉬기 + 빛 번짐
    this.tweens.add({ targets: this.challengeBtn, scale: { from: 1, to: 1.08 }, yoyo: true, repeat: -1, duration: 520, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: glow, alpha: { from: 0.2, to: 1 }, yoyo: true, repeat: -1, duration: 520, ease: 'Sine.easeInOut' });

    this.router.addButton({
      id: 'challenge',
      rect: { x: cx - w / 2 - this.px(16), y: cy - h / 2 - this.px(16), w: w + this.px(32), h: h + this.px(32) },
      mode: 'battle',
      action: { type: 'challenge' },
      enabled: () => this.sim.challengeAvailable,
      priority: 20,
    });
  }

  /** 입력은 전부 InputRouter가 판정 → 여기서는 action만 처리 */
  private createInput(): void {
    this.router.addButton({ id: 'nestBack', rect: nestBackButtonRect(this.L), mode: 'nest', action: { type: 'closeNest', via: 'button' } });
    const sample = (p: Phaser.Input.Pointer, up: boolean) => ({ id: p.id, x: p.x, y: p.y, t: up ? p.upTime : p.downTime });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.sfx.unlock(); // 첫 탭에서 소리 켬 (H-10 ⑥-5)
      this.dispatch(this.router.down(sample(p, false)));
      this.refreshPressed();
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      this.dispatch(this.router.up(sample(p, true)));
      this.refreshPressed();
    });
  }

  private dispatch(actions: InputAction[]): void {
    for (const a of actions) {
      switch (a.type) {
        case 'strongJump':
          this.sim.tapStrongJump();
          break;
        case 'challenge':
          this.sim.challenge();
          break;
        case 'menu':
          this.showToast(t('toast.menu_wip', { label: a.id }));
          break;
        case 'openNest':
          this.router.setMode('nest');
          this.scene.launch('nest', { config: this.cfg });
          break;
        case 'closeNest': {
          this.router.setMode('battle');
          const nest = this.scene.get('nest') as NestScene;
          nest.close();
          break;
        }
      }
    }
    this.handleEvents(this.sim.drainEvents());
  }

  private refreshPressed(): void {
    const pressed = new Set(this.router.pressedButtonIds());
    for (const [label, g] of this.menuGfx) g.setAlpha(pressed.has(`menu:${label}`) ? 0.6 : 1);
  }

  // ── 이벤트 → 연출 ────────────────────────────────────────

  private handleEvents(events: BattleEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case 'stageStart':
          this.removeBuildingView(false);
          if (e.reason === 'retreat') this.showToast(t('toast.retreat', { n: e.stage }), COLOR.hurt);
          else if (e.reason === 'restart') this.showToast(t('toast.restart'));
          else if (e.reason === 'challenge') this.showToast(t('toast.challenge', { n: e.stage }));
          else if (e.reason === 'advance') this.showToast(t('toast.advance', { n: e.stage }));
          break;
        case 'stageClear':
          if (e.wasChallenge) this.showToast(t('toast.breakthrough'), COLOR.autoOn);
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
          const on = this.fxOn;
          const final = e.hpLeft <= 0; // 마지막 일격
          // M3-D: 마지막 일격 > 4연타 마무리 (core combo) > 일반 — A' 끔이면 마무리 없음
          const kind: StrikeKind = strikeKind(e.combo, e.hpLeft, on.finisher);
          const fin = kind === 'finisher';
          const interval = this.cfg.battle.strike_interval_s;
          // E 펀치 과장 (끔 = M1 팔 찌르기) · 마무리 팔은 더 길게 (A')
          const stretch = (on.punch ? FX.punch.stretch : FX.arm.stretch) * (fin ? FX.finisher.stretch_mult : 1);
          this.fxCount += this.ant.strike(e.arm, stretch, FX.punch.ms, on.punch ? FX.punch.fist_scale : null, interval);
          if (on.punch || fin) this.fxCount += 1;
          const b = this.sim.building;
          if (this.buildingView && b) {
            this.buildingView.setCrackSteps(FX.crack.steps);
            this.buildingView.shake(this.px(FX.building_shake.px), FX.building_shake.ms);
            this.buildingView.setHp(e.hpLeft, b.maxHp);
            if (on.flash) this.fxCount += 1 + Number(this.buildingView.flash(FX.flash.alpha, FX.flash.ms)); // B
          }
          const y = this.ant.root.y - this.cfg.battle.ant.height_ratio * this.L.battle.height;
          this.floatText(this.L.width / 2 + this.px(Phaser.Math.Between(-120, 120)), y, `${e.damage}`, COLOR.damage, this.px(FX.damage.text_px), 900, FX.damage.ms, FX.damage.pop_scale);
          if (on.hitstop || fin) { this.hitstop.add(hitstopMs(kind, interval), FX.hitstop.max_ms); this.fxCount += 1; } // A · A' (일반 = 간격 × hit_ratio_max 이하)
          if (fin) { this.cameras.main.shake(FX.finisher.camera_ms, FX.finisher.camera_intensity); this.fxCount += 1; } // A' 큰 흔들림
          else if (on.shake && !final) { this.cameras.main.shake(FX.camera.hit_ms, FX.camera.hit_intensity); this.fxCount += 1; } // C (마지막 일격은 destroy에서 크게)
          if (on.impact) this.impact(kind, e.arm, stretch); // B' 충격 별 · 건물 밀림 · 큰 조각
          if (on.combo) this.showCombo(e.combo); // D
          if (on.hitDebris) this.burstHitDebris(y); // F
          if (on.sfx && this.sfx.created) { if (final) this.sfx.final(); else if (fin) this.sfx.finisher(); else this.sfx.hit(e.combo); this.fxCount += 1; } // G · A' 마무리 "쾅"
          break;
        }
        case 'destroy':
          this.burstDebris(e.debrisReward);
          this.removeBuildingView(false);
          if (this.fxOn.shake) { this.cameras.main.shake(FX.camera.final_ms, FX.camera.final_intensity); this.fxCount += 1; } // C 크게
          else this.cameras.main.shake(FX.camera.destroy_ms, FX.camera.destroy_intensity); // M1
          this.crumbleText(battleToScreenY(this.L, e.y) - this.px(140));
          if (this.fxOn.sfx && this.sfx.created) { this.sfx.crumble(); this.fxCount += 1; } // G
          this.comboText?.setVisible(false);
          break;
        case 'land':
          this.comboText?.setVisible(false);
          this.ant.hit(ART_DATA.config.hit_face_ms);
          this.cameras.main.shake(260, 0.014);
          this.floatText(this.L.width / 2, this.L.groundY - this.cfg.battle.ant.height_ratio * this.L.battle.height * 2.2, `-${e.damage}`, COLOR.hurt, this.px(72), 900);
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

  /** 잔해 조각마다 운반 팝업 숫자를 나눠 준다 (합계 = 건물 debris_reward, 연출용) */
  private burstDebris(reward: number): void {
    const v = this.buildingView;
    if (!v) return;
    const n = this.cfg.strip.debris_pieces;
    const each = n > 0 ? Math.floor(reward / n) : 0;
    const bw = this.cfg.battle.building.width_ratio * this.L.width;
    const bh = this.cfg.battle.building.height_ratio * this.L.battle.height;
    for (let i = 0; i < n; i++) {
      const size = this.px(Phaser.Math.Between(40, 80));
      const x = v.root.x + Phaser.Math.FloatBetween(-0.45, 0.45) * bw;
      const y = v.root.y - Phaser.Math.FloatBetween(0.1, 0.9) * bh;
      const obj = this.add.rectangle(x, y, size, size * 0.8, v.color).setStrokeStyle(this.px(5), COLOR.buildingDark).setDepth(DEPTH.building);
      this.debris.push({ obj, vx: this.px(Phaser.Math.FloatBetween(-520, 520)), vy: this.px(Phaser.Math.FloatBetween(-900, -300)), spin: Phaser.Math.FloatBetween(-8, 8), restTimer: null, amount: each + (i === 0 ? reward - each * n : 0) });
    }
  }

  private updateDebris(dt: number): void {
    const groundY = this.L.groundY;
    const gravity = this.px(2600); // 연출 전용 (1080폭 기준 px/s²)
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i]!;
      if (d.restTimer === null) {
        d.vy += gravity * dt;
        d.obj.x = Phaser.Math.Clamp(d.obj.x + d.vx * dt, this.px(40), this.L.width - this.px(40));
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
          this.tweens.add({ targets: obj, y: groundY + this.px(30), scale: 0.3, alpha: 0, duration: 160, onComplete: () => obj.destroy() });
          this.strip.spawnCarrier(obj.x, d.amount);
        }
      }
    }
  }

  /** CA-002: (떨어지는 건물 밑면 − 개미 발) ÷ 개미 키 — 건물이 없거나 착지했으면 Infinity */
  private hangGap(): number {
    const b = this.sim.building;
    return b && b.state === 'falling' ? (b.y - this.sim.ant.y) / this.cfg.battle.ant.height_ratio : Infinity;
  }

  private dustRing(): void {
    const ring = this.add.ellipse(this.L.width / 2, this.L.groundY, this.px(120), this.px(36)).setStrokeStyle(this.px(8), 0xffffff, 0.9).setDepth(DEPTH.ant - 1);
    this.tweens.add({ targets: ring, scaleX: 3, scaleY: 2, alpha: 0, duration: 320, onComplete: () => ring.destroy() });
  }

  private floatText(x: number, y: number, text: string, color: string, size: number, weight = 900, ms = 750, popScale = 1.25): Phaser.GameObjects.Text {
    const tx = this.add
      .text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: `${weight}`, stroke: COLOR.damageStroke, strokeThickness: Math.max(this.px(6), size / 7) })
      .setOrigin(0.5)
      .setDepth(DEPTH.fx);
    this.tweens.add({ targets: tx, y: y - this.px(110), alpha: { from: 1, to: 0 }, scale: { from: popScale, to: 1 }, duration: ms, ease: 'Quad.easeOut', onComplete: () => tx.destroy() });
    return tx;
  }

  /** "와르르!" — 대비 켬이면 어두운 받침 판 + 굵은 테두리 (잼병 L-05) */
  private crumbleText(y: number): void {
    const c = FX.crumble_text;
    if (!this.fxOn.contrast) {
      this.floatText(this.L.width / 2, y, t('fx.crumble'), '#ffe08a', this.px(c.px), 900, c.ms); // M1
      return;
    }
    const tx = this.add
      .text(0, 0, t('fx.crumble'), { fontFamily: FONT, fontSize: `${Math.round(this.px(c.px))}px`, color: '#ffe08a', fontStyle: '900', stroke: '#2a1a0c', strokeThickness: this.px(c.stroke_px) })
      .setOrigin(0.5)
      .setShadow(0, this.px(6), '#000000', this.px(10), true, true);
    const pad = this.px(24);
    const plate = this.add.graphics();
    plate.fillStyle(0x000000, c.plate_alpha);
    plate.fillRoundedRect(-tx.width / 2 - pad, -tx.height / 2 - pad / 2, tx.width + pad * 2, tx.height + pad, this.px(28));
    const box = this.add.container(this.L.width / 2, y, [plate, tx]).setDepth(DEPTH.fx);
    this.fxCount += 1;
    this.tweens.add({ targets: box, y: y - this.px(110), alpha: { from: 1, to: 0 }, scale: { from: 1.25, to: 1 }, duration: c.ms, ease: 'Quad.easeOut', onComplete: () => box.destroy(true) });
  }

  /** M2 D — "N HIT!" (2타부터 · 칠 때마다 튕김 · 마지막 타격 뒤 combo.ms 지나면 숨김) */
  private showCombo(combo: number): void {
    const c = FX.combo;
    if (combo < c.min_show) return;
    if (!this.comboText) {
      this.comboText = this.add
        .text(0, 0, '', { fontFamily: FONT, fontSize: `${Math.round(this.px(c.text_px))}px`, color: '#ffffff', fontStyle: '900', stroke: '#b3382a', strokeThickness: this.px(10) })
        .setOrigin(0, 0.5)
        .setDepth(DEPTH.fx);
      this.fxCount += 1;
    }
    const b = this.buildingView;
    const bw = this.cfg.battle.building.width_ratio * this.L.width;
    const x = this.L.width / 2 + bw / 2 - this.px(40);
    const y = (b ? b.root.y : this.L.groundY) - this.px(40);
    const tx = this.comboText;
    tx.setText(t('fx.combo', { n: combo })).setPosition(Math.min(x, this.L.width - tx.width - this.px(16)), y).setVisible(true).setAlpha(1);
    this.tweens.killTweensOf(tx);
    tx.setScale(c.pop_scale);
    this.tweens.add({ targets: tx, scale: 1, duration: 140, ease: 'Back.easeOut' });
    this.comboHideAt = this.time.now + c.ms;
    this.fxCount += 1;
  }

  /** M2 F — 타격점(건물 밑면)에서 작은 조각 · 먼지 */
  /** M3-D B' — 무기 끝 x · 건물 밑면 y에 충격 별 · 건물 그림 밀림 · (마무리 · 마지막 일격) 큰 조각 */
  private impact(kind: StrikeKind, slot: number, stretch: number): void {
    const v = this.buildingView;
    if (!v) return;
    const k = impactScale(kind);
    const x = Phaser.Math.Clamp(this.ant.strikeX(slot, stretch), v.root.x - v.w / 2, v.root.x + v.w / 2);
    const y = v.bottomY;
    const im = FX.impact;
    const file = ART_DATA.config.impact_file;
    const r = this.px(im.star_px) * k;
    const star: Phaser.GameObjects.Image | Phaser.GameObjects.Star =
      file && this.textures.exists(artTextureKey(file))
        ? this.add.image(x, y, artTextureKey(file)).setDisplaySize(r * 2, r * 2)
        : this.add.star(x, y, im.points, r * im.inner_ratio, r, COLOR.impact).setStrokeStyle(this.px(6), COLOR.buildingDark);
    star.setDepth(DEPTH.fx).setScale(star.scaleX * 0.4, star.scaleY * 0.4).setAngle(Phaser.Math.Between(0, 45));
    const sx = star.scaleX / 0.4;
    const sy = star.scaleY / 0.4;
    this.tweens.add({ targets: star, scaleX: sx * 1.2, scaleY: sy * 1.2, alpha: 0, duration: im.ms, ease: 'Quad.easeOut', onComplete: () => star.destroy() });
    v.push(this.px(im.push_px) * k, im.push_ms);
    this.fxCount += 2;
    if (dropsChunks(kind)) this.burstChunks(x, y);
  }

  /** M3-D B' 큰 조각 — 작은 파편(F)과 같은 움직임 · 크기만 큼 */
  private burstChunks(x: number, y: number): void {
    const f = FX.finisher;
    const d = FX.hit_debris;
    for (let i = 0; i < f.chunk_count; i++) {
      const size = this.px(f.chunk_px) * Phaser.Math.FloatBetween(0.8, 1.15);
      const o = this.add.rectangle(x, y, size, size * 0.8, this.buildingView?.color ?? 0xcccccc).setStrokeStyle(this.px(5), COLOR.buildingDark).setDepth(DEPTH.fx - 1);
      const ang = Phaser.Math.FloatBetween(Math.PI * 0.2, Math.PI * 0.8);
      const sp = this.px(d.speed_px) * (d.life_ms / 1000);
      this.tweens.add({ targets: o, x: o.x + Math.cos(ang) * sp * (i % 2 ? 1 : -1), y: o.y + Math.sin(ang) * sp, alpha: 0, angle: Phaser.Math.Between(-200, 200), duration: d.life_ms, ease: 'Quad.easeOut', onComplete: () => o.destroy() });
      this.fxCount += 1;
    }
  }

  private burstHitDebris(y: number): void {
    const d = FX.hit_debris;
    for (let i = 0; i < d.count; i++) {
      const size = this.px(d.size_px) * Phaser.Math.FloatBetween(0.6, 1.2);
      const dust = i % 2 === 1;
      const o = dust
        ? this.add.circle(this.L.width / 2, y, size * 0.7, 0xffffff, 0.8)
        : this.add.rectangle(this.L.width / 2, y, size, size, this.buildingView?.color ?? 0xcccccc).setStrokeStyle(2, COLOR.buildingDark);
      o.setDepth(DEPTH.fx - 1);
      const ang = Phaser.Math.FloatBetween(Math.PI * 0.15, Math.PI * 0.85); // 아래쪽 반원으로 튐
      const sp = this.px(d.speed_px) * Phaser.Math.FloatBetween(0.6, 1.1) * (d.life_ms / 1000);
      this.tweens.add({ targets: o, x: o.x + Math.cos(ang) * sp * (i % 2 ? 1 : -1), y: o.y + Math.sin(ang) * sp, alpha: 0, angle: Phaser.Math.Between(-180, 180), duration: d.life_ms, ease: 'Quad.easeOut', onComplete: () => o.destroy() });
      this.fxCount += 1;
    }
  }

  private showToast(text: string, color = '#ffffff'): void {
    this.toast?.destroy(true);
    const { L } = this;
    const tx = this.add.text(0, 0, text, { fontFamily: FONT, fontSize: `${Math.round(this.px(46))}px`, color, fontStyle: '900' }).setOrigin(0.5);
    const pad = this.px(28);
    const bg = this.add.rectangle(0, 0, tx.width + pad * 2, tx.height + pad, COLOR.toastBg, 0.55);
    const c = this.add.container(L.width / 2, L.battle.top + L.battle.height * 0.2, [bg, tx]).setDepth(DEPTH.fx);
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
    this.hudStage.setText(t('hud.stage', { n: s.stage }));
    // 진행도 점
    const g = this.hudPips;
    g.clear();
    const r = L.hud.height * 0.07;
    for (let i = 0; i < s.toClear; i++) {
      g.fillStyle(i < s.destroyed ? COLOR.pipOn : COLOR.pipOff, 1);
      g.fillCircle(this.px(36) + r + i * r * 3, L.hud.height * 0.78, r);
    }
    const a = sim.ant;
    const ratio = a.hp / a.maxHp;
    this.hudHpFill.scaleX = Math.max(0, ratio);
    this.hudHpFill.fillColor = ratio > 0.3 ? COLOR.hpFill : COLOR.hpLow;
    this.hudHpText.setText(`${Math.ceil(a.hp)} / ${a.maxHp}`);
    this.hudAuto.setText(t(s.autoAdvance ? 'hud.auto_on' : 'hud.auto_off'));
    this.hudAuto.setColor(s.autoAdvance ? COLOR.autoOn : COLOR.autoOff);

    const show = sim.challengeAvailable;
    if (this.challengeBtn.visible !== show) this.challengeBtn.setVisible(show);
    if (show) this.challengeSub.setText(t('challenge.sub', { n: s.stage + 1 }));
  }

  /** scripts/ci_smoke.mjs 확인용 — core 값을 DOM에 남긴다 (view가 세지 않음: 파괴 수는 core 누적값) */
  private markForSmoke(): void {
    this.frames += 1;
    if (this.frames % 10 !== 0) return;
    const host = this.game.canvas.parentElement;
    host?.setAttribute('data-frames', String(this.frames));
    host?.setAttribute('data-destroyed', String(this.sim.totalDestroyed));
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
