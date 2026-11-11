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
    c.battle.defend!.recoil_fall_mult = RECOIL; // I-32 키는 C에서 — 테스트에서만 넣음
    extra?.(c);
  });
const d0 = makeConfig().battle.defend!;
const RECOIL = 1.5;

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

describe('M7-E 받치기 (I-28) · 반동 (I-32 · H-73)', () => {
  /** 다음 받치기 과녁이 나올 때까지 → (닿을 때까지 기다렸다가) 탭. 반환 = 탭한 순간 이벤트 */
  const hitNext = (sim: BattleSim, atContact = true) => {
    const s = spawnOf(until(sim, (e) => e.some((x) => x.type === 'targetsSpawn')))!;
    if (atContact) until(sim, () => sim.ant.contact);
    sim.tapBattle(s.targets[0]!.x, s.targets[0]!.y);
    return { spawn: s, ev: sim.drainEvents() };
  };

  it('lift = push_power ÷ weight · 건물 올라감 · 낙하 멈춤 push_s · 개미 = 반동 (매달림 끝 · 하강 × recoil_fall_mult) · 그 점프 과녁 하나', () => {
    const sim = new BattleSim(defendCfg());
    const s = spawnOf(until(sim, (e) => e.some((x) => x.type === 'targetsSpawn')))!;
    until(sim, () => sim.ant.contact);
    const b = sim.building!;
    const y0 = b.y;
    sim.tapBattle(s.targets[0]!.x, s.targets[0]!.y);
    const ev = sim.drainEvents();
    expect(ev.map((e) => e.type)).toEqual(['targetHit', 'defend']); // 다음 과녁 = 다음 점프 (버팀 없음)
    const d = of(ev, 'defend')[0]!;
    expect(d).toMatchObject({ auto: false, n: 1, buildingId: b.id });
    expect(d.lift).toBeCloseTo(d0.push_power, 6);
    expect(b.y).toBeCloseTo(y0 + d0.push_power, 6);
    expect(b.pauseLeft).toBeCloseTo(d0.push_s, 9);
    expect([sim.ant.phase, sim.ant.contact]).toEqual(['fall', false]);
    expect(sim.ant.fallSpeed).toBeCloseTo(sim.stats.fallSpeed * RECOIL, 9);
    expect(sim.targets).toHaveLength(0);
    const yHold = b.y;
    step(sim, d0.push_s * 0.5);
    expect(b.y).toBeCloseTo(yHold, 9);
    step(sim, d0.push_s);
    expect(b.y).toBeLessThan(yHold);
  });

  it('체인 = 점프를 넘어서 셈 (1 / 3 → 2 / 3 → 3 / 3) · 감쇠 · 3 / 3 = 그 순간 마무리 1타 → 받치기 → 다음은 1 / 3', () => {
    const sim = new BattleSim(defendCfg());
    const lifts: number[] = [];
    const steps: number[] = [];
    let last: BattleEvent[] = [];
    for (let k = 0; k < 3; k++) {
      until(sim, (e) => e.some((x) => x.type === 'targetsSpawn'));
      steps.push(sim.chainStep!.n);
      until(sim, () => sim.ant.contact);
      const t = sim.targets[0]!;
      sim.tapBattle(t.x, t.y);
      last = sim.drainEvents();
      lifts.push(...of(last, 'defend').map((e) => e.lift));
    }
    expect(steps).toEqual([1, 2, 3]);
    const k = 1 - d0.decay_pct / 100;
    lifts.forEach((l, i) => expect(l).toBeCloseTo(d0.push_power * k ** i, 6));
    expect(last.map((e) => e.type)).toEqual(['targetHit', 'targetsEnd', 'perfect', 'strike', 'defend']);
    expect(of(last, 'strike')[0]).toMatchObject({ source: 'bonus' });
    until(sim, (e) => e.some((x) => x.type === 'targetsSpawn'));
    expect(sim.chainStep!.n).toBe(1);
  });

  it('놓치면 체인 끝 (다음 점프 = 1 / 3) · 건물당 max_per_building · 무게 2 = 절반', () => {
    const sim = new BattleSim(defendCfg());
    hitNext(sim);
    until(sim, (e) => e.some((x) => x.type === 'targetsSpawn'));
    expect(sim.chainStep!.n).toBe(2);
    until(sim, (e) => e.some((x) => x.type === 'targetsEnd')); // 안 누름 → 놓침
    until(sim, (e) => e.some((x) => x.type === 'targetsSpawn'));
    expect(sim.chainStep!.n).toBe(1);

    const cap = new BattleSim(defendCfg((c) => { c.battle.targets!.count_max = 9; }));
    const n: number[] = [];
    for (let i = 0; i < 5; i++) n.push(of(hitNext(cap).ev, 'defend').length);
    expect(n).toEqual([1, 1, 1, 0, 0]);

    const heavy = new BattleSim(defendCfg((c) => c.buildings.rows.forEach((r) => (r.weight = 2))));
    expect(of(hitNext(heavy).ev, 'defend')[0]!.lift).toBeCloseTo(d0.push_power / 2, 6);
  });

  it('lift_max_y 하나로 자름 (밑면이 이보다 안 올라감 · 내려가지도 않음)', () => {
    const sim = new BattleSim(defendCfg((c) => { c.battle.defend!.push_power = 5; }));
    hitNext(sim);
    expect(sim.building!.y).toBeCloseTo(d0.lift_max_y, 9);
    expect(sim.ant.phase).toBe('fall');
  });

  it('닿기 전에 맞힘 = 닿는 순간 1타 친 뒤 받치기 + 반동', () => {
    const sim = new BattleSim(defendCfg());
    const { ev } = hitNext(sim, false);
    expect(sim.ant.contact).toBe(false);
    expect(of(ev, 'defend')).toHaveLength(0);
    const after = until(sim, (e) => e.some((x) => x.type === 'defend'));
    const types = after.map((e) => e.type);
    expect(types.indexOf('strike')).toBeGreaterThanOrEqual(0);
    expect(types.indexOf('strike')).toBeLessThan(types.indexOf('defend'));
    expect(sim.ant.phase).toBe('fall');
  });

  it('닿기 전에 맞혔는데 끝내 못 닿고 정점 = 그 자리에서 받치기 (탭을 버리지 않음)', () => {
    const sim = new BattleSim(defendCfg());
    hitNext(sim, false);
    const y0 = sim.building!.y;
    sim.ant.riseTimeLeft = 1e-6; // 다음 스텝에 정점 (닿기 전)
    const ev = step(sim, 1 / 120);
    expect(sim.ant.contact).toBe(false);
    expect(of(ev, 'defend')).toHaveLength(1);
    expect(sim.building!.y).toBeGreaterThan(y0);
  });

  it('과녁 자리 = 건물 밑면 − dy · 개미 가운데 ± dx (체인 순서마다 좌우 번갈아 · 흔들기 안)', () => {
    const sim = new BattleSim(defendCfg());
    const xs: number[] = [];
    for (let k = 0; k < 2; k++) {
      const { spawn } = hitNext(sim, false);
      const t = spawn.targets[0]!;
      expect(Math.abs(Math.abs(t.x - 0.5) - d0.target_dx_ratio)).toBeLessThanOrEqual(d0.target_jitter_ratio + 1e-4);
      xs.push(t.x);
    }
    expect(Math.sign(xs[0]! - 0.5)).toBe(-Math.sign(xs[1]! - 0.5));
  });

  it('자동 받치기 = 매달림 시작에 뽑고 끝날 때 받침 (그 매달림 타격은 그대로 · 힘 × auto_power_ratio · 받치는 힘 강화 %)', () => {
    const sim = new BattleSim(defendCfg((c) => { c.battle.defend!.auto_pct = 100; c.battle.targets!.count_max = 0; c.upgrades.rows.push(row('push_power', { per_level_pct: 8 })); }), 1, { stage: 1, autoAdvance: true, debris: 0, levels: { push_power: 2 } });
    const ev = until(sim, (e) => e.some((x) => x.type === 'defend'));
    const d = of(ev, 'defend')[0]!;
    expect(d.auto).toBe(true);
    const types = ev.map((e) => e.type);
    expect(types.lastIndexOf('strike')).toBeLessThan(types.indexOf('defend')); // 치고 나서 받침
    expect(d.lift).toBeCloseTo((d0.push_power * 116) / 100 * d0.auto_power_ratio, 6);
    expect(of(ev, 'strike').length).toBeGreaterThan(0); // 매달린 동안 자동 타격 (그대로)
    expect(sim.ant.phase).toBe('fall');
  });

  it('손으로 받치면 그 매달림 자동 받치기는 없음 (한 점프에 한 번)', () => {
    const sim = new BattleSim(defendCfg((c) => { c.battle.defend!.auto_pct = 100; }));
    const { ev } = hitNext(sim);
    const later = step(sim, 0.3);
    expect([...of(ev, 'defend'), ...of(later, 'defend')].map((e) => e.auto)).toEqual([false]);
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
