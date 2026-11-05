import { describe, expect, it } from 'vitest';
import { artArm, blendPose, composePose, hangDrop, MOTION, type MotionInput, phasePose, restPose, strikeArm, strikeDuration, strikePhases } from '../view/antMotion';

/** M3-C 공격 · 점프 모션 (I-14 · H-21) — 순수 함수. 값 = fx_config motion.* */
const REST = [35, 35, 70, 70];
const PUNCH = { stretch: 1.8, socket: 1.6 };
const input = (o: Partial<MotionInput> = {}): MotionInput => ({ phase: 'ground', contact: false, groundTimer: 0.25, jumpPending: false, t: 10, jumpAt: null, jumpStrong: false, landAt: null, strikes: [null, null, null, null], tilt: null, ...o });

describe('M3-C 공격 모션 — 타격 간격 비례', () => {
  it('모션 길이 = 간격 × span — 0.12초 → 108ms · 공격속도 최대 0.067초 → 60ms', () => {
    expect(strikeDuration(MOTION, 0.12) * 1000).toBeCloseTo(108, 5);
    expect(strikeDuration(MOTION, 0.12 / 1.8) * 1000).toBeCloseTo(60, 5);
  });

  it('간격 0.12초: 당기기 → 내지르기 → 복귀, 다음 타격 전에 끝남', () => {
    const dur = strikeDuration(MOTION, 0.12);
    const ph = strikePhases(MOTION, dur);
    expect(ph.pull).toBeGreaterThan(0);
    expect(ph.pull + ph.thrust + ph.ret).toBeLessThanOrEqual(120);
    expect(strikeArm(MOTION, ph.pull * 0.99, dur, 35, PUNCH)!.out).toBeGreaterThan(0); // 당기기 = 바깥
    const peak = strikeArm(MOTION, ph.pull + ph.thrust - 0.01, dur, 35, PUNCH)!;
    expect(peak.out).toBeLessThan(-25); // 내지르기 = 곧게 위로
    expect(peak.stretch).toBeGreaterThan(1.7);
    expect(peak.socket).toBeGreaterThan(1.5);
    expect(strikeArm(MOTION, 120, dur, 35, PUNCH)).toBeNull(); // 다음 타격(120ms) 때는 끝나 있음
  });

  it('간격 0.067초 (공격속도 최대): 당기기 18 · 내지르기 18 · 복귀 24ms — 다음 타격 전에 끝남 → 연타가 안 뭉개짐', () => {
    const iv = 0.12 / 1.8;
    const dur = strikeDuration(MOTION, iv);
    const ph = strikePhases(MOTION, dur);
    expect(ph.pull).toBeCloseTo(18, 5); // min_pull_ms 16보다 길어서 남음 (한 프레임 남짓)
    expect(ph.pull + ph.thrust + ph.ret).toBeLessThan(iv * 1000);
    expect(strikeArm(MOTION, iv * 1000, dur, 35, PUNCH)).toBeNull();
  });

  it('당기기가 min_pull_ms보다 짧을 때만 생략', () => {
    const fast = strikePhases(MOTION, MOTION.strike.min_pull_ms / 1000 / MOTION.strike.pull_ratio - 0.001);
    expect(fast.pull).toBe(0);
    const ok = strikePhases(MOTION, MOTION.strike.min_pull_ms / 1000 / MOTION.strike.pull_ratio + 0.001);
    expect(ok.pull).toBeGreaterThan(0);
  });

  it('E 끔 (arm.stretch · 주먹 1): 늘어남만 작게, 주먹 · 무기 크기 그대로', () => {
    const dur = strikeDuration(MOTION, 0.12);
    const ph = strikePhases(MOTION, dur);
    const a = strikeArm(MOTION, ph.pull + ph.thrust - 0.01, dur, 70, { stretch: 1.35, socket: 1 })!;
    expect(a.stretch).toBeLessThanOrEqual(1.35);
    expect(a.socket).toBe(1);
  });
});

describe('M3-C 점프 모션 — core 상태를 읽음 (core 시각은 그대로)', () => {
  it('웅크림은 자동 점프 전 지면 대기 마지막 lead_s 안에서만', () => {
    const base = restPose();
    const before = composePose(MOTION, base, input({ jumpPending: true, groundTimer: MOTION.crouch.lead_s + 0.05 }), REST, PUNCH);
    expect(before.dy).toBe(0);
    const near = composePose(MOTION, base, input({ jumpPending: true, groundTimer: 0.01 }), REST, PUNCH);
    expect(near.dy).toBeLessThan(0);
    expect(near.legs[0]).toBeGreaterThan(0);
    const noBuilding = composePose(MOTION, base, input({ jumpPending: false, groundTimer: 0.01 }), REST, PUNCH);
    expect(noBuilding.dy).toBe(0);
  });

  it('단계 자세: 상승 = 다리 모음 · 팔 위로 / 매달림 = 다리 늘어뜨림 / 하강 = 다리 · 팔 벌림', () => {
    const rise = phasePose(MOTION, { phase: 'rise', contact: false }, REST);
    expect(rise.legs[0]).toBeLessThan(0);
    expect(rise.arms[0]!.out).toBeLessThan(0);
    const hang = phasePose(MOTION, { phase: 'rise', contact: true }, REST);
    expect(hang.legs[0]).toBe(MOTION.hang.leg_dangle_deg);
    expect(hang.arms[0]!.out).toBe(0);
    const fall = phasePose(MOTION, { phase: 'fall', contact: false }, REST);
    expect(fall.legs[1]).toBe(MOTION.fall.leg_spread_deg);
    expect(fall.arms[2]!.out).toBeGreaterThan(0);
  });

  it('단계가 바뀌면 blend_ms로 이어짐 (튀지 않음)', () => {
    const to = phasePose(MOTION, { phase: 'fall', contact: false }, REST);
    const mid = blendPose(restPose(), to, MOTION.blend_ms, MOTION.blend_ms);
    expect(mid.legs[0] / to.legs[0]).toBeCloseTo(1 - Math.exp(-1), 5);
  });

  it('도약 늘어남 · 착지 찌그러짐 · 강점프는 더 크게', () => {
    const t = 10;
    const auto = composePose(MOTION, restPose(), input({ phase: 'rise', t, jumpAt: t - 0.001 }), REST, PUNCH);
    expect(auto.sy).toBeGreaterThan(1.1);
    const strong = composePose(MOTION, restPose(), input({ phase: 'rise', t, jumpAt: t - MOTION.launch.ms * 0.35 / 1000, jumpStrong: true }), REST, PUNCH);
    const autoSame = composePose(MOTION, restPose(), input({ phase: 'rise', t, jumpAt: t - MOTION.launch.ms * 0.35 / 1000 }), REST, PUNCH);
    expect(strong.sy).toBeGreaterThan(autoSame.sy);
    const land = composePose(MOTION, restPose(), input({ t, landAt: t - 0.001 }), REST, PUNCH);
    expect(land.sy).toBeLessThan(0.85);
    const after = composePose(MOTION, restPose(), input({ t, landAt: t - 1 }), REST, PUNCH);
    expect(after.sy).toBe(1);
  });

  it('공격은 그 팔만 + 몸통 반동은 치는 쪽으로 (슬롯 2 = 오른쪽 +)', () => {
    const t = 10;
    const dur = strikeDuration(MOTION, 0.12);
    const p = composePose(MOTION, restPose(), input({ phase: 'rise', contact: true, t, strikes: [null, { at: t - dur * 0.5, dur }, null, null], tilt: { at: t - dur * 0.5, sign: 1, dur } }), REST, PUNCH);
    expect(p.arms[1]!.stretch).toBeGreaterThan(1);
    expect(p.arms[0]!.stretch).toBe(1);
    expect(p.tilt).toBeGreaterThan(0);
  });

  it('모션 시계가 멈추면 (히트스톱) 자세도 그대로', () => {
    const dur = strikeDuration(MOTION, 0.12);
    const inp = input({ phase: 'rise', contact: true, t: 10, strikes: [{ at: 10 - 0.05, dur }, null, null, null] });
    expect(composePose(MOTION, restPose(), inp, REST, PUNCH)).toEqual(composePose(MOTION, restPose(), { ...inp }, REST, PUNCH));
  });
});

describe('M3-C 그림 모드 팔 (고무 팔 고침 — H-21 Q6)', () => {
  it('늘어남은 art_stretch_max까지 · 넘는 만큼 팔 전체가 튀어나감', () => {
    const cap = MOTION.strike.art_stretch_max;
    expect(artArm(MOTION, 1.8)).toEqual({ stretch: cap, thrust: (1.8 - cap) * MOTION.strike.art_thrust });
    expect(artArm(MOTION, 1)).toEqual({ stretch: 1, thrust: 0 });
  });
});

describe('CA-002 그림 머리끝이 건물 밑면을 넘지 않음 (I-15)', () => {
  it('매달림 (gap = 1): 내리는 양 = 그림 머리끝 − 판정 머리 · 땅 밑으로는 안 내림 · 그림이 판정보다 작으면 0', () => {
    expect(hangDrop(1.87, 1, 5)).toBeCloseTo(0.87, 10);
    expect(hangDrop(1.87, 1, 0.3)).toBe(0.3); // 건물이 낮아 발 아래 여유가 0.3뿐
    expect(hangDrop(0.9, 1, 5)).toBe(0);
  });

  it('다가갈 때 · 떨어질 때: 겹치는 만큼만 (gap이 머리끝보다 크면 0) → 들어가고 나오는 것이 이어짐', () => {
    expect(hangDrop(1.87, 1.5, 5)).toBeCloseTo(0.37, 10);
    expect(hangDrop(1.87, 1.87, 5)).toBe(0);
    expect(hangDrop(1.87, Infinity, 5)).toBe(0); // 떨어지는 건물이 없음
  });
});
