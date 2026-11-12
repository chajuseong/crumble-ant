import { describe, expect, it } from 'vitest';
import { type BattleEvent, type BuildingState, BattleSim } from '../core/battle';
import type { GameConfig, StagePoolRow } from '../core/config';
import { makeConfig } from './helpers';

/** M8 층 건물 + 섞어 나오기 (I-25 · H-62 — docs/dev.md §3-2b · §4) */
type Ev<T extends BattleEvent['type']> = Extract<BattleEvent, { type: T }>;
const of = <T extends BattleEvent['type']>(ev: BattleEvent[], t: T) => ev.filter((e) => e.type === t) as Ev<T>[];
/** 테스트용 직접 호출 (판정 규칙만 보려고 — 매달림 · 시간 없이) */
type Inner = { strike(b: BuildingState, s: 'auto'): void; landBuilding(b: BuildingState): void; spawnBuilding(): void; nextSpawnDelay(): number };
const inner = (sim: BattleSim) => sim as unknown as Inner;

/** 스테이지 1 풀만 바꿈 · 과녁 · 링 · 받치기 없이 (판정만) */
const cfgWith = (pool: Omit<StagePoolRow, 'stage'>[], extra?: (c: GameConfig) => void) =>
  makeConfig((c) => {
    c.stages.pool = [...(c.stages.pool ?? []).filter((r) => r.stage !== 1), ...pool.map((r) => ({ stage: 1, ...r }))].sort(
      (a, b) => a.stage - b.stage || (a.building_id < b.building_id ? -1 : 1),
    );
    c.battle.targets!.count_max = 0;
    c.battle.strong_jump.mode = 'tap';
    c.battle.defend!.auto_pct = 0;
    c.battle.ant.max_hp = 1e9;
    extra?.(c);
  });
const hut = (c: GameConfig) => c.buildings.rows.find((r) => r.building_id === 'bld_hut')!;
const spawnNow = (sim: BattleSim) => {
  sim.building = null;
  inner(sim).spawnBuilding();
  return { b: sim.building!, ev: sim.drainEvents() };
};

describe('M8 층 건물 (H-62 ①)', () => {
  it('층 HP = floor(HP ÷ N) · 나머지 = 1층 (합 = HP) · spawn 이벤트에 floors · floorHp', () => {
    const sim = new BattleSim(cfgWith([{ building_id: 'bld_hut', weight: 1, floors_min: 3, floors_max: 3 }], (c) => (hut(c).hp = 61)));
    const { b, ev } = spawnNow(sim);
    expect(b.floorHp).toEqual([21, 20, 20]);
    expect(b.hp).toBe(61);
    expect(of(ev, 'spawn')[0]).toMatchObject({ hp: 61, floors: 3, floorHp: [21, 20, 20] });
  });

  it('타격 = 맨 아래층만 · 넘친 데미지 버림 · 층 0 = floorBreak (위층 그대로) · 지붕 0 = destroy', () => {
    const sim = new BattleSim(cfgWith([{ building_id: 'bld_hut', weight: 1, floors_min: 3, floors_max: 3 }], (c) => {
      hut(c).hp = 75; // 25 · 25 · 25
      c.battle.arms = c.battle.arms.map((a) => ({ ...a, damage: 10 }));
    }));
    const { b } = spawnNow(sim);
    const hit = () => {
      inner(sim).strike(b, 'auto');
      return sim.drainEvents();
    };
    hit();
    hit();
    expect(b.floorHp).toEqual([5, 25, 25]);
    const ev = hit(); // 10 중 5만 들어감 (나머지 5 버림)
    expect(of(ev, 'strike')[0]).toMatchObject({ hpLeft: 50, floorHpLeft: 0 });
    expect(of(ev, 'floorBreak')).toEqual([{ type: 'floorBreak', buildingId: b.id, floor: 1, floorsLeft: 2, hpLeft: 50 }]);
    expect(b.floorHp).toEqual([25, 25]);
    for (let i = 0; i < 3; i++) hit();
    expect(b.floorHp).toEqual([25]); // 2층 깨짐
    const last: BattleEvent[] = [];
    for (let i = 0; i < 3; i++) last.push(...hit());
    expect(of(last, 'floorBreak')).toHaveLength(0); // 지붕은 floorBreak 아님
    expect(of(last, 'destroy')).toHaveLength(1);
  });

  it('착지 데미지 = ceil(남은 층 HP 합 × 계수)', () => {
    const sim = new BattleSim(cfgWith([{ building_id: 'bld_hut', weight: 1, floors_min: 2, floors_max: 2 }], (c) => {
      hut(c).hp = 81; // 41 · 40
      c.battle.arms = c.battle.arms.map((a) => ({ ...a, damage: 10 }));
    }));
    const { b } = spawnNow(sim);
    for (let i = 0; i < 5; i++) inner(sim).strike(b, 'auto'); // 1층 41 → 깨짐 (넘친 9 버림)
    sim.drainEvents();
    expect([b.hp, b.floorHp]).toEqual([40, [40]]);
    inner(sim).landBuilding(b);
    expect(of(sim.drainEvents(), 'land')[0]!.damage).toBe(Math.ceil(40 * sim.cfg.battle.landing_damage_coeff));
  });

  it('1층 = 지금 그대로 (넘쳐도 HP 0에서 파괴)', () => {
    const sim = new BattleSim(cfgWith([{ building_id: 'bld_hut', weight: 1, floors_min: 1, floors_max: 1 }], (c) => (hut(c).hp = 15)));
    const { b } = spawnNow(sim);
    inner(sim).strike(b, 'auto');
    inner(sim).strike(b, 'auto');
    const ev = sim.drainEvents();
    expect(of(ev, 'floorBreak')).toHaveLength(0);
    expect(of(ev, 'destroy')).toHaveLength(1);
  });
});

describe('M8 섞어 나오기 · 간격 (H-62 ② ④)', () => {
  it('비중대로 섞임 · 층수 = 범위 안 · 같은 시드 = 같은 순서', () => {
    const pool = [
      { building_id: 'bld_hut', weight: 1, floors_min: 1, floors_max: 3 },
      { building_id: 'bld_house', weight: 3, floors_min: 2, floors_max: 2 },
    ];
    const seq = () => {
      const sim = new BattleSim(cfgWith(pool));
      return Array.from({ length: 400 }, () => {
        const { b } = spawnNow(sim);
        return `${b.buildingId}:${b.floors}`;
      });
    };
    const a = seq();
    expect(a).toEqual(seq());
    const house = a.filter((x) => x.startsWith('bld_house')).length / a.length;
    expect(house).toBeGreaterThan(0.65);
    expect(house).toBeLessThan(0.85);
    expect(new Set(a.filter((x) => x.startsWith('bld_hut')).map((x) => x.split(':')[1]))).toEqual(new Set(['1', '2', '3']));
    expect(new Set(a.filter((x) => x.startsWith('bld_house')))).toEqual(new Set(['bld_house:2']));
  });

  it('고를 게 없으면 안 뽑음 (풀 1행 · 층 고정 · 흔들기 0 · 연달아 0) → 풀이 없을 때와 이벤트 · 시각 같음', () => {
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
      c.battle.strong_jump.mode = 'timing'; // 링 기회 난수가 섞여 돌게
      c.battle.building.spawn_jitter_ratio = 0;
      c.battle.building.double_pct = 0;
    };
    expect(run(makeConfig(base))).toBe(run(makeConfig((c) => { base(c); delete c.stages.pool; })));
  });

  it('흔들기 = spawn_delay_s × (1 ± j) 안 · 0이면 그대로 · 연달아 100% = double_delay_s', () => {
    const d = makeConfig().battle.building.spawn_delay_s;
    const jit = new BattleSim(makeConfig((c) => { c.battle.building.spawn_jitter_ratio = 0.4; }));
    const ds = Array.from({ length: 200 }, () => inner(jit).nextSpawnDelay());
    expect(Math.min(...ds)).toBeGreaterThanOrEqual(d * 0.6 - 1e-6);
    expect(Math.max(...ds)).toBeLessThanOrEqual(d * 1.4 + 1e-6);
    expect(new Set(ds).size).toBeGreaterThan(50);
    const off = new BattleSim(makeConfig((c) => { c.battle.building.spawn_jitter_ratio = 0; c.battle.building.double_pct = 0; }));
    expect(inner(off).nextSpawnDelay()).toBe(d);
    const dbl = new BattleSim(makeConfig((c) => { c.battle.building.double_pct = 100; c.battle.building.double_delay_s = 0.15; }));
    expect(inner(dbl).nextSpawnDelay()).toBe(0.15);
  });
});
