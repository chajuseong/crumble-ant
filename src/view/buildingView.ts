import Phaser from 'phaser';
import { COLOR, FONT } from './theme';

/** 그림 한 줄마다 불투명한 왼쪽 · 오른쪽 끝 (px) — 텍스처마다 한 번만 잼 (H-49 금 가림) */
const SPANS = new Map<string, Int16Array>();
function rowSpans(scene: Phaser.Scene, key: string): Int16Array | null {
  const hit = SPANS.get(key);
  if (hit) return hit;
  const src = scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const w = src.width;
  const h = src.height;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(src, 0, 0);
  const a = ctx.getImageData(0, 0, w, h).data;
  const out = new Int16Array(h * 2).fill(-1);
  for (let y = 0; y < h; y++) {
    let l = -1;
    let r = -1;
    for (let x = 0; x < w; x++) {
      if (a[(y * w + x) * 4 + 3]! > 128) {
        if (l < 0) l = x;
        r = x;
      }
    }
    out[y * 2] = l;
    out[y * 2 + 1] = r;
  }
  SPANS.set(key, out);
  return out;
}

/** M6 건물 그림 (없으면 도형) — 그림 밑면 = core 밑면 · 폭 = 건물 폭 × drawW · 세로는 비율대로 (H-42 Q3) */
export interface BuildingArt {
  key: string;
  pivotY: number;
  drawW: number;
  tint: number | null;
  /** M8 자르기 지붕 칸 비율 · 쌓기 조각 텍스처 키 (null = 자르기) */
  cutRoof?: number;
  floorKeys?: { base: string; mid: string; roof: string } | null;
}

/** M8 층 하나 (아래층부터) — c = 층 그림 묶음 · h = 화면 높이 (깨지면 위층이 이만큼 내려앉음) · initY = 처음 자리 */
interface FloorPart {
  c: Phaser.GameObjects.Container;
  h: number;
  initY: number;
  overlay: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
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
  // ── M8 층 (2층 이상일 때만 — 1층 = 지금 모습 그대로) ──
  private readonly floorParts: FloorPart[] = [];
  private readonly floorMax: number[];
  private floorPips: Phaser.GameObjects.Graphics | null = null;
  private dropOffset = 0;
  /** 금이 그려지는 높이 (1층 건물 = 건물 높이 · 층 건물 = 맨 아래층 높이) */
  private crackH: number;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, id: number, maxHp: number, art: BuildingArt | null = null, floorMax: number[] = [maxHp]) {
    this.scene = scene;
    this.art = art;
    this.w = w;
    this.h = h;
    this.crackH = h;
    this.floorMax = floorMax.length > 0 ? [...floorMax] : [maxHp];
    this.color = COLOR.building[id % COLOR.building.length]!;
    this.root = scene.add.container(x, y);
    this.baseY = y;
    this.crackSeed = Array.from({ length: 12 }, (_, i) => ((id * 9301 + i * 49297) % 233280) / 233280);

    if (this.floorMax.length > 1) this.buildFloors(art);
    else if (art) {
      // M6: 그림 한 장 — 기준점 = 밑면 가운데
      const img = scene.add.image(0, 0, art.key).setOrigin(0.5, art.pivotY);
      img.setScale((w * art.drawW) / img.width);
      if (art.tint !== null) img.setTint(art.tint);
      this.root.add(img);
      this.image = img;
    }
    const g = scene.add.graphics();
    if (art || this.floorParts.length > 0) g.setVisible(false);
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
      .text(0, barY, `${this.floorMax[0]}`, { fontFamily: FONT, fontSize: `${Math.round(barH * 0.85)}px`, color: '#ffffff', fontStyle: '900', stroke: '#3b2a1a', strokeThickness: 6 })
      .setOrigin(0.5);
    this.root.add(this.hpText);
    if (this.floorParts.length > 0) {
      // M8 층 칸 (□□■ — 남은 층 = 채움) · HP 바 바로 위
      this.floorPips = scene.add.graphics();
      this.root.add(this.floorPips);
      this.pipY = barY - barH * 1.15;
      this.pipS = barH * 0.8;
      this.drawPips();
    }
  }

  private pipY = 0;
  private pipS = 0;

  /** M8 층 그림 만들기 — 쌓기 (조각 3장) · 자르기 (그림 1장을 N칸) · 도형 (띠 N칸) */
  private buildFloors(art: BuildingArt | null): void {
    const scene = this.scene;
    const N = this.floorMax.length;
    const { w, h } = this;
    const addPart = (parts: Phaser.GameObjects.GameObject[], overlay: FloorPart['overlay'], ph: number, y: number) => {
      parts.push(overlay.setAlpha(0));
      const c = scene.add.container(0, y, parts);
      this.root.add(c);
      this.floorParts.push({ c, h: ph, initY: y, overlay });
    };
    if (art?.floorKeys) {
      // 쌓기: 1층 + 중간 × (N − 2) + 지붕 — 층수만큼 키 커짐 (조각 = 여백 없음 · 밑면 기준)
      const keys = [art.floorKeys.base, ...Array.from({ length: N - 2 }, () => art.floorKeys!.mid), art.floorKeys.roof];
      let y = 0;
      for (const key of keys) {
        const img = scene.add.image(0, 0, key).setOrigin(0.5, 1);
        img.setScale((w * art.drawW) / img.width);
        if (art.tint !== null) img.setTint(art.tint);
        const ov = scene.add.image(0, 0, key).setOrigin(0.5, 1).setScale(img.scaleX).setTintFill(0xffffff);
        addPart([img], ov, img.displayHeight, y);
        y -= img.displayHeight;
      }
    } else if (art) {
      // 자르기: 그림 1장 높이 그대로 · 지붕 칸 = cutRoof · 나머지를 아래층들이 같게 (텍스처 px)
      const src = scene.textures.get(art.key).getSourceImage() as HTMLImageElement;
      const texW = src.width;
      const texH = src.height;
      const scale = (w * art.drawW) / texW;
      const bottom = art.pivotY * texH;
      const roofPx = bottom * (art.cutRoof ?? 0.35);
      const lowPx = (bottom - roofPx) / (N - 1);
      for (let i = 0; i < N; i++) {
        const y1 = i === 0 ? texH : bottom - i * lowPx;
        const y0 = i === N - 1 ? 0 : bottom - (i + 1) * lowPx;
        const img = scene.add.image(0, 0, art.key).setOrigin(0.5, art.pivotY).setScale(scale).setCrop(0, y0, texW, y1 - y0);
        if (art.tint !== null) img.setTint(art.tint);
        const ov = scene.add.image(0, 0, art.key).setOrigin(0.5, art.pivotY).setScale(scale).setCrop(0, y0, texW, y1 - y0).setTintFill(0xffffff);
        addPart([img], ov, (i === N - 1 ? roofPx : lowPx) * scale, 0);
      }
    } else {
      // 도형: 건물 높이를 N칸 띠로 · 맨 위 칸에 지붕
      const fh = h / N;
      for (let i = 0; i < N; i++) {
        const g = scene.add.graphics();
        if (i === N - 1) g.fillStyle(COLOR.buildingDark, 1).fillTriangle(-w * 0.55, -fh, w * 0.55, -fh, 0, -fh - h * 0.28);
        g.fillStyle(this.color, 1).fillRect(-w / 2, -fh, w, fh);
        g.lineStyle(8, COLOR.buildingDark, 1).strokeRect(-w / 2, -fh, w, fh);
        g.fillStyle(COLOR.window, 1);
        for (let k = 0; k < 3; k++) g.fillRect(-w / 2 + (w / 4) * (k + 1) - w * 0.085, -fh * 0.72, w * 0.17, fh * 0.42);
        const ov = scene.add.rectangle(0, -fh / 2, w, fh, 0xffffff, 1);
        addPart([g], ov, fh, -fh * i);
      }
    }
    this.crackH = this.floorParts[0]?.h ?? h;
  }

  /** M8 층 칸 다시 그림 (남은 층 = 채움) */
  private drawPips(): void {
    const g = this.floorPips;
    if (!g) return;
    g.clear();
    const n = this.floorMax.length;
    const left = this.floorParts.length;
    const s = this.pipS;
    const gap = s * 0.35;
    const x0 = -((n * s + (n - 1) * gap) / 2);
    for (let i = 0; i < n; i++) {
      const x = x0 + i * (s + gap);
      const on = i < left;
      g.fillStyle(on ? COLOR.hpLow : COLOR.hpBack, 1).fillRect(x, this.pipY - s / 2, s, s);
      g.lineStyle(3, COLOR.buildingDark, 1).strokeRect(x, this.pipY - s / 2, s, s);
    }
  }

  /** M8 층 건물인가 */
  get layered(): boolean {
    return this.floorParts.length > 0;
  }

  /**
   * M8 층 HP 바 — 지금 맞는 층 HP ÷ 그 층 처음 HP (둘 다 core 값 — floorHp[0] · floorMax) · 금 = 맨 아래층 안
   */
  setFloorHp(hpLeft: number, max: number): void {
    const ratio = Math.max(0, hpLeft / Math.max(1, max));
    this.hpBar.scaleX = ratio;
    this.hpText.setText(`${Math.ceil(hpLeft)}`);
    this.drawCracks(1 - ratio);
  }

  /** M8 맨 아래층 깨짐 — 그 층 사라짐 · 위층이 그 높이만큼 털썩 (ms · 그림만). 반환 = 깨진 층 높이 (px · 조각 자리) */
  breakFloor(dropMs: number): number {
    const f = this.floorParts.shift();
    if (!f) return 0;
    this.scene.tweens.add({ targets: f.c, alpha: 0, scaleX: 1.08, duration: 120, onComplete: () => f.c.destroy(true) });
    this.dropOffset += f.h;
    for (const p of this.floorParts) {
      this.scene.tweens.killTweensOf(p.c);
      this.scene.tweens.add({ targets: p.c, y: p.initY + this.dropOffset, duration: dropMs, ease: 'Bounce.easeOut' });
    }
    this.crackH = this.floorParts[0]?.h ?? this.h;
    this.cracks.clear();
    this.drawPips();
    return f.h;
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
    if (this.layered) return; // M8 층 건물 = setFloorHp
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
    if (this.layered) {
      // M8 층마다 흰 덮개 (그림 모양 그대로 — 처음 만들 때 같이 만들어 둠)
      for (const p of this.floorParts) {
        this.scene.tweens.killTweensOf(p.overlay);
        p.overlay.setAlpha(alpha);
        this.scene.tweens.add({ targets: p.overlay, alpha: 0, duration: ms, ease: 'Quad.easeOut' });
      }
      return false;
    }
    let created = false;
    if (!this.flashRect) {
      // M6 그림이면 사각형 대신 그림 모양 그대로 흰색 (투명한 모서리가 하얗게 안 보이게 — H-42). 맨 위에 둠 (도형 모드와 같게 — HP 바 · 금도 같이 번쩍)
      this.flashRect = this.image
        ? this.scene.add.image(0, 0, this.image.texture.key).setOrigin(0.5, this.image.originY).setScale(this.image.scaleX, this.image.scaleY).setTintFill(0xffffff).setAlpha(0)
        : this.scene.add.rectangle(0, -this.h / 2, this.w, this.h, 0xffffff, 1).setAlpha(0);
      this.root.add(this.flashRect);
      created = true;
    }
    const f = this.flashRect;
    this.scene.tweens.killTweensOf(f);
    f.setAlpha(alpha);
    this.scene.tweens.add({ targets: f, alpha: 0, duration: ms, ease: 'Quad.easeOut' });
    return created;
  }

  /**
   * H-49 금이 그림 밖으로 안 나가게 — 그 높이(y, 밑면 = 0 · 위 = -)에서 그림이 있는 x 범위 (여백 12px 안쪽).
   * 도형 모드 = 지금 범위 그대로 (판정 상자)
   */
  private crackRange(y: number): [number, number] {
    const lo = -this.w / 2 + 12;
    const hi = this.w / 2 - 12;
    const img = this.image;
    if (!img) return [lo, hi];
    const spans = rowSpans(this.scene, img.texture.key);
    if (!spans) return [lo, hi];
    const row = Math.round(img.originY * img.height + y / img.scaleY);
    if (row < 0 || row >= img.height) return [lo, hi];
    const l = spans[row * 2]!;
    const r = spans[row * 2 + 1]!;
    if (l < 0) return [lo, hi];
    const toX = (px: number) => (px - img.originX * img.width) * img.scaleX;
    const a = Math.max(lo, toX(l) + 12);
    const b = Math.min(hi, toX(r) - 12);
    return a < b ? [a, b] : [lo, hi];
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
    for (const p of this.floorParts) {
      this.scene.tweens.killTweensOf(p.c);
      this.scene.tweens.killTweensOf(p.overlay);
    }
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
      // 도형 모드 = 지금 식 그대로 · 그림 모드 = 각 점을 그 높이의 그림 범위 안으로 (H-49)
      const clamp = (px: number, py: number) => (this.image ? Phaser.Math.Clamp(px, ...this.crackRange(py)) : px);
      let x = -this.w / 2 + 12 + (this.w - 24) * s[i % s.length]!;
      let y = -this.crackH * (0.1 + 0.15 * s[(i + 3) % s.length]!);
      g.beginPath();
      g.moveTo(clamp(x, 0), 0);
      g.lineTo(clamp(x, y), y);
      for (let k = 0; k < 3; k++) {
        x = Phaser.Math.Clamp(x + (s[(i + k) % s.length]! - 0.5) * this.w * 0.25, -this.w / 2 + 12, this.w / 2 - 12);
        y -= this.crackH * 0.18;
        g.lineTo(clamp(x, y), y);
      }
      g.strokePath();
    }
  }
}
