import { describe, expect, it } from 'vitest';
import { type BattleEvent, BattleSim } from '../core/battle';
import type { GameConfig, UpgradeRow } from '../core/config';
import { makeSave, parseSave } from '../core/save';
import { makeConfig } from './helpers';

/** M7-E 체력 + 받치기 · 탭 길 · 운반 개미마다 돈 · 치트 (I-27 · I-28 · H-66 · H-67 · H-69 · I-30 — docs/dev.md §3-3 · §4) */
type Patch = (c: GameConfig) => void;
type Ev<T extends BattleEvent['type']> = Extract<BattleEvent, { type: T }>;

const step = (sim: BattleSim, seconds: number) => {
  const all: BattleEvent[] = [];
  for (let i = 0; i < Math.round(seconds * 120); i++) {
    sim.update(1 / 120);
    all.push(...sim.drainEvents());
  }
  return all;
};
const until = (sim: BattleSim, pred: (ev: BattleEvent[]) => boolean, maxS = 30) => {
  const all: BattleEvent[] = [];
  for (let i = 0; i < maxS * 120; i++) {
    sim.update(1 / 120);
    const ev = sim.drainEvents();
    all.push(...ev);
    if (pred(ev)) return all;
  }
  throw new Error('until: 조건 미충족');
};
const of = <T extends BattleEvent['type']>(ev: BattleEvent[], t: T) => ev.filter((e) => e.type === t) as Ev<T>[];
const spawnOf = (ev: BattleEvent[]) => of(ev, 'targetsSpawn')[0];

/** 받치기 켬 (C 모양) — 과녁만 보게 강점프 tap · 건물 안 부서짐 · 체력 무한에 가깝게 */
const defendCfg = (extra?: Patch) =>
  makeConfig((c) => {
    c.battle.strong_jump.mode = 'tap';
    c.battle.ant.max_hp = 1e9;
    c.buildings.rows.forEach((r) => (r.hp = 100000));
    c.battle.targets!.action = 'defend';
    c.battle.targets!.tap_route = 'state';
    extra?.(c);
  });
const d0 = makeConfig().battle.defend!;

/** 강화 행 (C에서 시트에 들어갈 모양 — 테스트에서만 넣음) */
const row = (stat: UpgradeRow['stat'], over: Partial<UpgradeRow> = {}): UpgradeRow => ({
  upgrade_id: stat, name: stat, stat, per_level_pct: 0, per_level_add: 0, max_level: 10, cost_base: 1, cost_growth_pct: 100, sort: 10 + ['max_hp', 'push_power', 'auto_defend'].indexOf(stat), ...over,
});

/** 첫 과녁이 나오고 개미가 닿을 때까지 → 과녁 탭 */
const hitAtContact = (sim: BattleSim) => {
  const s = spawnOf(until(sim, (e) => e.some((x) => x.type === 'targetsSpawn')))!;
  until(sim, () => sim.ant.contact);
  return s;
};

describe('M7-E 꺼진 채 = 지금 그대로 (시트 값: action strike · auto 0 · 운반 1)', () => {
  it('과녁 탭 = 1타 · 받치기 이벤트 없음 · deposit = index 0 · count 1', () => {
    const sim = new BattleSim(makeConfig((c) => { c.battle.strong_jump.mode = 'tap'; c.battle.ant.max_hp = 1e9; }));
    const s = hitAtContact(sim);
    sim.tapBattle(s.targets[0]!.x, s.targets[0]!.y);
    expect(sim.drainEvents().map((e) => e.type).slice(0, 2)).toEqual(['targetHit', 'strike']);
    const ev = step(sim, 60);
    expect(of(ev, 'defend')).toHaveLength(0);
    const dep = of(ev, 'deposit');
    expect(dep.length).toBeGreaterThan(0);
    expect(dep.every((e) => e.index === 0 && e.count === 1)).toBe(true);
  });

  it('auto_pct 0 = 난수 안 뽑음 → battle.defend가 없을 때와 이벤트 · 시각 같음 (링 기회 · 과녁 난수 그대로)', () => {
    const run = (c: GameConfig) => {
      const sim = new BattleSim(c);
      return JSON.stringify(step(sim, 120)) + sim.time;
    };
    const withKeys = run(makeConfig());
    const without = run(makeConfig((c) => { delete c.battle.defend; delete c.battle.targets!.action; delete c.battle.targets!.tap_route; }));
    expect(withKeys).toBe(without);
  });
});

describe('M7-E 받치기 (I-28)', () => {
  it('lift = push_power ÷ weight × (1 − decay)^n · 건물 올라감 · 낙하 멈춤 push_s · 개미 같이 올라감', () => {
    const sim = new BattleSim(defendCfg());
    const s = hitAtContact(sim);
    const b = sim.building!;
    const y0 = b.y;
    sim.tapBattle(s.targets[0]!.x, s.targets[0]!.y);
    const ev = sim.drainEvents();
    expect(ev.map((e) => e.type).slice(0, 3)).toEqual(['targetHit', 'defend', 'targetsSpawn']);
    expect(of(ev, 'strike')).toHaveLength(0); // PERFECT 전에는 받치기만 (1타 없음)
    const d = of(ev, 'defend')[0]!;
    expect(d).toMatchObject({ auto: false, n: 1, buildingId: b.id });
    expect(d.lift).toBeCloseTo(d0.push_power, 6);
    expect(b.y).toBeCloseTo(y0 + d0.push_power, 6);
    expect(b.pauseLeft).toBeCloseTo(d0.push_s, 9);
    expect(sim.ant.y).toBeCloseTo(b.y - sim.cfg.battle.ant.height_ratio, 9);
    expect(sim.ant.contact).toBe(true);
    // 멈춤 동안 밑면 그대로 → 끝나면 다시 떨어짐
    const yHold = b.y;
    step(sim, d0.push_s * 0.5);
    expect(b.y).toBeCloseTo(yHold, 9);
    step(sim, d0.push_s);
    expect(b.y).toBeLessThan(yHold);
  });

  it('연속 감쇠 · 건물당 max_per_building (넘으면 이벤트 없음) · 무게 2 = 절반', () => {
    const sim = new BattleSim(defendCfg((c) => { c.battle.targets!.count_max = 5; c.battle.targets!.chain_life_s = 5; }));
    let s = hitAtContact(sim);
    const lifts: number[] = [];
    for (let k = 0; k < 5; k++) {
      sim.tapBattle(s.targets[0]!.x, s.targets[0]!.y);
      const ev = sim.drainEvents();
      lifts.push(...of(ev, 'defend').map((e) => e.lift));
      const nx = spawnOf(ev);
      if (!nx) break;
      s = nx;
    }
    const k = 1 - d0.decay_pct / 100;
    expect(lifts).toHaveLength(d0.max_per_building);
    lifts.forEach((l, i) => expect(l).toBeCloseTo(d0.push_power * k ** i, 6));

    const heavy = new BattleSim(defendCfg((c) => c.buildings.rows.forEach((r) => (r.weight = 2))));
    const h = hitAtContact(heavy);
    heavy.tapBattle(h.targets[0]!.x, h.targets[0]!.y);
    expect(of(heavy.drainEvents(), 'defend')[0]!.lift).toBeCloseTo(d0.push_power / 2, 6);
  });

  it('lift_max_y 하나로 자름 (밑면이 이보다 안 올라감 · 내려가지도 않음)', () => {
    const sim = new BattleSim(defendCfg((c) => { c.battle.defend!.push_power = 5; }));
    const s = hitAtContact(sim);
    sim.tapBattle(s.targets[0]!.x, s.targets[0]!.y);
    expect(sim.building!.y).toBeCloseTo(d0.lift_max_y, 9);
    expect(sim.ant.y).toBeCloseTo(d0.lift_max_y - sim.cfg.battle.ant.height_ratio, 9);
  });

  it('닿기 전에 맞힘 = 닿는 순간 받치기 (손 · 건물이 같은 순간)', () => {
    const sim = new BattleSim(defendCfg());
    const s = spawnOf(until(sim, (e) => e.some((x) => x.type === 'targetsSpawn')))!;
    expect(sim.ant.contact).toBe(false);
    sim.tapBattle(s.targets[0]!.x, s.targets[0]!.y);
    expect(of(sim.drainEvents(), 'defend')).toHaveLength(0);
    const ev = until(sim, () => sim.ant.contact);
    expect(of(ev, 'defend')).toHaveLength(1);
    expect(sim.ant.y).toBeCloseTo(sim.building!.y - sim.cfg.battle.ant.height_ratio, 9);
  });

  it('닿기 전에 맞혔는데 끝내 못 닿고 정점 = 그 자리에서 받치기 (탭을 버리지 않음 · 개미는 안 따라 올라감)', () => {
    const sim = new BattleSim(defendCfg());
    const s = spawnOf(until(sim, (e) => e.some((x) => x.type === 'targetsSpawn')))!;
    sim.tapBattle(s.targets[0]!.x, s.targets[0]!.y);
    sim.drainEvents();
    const y0 = sim.building!.y;
    sim.ant.riseTimeLeft = 1e-6; // 다음 스텝에 정점 (닿기 전)
    const ev = step(sim, 1 / 120);
    expect(sim.ant.contact).toBe(false);
    expect(of(ev, 'defend')).toHaveLength(1);
    expect(sim.building!.y).toBeGreaterThan(y0);
  });

  it('과녁 자리 = 건물 밑면 − dy · 개미 가운데 ± dx (체인마다 좌우 번갈아 · 흔들기 안)', () => {
    const sim = new BattleSim(defendCfg());
    let s = hitAtContact(sim);
    const xs: number[] = [];
    for (let k = 0; k < 3; k++) {
      const t = s.targets[0]!;
      const b = sim.building!;
      expect(Math.abs(Math.abs(t.x - 0.5) - d0.target_dx_ratio)).toBeLessThanOrEqual(d0.target_jitter_ratio + 1e-4);
      if (k > 0) expect(Math.abs(t.y - (b.y - d0.target_dy_ratio))).toBeLessThanOrEqual(d0.target_jitter_ratio + 1e-4);
      xs.push(t.x);
      sim.tapBattle(t.x, t.y);
      const nx = spawnOf(sim.drainEvents());
      if (!nx) break;
      s = nx;
    }
    expect(Math.sign(xs[0]! - 0.5)).toBe(-Math.sign(xs[1]! - 0.5));
  });

  it('자동 받치기: auto_pct 100 = 매달림마다 auto 받치기 (힘 × auto_power_ratio) · 받치는 힘 강화 % 반영', () => {
    const sim = new BattleSim(defendCfg((c) => { c.battle.defend!.auto_pct = 100; c.upgrades.rows.push(row('push_power', { per_level_pct: 8 })); }), 1, { stage: 1, autoAdvance: true, debris: 0, levels: { push_power: 2 } });
    const ev = until(sim, (e) => e.some((x) => x.type === 'defend'));
    const d = of(ev, 'defend')[0]!;
    expect(d.auto).toBe(true);
    expect(d.lift).toBeCloseTo((d0.push_power * 116) / 100 * d0.auto_power_ratio, 6);
    expect(sim.ant.contact).toBe(true);
  });
});

describe('M7-E 탭 길 (H-69)', () => {
  it('state: 과녁 있으면 아래 절반 탭도 과녁 (빗나가면 체인 끝) · 없으면 위 = 무시 · 아래 = 링', () => {
    const cfg = defendCfg((c) => { c.battle.strong_jump.mode = 'timing'; });
    const sim = new BattleSim(cfg);
    until(sim, (e) => e.some((x) => x.type === 'targetsSpawn'));
    expect(sim.tapBattle(0.99, 0.02)).toBe('miss'); // 아래 끝 빈 곳 = 과녁 빗나감
    expect(sim.drainEvents().map((e) => e.type)).toEqual(['targetMiss', 'targetsEnd']);
    expect(sim.tapBattle(0.5, 0.9)).toBe('ignored'); // 과녁 없음 · 위 = 무시
    expect(sim.tapBattle(0.5, 0.1)).toBe('ignored'); // 과녁 없음 · 아래 = 링 (공중이라 무시)
    expect(sim.drainEvents()).toEqual([{ type: 'tapIgnored', reason: 'noChance' }, { type: 'tapIgnored', reason: 'airborne' }]);
  });

  it('zone (지금): 과녁이 있어도 아래 절반 탭 = 링 쪽 (과녁 그대로)', () => {
    const sim = new BattleSim(makeConfig((c) => { c.battle.ant.max_hp = 1e9; }));
    until(sim, (e) => e.some((x) => x.type === 'targetsSpawn'));
    expect(sim.tapBattle(0.99, 0.02)).toBe('ignored');
    expect(sim.targets).toHaveLength(1);
  });
});

describe('M7-E 체력 강화 (H-67)', () => {
  const hpCfg = () => makeConfig((c) => { c.upgrades.rows.push(row('max_hp', { per_level_add: 10, max_level: 7 })); });
  it('시작 = 시트 + Lv × add · 구매 = 늘어난 만큼 채움', () => {
    const base = makeConfig().battle.ant.max_hp;
    const sim = new BattleSim(hpCfg(), 1, { stage: 1, autoAdvance: true, debris: 10, levels: { max_hp: 2 } });
    expect([sim.ant.maxHp, sim.ant.hp]).toEqual([base + 20, base + 20]);
    sim.ant.hp = 5;
    expect(sim.buyUpgrade('max_hp')).toBe('ok');
    expect([sim.ant.maxHp, sim.ant.hp]).toEqual([base + 30, 15]);
  });

  it('기절 중 구매 = 최대만 (HP 0 그대로) → 다시 시작할 때 최대', () => {
    const base = makeConfig().battle.ant.max_hp;
    const sim = new BattleSim(hpCfg(), 1, { stage: 1, autoAdvance: true, debris: 10, levels: {} });
    sim.ant.hp = 0;
    sim.ant.phase = 'down';
    sim.ant.downTimer = 0.5;
    sim.buyUpgrade('max_hp');
    expect([sim.ant.maxHp, sim.ant.hp]).toEqual([base + 10, 0]);
    step(sim, 1);
    expect(sim.ant.hp).toBe(base + 10);
  });

  it('세이브 왕복: 새 강화 키 저장 · 없는 키 = Lv 0 (형식 v1 그대로)', () => {
    const c = hpCfg();
    const sim = new BattleSim(c, 1, { stage: 1, autoAdvance: true, debris: 0, levels: { max_hp: 3 } });
    const save = makeSave(sim);
    expect(save.v).toBe(1);
    expect(save.upgrades.max_hp).toBe(3);
    const old = parseSave({ v: 1, debris: 5, upgrades: { attack_power: 1 }, stage: 2, auto_advance: true }, c)!;
    expect(old.levels.max_hp).toBe(0);
  });
});

describe('M7-E 운반 개미마다 돈 (I-30)', () => {
  it('R을 K마리로 — floor · 나머지 = 마지막 · 합 = R · 도착 = 파괴 + delay + i × 간격', () => {
    const cfg = makeConfig((c) => {
      c.economy.carry_ants = 6;
      c.economy.carry_interval_s = 0.2;
      c.buildings.rows.forEach((r) => (r.debris_reward = 65));
    });
    const sim = new BattleSim(cfg);
    let tDestroy = -1;
    const all: (Ev<'deposit'> & { t: number })[] = [];
    for (let i = 0; i < 120 * 60 && all.length < 6; i++) {
      sim.update(1 / 120);
      for (const e of sim.drainEvents()) {
        if (e.type === 'destroy' && tDestroy < 0) tDestroy = sim.time;
        if (e.type === 'deposit') all.push({ ...e, t: sim.time });
      }
    }
    expect(all.map((e) => e.amount)).toEqual([10, 10, 10, 10, 10, 15]);
    expect(all.map((e) => [e.index, e.count])).toEqual([0, 1, 2, 3, 4, 5].map((i) => [i, 6]));
    all.forEach((e, i) => expect(e.t).toBeCloseTo(tDestroy + cfg.economy.carry_delay_s + i * 0.2, 1));
    expect(all[5]!.wallet).toBe(65);
  });
});

describe('M7-E 치트 (?cheat · [프로토만])', () => {
  it('자동 % · 힘 × · 무게 × · 체력 무한 · 잔해 + — 끄면 시트 값', () => {
    const sim = new BattleSim(defendCfg((c) => { c.battle.ant.max_hp = 30; }));
    expect(sim.autoDefendPct).toBe(0);
    sim.setCheat({ autoDefendPct: 100, pushMult: 2, weightMult: 0.5, infiniteHp: true });
    const d = of(until(sim, (e) => e.some((x) => x.type === 'defend')), 'defend')[0]!;
    expect(d.auto).toBe(true);
    expect(d.lift).toBeCloseTo(d0.push_power * d0.auto_power_ratio * 2 * 2, 6);
    const lands = of(step(sim, 60), 'land');
    expect(lands.length).toBeGreaterThan(0);
    expect(sim.ant.hp).toBe(30);
    const w = sim.wallet;
    sim.addDebrisCheat(1000);
    expect(sim.wallet).toBe(w + 1000);
    sim.setCheat({ autoDefendPct: null });
    expect(sim.autoDefendPct).toBe(0);
  });
});
