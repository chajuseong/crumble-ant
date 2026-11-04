import Phaser from 'phaser';
import { AntRig } from './antRig';
import type { ArtPlan, Face } from './artPlan';
import { COLOR, FONT } from './theme';
import { t } from './text';

/**
 * 개미 — 도형 (M1 placeholder: 큰 머리 + 작은 몸, 팔 4개 슬롯별 색, 다리 2개) 또는 파츠 그림 (M3 AntRig).
 * 원점 = 발 가운데. 높이 h는 전투 구역 비율 × 전투 구역 px. 함수 (strike · jump · hit · setDown)는 두 쪽 같음.
 * 찌그러짐 · 늘어남은 body 컨테이너에 걸려서 도형 · 그림 둘 다 똑같이 움직인다.
 */
export class AntView {
  readonly root: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Container;
  /** 도형 개미 (그림 끔 · 폴백 = M2 화면) */
  private readonly shape: Phaser.GameObjects.Container;
  private rig: AntRig | null = null;
  private down = false;
  private faceTimer: Phaser.Time.TimerEvent | null = null;
  private readonly arms: Phaser.GameObjects.Rectangle[] = [];
  private readonly armRest: { x: number; y: number; angle: number }[] = [];
  private readonly scene: Phaser.Scene;
  private readonly h: number;
  private squashTween: Phaser.Tweens.Tween | null = null;
  private dizzy: Phaser.GameObjects.Text | null = null;
  private readonly fists: (Phaser.GameObjects.Arc | null)[] = [null, null, null, null];
  private readonly armLen: number;
  private readonly armW: number;

  constructor(scene: Phaser.Scene, x: number, y: number, width: number, height: number) {
    this.scene = scene;
    this.h = height;
    this.root = scene.add.container(x, y);
    this.body = scene.add.container(0, 0);
    this.root.add(this.body);
    this.shape = scene.add.container(0, 0);
    this.body.add(this.shape);

    const headR = height * 0.3;
    const bodyW = width * 0.32;
    const bodyH = height * 0.34;
    const legH = height * 0.22;
    const bodyY = -legH - bodyH / 2;
    const headY = -legH - bodyH - headR * 0.75;

    // 다리 2개
    for (const side of [-1, 1]) {
      const leg = scene.add.rectangle(side * bodyW * 0.22, -legH / 2, width * 0.07, legH, COLOR.leg).setOrigin(0.5);
      this.shape.add(leg);
    }
    // 팔 4개: 슬롯 1·2 = 위쪽 (왼 · 오), 3·4 = 아래쪽 (왼 · 오). 쉬는 자세는 위로 벌린 V
    const armLen = height * 0.36;
    const armW = width * 0.075;
    this.armLen = armLen;
    this.armW = armW;
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
      this.shape.add(arm);
    });
    // 몸통 · 머리 · 눈 · 더듬이
    this.shape.add(scene.add.ellipse(0, bodyY, bodyW, bodyH, COLOR.antBody));
    for (const side of [-1, 1]) {
      const ant = scene.add.rectangle(side * headR * 0.45, headY - headR * 0.85, 6, headR * 0.7, COLOR.antBody).setOrigin(0.5, 1);
      ant.setAngle(side * 25);
      this.shape.add(ant);
    }
    this.shape.add(scene.add.circle(0, headY, headR, COLOR.antHead));
    for (const side of [-1, 1]) {
      this.shape.add(scene.add.circle(side * headR * 0.38, headY - headR * 0.05, headR * 0.24, COLOR.antEye));
      this.shape.add(scene.add.circle(side * headR * 0.34, headY - headR * 0.02, headR * 0.11, 0x000000));
    }
  }

  setY(y: number): void {
    this.root.y = y;
  }

  /** 그림 · 도형 바꾸기 (M3). plan.mode = shape면 도형 (M2 화면 그대로) */
  setArt(plan: ArtPlan): void {
    this.rig?.destroy();
    this.rig = null;
    this.faceTimer?.remove();
    this.faceTimer = null;
    if (plan.mode === 'image') {
      this.rig = new AntRig(this.scene, plan, this.h, this.armW * 0.9);
      this.body.add(this.rig.root);
      this.rig.setFace(this.down ? 'down' : 'normal');
    }
    this.shape.setVisible(!this.rig);
  }

  get artMode(): 'image' | 'shape' {
    return this.rig ? 'image' : 'shape';
  }

  private setFace(face: Face): void {
    this.rig?.setFace(face);
  }

  /**
   * 팔 슬롯 (1~4) 위로 찌르기. stretch · ms = fx_config (E 끔 = arm.stretch, 켬 = punch.stretch)
   * fistScale이 있으면 (M2 E) 팔 끝 주먹이 커졌다 돌아옴. 반환 = 이번에 새로 만든 연출 객체 수
   */
  strike(slot: number, stretch: number, ms: number, fistScale: number | null = null): number {
    if (this.rig) return this.rig.strike(slot, stretch, ms, fistScale);
    const i = slot - 1;
    const arm = this.arms[i];
    const rest = this.armRest[i];
    if (!arm || !rest) return 0;
    this.scene.tweens.killTweensOf(arm);
    arm.setAngle(rest.angle * 0.15).setScale(1, stretch);
    this.scene.tweens.add({ targets: arm, angle: rest.angle, scaleY: 1, duration: ms, ease: 'Quad.easeOut' });
    if (fistScale === null) {
      this.fists[i]?.setVisible(false);
      return 0;
    }
    let created = 0;
    let fist = this.fists[i];
    if (!fist) {
      fist = this.scene.add.circle(0, 0, this.armW * 0.9, COLOR.armSlot[i]!).setStrokeStyle(3, COLOR.antBody);
      this.shape.add(fist);
      this.fists[i] = fist;
      created = 1;
    }
    // 주먹 = 팔 끝 (팔 원점은 어깨, 길이 방향 = 위). 늘어난 팔 끝을 따라감
    const place = () => {
      const a = Phaser.Math.DegToRad(arm.angle);
      const len = this.armLen * arm.scaleY;
      fist!.setPosition(arm.x + Math.sin(a) * len, arm.y - Math.cos(a) * len);
    };
    this.scene.tweens.killTweensOf(fist);
    fist.setVisible(true).setScale(fistScale);
    place();
    this.scene.tweens.add({ targets: fist, scale: 1, duration: ms, ease: 'Quad.easeOut', onUpdate: place, onComplete: () => fist!.setVisible(false) });
    return created;
  }

  /** 점프 시작 — 늘어나기 */
  jump(strong: boolean): void {
    this.playSquash(strong ? 0.75 : 0.88, strong ? 1.3 : 1.12, 140);
  }

  /** 착지 피격 — 짓눌림 · 그림이면 hit 표정 faceMs 동안 (H-12 Q5) */
  hit(faceMs = 0): void {
    this.playSquash(1.35, 0.55, 260);
    if (!this.rig || this.down) return;
    this.setFace('hit');
    this.faceTimer?.remove();
    this.faceTimer = this.scene.time.delayedCall(faceMs, () => {
      this.faceTimer = null;
      if (!this.down) this.setFace('normal');
    });
  }

  /** 기절 — 납작 (코믹) */
  setDown(down: boolean): void {
    this.down = down;
    this.faceTimer?.remove();
    this.faceTimer = null;
    this.setFace(down ? 'down' : 'normal');
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
