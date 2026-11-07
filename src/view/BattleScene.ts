import Phaser from 'phaser';
import { BattleSim, type BattleEvent, type BattleStart } from '../core/battle';
import type { GameConfig } from '../core/config';
import { type InputAction, InputRouter } from '../core/inputRouter';
import { battleToScreenY, computeLayout, type Layout, nestBackButtonRect } from '../core/layout';
import { AntView } from './antView';
import { ART_FILE_URLS, artTextureKey } from './artFiles';
import { createArtPanel } from './artPanel';
import { ART_DATA, type ArtPlan, type ArtSettings, loadArtSettings, neededFiles, resolveArtPlan } from './artPlan';
import { type BuildingArt, BuildingView } from './buildingView';
import { ENV_DATA, type EnvPlan, envStatusText, neededEnvFiles, resolveEnvPlan } from './envPlan';
import { StripView } from './stripView';
import { COLOR, FONT } from './theme';
import { t } from './text';
import { FX, type FxToggles, loadToggles } from './fx';
import { createFxPanel } from './fxPanel';
import { HitstopClock } from './hitstop';
import { dropsChunks, hitstopMs, impactScale, type StrikeKind, strikeKind } from './hitFeel';
import { hitSoundTurn, lightFx, loadSpeed, nextSpeed, saveSpeed } from './speed';
import { SaveWriter } from './saveStore';
import { UpgradePanel } from './upgradePanel';
import { Sfx } from './sfx';
import type { NestScene } from './NestScene';

export interface BattleSceneData {
  config: GameConfig;
  startStage: number;
  debug: boolean;
  /** M4 저장에서 읽은 시작 상태 (없으면 새로 시작) */
  start?: BattleStart | null;
  /** M4 저장 켜기 (?stage 디버그 시작이면 끔 — 저장을 덮어쓰지 않게) */
  save?: boolean;
}

interface Debris {
  /** 도형 조각 · M6 파편 그림 */
  obj: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image;
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
  /** M6 지금 건물 뷰의 건물 테이블 PK (파괴 뒤에도 파편 그림을 고르려고 — core 값을 기억만) */
  private buildingViewRow: string | null = null;
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
  // ── M3-E 배속 (I-17 · H-28) — view만 들고 있음, core는 dt × 배속만 받음 ──
  speed = 1;
  private speedText!: Phaser.GameObjects.Text;
  private speedBg!: Phaser.GameObjects.Rectangle;
  /** 실제 배속 (게임 시간 ÷ 벽시계 — 느린 기기에서 상한에 걸리는지 · ?debug) */
  private realSpeed = 1;
  // ── M4 강화 · 재화 · 저장 (I-12 · H-17) ──
  private hudDebris!: Phaser.GameObjects.Text;
  upgradePanel!: UpgradePanel;
  private saver!: SaveWriter;
  // ── M3 아트 (I-11 · H-12) — 그림이 없거나 끄면 도형 (= M2 화면) ──
  private artSettings!: ArtSettings;
  /** 지금 그리는 계획 (smoke · 검수용으로 읽음) */
  artPlan!: ArtPlan;
  /** 실제로 텍스처가 올라간 그림 파일 이름 */
  artLoaded: string[] = [];
  // ── M6 건물 · 배경 · 파괴 그림 (H-42) — 끄거나 파일 없음 = 지금 도형 ──
  /** 지금 그리는 계획 (smoke · 검수용으로 읽음) */
  envPlan!: EnvPlan;
  private skyImage: Phaser.GameObjects.Image | null = null;
  private groundGfx: Phaser.GameObjects.Graphics | null = null;
  private envLoading = false;
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
    this.sim = new BattleSim(this.cfg, data.startStage, data.start ?? null);
    this.saver = new SaveWriter(this.sim, data.save ?? false);
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
    // M6: 켬일 때만 시작에 읽음 (약 6MB — [프로토만] H-42 Q6). 끔이면 지금처럼 안 읽음 · [ART]에서 켜면 그때 읽음
    if (this.artSettings.env) this.queueEnvFiles();
  }

  /** M6 그림 읽기 예약 — 목록(빌드에 묶인 파일)에 있고 아직 안 올라간 것만. 반환 = 예약한 수 */
  private queueEnvFiles(): number {
    let n = 0;
    for (const file of neededEnvFiles()) {
      const url = ART_FILE_URLS[file];
      if (url && !this.textures.exists(artTextureKey(file))) {
        this.load.image(artTextureKey(file), url);
        n++;
      }
    }
    return n;
  }

  /** M6 계획 다시 세우고 하늘 · 띠 · 지면 선 · 지금 건물에 적용 ([ART] 바꿀 때마다) */
  private applyEnv(): void {
    const on = this.artSettings.env;
    if (on && !this.envLoading && this.queueEnvFiles() > 0) {
      // [ART]에서 켰는데 아직 안 읽음 → 읽은 뒤 다시
      this.envLoading = true;
      this.load.once('complete', () => {
        this.envLoading = false;
        this.applyEnv();
      });
      this.load.start();
    }
    const loaded = new Set(neededEnvFiles().filter((f) => this.textures.exists(artTextureKey(f))));
    this.envPlan = resolveEnvPlan(ENV_DATA, on, loaded);
    const p = this.envPlan;
    // 하늘: 전체 화면 한 장 (도형 하늘 위) · 도형 구름 숨김
    this.skyImage?.destroy();
    this.skyImage = null;
    if (p.sky) this.skyImage = this.add.image(this.L.width / 2, this.L.height / 2, artTextureKey(p.sky)).setDisplaySize(this.L.width, this.L.height).setDepth(DEPTH.sky);
    for (const c of this.clouds) c.setVisible(!p.sky);
    // 띠: 덤불 = 하늘 바로 위 (건물 · 개미 뒤) · 땅 = 띠 레이어 · 지면 선 숨김
    if (p.strip) {
      const key = artTextureKey(p.strip.file);
      const src = this.textures.get(key).getSourceImage() as HTMLImageElement;
      const c = this.textures.getPixel(Math.floor(src.width / 2), src.height - 1, key);
      const fill = c ? Phaser.Display.Color.GetColor(c.red, c.green, c.blue) : COLOR.soil;
      this.strip.setArt({ key, groundRatio: p.strip.groundRatio, burrowX: p.strip.burrowX, fillColor: fill, popupY: p.strip.popupY }, DEPTH.sky + 1);
    } else this.strip.setArt(null, DEPTH.sky + 1);
    this.groundGfx?.setVisible(!p.strip);
    // 지금 떨어지는 건물을 새 계획으로 다시 (HP · 위치는 core 값 그대로)
    if (this.buildingView && this.sim.building) {
      this.removeBuildingView(false);
      this.createBuildingView();
    }
  }

  private buildingArt(buildingId: string): BuildingArt | null {
    const a = this.envPlan?.buildings[buildingId];
    return a ? { key: artTextureKey(a.file), pivotY: a.pivotY, drawW: a.drawW, tint: a.tint } : null;
  }

  private createBuildingView(): void {
    const b = this.sim.building;
    if (!b) return;
    const bw = this.cfg.battle.building.width_ratio * this.L.width;
    const bh = this.cfg.battle.building.height_ratio * this.L.battle.height;
    this.buildingView = new BuildingView(this, this.L.width / 2, battleToScreenY(this.L, b.y), bw, bh, b.id, b.maxHp, this.buildingArt(b.buildingId));
    this.buildingView.root.setDepth(DEPTH.building);
    this.buildingView.setCrackSteps(FX.crack.steps);
    this.buildingView.setHp(b.hp, b.maxHp);
    this.buildingViewId = b.id;
    this.buildingViewRow = b.buildingId;
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
    this.ant.windupS = cfg.battle.jump.windup_s ?? 0; // M5

    // 땅속 띠 + 메뉴
    this.strip = new StripView(this, cfg.strip, L.strip, L.width);
    this.strip.layer.setDepth(DEPTH.strip);
    this.createMenu();

    this.createHud();
    this.createSpeedButton();
    this.setSpeed(loadSpeed());
    this.upgradePanel = new UpgradePanel(this, this.sim, L, (n) => this.px(n), this.router, DEPTH.fx + 5);
    // M4 저장 — 화면을 떠날 때 바로
    const flush = () => this.saver.flush(this.time.now);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
    this.createChallengeButton();
    this.createInput();
    createFxPanel(this.fxOn, (t) => {
      this.fxOn = t;
      this.ant.setMotion(t.motion);
    }, () => this.sfx.unlock());
    this.applyArt();
    this.applyEnv();
    this.ant.setMotion(this.fxOn.motion);
    const artPanel = createArtPanel(
      ART_DATA,
      this.artSettings,
      () => {
        this.applyArt();
        this.applyEnv();
        artPanel.showPlan(this.artPlan, envStatusText(this.envPlan));
      },
      () => this.sfx.unlock(),
    );
    artPanel.showPlan(this.artPlan, envStatusText(this.envPlan));

    if (this.debug) {
      this.debugText = this.add
        .text(this.px(16), L.battle.top + this.px(12), '', { fontFamily: 'monospace', fontSize: `${Math.round(this.px(26))}px`, color: '#1b1a17', backgroundColor: '#ffffffaa' })
        .setDepth(DEPTH.debug);
    }

    this.handleEvents(this.sim.drainEvents());
    this.refreshHud();
  }

  update(_time: number, wallMs: number): void {
    // M3-E 배속: 게임 시간만 빨라짐 — core는 고정 스텝 그대로 dt만 더 받음 · 연출(잔해 · 일개미 · 모션 · 히트스톱)도 같은 배속
    const deltaMs = wallMs * this.speed;
    const dt = deltaMs / 1000;
    const t0 = this.sim.time;
    // M2 A 히트스톱: 멈춘 동안 core에 시간을 넘기지 않음 (core 시계 통째로 정지 — 결과 그대로)
    this.sim.update(this.hitstop.consume(deltaMs) / 1000);
    if (wallMs > 0 && !this.hitstop.stopped) this.realSpeed += ((this.sim.time - t0) / (wallMs / 1000) - this.realSpeed) * 0.1;
    this.handleEvents(this.sim.drainEvents());
    // M3-C 모션 — core 상태를 읽어 자세만 그림 (히트스톱 중엔 공격 모션도 멈춤 · 땅에 닿으면 먼지 고리)
    if (this.ant.updateMotion(deltaMs, this.sim.ant, this.sim.building?.state === 'falling', this.hitstop.stopped, this.hangGap(), this.sim.ant.y / this.cfg.battle.ant.height_ratio)) {
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
    this.saver.tick(this.time.now);
    this.upgradePanel.refresh();
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
    this.groundGfx = g;
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
      const action = nest ? ({ type: 'openNest', via: 'button' } as const) : ({ type: 'menu', id: key } as const);
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
    // M4 HUD 잔해 — 왼쪽 둘째 줄 (진행 점 오른쪽 · 5개 자리 뒤)
    const pr = h * 0.07;
    this.hudDebris = this.add
      .text(this.px(36) + pr * 15 + this.px(10), h * 0.78, '', { fontFamily: FONT, fontSize: `${Math.round(h * 0.22)}px`, color: COLOR.popup, fontStyle: '900' })
      .setOrigin(0, 0.5)
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
          if (a.id === 'menu.upgrade') this.openUpgrade();
          else this.showToast(t('toast.menu_wip', { label: t(a.id) }));
          break;
        case 'buyUpgrade': {
          const r = this.sim.buyUpgrade(a.id);
          this.upgradePanel.feedback(a.id, r);
          if (r === 'short') this.showToast(t('upgrade.short'), COLOR.hurt);
          break;
        }
        case 'closeUpgrade':
          this.upgradePanel.close();
          this.router.setMode('battle');
          break;
        case 'resetSave':
          if (this.upgradePanel.armReset()) {
            SaveWriter.reset();
            location.reload(); // 테스트 빌드 [기록 지우기] — 두 번째 누름에서 (H-17 질문 7)
          }
          break;
        case 'openNest':
          this.router.setMode('nest');
          this.scene.launch('nest', { config: this.cfg });
          break;
        case 'cycleSpeed':
          this.setSpeed(nextSpeed(this.speed));
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
        case 'deposit': // M4 실제 재화 도착 — 굴 입구 "+N" · HUD 잔해 튐
          this.strip.popup(e.amount);
          this.popDebris();
          this.saver.request(this.time.now);
          break;
        case 'upgrade':
          this.saver.request(this.time.now);
          break;
        case 'stageStart':
          this.saver.request(this.time.now);
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
          this.buildingView = new BuildingView(this, this.L.width / 2, battleToScreenY(this.L, b.y), bw, bh, b.id, b.maxHp, this.buildingArt(b.buildingId));
          this.buildingView.root.setDepth(DEPTH.building);
          this.buildingViewId = b.id;
          this.buildingViewRow = b.buildingId;
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
          const interval = this.sim.stats.strikeIntervalS; // M4: 공격속도 강화 반영 (core 값)
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
          const light = lightFx(this.speed) && kind === 'hit'; // M3-E ×2 이상: 일반 타격 멈춤 · 흔들림 끔 (H-28 ②)
          if ((on.hitstop && !light) || fin) { this.hitstop.add(hitstopMs(kind, interval), FX.hitstop.max_ms); this.fxCount += 1; } // A · A' (일반 = 간격 × hit_ratio_max 이하)
          if (fin) { this.shake(FX.finisher.camera_ms, FX.finisher.camera_intensity); this.fxCount += 1; } // A' 큰 흔들림
          else if (on.shake && !final && !light) { this.shake(FX.camera.hit_ms, FX.camera.hit_intensity); this.fxCount += 1; } // C (마지막 일격은 destroy에서 크게)
          if (on.impact) this.impact(kind, e.arm, stretch); // B' 충격 별 · 건물 밀림 · 큰 조각
          if (final && this.buildingView) this.finalRing(Phaser.Math.Clamp(this.ant.strikeX(e.arm, stretch), this.buildingView.root.x - this.buildingView.w / 2, this.buildingView.root.x + this.buildingView.w / 2), this.buildingView.bottomY); // M6 링
          if (on.combo) this.showCombo(e.combo); // D
          if (on.hitDebris) this.burstHitDebris(y); // F
          if (on.sfx && this.sfx.created) { if (final) this.sfx.final(); else if (fin) this.sfx.finisher(); else if (hitSoundTurn(e.combo, this.speed)) this.sfx.hit(e.combo); this.fxCount += 1; } // G · A' 마무리 "쾅"
          break;
        }
        case 'destroy':
          if (this.buildingView) this.destroyDust(this.buildingView.root.x, this.buildingView.bottomY); // M6 먼지
          this.burstDebris(e.debrisReward);
          this.removeBuildingView(false);
          if (this.fxOn.shake) { this.shake(FX.camera.final_ms, FX.camera.final_intensity); this.fxCount += 1; } // C 크게
          else this.shake(FX.camera.destroy_ms, FX.camera.destroy_intensity); // M1
          this.crumbleText(battleToScreenY(this.L, e.y) - this.px(140));
          if (this.fxOn.sfx && this.sfx.created) { this.sfx.crumble(); this.fxCount += 1; } // G
          this.comboText?.setVisible(false);
          break;
        case 'land':
          this.comboText?.setVisible(false);
          this.ant.hit(ART_DATA.config.hit_face_ms);
          this.shake(260, 0.014);
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
    const art = this.debrisArt();
    for (let i = 0; i < n; i++) {
      const size = this.px(Phaser.Math.Between(40, 80));
      const x = v.root.x + Phaser.Math.FloatBetween(-0.45, 0.45) * bw;
      const y = v.root.y - Phaser.Math.FloatBetween(0.1, 0.9) * bh;
      // M6: 파편 그림 (건물별 → 공용) — 수 · 움직임 · 줍기는 그대로 (H-42 Q5)
      const obj = art ? this.debrisImage(art, x, y, size).setDepth(DEPTH.building) : this.add.rectangle(x, y, size, size * 0.8, v.color).setStrokeStyle(this.px(5), COLOR.buildingDark).setDepth(DEPTH.building);
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
        const floor = groundY - d.obj.displayHeight / 2;
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
          this.strip.spawnCarrier(obj.x, 0); // M4: "+N"은 core deposit 때 한 번에 (재화가 실제로 들어오는 때)
        }
      }
    }
  }

  /** CA-002: (떨어지는 건물 밑면 − 개미 발) ÷ 개미 키 — 건물이 없거나 착지했으면 Infinity */
  private hangGap(): number {
    const b = this.sim.building;
    return b && b.state === 'falling' ? (b.y - this.sim.ant.y) / this.cfg.battle.ant.height_ratio : Infinity;
  }

  /** M4 재화 도착 — HUD 숫자가 톡 튐 (dev.md §5 0.2초) */
  private popDebris(): void {
    this.tweens.killTweensOf(this.hudDebris);
    this.hudDebris.setScale(1.3);
    this.tweens.add({ targets: this.hudDebris, scale: 1, duration: 200, ease: 'Back.easeOut' });
  }

  /** 화면 흔들림 — 시간은 배속만큼 짧게 (M3-E) */
  private shake(ms: number, intensity: number): void {
    this.cameras.main.shake(ms / this.speed, intensity);
  }

  /** M3-E 배속 바꾸기 — 트윈 · 타이머 · 모션 최소 길이도 같은 배속 · 이 브라우저에 기억 */
  setSpeed(v: number): void {
    this.speed = v;
    this.tweens.timeScale = v;
    this.time.timeScale = v;
    this.ant.speed = v;
    this.speedText?.setText(t('hud.speed', { n: v }));
    this.speedBg?.setFillStyle(v > 1 ? COLOR.challenge : COLOR.menuBg, v > 1 ? 0.9 : 0.35);
    saveSpeed(v);
  }

  /** M3-E HUD 오른쪽 아래 (자동 진행 표시 왼쪽) [×1] 버튼 — InputRouter 버튼이라 강점프와 안 겹침 */
  private createSpeedButton(): void {
    const { L } = this;
    const h = L.hud.height;
    const probe = this.add.text(0, 0, t('hud.auto_on'), { fontFamily: FONT, fontSize: `${Math.round(h * 0.2)}px`, fontStyle: '900' });
    const probe2 = this.add.text(0, 0, t('hud.auto_off'), { fontFamily: FONT, fontSize: `${Math.round(h * 0.2)}px`, fontStyle: '900' });
    const autoW = Math.max(probe.width, probe2.width);
    probe.destroy();
    probe2.destroy();
    const bw = h * 0.62;
    const bh = h * 0.3;
    const cx = L.width - this.px(36) - autoW - this.px(18) - bw / 2;
    const cy = h * 0.78;
    this.speedBg = this.add.rectangle(cx, cy, bw, bh, COLOR.menuBg, 0.35).setStrokeStyle(this.px(3), 0xffffff, 0.6).setDepth(DEPTH.hud);
    this.speedText = this.add.text(cx, cy, '', { fontFamily: FONT, fontSize: `${Math.round(bh * 0.7)}px`, fontStyle: '900', color: COLOR.hudText }).setOrigin(0.5).setDepth(DEPTH.hud);
    this.router.addButton({ id: 'speed', rect: { x: cx - bw / 2, y: cy - bh / 2 - this.px(10), w: bw, h: bh + this.px(20) }, mode: 'battle', action: { type: 'cycleSpeed' }, priority: 20 });
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
  /** M6 지금 건물의 파편 그림 (끔 · 그림 건물 아님 · 파일 없음 = null → 도형 조각) */
  private debrisArt(): { key: string; tint: number | null } | null {
    if (!this.fxOn.envFx) return null;
    const a = this.buildingViewRow ? this.envPlan.buildings[this.buildingViewRow] : null;
    return a?.debris ? { key: artTextureKey(a.debris), tint: a.tint } : null;
  }

  /** 파편 그림 한 조각 — 폭 = 도형 조각 크기 × size_mult · 좌우 뒤집기 (반복 티 줄이기) · 7 · 8은 건물 색 그대로 곱하기 */
  private debrisImage(art: { key: string; tint: number | null }, x: number, y: number, size: number): Phaser.GameObjects.Image {
    const im = this.add.image(x, y, art.key);
    im.setScale((size * FX.debris_img.size_mult) / im.width).setFlipX(Math.random() < FX.debris_img.flip_ratio);
    if (art.tint !== null) im.setTint(art.tint);
    this.fxCount += 1;
    return im;
  }

  /** M6 마지막 일격 충격파 링 — 타격점에서 퍼지며 사라짐 */
  private finalRing(x: number, y: number): void {
    const file = this.envPlan.ring;
    if (!file || !this.fxOn.envFx) return;
    const d = this.px(FX.final_ring.px);
    const ring = this.add.image(x, y, artTextureKey(file)).setDepth(DEPTH.fx);
    const full = d / ring.width;
    ring.setScale(full * 0.2);
    this.tweens.add({ targets: ring, scale: full, alpha: { from: 1, to: 0 }, duration: FX.final_ring.ms, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    this.fxCount += 1;
  }

  /** M6 파괴 먼지 — 건물 밑면 둘레로 퍼지며 사라짐 */
  private destroyDust(x: number, y: number): void {
    const file = this.envPlan.dust;
    if (!file || !this.fxOn.envFx) return;
    const f = FX.destroy_dust;
    for (let i = 0; i < f.count; i++) {
      const o = this.add.image(x, y, artTextureKey(file)).setDepth(DEPTH.fx - 1).setFlipX(i % 2 === 1);
      const k = this.px(f.px) / o.width;
      o.setScale(k * 0.6);
      const ang = Math.PI * (f.count > 1 ? i / (f.count - 1) : 0.5); // 좌 → 우 반원 (위쪽)
      const sp = this.px(f.spread_px);
      this.tweens.add({ targets: o, x: x - Math.cos(ang) * sp, y: y - Math.sin(ang) * sp * 0.5, scale: k, alpha: { from: 0.9, to: 0 }, duration: f.ms, ease: 'Quad.easeOut', onComplete: () => o.destroy() });
      this.fxCount += 1;
    }
  }

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
    const art = this.debrisArt();
    for (let i = 0; i < f.chunk_count; i++) {
      const size = this.px(f.chunk_px) * Phaser.Math.FloatBetween(0.8, 1.15);
      const o = (art ? this.debrisImage(art, x, y, size) : this.add.rectangle(x, y, size, size * 0.8, this.buildingView?.color ?? 0xcccccc).setStrokeStyle(this.px(5), COLOR.buildingDark)).setDepth(DEPTH.fx - 1);
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
    this.hudDebris.setText(t('hud.debris', { n: sim.wallet }));
    this.hudAuto.setColor(s.autoAdvance ? COLOR.autoOn : COLOR.autoOff);

    const show = sim.challengeAvailable;
    if (this.challengeBtn.visible !== show) this.challengeBtn.setVisible(show);
    if (show) this.challengeSub.setText(t('challenge.sub', { n: s.stage + 1 }));
  }

  /** scripts/ci_smoke.mjs 확인용 — core 값을 DOM에 남긴다 (view가 세지 않음: 파괴 수는 core 누적값) */
  /** M4 [강화] → 패널 (전투는 뒤에서 계속 · 강점프 막힘) */
  openUpgrade(): void {
    if (this.upgradePanel.isOpen) return;
    this.router.setMode('upgrade');
    this.upgradePanel.open();
  }

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
      `speed ×${this.speed} (실제 ×${this.realSpeed.toFixed(2)})`,
      `t=${sim.time.toFixed(1)} stage=${sim.stage.stage} ${sim.stage.destroyed}/${sim.stage.toClear} auto=${sim.stage.autoAdvance} chal=${sim.stage.challenging}`,
      `ant ${a.phase} y=${a.y.toFixed(3)} hp=${a.hp} contact=${a.contact} nextArm=${a.nextArm + 1}`,
      b ? `bld#${b.id} ${b.state} y=${b.y.toFixed(3)} hp=${b.hp}/${b.maxHp}` : `bld - spawnIn=${sim.spawnTimer.toFixed(2)}`,
    ].join('\n');
  }
}
