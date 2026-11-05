/**
 * M3-C 공격 · 점프 모션 (I-14 · H-21) — 자세 계산 순수 함수 (Phaser 없음 · 테스트 대상).
 * 입력 = core 상태(phase · contact · groundTimer)와 이벤트(jump · strike)를 view가 받은 시각. view는 그리기만 — 판정 · 시각은 core.
 * 값 = fx_config `motion.*` (폰 보고 맞출 값). [FX] "모션" 끔 = M3 모습 (이 파일을 안 씀).
 *
 * 각도 규칙: 팔 · 다리 각도는 "바깥쪽 +" (왼쪽 슬롯 1 · 3 · 왼다리는 그릴 때 부호를 뒤집음).
 * 길이 단위: 개미 키 = 1.
 */
import fx_config from '../data/fx_config.json';

export type MotionConfig = typeof fx_config.motion;
export const MOTION: MotionConfig = fx_config.motion;
export const SLOT_COUNT = 4;

export interface ArmPose {
  /** 기본 각도에서 바깥쪽으로 더 벌림 (deg, - = 안쪽 · 위로) */
  out: number;
  /** 팔 늘어남 배율 */
  stretch: number;
  /** 손 소켓(무기 · 주먹) 배율 */
  socket: number;
  /** 무기 회전 (deg, 바깥쪽 +) */
  spin: number;
}

export interface Pose {
  /** 몸 전체 위로 (개미 키 단위, - = 낮춤) */
  dy: number;
  sx: number;
  sy: number;
  /** 몸 기울기 (deg, + = 오른쪽) */
  tilt: number;
  /** 다리 [왼, 오] 바깥쪽 각도 */
  legs: [number, number];
  arms: ArmPose[];
}

export interface MotionInput {
  phase: 'ground' | 'rise' | 'fall' | 'down';
  contact: boolean;
  /** core: 다음 자동 점프까지 (건물이 떨어지는 중일 때만 줄어듦) */
  groundTimer: number;
  /** 건물이 떨어지는 중 = 자동 점프가 곧 옴 */
  jumpPending: boolean;
  /** 모션 시계 (초 · 히트스톱 동안 멈춤) */
  t: number;
  jumpAt: number | null;
  jumpStrong: boolean;
  landAt: number | null;
  /** 슬롯 1 ~ 4: 마지막 타격 시각 · 모션 길이 (초) */
  strikes: ({ at: number; dur: number } | null)[];
  /** 몸통 반동 — 마지막 타격 시각 · 방향 (-1 왼 · +1 오) · 길이 */
  tilt: { at: number; sign: number; dur: number } | null;
}

/** 내지르기 세기 (M2 E 켬 = punch · 끔 = arm.stretch, 주먹 · 무기 1) */
export interface PunchSize {
  stretch: number;
  socket: number;
}

/** 팔 기본 각도의 크기 (슬롯 1 · 2 = 35 · 3 · 4 = 70 — ant_mounts / M1 도형) */
export type RestAngles = readonly number[];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOut = (p: number) => 1 - (1 - p) * (1 - p);
const easeInOut = (p: number) => (p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p));
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

export const restPose = (): Pose => ({ dy: 0, sx: 1, sy: 1, tilt: 0, legs: [0, 0], arms: Array.from({ length: SLOT_COUNT }, () => ({ out: 0, stretch: 1, socket: 1, spin: 0 })) });

/** 단계 자세 (웅크림 · 상승 · 매달림 · 하강) — 단계가 바뀌면 blendPose로 이어 붙임 */
export function phasePose(cfg: MotionConfig, inp: Pick<MotionInput, 'phase' | 'contact'>, rest: RestAngles): Pose {
  const p = restPose();
  if (inp.phase === 'rise' && !inp.contact) {
    p.legs = [-cfg.rise.leg_tuck_deg, -cfg.rise.leg_tuck_deg];
    p.arms.forEach((a, i) => (a.out = -(rest[i] ?? 0) * cfg.rise.arm_gather));
  } else if (inp.phase === 'rise' && inp.contact) {
    p.legs = [cfg.hang.leg_dangle_deg, cfg.hang.leg_dangle_deg];
  } else if (inp.phase === 'fall') {
    p.legs = [cfg.fall.leg_spread_deg, cfg.fall.leg_spread_deg];
    p.arms.forEach((a, i) => (a.out = (rest[i] ?? 0) * (cfg.fall.arm_spread - 1)));
  }
  return p;
}

/** from → to로 dtMs만큼 다가감 (blend_ms = 63%에 닿는 시간) */
export function blendPose(from: Pose, to: Pose, dtMs: number, blendMs: number): Pose {
  const k = blendMs <= 0 ? 1 : 1 - Math.exp(-dtMs / blendMs);
  return {
    dy: lerp(from.dy, to.dy, k),
    sx: lerp(from.sx, to.sx, k),
    sy: lerp(from.sy, to.sy, k),
    tilt: lerp(from.tilt, to.tilt, k),
    legs: [lerp(from.legs[0], to.legs[0], k), lerp(from.legs[1], to.legs[1], k)],
    arms: from.arms.map((a, i) => {
      const b = to.arms[i]!;
      return { out: lerp(a.out, b.out, k), stretch: lerp(a.stretch, b.stretch, k), socket: lerp(a.socket, b.socket, k), spin: lerp(a.spin, b.spin, k) };
    }),
  };
}

/** 공격 모션 길이 (초) = 타격 간격 × span — 공격속도 강화를 따라 줄어듦 */
export const strikeDuration = (cfg: MotionConfig, intervalS: number): number => intervalS * cfg.strike.span;

/** 공격 3단계 시간 (ms). 당기기가 min_pull_ms보다 짧으면 생략 → 복귀에 더함 */
export function strikePhases(cfg: MotionConfig, durS: number): { pull: number; thrust: number; ret: number } {
  const dur = durS * 1000;
  let pull = dur * cfg.strike.pull_ratio;
  if (pull < cfg.strike.min_pull_ms) pull = 0;
  const thrust = dur * cfg.strike.thrust_ratio;
  return { pull, thrust, ret: Math.max(0, dur - pull - thrust) };
}

/**
 * 공격 1타 진행 (elapsed ms) → 팔 자세 더할 값. 끝났으면 null
 * 당기기 (바깥 아래로) → 내지르기 (위로 곧게 · 늘어남 · 무기 회전) → 복귀
 */
export function strikeArm(cfg: MotionConfig, elapsedMs: number, durS: number, restAbs: number, punch: PunchSize): ArmPose | null {
  const ph = strikePhases(cfg, durS);
  const total = ph.pull + ph.thrust + ph.ret;
  if (elapsedMs < 0 || elapsedMs >= total) return null;
  const top = -restAbs * 0.85; // 내지르기 = 기본 각도의 15%까지 곧게 (M2 팔 찌르기와 같은 끝 자세)
  let out: number;
  let ext: number;
  if (elapsedMs < ph.pull) {
    out = cfg.strike.pull_deg * easeOut(elapsedMs / ph.pull);
    ext = 0;
  } else if (elapsedMs < ph.pull + ph.thrust) {
    const p = easeOut((elapsedMs - ph.pull) / ph.thrust);
    out = lerp(ph.pull > 0 ? cfg.strike.pull_deg : 0, top, p);
    ext = p;
  } else {
    const p = easeInOut(ph.ret > 0 ? (elapsedMs - ph.pull - ph.thrust) / ph.ret : 1);
    out = lerp(top, 0, p);
    ext = 1 - p;
  }
  return { out, stretch: 1 + (punch.stretch - 1) * ext, socket: 1 + (punch.socket - 1) * ext, spin: cfg.strike.weapon_spin_deg * ext };
}

/** 단계 자세(blend된 base) + 시간 연출 (웅크림 · 도약 · 착지 · 공격 · 반동 · 흔들림) */
export function composePose(cfg: MotionConfig, base: Pose, inp: MotionInput, rest: RestAngles, punch: PunchSize): Pose {
  const p: Pose = { ...base, legs: [...base.legs] as [number, number], arms: base.arms.map((a) => ({ ...a })) };
  const strong = inp.jumpStrong ? cfg.strong_scale : 1;
  // 웅크림 — 자동 점프 전 지면 대기 마지막 lead_s 동안 (core 점프 시각은 그대로)
  if (inp.phase === 'ground' && inp.jumpPending && cfg.crouch.lead_s > 0 && inp.groundTimer <= cfg.crouch.lead_s) {
    const c = clamp01(1 - inp.groundTimer / cfg.crouch.lead_s);
    p.dy -= cfg.crouch.body_drop * c;
    p.sy *= 1 - cfg.crouch.body_drop * c;
    p.legs[0] += cfg.crouch.leg_fold_deg * c;
    p.legs[1] += cfg.crouch.leg_fold_deg * c;
  }
  // 도약 — 몸 늘어남 (강점프는 앞 30% 압축 → 튕김)
  if (inp.jumpAt !== null && cfg.launch.ms > 0) {
    const e = (inp.t - inp.jumpAt) * 1000;
    if (e >= 0 && e < cfg.launch.ms) {
      const amp = (cfg.launch.stretch - 1) * strong;
      const u = e / cfg.launch.ms;
      let k: number;
      if (inp.jumpStrong && u < 0.3) k = -0.5 * Math.sin((u / 0.3) * Math.PI);
      else k = 1 - easeOut(inp.jumpStrong ? (u - 0.3) / 0.7 : u);
      p.sx *= 1 - amp * k;
      p.sy *= 1 + amp * k;
    }
  }
  // 착지 (땅에 닿음) 찌그러짐
  if (inp.landAt !== null && cfg.land.ms > 0) {
    const e = (inp.t - inp.landAt) * 1000;
    if (e >= 0 && e < cfg.land.ms) {
      const k = 1 - easeOut(e / cfg.land.ms);
      p.sy *= 1 - (1 - cfg.land.squash) * k;
      p.sx *= 1 + (1 - cfg.land.squash) * k;
    }
  }
  // 매달림 흔들림
  if (inp.phase === 'rise' && inp.contact && cfg.hang.sway_deg > 0) p.tilt += Math.sin(inp.t * Math.PI * 2 * 1.2) * cfg.hang.sway_deg;
  // 공격 — 그 팔만
  inp.strikes.forEach((s, i) => {
    if (!s) return;
    const a = strikeArm(cfg, (inp.t - s.at) * 1000, s.dur, rest[i] ?? 0, punch);
    if (!a) return;
    const arm = p.arms[i]!;
    arm.out += a.out;
    arm.stretch *= a.stretch;
    arm.socket *= a.socket;
    arm.spin += a.spin;
  });
  // 몸통 반동 — 치는 쪽으로 기울었다 돌아옴 (타격 간격 안)
  if (inp.tilt && inp.tilt.dur > 0) {
    const u = (inp.t - inp.tilt.at) / inp.tilt.dur;
    if (u >= 0 && u < 1) p.tilt += inp.tilt.sign * cfg.strike.body_tilt_deg * Math.sin(u * Math.PI);
  }
  return p;
}

/** 슬롯 → 몸 쪽 (1 · 3 = 왼 -1 · 2 · 4 = 오 +1) */
export const slotSide = (slot: number): number => (slot % 2 === 1 ? -1 : 1);

/**
 * 그림 모드 팔 (고무 팔 고침 — H-21 Q6): 늘어남은 art_stretch_max까지만, 넘는 길이 × art_thrust만큼 팔 전체가 팔 방향으로 튀어나감.
 * 반환 = 그림 늘어남 · 밀어내는 거리 (팔 길이 단위)
 */
export function artArm(cfg: MotionConfig, stretch: number): { stretch: number; thrust: number } {
  const cap = Math.max(1, cfg.strike.art_stretch_max);
  const s = Math.min(stretch, cap);
  return { stretch: s, thrust: Math.max(0, stretch - cap) * cfg.strike.art_thrust };
}
