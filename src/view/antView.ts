import Phaser from 'phaser';
import { COLOR, FONT } from './theme';
import { t } from './text';

/**
 * 개미 placeholder — 큰 머리 + 작은 몸 (2~2.5등신), 팔 4개 (슬롯별 색), 다리 2개.
 * 원점 = 발 가운데. 높이 h는 전투 구역 비율 × 전투 구역 px.
 */
export class AntView {
  readonly root: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Container;
  private readonly arms: Phaser.GameObjects.Rectangle[] = [];
  private readonly armRest: { x: number; y: number; angle: number }[] = [];
  private readonly scene: Phaser.Scene;
  private readonly h: number;
  private squashTween: Phaser.Tweens.Tween | null = null;
  private dizzy: Phaser.GameObjects.Text | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, width: number, height: number) {
    this.scene = scene;
    this.h = height;
    this.root = scene.add.container(x, y);
    this.body = scene.add.container(0, 0);
    this.root.add(this.body);

    const headR = height * 0.3;
    const bodyW = width * 0.32;
    const bodyH = height * 0.34;
    const legH = height * 0.22;
    const bodyY = -legH - bodyH / 2;
    const headY = -legH - bodyH - headR * 0.75;

    // 다리 2개
    for (const side of [-1, 1]) {
      const leg = scene.add.rectangle(side * bodyW * 0.22, -legH / 2, width * 0.07, legH, COLOR.leg).setOrigin(0.5);
      this.body.add(leg);
    }
    // 팔 4개: 슬롯 1·2 = 위쪽 (왼 · 오), 3·4 = 아래쪽 (왼 · 오). 쉬는 자세는 위로 벌린 V
    const armLen = height * 0.36;
    const armW = width * 0.075;
    const slots = [
      { side: -1, y: bodyY - bodyH * 0.25, angle: -35 },
      { side: 1, y: bodyY - bodyH * 0.25, angle: 35 },
      { side: -1, y: bodyY + bodyH * 0.15, angle: -70 },
      { side: 1, y: bodyY + bodyH * 0.15, angle: 70 },
    ];
    slots.forEach((s, i) => {
      const x = s.side * bodyW * 0.45;
      const arm = scene.add.rectangle(x, s.y, armW, armLen, COLOR.armSlot[i]!).setOrigin(0.5, 1);
      arm.setAngle(s.angle);
      arm.setStrokeStyle(4, COLOR.antBody);
      this.arms.push(arm);
      this.armRest.push({ x, y: s.y, angle: s.angle });
      this.body.add(arm);
    });
    // 몸통 · 머리 · 눈 · 더듬이
    this.body.add(scene.add.ellipse(0, bodyY, bodyW, bodyH, COLOR.antBody));
    for (const side of [-1, 1]) {
      const ant = scene.add.rectangle(side * headR * 0.45, headY - headR * 0.85, 6, headR * 0.7, COLOR.antBody).setOrigin(0.5, 1);
      ant.setAngle(side * 25);
      this.body.add(ant);
    }
    this.body.add(scene.add.circle(0, headY, headR, COLOR.antHead));
    for (const side of [-1, 1]) {
      this.body.add(scene.add.circle(side * headR * 0.38, headY - headR * 0.05, headR * 0.24, COLOR.antEye));
      this.body.add(scene.add.circle(side * headR * 0.34, headY - headR * 0.02, headR * 0.11, 0x000000));
    }
  }

  setY(y: number): void {
    this.root.y = y;
  }

  /** 팔 슬롯 (1~4) 위로 찌르기 */
  strike(slot: number): void {
    const i = slot - 1;
    const arm = this.arms[i];
    const rest = this.armRest[i];
    if (!arm || !rest) return;
    this.scene.tweens.killTweensOf(arm);
    arm.setAngle(rest.angle * 0.15).setScale(1, 1.35);
    this.scene.tweens.add({ targets: arm, angle: rest.angle, scaleY: 1, duration: 110, ease: 'Quad.easeOut' });
  }

  /** 점프 시작 — 늘어나기 */
  jump(strong: boolean): void {
    this.playSquash(strong ? 0.75 : 0.88, strong ? 1.3 : 1.12, 140);
  }

  /** 착지 피격 — 짓눌림 */
  hit(): void {
    this.playSquash(1.35, 0.55, 260);
  }

  /** 기절 — 납작 (코믹) */
  setDown(down: boolean): void {
    this.squashTween?.stop();
    if (down) {
      this.body.setScale(1.45, 0.28);
      this.dizzy ??= this.scene.add
        .text(0, -this.h * 0.55, t('ant.down'), { fontFamily: FONT, fontSize: `${Math.round(this.h * 0.28)}px`, fontStyle: '900', color: '#ffe08a', stroke: '#3b2a1a', strokeThickness: 8 })
        .setOrigin(0.5);
      this.root.add(this.dizzy);
      this.dizzy.setVisible(true);
      this.scene.tweens.add({ targets: this.dizzy, angle: { from: -8, to: 8 }, yoyo: true, repeat: -1, duration: 220 });
    } else {
      this.body.setScale(1, 1);
      if (this.dizzy) {
        this.scene.tweens.killTweensOf(this.dizzy);
        this.dizzy.setVisible(false).setAngle(0);
      }
    }
  }

  private playSquash(sx: number, sy: number, duration: number): void {
    this.squashTween?.stop();
    this.body.setScale(sx, sy);
    this.squashTween = this.scene.tweens.add({ targets: this.body, scaleX: 1, scaleY: 1, duration, ease: 'Back.easeOut' });
  }
}
