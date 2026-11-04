import Phaser from 'phaser';
import { COLOR, FONT } from './theme';

/** 건물 placeholder — 원점 = 밑면 가운데. HP가 줄면 금이 간다. */
export class BuildingView {
  readonly root: Phaser.GameObjects.Container;
  readonly color: number;
  private readonly cracks: Phaser.GameObjects.Graphics;
  private readonly hpBar: Phaser.GameObjects.Rectangle;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly w: number;
  private readonly h: number;
  private readonly scene: Phaser.Scene;
  private readonly crackSeed: number[];

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, id: number, maxHp: number) {
    this.scene = scene;
    this.w = w;
    this.h = h;
    this.color = COLOR.building[id % COLOR.building.length]!;
    this.root = scene.add.container(x, y);
    this.crackSeed = Array.from({ length: 12 }, (_, i) => ((id * 9301 + i * 49297) % 233280) / 233280);

    const g = scene.add.graphics();
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

  setY(y: number): void {
    this.root.y = y;
  }

  setHp(hp: number, maxHp: number): void {
    const ratio = Math.max(0, hp / maxHp);
    this.hpBar.scaleX = ratio;
    this.hpText.setText(`${Math.ceil(hp)}`);
    this.drawCracks(1 - ratio);
  }

  /** 맞았을 때 흔들림 */
  shake(): void {
    this.scene.tweens.killTweensOf(this.root);
    const x = this.root.x;
    this.scene.tweens.add({ targets: this.root, x: { from: x - 10, to: x }, duration: 90, ease: 'Quad.easeOut' });
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.root);
    this.root.destroy(true);
  }

  private drawCracks(damage: number): void {
    const g = this.cracks;
    g.clear();
    const n = Math.floor(damage * 6);
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
