import Phaser from 'phaser';
import type { GameConfig } from '../core/config';
import { computeLayout, nestBackButtonRect } from '../core/layout';
import { COLOR, FONT } from '../ui/theme';

export interface NestSceneData {
  config: GameConfig;
}

/**
 * 개미굴 전체 화면 — placeholder (방 기능은 범위 밖).
 * 전투(BattleScene)는 뒤에서 계속 돈다 (방치).
 * 복귀: [▲ 전투로] 버튼 또는 위로 스와이프 — 판정은 BattleScene의 InputRouter (nest 모드).
 * 이 장면은 그리기만 한다 (입력 객체 없음).
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

    const r = nestBackButtonRect(L);
    const btn = this.add.graphics();
    btn.fillStyle(0x000000, 0.45);
    btn.fillRoundedRect(r.x, r.y, r.w, r.h, 30);
    const btnText = this.add
      .text(r.x + r.w / 2, r.y + r.h / 2, '▲ 전투로', { fontFamily: FONT, fontSize: `${Math.round(r.h * 0.42)}px`, color: '#ffffff', fontStyle: '900' })
      .setOrigin(0.5);

    this.root = this.add.container(0, 0, [g, title, sub, btn, btnText]);

    // 띠에서 아래로 내려가는 느낌: 아래에서 위로 올라옴
    this.root.y = H;
    this.tweens.add({ targets: this.root, y: 0, duration: 280, ease: 'Cubic.easeOut' });
  }

  /** BattleScene이 closeNest action을 받으면 호출 */
  close(): void {
    if (this.closing) return;
    this.closing = true;
    this.tweens.add({
      targets: this.root,
      y: this.scale.height,
      duration: 220,
      ease: 'Cubic.easeIn',
      onComplete: () => this.scene.stop(),
    });
  }
}
