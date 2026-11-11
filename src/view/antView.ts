import Phaser from 'phaser';
import { AntRig } from './antRig';
import type { ArtPlan, Face } from './artPlan';
import { blendPose, composePose, hangDrop, MOTION, type MotionInput, phasePose, type Pose, type PunchSize, restPose, slotSide, strikeDuration } from './antMotion';
import { COLOR, FONT } from './theme';
import { t } from './text';

/** 모션에 넘길 core 상태 (core BattleSim.ant 일부) */
export interface AntMotionState {
  phase: 'ground' | 'rise' | 'fall' | 'down';
  contact: boolean;
  groundTimer: number;
}

/**
 * 개미 — 도형 (M1 placeholder: 큰 머리 + 작은 몸, 팔 4개 슬롯별 색, 다리 2개) 또는 파츠 그림 (M3 AntRig).
 * 원점 = 발 가운데. 높이 h는 전투 구역 비율 × 전투 구역 px. 함수 (strike · jump · hit · setDown)는 두 쪽 같음.
 * 계층: root → body (피격 짓눌림 · 기절 · M3 점프 늘어남) → pose (M3-C 모션: 웅크림 · 도약 · 착지 · 기울기) → 도형 / 그림
 * M3-C 모션 (I-14 · H-21): setMotion(true)이면 매 프레임 updateMotion이 자세(antMotion.ts)를 도형 · 그림에 똑같이 적용.
 * 끄면 M3 모습 그대로 (팔 찌르기 트윈 · 점프 늘어남).
 */
export class AntView {
  readonly root: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Container;
  private readonly pose: Phaser.GameObjects.Container;
  /** 도형 개미 (그림 끔 · 폴백 = M2 화면) */
  private readonly shape: Phaser.GameObjects.Container;
  private rig: AntRig | null = null;
  private down = false;
  private faceTimer: Phaser.Time.TimerEvent | null = null;
  private readonly arms: Phaser.GameObjects.Rectangle[] = [];
  private readonly armRest: { x: number; y: number; angle: number }[] = [];
  private readonly legs: Phaser.GameObjects.Rectangle[] = [];
  private readonly scene: Phaser.Scene;
  private readonly h: number;
  private squashTween: Phaser.Tweens.Tween | null = null;
  private dizzy: Phaser.GameObjects.Text | null = null;
  private readonly fists: (Phaser.GameObjects.Arc | null)[] = [null, null, null, null];
  private readonly armLen: number;
  private readonly armW: number;
  // ── M3-C 모션 ──
  private motionOn = false;
  private motionT = 0;
  private base: Pose = restPose();
  private lastPhase: AntMotionState['phase'] = 'ground';
  private readonly mi: Omit<MotionInput, 'phase' | 'contact' | 'groundTimer' | 'jumpPending' | 't'> = { jumpAt: null, jumpStrong: false, landAt: null, strikes: [null, null, null, null], tilt: null };
  private punch: PunchSize = { stretch: 1, socket: 1 };
  /** M3-E 배속 — 공격 모션 최소 길이(벽시계)를 게임 시간으로 바꿀 때 */
  speed = 1;
  /** M5 도움닫기 길이 (core 값 · 0 = 끔) — 웅크림이 도움닫기 전체에 걸침 */
  windupS = 0;
  /** CA-002 지금 내린 양 (개미 키 단위 · 확인용) */
  drop = 0;
  /** M7-E 받치기 자세 (위 두 팔 = 위로 · 아래 두 팔 = 벌림 · 무기 공격은 그대로 겹침 — 콘티 PR #92) */
  private pushPose: { at: number; dur: number; deg: number } | null = null;
  /** 팔 기본 각도 크기 (슬롯 1 ~ 4) — 도형 팔과 같은 값 */
  private readonly restAbs: number[];

  constructor(scene: Phaser.Scene, x: number, y: number, width: number, height: number) {
    this.scene = scene;
    this.h = height;
    this.root = scene.add.container(x, y);
    this.body = scene.add.container(0, 0);
    this.root.add(this.body);
    this.pose = scene.add.container(0, 0);
    this.body.add(this.pose);
    this.shape = scene.add.container(0, 0);
    this.pose.add(this.shape);

    const headR = height * 0.3;
    const bodyW = width * 0.32;
    const bodyH = height * 0.34;
    const legH = height * 0.22;
    const bodyY = -legH - bodyH / 2;
    const headY = -legH - bodyH - headR * 0.75;

    // 다리 2개 (회전축 = 위 끝 — 모양 · 자리는 M1 그대로)
    for (const side of [-1, 1]) {
      const leg = scene.add.rectangle(side * bodyW * 0.22, -legH, width * 0.07, legH, COLOR.leg).setOrigin(0.5, 0);
      this.legs.push(leg);
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
    this.restAbs = slots.map((s) => Math.abs(s.angle));
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
      this.pose.add(this.rig.root);
      this.rig.setFace(this.down ? 'down' : 'normal');
    }
    this.shape.setVisible(!this.rig);
    if (this.motionOn) this.applyPose(composePose(MOTION, this.base, this.motionInput(null), this.restAbs, this.punch));
  }

  get artMode(): 'image' | 'shape' {
    return this.rig ? 'image' : 'shape';
  }

  get motion(): boolean {
    return this.motionOn;
  }

  private setFace(face: Face): void {
    this.rig?.setFace(face);
  }

  /** M3-C 모션 켜기 / 끄기 — 끄면 기본 자세로 돌려놓고 M3 방식(트윈)으로 */
  setMotion(on: boolean): void {
    if (on === this.motionOn) return;
    this.motionOn = on;
    for (const a of this.arms) this.scene.tweens.killTweensOf(a);
    for (const f of this.fists) if (f) this.scene.tweens.killTweensOf(f), f.setVisible(false);
    this.rig?.resetPose();
    this.base = restPose();
    this.mi.strikes = [null, null, null, null];
    this.mi.tilt = null;
    this.mi.jumpAt = null;
    this.mi.landAt = null;
    this.applyPose(restPose());
  }

  /**
   * 팔 슬롯 (1~4) 위로 찌르기. stretch · ms = fx_config (E 끔 = arm.stretch, 켬 = punch.stretch)
   * fistScale이 있으면 (M2 E) 팔 끝 주먹이 커졌다 돌아옴. 반환 = 이번에 새로 만든 연출 객체 수
   * 모션 켬: intervalS = 지금 타격 간격 (core) — 모션 길이 = 간격 × motion.strike.span
   */
  strike(slot: number, stretch: number, ms: number, fistScale: number | null = null, intervalS = 0): number {
    if (this.motionOn) {
      const dur = strikeDuration(MOTION, intervalS > 0 ? intervalS : ms / 1000, this.speed);
      this.mi.strikes[slot - 1] = { at: this.motionT, dur };
      this.mi.tilt = { at: this.motionT, sign: slotSide(slot), dur };
      this.punch = { stretch, socket: fistScale ?? 1 };
      return this.rig ? this.rig.ensureFist(slot, fistScale !== null) : this.ensureShapeFist(slot - 1, fistScale !== null);
    }
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
    const created = this.ensureShapeFist(i, true);
    const fist = this.fists[i]!;
    // 주먹 = 팔 끝 (팔 원점은 어깨, 길이 방향 = 위). 늘어난 팔 끝을 따라감
    const place = () => this.placeShapeFist(i);
    this.scene.tweens.killTweensOf(fist);
    fist.setVisible(true).setScale(fistScale);
    place();
    this.scene.tweens.add({ targets: fist, scale: 1, duration: ms, ease: 'Quad.easeOut', onUpdate: place, onComplete: () => fist.setVisible(false) });
    return created;
  }

  /** M3-D 충격 별 자리 x (화면) — 그 팔이 내지른 끝 (무기 끝 · 맨주먹이면 팔 끝 — H-27 Q4) */
  strikeX(slot: number, stretch = 1): number {
    if (this.rig) {
      const x = this.rig.tipX(slot);
      if (x !== null) return this.root.x + x * this.rig.root.scaleX;
    }
    const arm = this.arms[slot - 1];
    const rest = this.armRest[slot - 1];
    if (!arm || !rest) return this.root.x;
    return this.root.x + rest.x + Math.sin(Phaser.Math.DegToRad(rest.angle * 0.15)) * this.armLen * stretch;
  }

  /** 도형 주먹 (M2 E) — 없으면 만듦. 반환 = 새로 만든 수 */
  private ensureShapeFist(i: number, want: boolean): number {
    if (!want || this.fists[i]) return 0;
    const fist = this.scene.add.circle(0, 0, this.armW * 0.9, COLOR.armSlot[i]!).setStrokeStyle(3, COLOR.antBody).setVisible(false);
    this.shape.add(fist);
    this.fists[i] = fist;
    return 1;
  }

  private placeShapeFist(i: number): void {
    const arm = this.arms[i]!;
    const fist = this.fists[i];
    if (!fist) return;
    const a = Phaser.Math.DegToRad(arm.angle);
    const len = this.armLen * arm.scaleY;
    fist.setPosition(arm.x + Math.sin(a) * len, arm.y - Math.cos(a) * len);
  }

  /** M7-E 받치기 — 위 두 팔을 deg만큼 위로 · 아래 두 팔 벌림 (ms 동안 · 모션 켬일 때만 — 끔이면 M3 모습) */
  pushUp(deg: number, ms: number): void {
    if (this.motionOn) this.pushPose = { at: this.motionT, dur: ms / 1000, deg };
  }

  /** 점프 시작 — 늘어나기 (모션 켬 = 도약 단계로) */
  jump(strong: boolean): void {
    if (this.motionOn) {
      this.mi.jumpAt = this.motionT;
      this.mi.jumpStrong = strong;
      return;
    }
    this.playSquash(strong ? 0.75 : 0.88, strong ? 1.3 : 1.12, 140);
  }

  /**
   * M3-C — 매 프레임. dtMs = 벽시계 · frozen = 히트스톱 중 (공격 모션도 같이 멈춤 — H-21 Q3)
   * 반환 = 이번 프레임에 땅에 닿았는가 (phase fall → ground — H-21 Q1, 착지 먼지는 장면이 그림)
   * gap · feetRoom = (건물 밑면 − 발) · 발 높이 ÷ 개미 키 (core 값) — CA-002 그림 머리끝이 건물 밑면을 넘지 않게 (떨어지는 건물이 없으면 gap = Infinity)
   */
  updateMotion(dtMs: number, st: AntMotionState, jumpPending: boolean, frozen: boolean, gap = Infinity, feetRoom = 0): boolean {
    if (!this.motionOn) return false;
    if (!frozen) this.motionT += dtMs / 1000;
    const touchdown = this.lastPhase === 'fall' && st.phase === 'ground';
    this.lastPhase = st.phase;
    if (touchdown) this.mi.landAt = this.motionT;
    if (!frozen) this.base = blendPose(this.base, phasePose(MOTION, st, this.restAbs), dtMs, MOTION.blend_ms);
    const pose = composePose(MOTION, this.base, this.motionInput({ ...st, jumpPending }), this.restAbs, this.punch);
    const pp = this.pushPose;
    if (pp) {
      const e = pp.dur > 0 ? (this.motionT - pp.at) / pp.dur : 1;
      if (e >= 1) this.pushPose = null;
      else {
        const k = e < 0.6 ? 1 : 1 - (e - 0.6) / 0.4; // 60%까지 유지 → 풀림
        pose.arms[0]!.out -= pp.deg * k;
        pose.arms[1]!.out -= pp.deg * k;
        pose.arms[2]!.out += pp.deg * 0.5 * k;
        pose.arms[3]!.out += pp.deg * 0.5 * k;
      }
    }
    // CA-002 (I-15): 그림 모드만 — 그림 머리끝 = 건물 밑면 (도형은 판정 키와 크기가 같아서 그대로)
    this.drop = this.rig ? hangDrop(this.rig.topRatio, gap, feetRoom) : 0;
    pose.dy -= this.drop;
    this.applyPose(pose);
    return touchdown;
  }

  private motionInput(st: (AntMotionState & { jumpPending: boolean }) | null): MotionInput {
    return { phase: st?.phase ?? this.lastPhase, contact: st?.contact ?? false, groundTimer: st?.groundTimer ?? Infinity, jumpPending: st?.jumpPending ?? false, windupS: this.windupS, t: this.motionT, ...this.mi };
  }

  private applyPose(p: Pose): void {
    this.pose.setPosition(0, -p.dy * this.h).setScale(p.sx, p.sy).setAngle(p.tilt);
    if (this.rig) {
      this.rig.applyPose(p, this.armLen);
      return;
    }
    this.legs.forEach((leg, i) => leg.setAngle((i === 0 ? -1 : 1) * p.legs[i as 0 | 1]));
    this.arms.forEach((arm, i) => {
      const rest = this.armRest[i]!;
      const a = p.arms[i]!;
      arm.setAngle(rest.angle + Math.sign(rest.angle) * a.out).setScale(1, a.stretch);
      const fist = this.fists[i];
      if (fist) {
        const show = this.motionOn && a.socket > 1.001;
        fist.setVisible(show);
        if (show) {
          fist.setScale(a.socket);
          this.placeShapeFist(i);
        }
      }
    });
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
