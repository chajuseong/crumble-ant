import Phaser from 'phaser';
import type { TargetState } from '../core/battle';
import { battleToScreenY, type Layout } from '../core/layout';
import { FX } from './fx';
import { t as text } from './text';
import { COLOR, FONT } from './theme';

/** 과녁 · 타이밍 원 모양 상수 (안 바뀌는 그림 — 크기 · 시간 키는 fx_config) */
const TARGET_RIM = 0x2a1a0c; // 진한 테두리 (밝은 하늘 위 대비 — L-05)
const TARGET_BULL = 0xe8452b;
const RING_IDLE = 0xffffff;
const RING_HOT = 0xffd23f;
const RING_OFF = 0x9a9a9a;
// M7-E 받쳐! 과녁 도형 색 (그림 시안 #96과 같은 쪽 — 노랑 · 주황 + 흰 화살표 · 모양 상수)
const DEFEND_YELLOW = 0xffc928;
const DEFEND_ORANGE = 0xf28a1c;
const ARROW_WHITE = 0xfff8ec;

interface TargetView {
  id: number;
  root: Phaser.GameObjects.Container;
  timer: Phaser.GameObjects.Graphics;
  r: number;
  /** M7-E 받치기 과녁 (깜빡 · 놓침 연출) */
  defend: boolean;
  /** M7-E 그림 링 (있으면 테두리 대신 줄어듦) */
  ring?: Phaser.GameObjects.Image;
  ringBase?: number;
}

/** M7-E 받치기 과녁 옵션 — 체인 칸 "n / m" (core chainStep) · 수명 (실제 초 — 마지막 깜빡) */
export interface DefendSpawn {
  step: { n: number; m: number } | null;
  lifeS: number;
}

/**
 * M7 터치 과녁 · 타이밍 원 (I-23 · H-51) — 그리기만. 위치 · 남은 시간 · 맞는 창 = core 값 (이식 원칙 1)
 * visible = [FX] "M7 과녁 · 타이밍 원" (끄면 그림만 안 보임 — 판정은 그대로)
 */
export class TouchView {
  private readonly targets: TargetView[] = [];
  private ring: Phaser.GameObjects.Graphics | null = null;
  private ringDone = false;
  private lifeS = 0;
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

  spawn(list: TargetState[], defend: DefendSpawn | null = null): number {
    this.clearTargets(false);
    if (defend) return this.spawnDefend(list, defend);
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
      this.targets.push({ id: t.id, root, timer, r, defend: false });
    }
    return list.length;
  }

  /** M7-E 받치기 과녁 그림 (art/game — 있으면 그림 · 없으면 도형 — DD 13:00 · 아트 #96) · 텍스처 키 */
  defendArt: { button: string | null; ring: string | null; hit: string | null } = { button: null, ring: null, hit: null };

  /**
   * M7-E (H-66 · H-72) 받치기 과녁 — 노랑 · 주황 버튼 + 흰 위 화살표 (그림이 있으면 그림 · 없으면 같은 모양 도형 · 진한 테두리 L-05)
   * 아래 "받쳐!" · 위 체인 칸 "n / m" · 들어올 때 튀어나옴 · 남은 시간 = 줄어드는 링 · 마지막 blink_ms 깜빡 · hint = 처음 N번 손가락 안내
   */
  private spawnDefend(list: TargetState[], d: DefendSpawn): number {
    const r = this.px(FX.defend.target_px) / 2;
    this.lifeS = d.lifeS;
    const art = this.defendArt;
    for (const t of list) {
      const p = this.screen(t.x, t.y);
      const parts: Phaser.GameObjects.GameObject[] = [];
      if (art.button) parts.push(this.scene.add.image(0, 0, art.button).setDisplaySize(r * 2, r * 2));
      else {
        const g = this.scene.add.graphics();
        const bR = r * 0.8; // 버튼 (바깥 링 자리 = r)
        g.fillStyle(TARGET_RIM, 1).fillCircle(0, 0, bR);
        g.fillStyle(DEFEND_ORANGE, 1).fillCircle(0, 0, bR * 0.9);
        g.fillStyle(DEFEND_YELLOW, 1).fillCircle(0, 0, bR * 0.74);
        g.fillStyle(0xffffff, 0.45).fillEllipse(-bR * 0.32, -bR * 0.42, bR * 0.36, bR * 0.2);
        // 흰 위 화살표 (진한 테두리)
        const tri = [0, -bR * 0.56, -bR * 0.42, -bR * 0.06, bR * 0.42, -bR * 0.06];
        g.fillStyle(TARGET_RIM, 1).fillTriangle(tri[0]!, tri[1]! - this.px(6), tri[2]! - this.px(7), tri[3]! + this.px(4), tri[4]! + this.px(7), tri[5]! + this.px(4));
        g.fillRect(-bR * 0.2 - this.px(5), -bR * 0.1, bR * 0.4 + this.px(10), bR * 0.58 + this.px(5));
        g.fillStyle(ARROW_WHITE, 1).fillTriangle(tri[0]!, tri[1]!, tri[2]!, tri[3]!, tri[4]!, tri[5]!);
        g.fillRect(-bR * 0.2, -bR * 0.1, bR * 0.4, bR * 0.58);
        parts.push(g);
      }
      const label = this.scene.add
        .text(0, r * 1.22, text('fx.defend_target'), { fontFamily: FONT, fontSize: `${Math.round(r * 0.4)}px`, color: '#ffffff', fontStyle: '900', stroke: '#2a1a0c', strokeThickness: this.px(8) })
        .setOrigin(0.5);
      parts.push(label);
      if (d.step && d.step.m > 1) {
        const chip = this.scene.add
          .text(0, -r * 1.25, text('fx.chain_count', { n: d.step.n, m: d.step.m }), { fontFamily: FONT, fontSize: `${Math.round(r * 0.38)}px`, color: '#ffffff', fontStyle: '900', stroke: '#2a1a0c', strokeThickness: this.px(8) })
          .setOrigin(0.5);
        parts.push(chip);
      }
      const timer = this.scene.add.graphics();
      parts.push(timer);
      let ring: Phaser.GameObjects.Image | undefined;
      if (art.ring) {
        ring = this.scene.add.image(0, 0, art.ring).setDisplaySize(r * 2, r * 2);
        parts.push(ring);
      }
      const root = this.scene.add.container(p.x, p.y, parts).setDepth(this.depth).setVisible(this.visible).setScale(FX.defend.pop_scale);
      this.scene.tweens.add({ targets: root, scale: 1, duration: FX.defend.pop_ms, ease: 'Back.easeOut' });
      this.targets.push({ id: t.id, root, timer, r, defend: true, ring, ringBase: ring?.scale });
    }
    return list.length;
  }

  /** M7-E (H-72) 처음 N번 손가락 안내 — 과녁 오른쪽 아래 손가락이 톡톡 + "눌러!" (과녁과 같이 사라짐) */
  fingerHint(label: string): void {
    const t = this.targets[0];
    if (!t || !t.defend) return;
    const r = t.r;
    const g = this.scene.add.graphics();
    const s = r * 0.55;
    g.fillStyle(0xffffff, 1).lineStyle(this.px(6), TARGET_RIM, 1);
    g.fillRoundedRect(-s * 0.18, -s * 0.05, s * 0.36, s * 0.9, s * 0.16).strokeRoundedRect(-s * 0.18, -s * 0.05, s * 0.36, s * 0.9, s * 0.16); // 검지
    g.fillRoundedRect(-s * 0.42, s * 0.45, s * 0.84, s * 0.7, s * 0.25).strokeRoundedRect(-s * 0.42, s * 0.45, s * 0.84, s * 0.7, s * 0.25); // 손
    const finger = this.scene.add.container(r * 0.55, r * 0.55, [g]).setAngle(-20);
    this.scene.tweens.add({ targets: finger, x: r * 0.3, y: r * 0.25, duration: 220, yoyo: true, repeat: -1, ease: 'Quad.easeInOut' });
    const tx = this.scene.add
      .text(r * 1.15, -r * 0.2, label, { fontFamily: FONT, fontSize: `${Math.round(r * 0.42)}px`, color: '#ffe08a', fontStyle: '900', stroke: '#2a1a0c', strokeThickness: this.px(9) })
      .setOrigin(0, 0.5);
    t.root.add([finger, tx]);
  }

  /** M7-E 받치기 과녁이 있는가 (놓침 연출 고를 때) */
  get defendShown(): boolean {
    return this.targets.some((t) => t.defend);
  }

  /** 남은 시간 고리 (core 남은 수명 ÷ 전체) · 그림 링이면 링이 줄어듦 (1 → 0.8) */
  update(left: number, total: number): void {
    const k = total > 0 ? Phaser.Math.Clamp(left / total, 0, 1) : 0;
    const leftMs = k * this.lifeS * 1000; // 남은 실제 시간 (M7-E 깜빡)
    for (const t of this.targets) {
      t.root.setVisible(this.visible);
      if (t.defend) t.root.setAlpha(leftMs < FX.defend.blink_ms && Math.floor(this.scene.time.now / 60) % 2 === 1 ? 0.35 : 1);
      if (t.ring && t.ringBase !== undefined) {
        t.ring.setScale(t.ringBase * (0.8 + 0.2 * k));
        continue;
      }
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
    if (this.visible && t.defend && this.defendArt.hit) {
      // M7-E 그림 번쩍 (있으면 충격 별 대신)
      const im = this.scene.add.image(at.x, at.y, this.defendArt.hit).setDepth(this.depth + 1);
      const k = (t.r * 2.4) / im.width;
      im.setScale(k * 0.5);
      this.scene.tweens.add({ targets: im, scale: k, alpha: 0, duration: 220, ease: 'Quad.easeOut', onComplete: () => im.destroy() });
    } else if (this.visible) {
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
      // H-61 링 = 개미 몸 중심 (footX · footY = 몸 가운데) · 몸 원 (body_px)으로 줄어듦 · 진한 받침 + 굵은 테두리 (L-05)
      const body = this.px(FX.ring.body_px);
      const d0 = this.px(FX.ring.px);
      const d = Math.max(body * 0.85, d0 + (body - d0) * Math.max(0, k));
      // M7-E (H-66 메모 · L-05) 진한 받침 위 노랑 링 (밝은 하늘에서 흰 링이 안 보임) · 겹침 = 흰색으로 번쩍
      const col = hot ? RING_IDLE : RING_HOT;
      const plate = FX.ring.plate_alpha;
      g.lineStyle(this.px(16), TARGET_RIM, plate).strokeCircle(footX, footY, body / 2); // 몸 원 받침
      g.lineStyle(this.px(6), col, 0.95).strokeCircle(footX, footY, body / 2);
      g.lineStyle(this.px(hot ? 22 : 18), TARGET_RIM, plate).strokeCircle(footX, footY, d / 2); // 줄어드는 링 받침
      g.lineStyle(this.px(hot ? 10 : 8), col, 1).strokeCircle(footX, footY, d / 2);
      if (hot) g.fillStyle(RING_HOT, 0.3).fillCircle(footX, footY, body / 2); // 겹침 = 안쪽 원 번쩍
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
