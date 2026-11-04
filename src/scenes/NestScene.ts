import Phaser from 'phaser';
import type { GameConfig } from '../core/config';
import { isSwipeUp } from '../core/input';
import { computeLayout } from '../core/layout';
import { COLOR, FONT } from '../ui/theme';

export interface NestSceneData {
  config: GameConfig;
  onClose: () => void;
}

/**
 * 개미굴 전체 화면 — placeholder (방 기능은 범위 밖).
 * 전투(BattleScene)는 뒤에서 계속 돈다 (방치).
 * 복귀: [▲ 전투로] 버튼 또는 위로 스와이프.
 */
export class NestScene extends Phaser.Scene {
  private data_!: NestSceneData;
  private root!: Phaser.GameObjects.Container;
  private closing = false;

  constructor() {
    super('nest');
  }

  init(data: NestSceneData): void {
    this.data_ = data;
    this.closing = false;
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const L = computeLayout(this.data_.config.layout, W, H);

    const g = this.add.graphics();
    const steps = 10;
    for (let i = 0; i < steps; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(COLOR.nestBg),
        Phaser.Display.Color.ValueToColor(COLOR.nestDeep),
        steps - 1,
        i,
      );
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
      g.fillRect(0, (H / steps) * i, W, H / steps + 1);
    }
    // 굴 단면 느낌의 빈 방 3칸 (placeholder)
    g.fillStyle(0x000000, 0.25);
    for (let i = 0; i < 3; i++) g.fillEllipse(W * (0.3 + 0.2 * i), H * (0.42 + 0.14 * i), W * 0.42, H * 0.08);

    // 입력 막기 (아래 전투 화면으로 터치가 새지 않게)
    const blocker = this.add.zone(0, 0, W, H).setOrigin(0).setInteractive();

    const title = this.add
      .text(W / 2, H * 0.2, '개미굴', { fontFamily: FONT, fontSize: '120px', color: '#ffe8c2', fontStyle: '900' })
      .setOrigin(0.5);
    const sub = this.add
      .text(W / 2, H * 0.27, '준비 중 — 방 기능은 이번 프로토 범위 밖\n(전투는 뒤에서 계속 진행)', {
        fontFamily: FONT,
        fontSize: '44px',
        color: '#e0c9a6',
        fontStyle: '500',
        align: 'center',
      })
      .setOrigin(0.5);

    const bw = W * 0.5;
    const bh = L.hud.height * 0.9;
    const by = L.hud.height * 0.9;
    const btn = this.add.graphics();
    btn.fillStyle(0x000000, 0.45);
    btn.fillRoundedRect(W / 2 - bw / 2, by - bh / 2, bw, bh, 30);
    const btnText = this.add
      .text(W / 2, by, '▲ 전투로', { fontFamily: FONT, fontSize: `${Math.round(bh * 0.42)}px`, color: '#ffffff', fontStyle: '900' })
      .setOrigin(0.5);
    const btnZone = this.add.zone(W / 2, by, bw, bh).setInteractive();
    btnZone.on('pointerup', () => this.close());

    this.root = this.add.container(0, 0, [g, blocker, title, sub, btn, btnText, btnZone]);

    // 띠에서 아래로 내려가는 느낌: 아래에서 위로 올라옴
    this.root.y = H;
    this.tweens.add({ targets: this.root, y: 0, duration: 280, ease: 'Cubic.easeOut' });

    let start: { x: number; y: number; t: number } | null = null;
    blocker.on('pointerdown', (p: Phaser.Input.Pointer) => (start = { x: p.x, y: p.y, t: p.downTime }));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!start) return;
      const s = start;
      start = null;
      if (isSwipeUp(L, this.data_.config.input, { startX: s.x, startY: s.y, endX: p.x, endY: p.y, durationMs: p.upTime - s.t })) this.close();
    });
  }

  private close(): void {
    if (this.closing) return;
    this.closing = true;
    this.tweens.add({
      targets: this.root,
      y: this.scale.height,
      duration: 220,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.data_.onClose();
        this.scene.stop();
      },
    });
  }
}
