import Phaser from 'phaser';
import type { StripConfig } from '../core/config';
import type { Band } from '../core/layout';
import { COLOR, FONT } from './theme';

interface Worker {
  root: Phaser.GameObjects.Container;
  amount: number;
  phase: number;
}

/**
 * 땅속 띠 — 연출 전용 (경제 로직 없음).
 *  - 흙 단면 배경 + 점 패턴
 *  - 일개미 행렬: 좌 → 우 이동 (메뉴 버튼 뒤 레이어)
 *  - 굴 입구: 띠 우측 끝 고정, 도착하면 운반량 팝업
 */
export class StripView {
  /** 메뉴 버튼보다 아래 깊이에 둘 레이어 */
  readonly layer: Phaser.GameObjects.Container;
  private readonly scene: Phaser.Scene;
  private readonly cfg: StripConfig;
  private readonly band: Band;
  private readonly width: number;
  private readonly workers: Worker[] = [];
  private burrowX: number;
  /** M6 띠 그림 (덤불 = 건물 · 개미 뒤 · 땅 = 이 레이어) — null = 도형 */
  private art: { top: Phaser.GameObjects.Image; bottom: Phaser.GameObjects.Image; fill: Phaser.GameObjects.Rectangle } | null = null;
  /** "+N" 높이 (화면 y) — 기본 = 일개미 줄 위 · H-49 그림 켬 = 그림 굴 입구 가운데 */
  private popupY: number;
  private readonly laneY: number;
  private readonly size: number;
  private ambientTimer = 0;

  constructor(scene: Phaser.Scene, cfg: StripConfig, band: Band, width: number) {
    this.scene = scene;
    this.cfg = cfg;
    this.band = band;
    this.width = width;
    this.size = band.height * cfg.worker_size_ratio;
    this.burrowX = width * cfg.burrow_x_ratio;
    this.laneY = band.top + band.height * 0.56;
    this.popupY = this.lanePopupY();
    this.layer = scene.add.container(0, 0);

    const g = scene.add.graphics();
    g.fillStyle(COLOR.soil, 1);
    g.fillRect(0, band.top, width, band.height);
    g.fillStyle(COLOR.soilDot, 1);
    for (let i = 0; i < 90; i++) {
      const x = ((i * 7919) % 1000) / 1000 * width;
      const y = band.top + (((i * 104729) % 1000) / 1000) * band.height;
      g.fillCircle(x, y, 3 + (i % 3) * 2);
    }
    // 굴 입구
    g.fillStyle(COLOR.burrowRim, 1);
    g.fillEllipse(this.burrowX, this.laneY, this.size * 1.9, this.size * 1.5);
    g.fillStyle(COLOR.burrow, 1);
    g.fillEllipse(this.burrowX, this.laneY + this.size * 0.08, this.size * 1.45, this.size * 1.15);
    this.layer.add(g);
  }

  /**
   * M6 띠 그림 켜기 / 끄기 (H-42 ④). 한 장을 두 번 잘라 (crop) 깐다:
   *  - 풀 윗선(groundRatio) 위 = 덤불 → backDepth (건물 · 개미 뒤)
   *  - 아래 = 땅 → 이 레이어 맨 아래 (일개미 · 팝업 아래 · 잔해가 "땅속으로 쏙" 가려짐)
   * 풀 윗선 = 지면 (띠 맨 위). 그림 아래 남는 곳 = 그림 맨 아래 흙색 (fillColor)
   */
  setArt(art: { key: string; groundRatio: number; burrowX: number; fillColor: number; popupY?: number | null } | null, backDepth: number): void {
    if (this.art) {
      this.art.top.destroy();
      this.art.bottom.destroy();
      this.art.fill.destroy();
      this.art = null;
    }
    this.burrowX = this.width * (art ? art.burrowX : this.cfg.burrow_x_ratio);
    this.popupY = this.lanePopupY();
    if (!art) return;
    const mk = () => this.scene.add.image(0, 0, art.key).setOrigin(0, 0);
    const top = mk();
    const k = this.width / top.width;
    const lineY = art.groundRatio * top.height;
    const y0 = this.band.top - lineY * k;
    top.setScale(k).setPosition(0, y0).setCrop(0, 0, top.width, lineY).setDepth(backDepth);
    const bottom = mk().setScale(k).setPosition(0, y0);
    bottom.setCrop(0, lineY, bottom.width, bottom.height - lineY);
    const artBottom = y0 + top.height * k;
    const fill = this.scene.add.rectangle(0, artBottom, this.width, Math.max(0, this.band.top + this.band.height - artBottom), art.fillColor).setOrigin(0, 0);
    this.layer.addAt([fill, bottom], 1); // 0 = 도형 흙 단면 (그 위를 덮음)
    this.art = { top, bottom, fill };
    if (art.popupY !== null && art.popupY !== undefined) this.popupY = y0 + art.popupY * top.height * k; // 굴 입구 가운데 (일개미 줄은 그대로)
  }

  /** 지금 "+N" 자리 (일개미 줄 위 — 도형 띠 · 그림 키 없음) */
  private lanePopupY(): number {
    return this.laneY - this.size * 0.6;
  }

  /** "+N" 화면 y (검수용) */
  get popupAt(): number {
    return this.popupY;
  }

  /** M6 그림 켬인가 (smoke · 검수용) */
  get artMode(): 'image' | 'shape' {
    return this.art ? 'image' : 'shape';
  }

  /** 잔해를 집은 일개미 (파괴 연출 → 띠로 이어짐) */
  spawnCarrier(x: number, amount: number): void {
    // 앞 개미와 겹치지 않게 간격(worker_gap_ratio)만큼 뒤에 선다
    const gap = this.width * this.cfg.worker_gap_ratio;
    let sx = Math.min(x, this.burrowX - this.size);
    for (const w of this.workers) if (Math.abs(w.root.x - sx) < gap) sx = w.root.x - gap;
    this.spawnWorker(sx, amount, true);
  }

  update(dt: number): void {
    this.ambientTimer -= dt;
    if (this.ambientTimer <= 0) {
      this.ambientTimer = this.cfg.ambient_spawn_interval_s;
      this.spawnWorker(-this.size, 0, false); // M4: 배경 행렬은 재화 없음 · 숫자 팝업 없음 (H-17 질문 3)
    }
    const speed = this.cfg.worker_speed_ratio_per_s * this.width;
    for (let i = this.workers.length - 1; i >= 0; i--) {
      const w = this.workers[i]!;
      w.root.x += speed * dt;
      w.phase += dt * 14;
      w.root.y = this.laneY - Math.abs(Math.sin(w.phase)) * this.size * 0.08;
      if (w.root.x >= this.burrowX) {
        if (w.amount > 0) this.popup(w.amount);
        w.root.destroy(true);
        this.workers.splice(i, 1);
      }
    }
  }

  private spawnWorker(x: number, amount: number, carrying: boolean): void {
    const s = this.size;
    const root = this.scene.add.container(x, this.laneY);
    // 몸 (머리 · 가슴 · 배) + 다리 느낌의 선
    const g = this.scene.add.graphics();
    g.lineStyle(4, COLOR.worker, 1);
    for (const lx of [-0.15, 0.05, 0.25]) {
      g.lineBetween(lx * s, 0, (lx - 0.1) * s, s * 0.32);
      g.lineBetween(lx * s, 0, (lx + 0.1) * s, s * 0.32);
    }
    g.fillStyle(COLOR.worker, 1);
    g.fillEllipse(-s * 0.3, 0, s * 0.42, s * 0.32);
    g.fillCircle(0.02 * s, -s * 0.02, s * 0.14);
    g.fillCircle(s * 0.3, -s * 0.06, s * 0.18);
    root.add(g);
    // 짐 (부스러기)
    const load = this.scene.add.rectangle(s * 0.02, -s * 0.36, s * (carrying ? 0.5 : 0.28), s * (carrying ? 0.34 : 0.2), COLOR.crumb);
    load.setStrokeStyle(3, COLOR.groundLine);
    root.add(load);
    this.layer.add(root);
    this.workers.push({ root, amount, phase: Math.random() * Math.PI });
  }

  /** 굴 입구 "+N" — M4부터 core deposit(실제 재화 도착) 때 장면이 부름 */
  popup(amount: number): void {
    const t = this.scene.add
      .text(this.burrowX, this.popupY, `+${amount}`, {
        fontFamily: FONT,
        fontSize: `${Math.round(this.size * 0.55)}px`,
        color: COLOR.popup,
        fontStyle: '900',
        stroke: '#3b2a1a',
        strokeThickness: 8,
      })
      .setOrigin(0.5);
    this.layer.add(t);
    this.scene.tweens.add({
      targets: t,
      y: t.y - this.band.height * this.cfg.popup_rise_ratio,
      alpha: { from: 1, to: 0 },
      duration: this.cfg.popup_duration_s * 1000,
      ease: 'Quad.easeOut',
      onComplete: () => t.destroy(),
    });
  }
}
