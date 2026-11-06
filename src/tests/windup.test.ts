import { describe, expect, it } from 'vitest';
import { BattleSim, type BattleEvent } from '../core/battle';
import { makeConfig } from './helpers';

/** M5 점프 도움닫기 (I-19 · I-20 · H-34) — core 규칙 · 꺼진 채 먼저 (windup_s 0 = M4 그대로) */
const on = (s = 0.5, patch?: Parameters<typeof makeConfig>[0]) =>
  makeConfig((c) => {
    c.battle.jump.windup_s = s;
    patch?.(c);
  });
const step = (sim: BattleSim, seconds: number, onEach?: (ev: BattleEvent[]) => void) => {
  const all: BattleEvent[] = [];
  for (let i = 0; i < Math.round(seconds * 120); i++) {
    sim.update(1 / 120);
    const ev = sim.drainEvents();
    all.push(...ev);
    onEach?.(ev);
  }
  return all;
};
/** 건물이 떨어지기 시작한 시각 · 첫 점프 시각 */
const firstJump = (sim: BattleSim) => {
  let spawnAt = -1;
  let jumpAt = -1;
  step(sim, 10, (ev) => {
    for (const e of ev) {
      if (e.type === 'spawn' && spawnAt < 0) spawnAt = sim.time;
      if (e.type === 'jump' && jumpAt < 0) jumpAt = sim.time;
    }
  });
  return { spawnAt, jumpAt };
};

describe('M5 도움닫기', () => {
  it('windup_s 0 = 지면 대기 ground_delay_s 그대로 · windupStart 없음', () => {
    const sim = new BattleSim(makeConfig());
    const { spawnAt, jumpAt } = firstJump(sim);
    expect(jumpAt - spawnAt).toBeCloseTo(sim.cfg.battle.jump.ground_delay_s, 1);
    const sim2 = new BattleSim(makeConfig());
    expect(step(sim2, 10).some((e) => e.type === 'windupStart')).toBe(false);
  });

  it('켜면 건물이 떨어지기 시작한 뒤 windup_s(0.5초)에 자동 점프 · windupStart 1번 · 첫 점프에도', () => {
    const sim = new BattleSim(on(0.5));
    const { spawnAt, jumpAt } = firstJump(sim);
    expect(jumpAt - spawnAt).toBeCloseTo(0.5, 1);
    const sim2 = new BattleSim(on(0.5));
    const ev = step(sim2, 0.6 + 0.6); // spawn_delay 0.6 + 도움닫기 0.5 + 여유
    expect(ev.filter((e) => e.type === 'windupStart')).toHaveLength(1);
  });

  it('도움닫기 중 남은 시간 = windupLeft (줄어듦)', () => {
    const sim = new BattleSim(on(0.5));
    step(sim, 0.6 + 0.2);
    expect(sim.ant.winding).toBe(true);
    expect(sim.ant.windupLeft).toBeGreaterThan(0.25);
    expect(sim.ant.windupLeft).toBeLessThan(0.35);
  });

  it('도움닫기 중 탭 = 남은 도움닫기를 건너뛰고 바로 강점프 (skip — I-20) · 다시 탭하면 무시 (1회)', () => {
    const sim = new BattleSim(on(0.5));
    step(sim, 0.6 + 0.1);
    expect(sim.ant.winding).toBe(true);
    expect(sim.tapStrongJump()).toBe(true);
    expect(sim.ant.phase).toBe('rise');
    expect(sim.ant.jumpKind).toBe('strong');
    expect(sim.ant.winding).toBe(false);
    expect(sim.tapStrongJump()).toBe(false);
    expect(sim.drainEvents().filter((e) => e.type === 'jump')).toHaveLength(1);
  });

  it('도움닫기 중 건물이 내려와 깔리면 → 피격 · 도움닫기 취소 (점프 없음)', () => {
    // 건물이 바로 위에서 빨리 떨어짐 → 0.5초 도움닫기가 끝나기 전에 착지
    const sim = new BattleSim(on(0.5, (c) => { c.battle.building.spawn_bottom_ratio = 0.12; c.buildings.rows.forEach((b) => (b.fall_speed = 0.5)); }));
    const ev = step(sim, 0.6 + 0.3);
    expect(ev.some((e) => e.type === 'land')).toBe(true);
    expect(ev.some((e) => e.type === 'jump')).toBe(false);
    expect(sim.ant.winding).toBe(false);
  });

  it('건물이 없을 때 탭 = 지금처럼 바로 강점프 (도움닫기 아님)', () => {
    const sim = new BattleSim(on(0.5));
    expect(sim.building).toBeNull();
    expect(sim.tapStrongJump()).toBe(true);
    expect(sim.ant.jumpKind).toBe('strong');
  });

  it('도움닫기는 강화 대상 아님 — 점프력 · 이동속도 Lv을 올려도 길이 그대로', () => {
    const sim = new BattleSim(on(0.5), 1, { stage: 1, autoAdvance: true, debris: 0, levels: { jump_power: 7, move_speed: 6 } });
    const { spawnAt, jumpAt } = firstJump(sim);
    expect(jumpAt - spawnAt).toBeCloseTo(0.5, 1);
  });
});
