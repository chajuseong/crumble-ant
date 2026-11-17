import { describe, expect, it } from 'vitest';
import { type BattleEvent, type BuildingState, BattleSim } from '../core/battle';
import type { GameConfig, StageRow } from '../core/config';
import { makeConfig } from './helpers';

/** M8-W 줄줄이 웨이브 (I-35 · H-88 — docs/dev.md §3-2 규칙 · §4) */
type Ev<T extends BattleEvent['type']> = Extract<BattleEvent, { type: T }>;
const of = <T extends BattleEvent['type']>(ev: BattleEvent[], t: T) => ev.filter((e) => e.type === t) as Ev<T>[];
type Inner = {
  strike(b: BuildingState, s: 'auto'): void;
  landBuilding(b: BuildingState): void;
  spawnBuilding(): void;
  defend(b: BuildingState, auto: boolean): void;
  startStage(stage: number, reason: 'restart'): void;
};
const inner = (sim: BattleSim) => sim as unknown as Inner;

/** 스테이지 1 = 웨이브 칸 · 풀 = 지금 건물 1층 고정 · 과녁 · 링 · 자동 받치기 없이 (판정만) */
const cfgWave = (wave: Partial<StageRow>, extra?: (c: GameConfig) => void) =>
  makeConfig((c) => {
    Object.assign(c.stages.rows[0]!, { buildings_to_clear: 20, wave_min: null, wave_max: null, wave_gap: 0, wave_rest_s: null, ...wave }); // 시트 값과 상관없이
    c.stages.pool = c.stages.rows.map((r) => ({ stage: r.stage, building_id: r.building_id, weight: 1, floors_min: 1, floors_max: 1 }));
    c.battle.wave = { weight_coef: 0, chain_bonus_pct: 10, chain_bonus_cap_pct: 50, land_ends_wave: true };
    c.battle.targets!.count_max = 0;
    c.battle.strong_jump.mode = 'tap';
    c.battle.defend!.auto_pct = 0;
    c.battle.ant.max_hp = 1e9;
    extra?.(c);
  });
const spawnNow = (sim: BattleSim) => {
  sim.building = null;
  inner(sim).spawnBuilding();
  return sim.drainEvents();
};
/** 맨 아래 건물을 한 번에 깸 (데미지 = HP) */
const kill = (sim: BattleSim) => {
  const b = sim.building!;
  sim.stats.armDamage = sim.stats.armDamage.map(() => b.hp);
  inner(sim).strike(b, 'auto');
  return sim.drainEvents();
};

describe('M8-W 줄 (H-88 ①)', () => {
  it('웨이브 3채 = 맨 아래 + 위 2채 · 자리 = 아래 꼭대기 (밑면 + 건물 키) + gap · spawn 3번 → waveStart', () => {
    const sim = new BattleSim(cfgWave({ wave_min: 3, wave_max: 3, wave_gap: 0.05 }));
    const ev = spawnNow(sim);
    const b = sim.building!;
    const step = sim.cfg.battle.building.height_ratio + 0.05;
    expect(sim.stack.map((u) => u.y)).toEqual([Math.round((b.y + step) * 1e6) / 1e6, Math.round((Math.round((b.y + step) * 1e6) / 1e6 + step) * 1e6) / 1e6]);
    expect(ev.map((e) => e.type).filter((t) => t === 'spawn' || t === 'waveStart')).toEqual(['spawn', 'spawn', 'spawn', 'waveStart']);
    expect(of(ev, 'waveStart')[0]).toEqual({ type: 'waveStart', count: 3, ids: [b.id, sim.stack[0]!.id, sim.stack[1]!.id] });
    sim.update(0.5); // 맨 아래가 떨어지면 위 건물도 같이 (자리 그대로)
    expect(sim.stack[0]!.y).toBeCloseTo(sim.building!.y + step, 5);
  });

  it('맨 아래 깨짐 → 바로 다음이 맨 아래 (생성 대기 없음) · 마지막 = waveEnd cleared', () => {
    const sim = new BattleSim(cfgWave({ wave_min: 2, wave_max: 2 }));
    spawnNow(sim);
    const second = sim.stack[0]!;
    const ev1 = kill(sim);
    expect(sim.building).toBe(second);
    expect(sim.stack).toHaveLength(0);
    expect(of(ev1, 'waveEnd')).toHaveLength(0);
    const ev2 = kill(sim);
    expect(of(ev2, 'waveEnd')).toEqual([{ type: 'waveEnd', reason: 'cleared', vanished: [] }]);
    expect(sim.building).toBeNull();
  });

  it('착지 = 그 웨이브 끝 (land_ends_wave) — 위 건물 사라짐 · 깬 수 아님 · waveEnd landed', () => {
    const sim = new BattleSim(cfgWave({ wave_min: 3, wave_max: 3 }));
    spawnNow(sim);
    const ids = sim.stack.map((u) => u.id);
    const before = sim.stage.destroyed;
    inner(sim).landBuilding(sim.building!);
    const ev = sim.drainEvents();
    expect(of(ev, 'waveEnd')).toEqual([{ type: 'waveEnd', reason: 'landed', vanished: ids }]);
    expect(sim.stack).toHaveLength(0);
    expect(sim.stage.destroyed).toBe(before);
  });

  it('land_ends_wave 끔 = 줄이 이어짐 (머문 뒤 다음이 맨 아래) · 착지로 연쇄 끊김', () => {
    const sim = new BattleSim(cfgWave({ wave_min: 3, wave_max: 3 }, (c) => (c.battle.wave!.land_ends_wave = false)));
    spawnNow(sim);
    kill(sim); // 연쇄 1
    const next = sim.stack[0]!;
    inner(sim).landBuilding(sim.building!);
    expect(of(sim.drainEvents(), 'waveEnd')).toHaveLength(0);
    for (let t = 0; t < sim.cfg.battle.building.landed_linger_s + 0.05; t += 1 / 120) sim.update(1 / 120);
    sim.drainEvents();
    expect(sim.building).toBe(next);
    expect(of(kill(sim), 'destroy')[0]).toMatchObject({ chain: 1, bonus: 0 }); // 착지 뒤 = 1부터
  });

  it('스테이지 시작 (후퇴 · 재시작 · 클리어) = 줄 비움', () => {
    const sim = new BattleSim(cfgWave({ wave_min: 3, wave_max: 3 }));
    spawnNow(sim);
    inner(sim).startStage(1, 'restart');
    expect(sim.stack).toHaveLength(0);
    expect(sim.building).toBeNull();
  });
});

describe('M8-W 연쇄 보너스 (H-88 ③)', () => {
  it('연쇄 = 웨이브 안에서 착지 없이 연달아 · 보너스 = floor(보상 × min(상한, % × (연쇄 − 1)) ÷ 100) · 잔해에 합쳐짐', () => {
    const sim = new BattleSim(cfgWave({ wave_min: 8, wave_max: 8 }, (c) => (c.economy.carry_ants = 1)));
    spawnNow(sim);
    const got: { chain: number; bonus: number; reward: number; base: number }[] = [];
    for (let i = 0; i < 8; i++) {
      const base = sim.building!.debrisReward;
      const d = of(kill(sim), 'destroy')[0]!;
      got.push({ chain: d.chain, bonus: d.bonus, reward: d.debrisReward, base });
    }
    expect(got.map((g) => g.chain)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const g of got) {
      const pct = Math.min(50, 10 * (g.chain - 1));
      expect(g.bonus).toBe(Math.floor((g.base * pct) / 100));
      expect(g.reward).toBe(g.base + g.bonus);
    }
    expect(sim.carrying.reduce((t, c) => t + c.amount, 0)).toBe(got.reduce((t, g) => t + g.reward, 0)); // 운반 = 보너스 포함
  });

  it('보너스 0이면 잔해 그대로 (연쇄 수만 셈)', () => {
    const sim = new BattleSim(cfgWave({ wave_min: 2, wave_max: 2 }, (c) => (c.battle.wave!.chain_bonus_pct = 0)));
    spawnNow(sim);
    kill(sim);
    const base = sim.building!.debrisReward;
    expect(of(kill(sim), 'destroy')[0]).toMatchObject({ chain: 2, bonus: 0, debrisReward: base });
  });
});

describe('M8-W 받치기 무게 합침 (H-88 ②)', () => {
  it('lift = 힘 ÷ (맨 아래 무게 + 계수 × 위 무게 합) — 계수 0이면 지금 그대로 · 위 건물도 같이 올라감', () => {
    const liftWith = (coef: number) => {
      const sim = new BattleSim(cfgWave({ wave_min: 3, wave_max: 3 }, (c) => {
        c.battle.wave!.weight_coef = coef;
        c.battle.defend!.lift_max_y = 100;
      }));
      spawnNow(sim);
      sim.building!.y = 0.3;
      sim.update(0); // 줄 자리 맞춤
      const b = sim.building!;
      const above = sim.stack.reduce((t, u) => t + u.weight, 0);
      inner(sim).defend(b, false);
      const lift = of(sim.drainEvents(), 'defend')[0]!.lift;
      return { lift, w: b.weight, above, gapOk: Math.abs(sim.stack[0]!.y - (b.y + sim.cfg.battle.building.height_ratio)) < 1e-6 };
    };
    const off = liftWith(0);
    const on = liftWith(0.25);
    expect(on.lift).toBeCloseTo((off.lift * off.w) / (on.w + 0.25 * on.above), 5);
    expect(on.lift).toBeLessThan(off.lift);
    expect(on.gapOk).toBe(true);
  });
});

describe('M8-W 웨이브 크기 · 난수 (H-88 ⑦)', () => {
  it('wave_min ~ wave_max 안 · 같은 시드 = 같은 크기 순서 · 남은 깰 수로 자름', () => {
    const sizes = () => {
      const sim = new BattleSim(cfgWave({ wave_min: 2, wave_max: 4 }));
      return Array.from({ length: 60 }, () => {
        sim.stage.destroyed = 0;
        spawnNow(sim);
        return 1 + sim.stack.length;
      });
    };
    const a = sizes();
    expect(a).toEqual(sizes());
    expect(new Set(a)).toEqual(new Set([2, 3, 4]));
    const sim = new BattleSim(cfgWave({ wave_min: 4, wave_max: 4, buildings_to_clear: 5 }));
    sim.stage.destroyed = 3;
    spawnNow(sim);
    expect(1 + sim.stack.length).toBe(2);
  });

  it('꺼진 채 (칸 빈칸 · 무게 · 보너스 0) = 칸 · 키가 없을 때와 이벤트 · 시각 같음', () => {
    const run = (c: GameConfig) => {
      const sim = new BattleSim(c);
      const out: BattleEvent[] = [];
      for (let i = 0; i < 120 * 90; i++) {
        sim.update(1 / 120);
        out.push(...sim.drainEvents());
      }
      return JSON.stringify(out) + sim.time;
    };
    const base = (c: GameConfig) => {
      c.battle.strong_jump.mode = 'timing';
      for (const r of c.stages.rows) Object.assign(r, { wave_min: null, wave_max: null, wave_gap: null, wave_rest_s: null });
      c.battle.wave = { weight_coef: 0, chain_bonus_pct: 0, chain_bonus_cap_pct: 50, land_ends_wave: true };
    };
    const none = (c: GameConfig) => {
      base(c);
      for (const r of c.stages.rows) {
        delete r.wave_min;
        delete r.wave_max;
        delete r.wave_gap;
        delete r.wave_rest_s;
      }
      delete c.battle.wave;
    };
    const a = run(makeConfig(base));
    expect(a).toBe(run(makeConfig(none)));
    expect(a).not.toContain('waveStart');
  });
});
