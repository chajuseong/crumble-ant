import Phaser from 'phaser';
import { floorCrackStep } from './floorFeel';
import { FX } from './fx';
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

/**
 * M8 층 하나 (아래층부터) — c = 층 그림 묶음 · h = 화면 높이 (깨지면 위층이 이만큼 내려앉음) · initY = 처음 자리
 * M8-D: 그림은 처음부터 왼쪽 · 오른쪽 반 (halves — 붙어 있으면 한 장처럼) · 층 금도 반쪽마다 → 깨지면 판 2조각으로 떨어져 나감
 * base = c 안에서 그 층 밑면 y
 */
interface FloorPart {
  c: Phaser.GameObjects.Container;
  h: number;
  initY: number;
  base: number;
  overlay: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  halves: [Phaser.GameObjects.Container, Phaser.GameObjects.Container];
  cracks: [Phaser.GameObjects.Graphics, Phaser.GameObjects.Graphics];
  crackStep: number;
}

/** M8-D 떨어져 나간 층 판 2조각 (장면 오브젝트 · 화면 좌표) */
export interface FloorSlabs {
  halves: Phaser.GameObjects.Container[];
  /** 깨진 층 높이 (px) */
  h: number;
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

  /** M8 층 그림 만들기 — 쌓기 (조각 3장) · 자르기 (그림 1장을 N칸) · 도형 (띠 N칸) · M8-D 층마다 왼쪽 · 오른쪽 반 (판 2조각) */
  private buildFloors(art: BuildingArt | null): void {
    const scene = this.scene;
    const N = this.floorMax.length;
    const { w, h } = this;
    /** halfParts(sx) = 그 반쪽 그림 (c 좌표) · 반쪽 묶음 원점 = 그 반쪽 가운데 (돌 때 제자리에서 돌게) */
    const addPart = (halfParts: (sx: -1 | 1) => Phaser.GameObjects.GameObject[], overlay: FloorPart['overlay'], ph: number, y: number, base: number) => {
      const mk = (sx: -1 | 1) => {
        const cx = (sx * w) / 4;
        const cy = base - ph / 2;
        const g = scene.add.graphics();
        const kids = [...halfParts(sx), g];
        for (const k of kids) {
          const o = k as unknown as Phaser.GameObjects.Components.Transform;
          o.x -= cx;
          o.y -= cy;
        }
        return { half: scene.add.container(cx, cy, kids), g };
      };
      const L = mk(-1);
      const R = mk(1);
      overlay.setAlpha(0);
      const c = scene.add.container(0, y, [L.half, R.half, overlay]);
      this.root.add(c);
      this.floorParts.push({ c, h: ph, initY: y, base, overlay, halves: [L.half, R.half], cracks: [L.g, R.g], crackStep: 0 });
    };
    if (art?.floorKeys) {
      // 쌓기: 1층 + 중간 × (N − 2) + 지붕 — 층수만큼 키 커짐 (조각 = 여백 없음 · 밑면 기준)
      const keys = [art.floorKeys.base, ...Array.from({ length: N - 2 }, () => art.floorKeys!.mid), art.floorKeys.roof];
      let y = 0;
      for (const key of keys) {
        const src = scene.textures.get(key).getSourceImage() as HTMLImageElement;
        const scale = (w * art.drawW) / src.width;
        const ph = src.height * scale;
        const half = (sx: -1 | 1) => {
          const img = scene.add.image(0, 0, key).setOrigin(0.5, 1).setScale(scale).setCrop(sx < 0 ? 0 : src.width / 2, 0, src.width / 2, src.height);
          if (art.tint !== null) img.setTint(art.tint);
          return [img];
        };
        const ov = scene.add.image(0, 0, key).setOrigin(0.5, 1).setScale(scale).setTintFill(0xffffff);
        addPart(half, ov, ph, y, 0);
        y -= ph;
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
        const half = (sx: -1 | 1) => {
          const img = scene.add.image(0, 0, art.key).setOrigin(0.5, art.pivotY).setScale(scale).setCrop(sx < 0 ? 0 : texW / 2, y0, texW / 2, y1 - y0);
          if (art.tint !== null) img.setTint(art.tint);
          return [img];
        };
        const ov = scene.add.image(0, 0, art.key).setOrigin(0.5, art.pivotY).setScale(scale).setCrop(0, y0, texW, y1 - y0).setTintFill(0xffffff);
        addPart(half, ov, (i === N - 1 ? roofPx : lowPx) * scale, 0, -i * lowPx * scale);
      }
    } else {
      // 도형: 건물 높이를 N칸 띠로 · 맨 위 칸에 지붕 (반쪽마다 x 범위로 잘라 그림)
      const fh = h / N;
      for (let i = 0; i < N; i++) {
        const half = (sx: -1 | 1) => {
          const g = scene.add.graphics();
          const [a, b] = sx < 0 ? [-w / 2, 0] : [0, w / 2];
          const rect = (x: number, y: number, rw: number, rh: number) => {
            const l = Math.max(a, x);
            const r = Math.min(b, x + rw);
            if (r > l) g.fillRect(l, y, r - l, rh);
          };
          if (i === N - 1) g.fillStyle(COLOR.buildingDark, 1).fillTriangle(sx * w * 0.55, -fh, 0, -fh, 0, -fh - h * 0.28);
          g.fillStyle(this.color, 1);
          rect(-w / 2, -fh, w, fh);
          // 테두리 = 바깥 세 변만 (가운데 이음매에 선이 안 보이게)
          const ox = sx * (w / 2);
          g.lineStyle(8, COLOR.buildingDark, 1).beginPath();
          g.moveTo(0, -fh).lineTo(ox, -fh).lineTo(ox, 0).lineTo(0, 0).strokePath();
          g.fillStyle(COLOR.window, 1);
          for (let k = 0; k < 3; k++) rect(-w / 2 + (w / 4) * (k + 1) - w * 0.085, -fh * 0.72, w * 0.17, fh * 0.42);
          return [g];
        };
        const ov = scene.add.rectangle(0, -fh / 2, w, fh, 0xffffff, 1);
        addPart(half, ov, fh, -fh * i, 0);
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
    // M8-D 층 금 = 그 층 반쪽 묶음 안 · crack_at_pct 단계마다 (층과 같이 흔들리고 판에 남아 떨어짐)
    const f = this.floorParts[0];
    if (!f) return;
    const step = floorCrackStep(hpLeft, max);
    if (step !== f.crackStep) {
      f.crackStep = step;
      this.drawFloorCracks(f);
    }
  }

  /** M8-D 층 금 그리기 — 줄을 번갈아 왼쪽 · 오른쪽 반에 그림 (금 그래픽 원점 = 층 묶음 c 원점 → c 좌표 그대로) */
  private drawFloorCracks(f: FloorPart): void {
    const n = f.crackStep * FX.floor_break.crack_lines;
    const s = this.crackSeed;
    const w = this.w;
    f.cracks.forEach((g, side) => {
      g.clear();
      g.lineStyle(7, COLOR.crack, 0.85);
      const sx = side === 0 ? -1 : 1;
      const [a, b] = sx < 0 ? [-w / 2 + 14, -8] : [8, w / 2 - 14];
      for (let i = 0; i < n; i++) {
        if ((i % 2 === 0 ? -1 : 1) !== sx) continue; // 줄을 번갈아 왼쪽 · 오른쪽
        let x = a + (b - a) * s[i % s.length]!;
        let y = f.base;
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 4; k++) {
          x = Phaser.Math.Clamp(x + (s[(i + k + 5) % s.length]! - 0.5) * w * 0.18, a, b);
          y -= f.h * (0.12 + 0.1 * s[(i + k) % s.length]!);
          g.lineTo(x, y);
        }
        g.strokePath();
      }
    });
  }

  /**
   * M8 맨 아래층 깨짐 — 그 층 판 2조각을 장면으로 떼어 냄 (반환 · 떨어뜨리기는 BattleScene) · 위층이 그 높이만큼 내려옴 (Quad.easeIn)
   * → M8-D 털썩 (세로 눌림 · 가로 퍼짐 → 살짝 튐 — 그림만 · core 밑면 그대로) · 잃은 층 칸 번쩍. 값 = fx_config floor_break.*
   */
  breakFloor(): FloorSlabs | null {
    const f = this.floorParts.shift();
    if (!f) return null;
    const F = FX.floor_break;
    const halves = f.halves.map((half) => {
      const m = half.getWorldTransformMatrix();
      f.c.remove(half);
      half.setPosition(m.tx, m.ty).setScale(m.scaleX, m.scaleY).setRotation(0);
      this.scene.add.existing(half);
      return half;
    });
    f.c.destroy(true);
    this.dropOffset += f.h;
    const first = this.floorParts[0];
    for (const p of this.floorParts) {
      this.scene.tweens.killTweensOf(p.c);
      this.scene.tweens.add({
        targets: p.c,
        y: p.initY + this.dropOffset,
        duration: F.drop_ms,
        ease: 'Quad.easeIn',
        onComplete: p === first ? () => this.thud() : undefined,
      });
    }
    this.crackH = this.floorParts[0]?.h ?? this.h;
    this.cracks.clear();
    this.drawPips();
    this.pipFlash();
    return { halves, h: f.h };
  }

  /** M8-D 털썩 — 밑면 기준 세로 눌림 · 가로 퍼짐 → 되돌아오는 순간 위로 살짝 튐 (그림만) */
  private thud(): void {
    const F = FX.floor_break;
    const r = this.root;
    if (!r.active) return;
    this.thudTween?.stop();
    r.setScale(1);
    this.thudTween = this.scene.tweens.add({
      targets: r,
      scaleY: F.squash,
      scaleX: 1 + (1 - F.squash) * 0.6,
      duration: F.squash_ms,
      ease: 'Quad.easeOut',
      yoyo: true,
      onYoyo: () => this.bounce(F.bounce_px * this.pxScale, F.bounce_ms),
      onStop: () => r.active && r.setScale(1),
    });
  }

  private thudTween: Phaser.Tweens.Tween | null = null;
  private shakeTween: Phaser.Tweens.Tween | null = null;
  private shakeHomeX = 0;

  /** 위로 px 올라갔다 내려옴 (ms · 그림만 — core 건물 y 그대로) */
  private bounce(px: number, ms: number): void {
    this.scene.tweens.killTweensOf(this.pushAnim);
    this.pushAnim.v = 0;
    this.scene.tweens.add({ targets: this.pushAnim, v: px, duration: ms / 2, ease: 'Quad.easeOut', yoyo: true, onUpdate: () => (this.root.y = this.baseY - this.pushAnim.v) });
  }

  /** M8-D 잃은 층 칸 번쩍 + 튀어나옴 (지금 남은 층 수 자리 = 방금 꺼진 칸) */
  private pipFlash(): void {
    if (!this.floorPips) return;
    const F = FX.floor_break;
    const n = this.floorMax.length;
    const s = this.pipS;
    const gap = s * 0.35;
    const x = -((n * s + (n - 1) * gap) / 2) + this.floorParts.length * (s + gap) + s / 2;
    const r = this.scene.add.rectangle(x, this.pipY, s, s, 0xffffff, 1).setStrokeStyle(3, COLOR.buildingDark);
    this.root.add(r);
    this.scene.tweens.add({ targets: r, scale: F.pip_pop_scale, alpha: 0, duration: F.pip_flash_ms, ease: 'Quad.easeOut', onComplete: () => r.destroy() });
  }

  /** 1080폭 px → 화면 px (BattleScene이 넣어 줌 — 튐 높이) */
  pxScale = 1;

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
    // M8-D: 흔들림 트윈만 멈춤 (털썩 눌림 트윈은 그대로 — 매 타격 흔들림이 눌림을 끊지 않게)
    if (!this.shakeTween?.isPlaying()) this.shakeHomeX = this.root.x;
    const x = this.shakeHomeX;
    this.shakeTween?.stop();
    this.root.x = x;
    this.shakeTween = this.scene.tweens.add({ targets: this.root, x: { from: x - px, to: x }, duration: ms, ease: 'Quad.easeOut' });
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
