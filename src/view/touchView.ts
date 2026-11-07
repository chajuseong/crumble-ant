import Phaser from 'phaser';
import type { TargetState } from '../core/battle';
import { battleToScreenY, type Layout } from '../core/layout';
import { FX } from './fx';
import { COLOR } from './theme';

/** 과녁 · 타이밍 원 모양 상수 (안 바뀌는 그림 — 크기 · 시간 키는 fx_config) */
const TARGET_RIM = 0x2a1a0c; // 진한 테두리 (밝은 하늘 위 대비 — L-05)
const TARGET_BULL = 0xe8452b;
const RING_IDLE = 0xffffff;
const RING_HOT = 0xffd23f;
const RING_OFF = 0x9a9a9a;

interface TargetView {
  id: number;
  root: Phaser.GameObjects.Container;
  timer: Phaser.GameObjects.Graphics;
  r: number;
}

/**
 * M7 터치 과녁 · 타이밍 원 (I-23 · H-51) — 그리기만. 위치 · 남은 시간 · 맞는 창 = core 값 (이식 원칙 1)
 * visible = [FX] "M7 과녁 · 타이밍 원" (끄면 그림만 안 보임 — 판정은 그대로)
 */
export class TouchView {
  private readonly targets: TargetView[] = [];
  private ring: Phaser.GameObjects.Graphics | null = null;
  private ringDone = false;
  visible = true;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly L: Layout,
    private readonly px: (n: number) => number,
    private readonly depth: number,
  ) {}

  /** core 비율 좌표 → 화면 px */
  screen(x: number, y: number): { x: number; y: number } {
    return { x: x * this.L.width, y: battleToScreenY(this.L, y) };
  }

  spawn(list: TargetState[]): number {
    this.clearTargets(false);
    const r = this.px(FX.target.px) / 2;
    for (const t of list) {
      const p = this.screen(t.x, t.y);
      const g = this.scene.add.graphics();
      g.fillStyle(0xffffff, 0.95).fillCircle(0, 0, r);
      g.lineStyle(this.px(5), TARGET_RIM, 1).strokeCircle(0, 0, r);
      g.fillStyle(TARGET_BULL, 1).fillCircle(0, 0, r * 0.42);
      g.fillStyle(0xffffff, 1).fillCircle(0, 0, r * 0.16);
      const timer = this.scene.add.graphics();
      const root = this.scene.add.container(p.x, p.y, [g, timer]).setDepth(this.depth).setVisible(this.visible).setScale(0.4);
      this.scene.tweens.add({ targets: root, scale: 1, duration: 110, ease: 'Back.easeOut' });
      this.targets.push({ id: t.id, root, timer, r });
    }
    return list.length;
  }

  /** 남은 시간 고리 (core 남은 수명 ÷ 전체) */
  update(left: number, total: number): void {
    const k = total > 0 ? Phaser.Math.Clamp(left / total, 0, 1) : 0;
    for (const t of this.targets) {
      t.root.setVisible(this.visible);
      t.timer.clear();
      t.timer.lineStyle(this.px(7), TARGET_RIM, 0.9);
      t.timer.beginPath();
      t.timer.arc(0, 0, t.r + this.px(9), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k, false);
      t.timer.strokePath();
    }
  }

  /** 맞힘 — 터짐 + 그 자리 충격 별. 반환 = 화면 자리 (null = 그 과녁 없음) */
  hit(id: number): { x: number; y: number } | null {
    const i = this.targets.findIndex((t) => t.id === id);
    if (i < 0) return null;
    const t = this.targets.splice(i, 1)[0]!;
    const at = { x: t.root.x, y: t.root.y };
    this.scene.tweens.add({ targets: t.root, scale: 1.45, alpha: 0, duration: 120, ease: 'Quad.easeOut', onComplete: () => t.root.destroy(true) });
    if (this.visible) {
      const im = FX.impact;
      const rr = this.px(im.star_px);
      const star = this.scene.add.star(at.x, at.y, im.points, rr * im.inner_ratio, rr, COLOR.impact).setStrokeStyle(this.px(6), COLOR.buildingDark).setDepth(this.depth + 1).setScale(0.5);
      this.scene.tweens.add({ targets: star, scale: 1.2, alpha: 0, duration: im.ms, ease: 'Quad.easeOut', onComplete: () => star.destroy() });
    }
    return at;
  }

  /** 시간 지남 · 매달림 끝 · 빈 곳 탭 · 다 맞힘 — 남은 과녁 조용히 사라짐 */
  clearTargets(fade = true): void {
    for (const t of this.targets.splice(0)) {
      if (!fade) t.root.destroy(true);
      else this.scene.tweens.add({ targets: t.root, scale: 0.6, alpha: 0, duration: 150, onComplete: () => t.root.destroy(true) });
    }
  }

  get count(): number {
    return this.targets.length;
  }

  // ── 타이밍 원 ──

  timingStart(): void {
    this.ring?.destroy();
    this.ring = this.scene.add.graphics().setDepth(this.depth - 1);
    this.ringDone = false;
  }

  /**
   * 도움닫기 경과 비율 k · 창 안인가 · 개미 발 자리.
   * circle (M7 B): k = 도움닫기 경과 ÷ 전체 · 원 하나가 줄어듦
   * ring (I-24): k = 경과 ÷ 겹침 시각 (1 = 겹침) · 발밑 원 (과녁) + 큰 링이 발밑 원으로 줄어듦 · GOOD 폭 안 = 노랑
   */
  timingUpdate(k: number, hot: boolean, footX: number, footY: number, antW: number, style: 'circle' | 'ring' = 'circle'): void {
    const g = this.ring;
    if (!g || this.ringDone) return;
    g.clear().setVisible(this.visible);
    if (style === 'ring') {
      const foot = antW * 1.4;
      const d0 = this.px(FX.ring.px);
      const d = Math.max(foot * 0.85, d0 + (foot - d0) * Math.max(0, k));
      g.lineStyle(this.px(5), hot ? RING_HOT : RING_IDLE, 0.9).strokeEllipse(footX, footY, foot, foot * 0.34); // 발밑 원
      g.lineStyle(this.px(hot ? 12 : 8), hot ? RING_HOT : RING_IDLE, hot ? 1 : 0.8).strokeEllipse(footX, footY, d, d * 0.34); // 줄어드는 링
      return;
    }
    const d0 = this.px(FX.timing.ring_px);
    const d = d0 + (antW - d0) * Phaser.Math.Clamp(k, 0, 1);
    g.lineStyle(this.px(hot ? 12 : 6), hot ? RING_HOT : RING_IDLE, hot ? 1 : 0.85);
    g.strokeEllipse(footX, footY, d, d * 0.34);
  }

  timingResult(ok: boolean, footX: number, footY: number): void {
    const g = this.ring;
    if (!g) return;
    this.ringDone = true;
    if (!ok) {
      g.clear();
      g.lineStyle(this.px(6), RING_OFF, 0.7).strokeEllipse(footX, footY, this.px(FX.timing.ring_px) * 0.6, this.px(FX.timing.ring_px) * 0.2);
      this.scene.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => this.timingClear() });
    } else this.timingClear();
  }

  timingClear(): void {
    this.ring?.destroy();
    this.ring = null;
    this.ringDone = false;
  }

  get timingOn(): boolean {
    return this.ring !== null && !this.ringDone;
  }
}
