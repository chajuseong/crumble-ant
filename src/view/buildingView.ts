import Phaser from 'phaser';
import { COLOR, FONT } from './theme';

/** M6 건물 그림 (없으면 도형) — 그림 밑면 = core 밑면 · 폭 = 건물 폭 × drawW · 세로는 비율대로 (H-42 Q3) */
export interface BuildingArt {
  key: string;
  pivotY: number;
  drawW: number;
  tint: number | null;
}

/** 건물 — 원점 = 밑면 가운데. HP가 줄면 금이 간다. M6: 그림이 있으면 도형 대신 그림 (HP 바 · 금 · 번쩍 · 흔들림 · 밀림은 같게) */
export class BuildingView {
  readonly root: Phaser.GameObjects.Container;
  readonly color: number;
  private readonly cracks: Phaser.GameObjects.Graphics;
  private readonly hpBar: Phaser.GameObjects.Rectangle;
  private readonly hpText: Phaser.GameObjects.Text;
  readonly w: number;
  private readonly h: number;
  private readonly scene: Phaser.Scene;
  private readonly crackSeed: number[];
  private flashRect: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image | null = null;
  /** M6 그림 (null = 도형) */
  readonly image: Phaser.GameObjects.Image | null = null;
  private readonly art: BuildingArt | null;
  private crackSteps = 6;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, id: number, maxHp: number, art: BuildingArt | null = null) {
    this.scene = scene;
    this.art = art;
    this.w = w;
    this.h = h;
    this.color = COLOR.building[id % COLOR.building.length]!;
    this.root = scene.add.container(x, y);
    this.baseY = y;
    this.crackSeed = Array.from({ length: 12 }, (_, i) => ((id * 9301 + i * 49297) % 233280) / 233280);

    if (art) {
      // M6: 그림 한 장 — 기준점 = 밑면 가운데
      const img = scene.add.image(0, 0, art.key).setOrigin(0.5, art.pivotY);
      img.setScale((w * art.drawW) / img.width);
      if (art.tint !== null) img.setTint(art.tint);
      this.root.add(img);
      this.image = img;
    }
    const g = scene.add.graphics();
    if (art) g.setVisible(false);
    // 지붕
    g.fillStyle(COLOR.buildingDark, 1);
    g.fillTriangle(-w * 0.55, -h, w * 0.55, -h, 0, -h - h * 0.28);
    // 벽
    g.fillStyle(this.color, 1);
    g.fillRect(-w / 2, -h, w, h);
    g.lineStyle(8, COLOR.buildingDark, 1);
    g.strokeRect(-w / 2, -h, w, h);
    // 창문 3×2
    g.fillStyle(COLOR.window, 1);
    const cols = 3;
    const rows = 2;
    const ww = w * 0.17;
    const wh = h * 0.2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = -w / 2 + (w / (cols + 1)) * (c + 1);
        const cy = -h + (h * 0.58) / rows * r + h * 0.14;
        g.fillRect(cx - ww / 2, cy, ww, wh);
      }
    }
    this.root.add(g);

    this.cracks = scene.add.graphics();
    this.root.add(this.cracks);

    // HP 바 — 밑면 쪽 (건물이 위에서 들어올 때 먼저 보임)
    const barW = w * 0.86;
    const barH = h * 0.1;
    const barY = -h * 0.12;
    this.root.add(scene.add.rectangle(0, barY, barW, barH, COLOR.hpBack).setStrokeStyle(4, COLOR.buildingDark));
    this.hpBar = scene.add.rectangle(-barW / 2, barY, barW, barH, COLOR.hpLow).setOrigin(0, 0.5);
    this.root.add(this.hpBar);
    this.hpText = scene.add
      .text(0, barY, `${maxHp}`, { fontFamily: FONT, fontSize: `${Math.round(barH * 0.85)}px`, color: '#ffffff', fontStyle: '900', stroke: '#3b2a1a', strokeThickness: 6 })
      .setOrigin(0.5);
    this.root.add(this.hpText);
  }

  /** M3-D B 건물 밀림 (그림만 위로 — core 건물 y 그대로) */
  private readonly pushAnim = { v: 0 };
  private baseY = 0;

  setY(y: number): void {
    this.baseY = y;
    this.root.y = y - this.pushAnim.v;
  }

  /** 맞은 건물 밑면 화면 y (밀림 빼고) — 충격 별 자리 */
  get bottomY(): number {
    return this.baseY;
  }

  /** 위로 px만큼 밀렸다 ms 동안 돌아옴 (트윈 = 벽시계 → 히트스톱 중에도 진행 — H-27 Q5) */
  push(px: number, ms: number): void {
    this.scene.tweens.killTweensOf(this.pushAnim);
    this.pushAnim.v = px;
    this.root.y = this.baseY - px;
    this.scene.tweens.add({ targets: this.pushAnim, v: 0, duration: ms, ease: 'Quad.easeOut', onUpdate: () => (this.root.y = this.baseY - this.pushAnim.v) });
  }

  setHp(hp: number, maxHp: number): void {
    const ratio = Math.max(0, hp / maxHp);
    this.hpBar.scaleX = ratio;
    this.hpText.setText(`${Math.ceil(hp)}`);
    this.drawCracks(1 - ratio);
  }

  /** 맞았을 때 흔들림 */
  /** 맞았을 때 흔들림 — 거리 · 시간 = fx_config building_shake */
  shake(px: number, ms: number): void {
    this.scene.tweens.killTweensOf(this.root);
    const x = this.root.x;
    this.scene.tweens.add({ targets: this.root, x: { from: x - px, to: x }, duration: ms, ease: 'Quad.easeOut' });
  }

  /** M2 B — 흰색 번쩍 (처음 쓸 때 덮개를 만든다) */
  flash(alpha: number, ms: number): boolean {
    let created = false;
    if (!this.flashRect) {
      // M6 그림이면 사각형 대신 그림 모양 그대로 흰색 (투명한 모서리가 하얗게 안 보이게 — H-42)
      this.flashRect = this.image
        ? this.scene.add.image(0, 0, this.image.texture.key).setOrigin(0.5, this.image.originY).setScale(this.image.scaleX, this.image.scaleY).setTintFill(0xffffff).setAlpha(0)
        : this.scene.add.rectangle(0, -this.h / 2, this.w, this.h, 0xffffff, 1).setAlpha(0);
      this.root.add(this.flashRect);
      if (this.image) this.root.moveAbove(this.flashRect, this.image);
      created = true;
    }
    const f = this.flashRect;
    this.scene.tweens.killTweensOf(f);
    f.setAlpha(alpha);
    this.scene.tweens.add({ targets: f, alpha: 0, duration: ms, ease: 'Quad.easeOut' });
    return created;
  }

  /** 그림 모드인가 (smoke · 테스트용) */
  get artMode(): 'image' | 'shape' {
    return this.art ? 'image' : 'shape';
  }

  setCrackSteps(n: number): void {
    this.crackSteps = Math.max(1, Math.floor(n));
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.root);
    this.scene.tweens.killTweensOf(this.pushAnim);
    this.root.destroy(true);
  }

  private drawCracks(damage: number): void {
    const g = this.cracks;
    g.clear();
    const n = Math.floor(damage * this.crackSteps);
    if (n <= 0) return;
    g.lineStyle(7, COLOR.crack, 0.85);
    for (let i = 0; i < n; i++) {
      const s = this.crackSeed;
      let x = -this.w / 2 + 12 + (this.w - 24) * s[i % s.length]!;
      let y = -this.h * (0.1 + 0.15 * s[(i + 3) % s.length]!);
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, y);
      for (let k = 0; k < 3; k++) {
        x = Phaser.Math.Clamp(x + (s[(i + k) % s.length]! - 0.5) * this.w * 0.25, -this.w / 2 + 12, this.w / 2 - 12);
        y -= this.h * 0.18;
        g.lineTo(x, y);
      }
      g.strokePath();
    }
  }
}
