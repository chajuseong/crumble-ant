import { describe, expect, it } from 'vitest';
import { BattleSim, type BattleEvent } from '../core/battle';
import { MOTION, strikeDuration } from '../view/antMotion';
import { FX } from '../view/fx';
import { hitSoundTurn, lightFx, nextSpeed, sanitizeSpeed, SPEED_LEVELS } from '../view/speed';
import { makeConfig } from './helpers';

/** M3-E 배속 (I-17 · H-28) — core는 dt만 받음 · 배속 값은 view */
describe('M3-E 배속 단계', () => {
  it('×1 → ×1.5 → ×2 → ×3 → ×1 (game_config speed.levels)', () => {
    expect(SPEED_LEVELS).toEqual([1, 1.5, 2, 3]);
    const seq = [1];
    for (let i = 0; i < 4; i++) seq.push(nextSpeed(seq[seq.length - 1]!));
    expect(seq).toEqual([1, 1.5, 2, 3, 1]);
  });
  it('저장 값 정리: 목록에 없으면 ×1', () => {
    expect(sanitizeSpeed('2')).toBe(2);
    expect(sanitizeSpeed('5')).toBe(1);
    expect(sanitizeSpeed(null)).toBe(1);
    expect(nextSpeed(7)).toBe(1);
  });
});

describe('M3-E 같은 게임 시간 = 같은 결과 (core 결정성)', () => {
  /** view처럼 벽시계 1/60초 × 배속을 넘김 → 게임 시간 seconds까지 */
  const run = (speed: number, seconds: number) => {
    const sim = new BattleSim(makeConfig(), 1);
    const events: BattleEvent[] = [];
    for (let i = 0, n = Math.round((seconds * 60) / speed); i < n; i++) {
      sim.update((1 / 60) * speed);
      events.push(...sim.drainEvents());
    }
    return { sim, events };
  };
  /** 누적 오차로 고정 스텝 하나가 다음 프레임으로 밀릴 수 있어서, 같은 스텝 수까지 맞춘 뒤 비교 */
  const steps = (sim: BattleSim) => Math.round(sim.time * 120);
  const catchUp = (r: ReturnType<typeof run>, target: number) => {
    while (steps(r.sim) < target) {
      r.sim.update(1 / 120);
      r.events.push(...r.sim.drainEvents());
    }
  };
  it.each([1.5, 2, 3])('×%s로 30초 = ×1로 30초 — 상태 · 이벤트가 그대로 같음', (speed) => {
    const a = run(1, 30);
    const b = run(speed, 30);
    const target = Math.max(steps(a.sim), steps(b.sim));
    catchUp(a, target);
    catchUp(b, target);
    expect(steps(a.sim)).toBe(steps(b.sim));
    expect(b.sim.ant).toEqual(a.sim.ant);
    expect(b.sim.building).toEqual(a.sim.building);
    expect(b.sim.stage).toEqual(a.sim.stage);
    expect(b.sim.totalDestroyed).toBe(a.sim.totalDestroyed);
    expect(b.events).toEqual(a.events);
    expect(a.sim.totalDestroyed).toBeGreaterThan(0);
  });
});

describe('M3-E ×2 이상 가벼운 연출 · 공격 모션 최소 길이', () => {
  it('배속 ≥ speed_fx.light_from(2)이면 가벼운 연출', () => {
    expect([1, 1.5, 2, 3].map((s) => lightFx(s))).toEqual([false, false, true, true]);
  });
  it('가벼운 연출: 일반 타격음은 hit_sfx_every(3)타에 1번 (1 · 4 · 7번째) · ×1은 매번', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map((c) => hitSoundTurn(c, 3))).toEqual([true, false, false, true, false, false, true]);
    expect([1, 2, 3].map((c) => hitSoundTurn(c, 1))).toEqual([true, true, true]);
    expect(FX.speed_fx.hit_sfx_every).toBe(3);
  });
  it('공격 모션 = max(간격 × span, min_wall_ms × 배속) — ×1에서는 그대로, ×3 · 공속 최대에서도 벽시계 33ms', () => {
    expect(strikeDuration(MOTION, 0.12, 1)).toBeCloseTo(0.108, 9);
    const fast = 0.12 / 1.8;
    expect(strikeDuration(MOTION, fast, 1)).toBeCloseTo(fast * MOTION.strike.span, 9);
    const d3 = strikeDuration(MOTION, fast, 3); // 게임 시간
    expect(d3 / 3).toBeCloseTo(MOTION.strike.min_wall_ms / 1000, 9); // 벽시계 33ms
    expect(d3).toBeLessThan(fast * 4); // 같은 팔은 4타마다 — 안 겹침
  });
});
