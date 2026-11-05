import Phaser from 'phaser';
import { artTextureKey } from './artFiles';
import { artArm, MOTION, type Pose } from './antMotion';
import { armSlotOf, type ArtPlan, type Face, SLOTS } from './artPlan';
import { COLOR } from './theme';

/** 기준점 보기 점 색 (디버그 표시 — 모양 상수) */
const PIVOT_COLOR = 0xff3df2;
const SOCKET_COLOR = 0x3df2ff;

interface RigArm {
  mount: Phaser.GameObjects.Container;
  image: Phaser.GameObjects.Image;
  baseSX: number;
  baseSY: number;
  socket: Phaser.GameObjects.Container;
  socketX: number;
  socketY: number;
  rest: number;
  /** 마운트 기본 자리 (모션이 팔 전체를 밀어낼 때 기준) */
  baseX: number;
  baseY: number;
  /** 팔 그림 길이 px (pivot → socket) */
  len: number;
  mir: number;
  weapon: Phaser.GameObjects.Image | null;
  weaponAngle: number;
  hasWeapon: boolean;
  fist: Phaser.GameObjects.Arc | null;
  /** 트윈 대상 (늘어남 k · 손 소켓 크기 f) */
  anim: { k: number; f: number };
}

/**
 * 개미 파츠 조립 (M3 — I-11 · H-12). 원점 = 발 가운데, 위 = -y. 길이 단위 = 개미 키 h (px).
 * 계층: root (scale = draw_scale) → 마운트 (anchor · angle) → 파츠 그림 (origin = pivot) · 팔은 + 손 소켓 → 무기 (origin = grip)
 * 왼쪽 (mirror) = scaleX 음수 — 기준점(origin) 둘레로 뒤집혀서 pivot이 그대로 맞는다
 */
export class AntRig {
  readonly root: Phaser.GameObjects.Container;
  private readonly arms: (RigArm | null)[] = Array.from({ length: SLOTS }, () => null);
  private readonly heads = new Map<Face, Phaser.GameObjects.Image>();
  /** 그림 머리끝 높이 ÷ 개미 키 (그림 배율 · 머리 배율 포함) — CA-002 매달릴 때 내리는 양 */
  readonly topRatio: number;
  /** 다리 마운트 [왼, 오] — M3-C 모션 */
  private readonly legs: { mount: Phaser.GameObjects.Container; rest: number; side: number }[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    plan: ArtPlan,
    h: number,
    private readonly fistR: number,
  ) {
    this.root = scene.add.container(0, 0).setScale(plan.drawScale);
    let top = 1;
    const dot = (parent: Phaser.GameObjects.Container, x: number, y: number, color: number) => {
      if (plan.showPivots) parent.add(scene.add.circle(x, y, h * 0.035, color).setStrokeStyle(2, 0xffffff));
    };
    for (const mount of plan.mounts) {
      const isHead = mount.part_id.startsWith('head_');
      const m = scene.add.container(mount.anchor_x * h, -mount.anchor_y * h).setAngle(mount.angle_deg);
      if (isHead) m.setScale(plan.headScale); // 머리만 따로 (목 기준) — 표정 가독성 (H-22)
      const mir = mount.mirror ? -1 : 1;
      const place = (partId: keyof ArtPlan['parts']) => {
        const part = plan.parts[partId];
        if (!part) return null;
        const img = scene.add.image(0, 0, artTextureKey(part.file)).setOrigin(part.pivot_x, part.pivot_y);
        const s = (part.draw_h * h) / img.height;
        img.setScale(s * mir, s);
        m.add(img);
        return { img, part, s };
      };
      if (isHead) {
        for (const face of ['normal', 'hit', 'down'] as const) {
          const p = place(`head_${face}`);
          if (p) this.heads.set(face, p.img.setVisible(face === 'normal'));
          if (p) top = Math.max(top, plan.drawScale * (mount.anchor_y + plan.headScale * p.part.draw_h * p.part.pivot_y));
        }
      } else {
        const p = place(mount.part_id as keyof ArtPlan['parts']);
        const slot = armSlotOf(mount.mount_id);
        if (p && slot !== null && slot >= 1 && slot <= SLOTS && p.part.socket_x !== null && p.part.socket_y !== null) {
          const sx = (p.part.socket_x - p.part.pivot_x) * p.img.width * p.s * mir;
          const sy = (p.part.socket_y - p.part.pivot_y) * p.img.height * p.s;
          const socket = scene.add.container(sx, sy);
          const weapon = plan.slots[slot - 1] ?? null;
          let wImg: Phaser.GameObjects.Image | null = null;
          if (weapon) {
            wImg = scene.add.image(0, 0, artTextureKey(weapon.file)).setOrigin(weapon.grip_x, weapon.grip_y);
            const ws = (weapon.scale * h * plan.weaponScale) / wImg.height;
            wImg.setScale(ws * mir, ws).setAngle(weapon.angle_deg * mir);
            socket.add(wImg);
          }
          dot(socket, 0, 0, SOCKET_COLOR);
          m.add(socket);
          this.arms[slot - 1] = {
            mount: m, image: p.img, baseSX: p.img.scaleX, baseSY: p.img.scaleY, socket, socketX: sx, socketY: sy, rest: mount.angle_deg,
            baseX: m.x, baseY: m.y, len: Math.hypot(sx, sy), mir, weapon: wImg, weaponAngle: weapon ? weapon.angle_deg * mir : 0,
            hasWeapon: !!weapon, fist: null, anim: { k: 1, f: 1 },
          };
        }
        if (mount.part_id === 'leg') {
          this.legs.push({ mount: m, rest: mount.angle_deg, side: mount.anchor_x < 0 ? -1 : 1 });
          this.legs.sort((a, b) => a.side - b.side); // [왼, 오]
        }
      }
      dot(m, 0, 0, PIVOT_COLOR);
      this.root.add(m);
    }
    this.topRatio = top;
  }

  setFace(face: Face): void {
    for (const [f, img] of this.heads) img.setVisible(f === face);
  }

  /** M2 E 펀치 과장과 같은 동작 — 팔 늘이기 + 손 소켓(무기 · 맨주먹) 키우기. 반환 = 새로 만든 연출 객체 수 */
  strike(slot: number, stretch: number, ms: number, fistScale: number | null): number {
    const arm = this.arms[slot - 1];
    if (!arm) return 0;
    const { scene } = this;
    scene.tweens.killTweensOf(arm.mount);
    scene.tweens.killTweensOf(arm.anim);
    let created = 0;
    if (fistScale !== null && !arm.hasWeapon && !arm.fist) {
      arm.fist = scene.add.circle(0, 0, this.fistR, COLOR.armSlot[slot - 1]!).setStrokeStyle(3, COLOR.antBody);
      arm.socket.add(arm.fist);
      created = 1;
    }
    arm.fist?.setVisible(fistScale !== null);
    const apply = () => {
      arm.image.setScale(arm.baseSX, arm.baseSY * arm.anim.k);
      arm.socket.setPosition(arm.socketX, arm.socketY * arm.anim.k).setScale(arm.anim.f);
    };
    arm.anim.k = stretch;
    arm.anim.f = fistScale ?? 1;
    arm.mount.setAngle(arm.rest * 0.15);
    apply();
    scene.tweens.add({ targets: arm.mount, angle: arm.rest, duration: ms, ease: 'Quad.easeOut' });
    scene.tweens.add({
      targets: arm.anim,
      k: 1,
      f: 1,
      duration: ms,
      ease: 'Quad.easeOut',
      onUpdate: apply,
      onComplete: () => {
        apply();
        arm.fist?.setVisible(false);
      },
    });
    return created;
  }

  /** M3-D: 내지르기 끝(팔 각도 = 기본 × 0.15)에서 무기 끝 x — 그림 좌표 (root 배율 전) */
  tipX(slot: number): number | null {
    const arm = this.arms[slot - 1];
    if (!arm) return null;
    const reach = arm.len + (arm.weapon ? arm.weapon.height * Math.abs(arm.weapon.scaleY) * arm.weapon.originY : 0);
    return arm.baseX + Math.sin(Phaser.Math.DegToRad(arm.rest * 0.15)) * reach;
  }

  /** M3-C: 맨주먹 슬롯 주먹을 미리 만들어 둠 (모션이 크기만 바꿈). 반환 = 새로 만든 수 */
  ensureFist(slot: number, want: boolean): number {
    const arm = this.arms[slot - 1];
    if (!arm || !want || arm.hasWeapon || arm.fist) return 0;
    arm.fist = this.scene.add.circle(0, 0, this.fistR, COLOR.armSlot[slot - 1]!).setStrokeStyle(3, COLOR.antBody).setVisible(false);
    arm.socket.add(arm.fist);
    return 1;
  }

  /**
   * M3-C 자세 적용. 그림 팔은 늘어남을 motion.strike.art_stretch_max까지만 — 넘는 길이는 팔 전체가 팔 방향으로 튀어나감 (고무 팔 고침 — H-21 Q6)
   */
  applyPose(p: Pose, _shapeArmLen: number): void {
    this.legs.forEach((l, i) => l.mount.setAngle(l.rest + l.side * p.legs[i as 0 | 1]));
    this.arms.forEach((arm, i) => {
      if (!arm) return;
      const a = p.arms[i]!;
      const angle = arm.rest + Math.sign(arm.rest || 1) * a.out;
      const { stretch, thrust } = artArm(MOTION, a.stretch);
      const push = thrust * arm.len;
      const rad = Phaser.Math.DegToRad(angle);
      arm.mount.setAngle(angle).setPosition(arm.baseX + Math.sin(rad) * push, arm.baseY - Math.cos(rad) * push);
      arm.image.setScale(arm.baseSX, arm.baseSY * stretch);
      arm.socket.setPosition(arm.socketX, arm.socketY * stretch).setScale(a.socket);
      arm.weapon?.setAngle(arm.weaponAngle + Math.sign(arm.rest || 1) * a.spin);
      arm.fist?.setVisible(!arm.hasWeapon && a.socket > 1.001);
    });
  }

  /** 모션을 끌 때 기본 자세로 */
  resetPose(): void {
    for (const l of this.legs) l.mount.setAngle(l.rest);
    for (const arm of this.arms) {
      if (!arm) continue;
      this.scene.tweens.killTweensOf([arm.mount, arm.anim]);
      arm.anim.k = 1;
      arm.anim.f = 1;
      arm.mount.setAngle(arm.rest).setPosition(arm.baseX, arm.baseY);
      arm.image.setScale(arm.baseSX, arm.baseSY);
      arm.socket.setPosition(arm.socketX, arm.socketY).setScale(1);
      arm.weapon?.setAngle(arm.weaponAngle);
      arm.fist?.setVisible(false);
    }
  }

  destroy(): void {
    for (const a of this.arms) if (a) this.scene.tweens.killTweensOf([a.mount, a.anim]);
    this.root.destroy();
  }
}
