import Phaser from 'phaser';
import { artTextureKey } from './artFiles';
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

  constructor(
    private readonly scene: Phaser.Scene,
    plan: ArtPlan,
    h: number,
    private readonly fistR: number,
  ) {
    this.root = scene.add.container(0, 0).setScale(plan.drawScale);
    const dot = (parent: Phaser.GameObjects.Container, x: number, y: number, color: number) => {
      if (plan.showPivots) parent.add(scene.add.circle(x, y, h * 0.035, color).setStrokeStyle(2, 0xffffff));
    };
    for (const mount of plan.mounts) {
      const isHead = mount.part_id.startsWith('head_');
      const m = scene.add.container(mount.anchor_x * h, -mount.anchor_y * h).setAngle(mount.angle_deg);
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
        }
      } else {
        const p = place(mount.part_id as keyof ArtPlan['parts']);
        const slot = armSlotOf(mount.mount_id);
        if (p && slot !== null && slot >= 1 && slot <= SLOTS && p.part.socket_x !== null && p.part.socket_y !== null) {
          const sx = (p.part.socket_x - p.part.pivot_x) * p.img.width * p.s * mir;
          const sy = (p.part.socket_y - p.part.pivot_y) * p.img.height * p.s;
          const socket = scene.add.container(sx, sy);
          const weapon = plan.slots[slot - 1] ?? null;
          if (weapon) {
            const w = scene.add.image(0, 0, artTextureKey(weapon.file)).setOrigin(weapon.grip_x, weapon.grip_y);
            const ws = (weapon.scale * h * plan.weaponScale) / w.height;
            w.setScale(ws * mir, ws).setAngle(weapon.angle_deg * mir);
            socket.add(w);
          }
          dot(socket, 0, 0, SOCKET_COLOR);
          m.add(socket);
          this.arms[slot - 1] = { mount: m, image: p.img, baseSX: p.img.scaleX, baseSY: p.img.scaleY, socket, socketX: sx, socketY: sy, rest: mount.angle_deg, hasWeapon: !!weapon, fist: null, anim: { k: 1, f: 1 } };
        }
      }
      dot(m, 0, 0, PIVOT_COLOR);
      this.root.add(m);
    }
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

  destroy(): void {
    for (const a of this.arms) if (a) this.scene.tweens.killTweensOf([a.mount, a.anim]);
    this.root.destroy();
  }
}
