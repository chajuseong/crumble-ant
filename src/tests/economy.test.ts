import { describe, expect, it } from 'vitest';
import { BattleSim, type BattleEvent } from '../core/battle';
import { buyCheck, deriveStats, initialLevels, levelPct, upgradeCost } from '../core/economy';
import { makeSave, parseSave } from '../core/save';
import { has, makeConfig, runUntil } from './helpers';

/** M4 강화 · 재화 · 저장 (I-12 · I-13 · H-17) — core */
const cfg = makeConfig();
const row = (id: string) => cfg.upgrades.rows.find((r) => r.upgrade_id === id)!;

describe('M4 비용 · 효과 (정수)', () => {
  it('비용 = 정수 반복: 60 → 78 → 101 → 131 (floor(이전 × 130 / 100)) · Lv 0 = cost_base', () => {
    // 비용 값은 시트와 상관없이 고정 (M5-D에서 시트 비용이 바뀜) — 계산 규칙만 검사
    const fixed = { ...row('attack_power'), cost_base: 60, cost_growth_pct: 130 };
    expect([0, 1, 2, 3].map((lv) => upgradeCost(fixed, lv))).toEqual([60, 78, 101, 131]);
    expect(upgradeCost(row('attack_speed'), 0)).toBe(row('attack_speed').cost_base);
  });
  it('효과 % = 100 + pct × Lv · 데미지 = floor(10 × % / 100) → Lv당 +1', () => {
    expect(levelPct(row('attack_power'), 3)).toBe(130);
    const lv = { ...initialLevels(cfg), attack_power: 3 };
    expect(deriveStats(cfg, lv).armDamage).toEqual([13, 13, 13, 13]);
  });
  it('Lv 0 = 시트 값 그대로 (M3 결과 그대로)', () => {
    const s = deriveStats(cfg, initialLevels(cfg));
    expect(s.armDamage).toEqual(cfg.battle.arms.map((a) => a.damage));
    expect(s.strikeIntervalS).toBe(cfg.battle.strike_interval_s);
    expect(s.jumpHeight).toBe(cfg.battle.jump.height_ratio);
    expect(s.fallSpeed).toBe(cfg.battle.jump.speed_ratio_per_s);
  });
  it('공격속도 = 간격 × 100 / % (하한 strike_interval_min_s) · 이동속도 = 하강만 (상승 그대로 — I-13)', () => {
    const s = deriveStats(cfg, { ...initialLevels(cfg), attack_speed: 10, move_speed: 6 });
    expect(s.strikeIntervalS).toBeCloseTo((0.12 * 100) / 180, 12);
    expect(s.riseSpeed).toBe(cfg.battle.jump.speed_ratio_per_s);
    expect(s.fallSpeed).toBeCloseTo(cfg.battle.jump.speed_ratio_per_s * 1.3, 12);
  });
});

describe('M4 구매', () => {
  it('부족 → short · 살 수 있음 → ok (재화 줄고 Lv +1 · upgrade 이벤트) · MAX → max', () => {
    const sim = new BattleSim(cfg, 1, { stage: 1, autoAdvance: true, debris: 59, levels: {} });
    expect(sim.buyUpgrade('attack_power')).toBe('short');
    sim.wallet = 200;
    expect(sim.buyUpgrade('attack_power')).toBe('ok');
    expect(sim.wallet).toBe(140);
    expect(sim.levels.attack_power).toBe(1);
    expect(sim.drainEvents()).toContainEqual({ type: 'upgrade', id: 'attack_power', level: 1, cost: 60, wallet: 140 });
    expect(sim.stats.armDamage[0]).toBe(11);
    sim.levels.move_speed = row('move_speed').max_level;
    expect(buyCheck(cfg, sim.levels, 1e9, 'move_speed').result).toBe('max');
    expect(sim.buyUpgrade('nope')).toBe('unknown');
  });
  it('강화는 다음 타격부터 — 산 뒤 strike damage가 바뀜', () => {
    const sim = new BattleSim(cfg, 1, { stage: 1, autoAdvance: true, debris: 1000, levels: {} });
    const before = runUntil(sim, has('strike'), 30).find((e) => e.type === 'strike')!;
    sim.buyUpgrade('attack_power');
    const after = runUntil(sim, (ev) => ev.some((e) => e.type === 'strike'), 30).find((e) => e.type === 'strike')!;
    expect(before.type === 'strike' && before.damage).toBe(10);
    expect(after.type === 'strike' && after.damage).toBe(11);
  });
});

describe('M4 재화 도착 (deposit)', () => {
  it('파괴 뒤 carry_delay_s(게임 시간)가 지나면 debris_reward만큼 들어옴 — 그 전에는 0', () => {
    const sim = new BattleSim(cfg, 1);
    let destroyAt = -1;
    const ev: BattleEvent[] = [];
    for (let i = 0; i < 120 * 60; i++) {
      sim.update(1 / 120);
      for (const e of sim.drainEvents()) {
        ev.push(e);
        if (e.type === 'destroy' && destroyAt < 0) destroyAt = sim.time;
      }
      if (ev.some((e) => e.type === 'deposit')) break;
    }
    const dep = ev.find((e) => e.type === 'deposit')!;
    expect(dep).toMatchObject({ type: 'deposit', amount: 60, wallet: 60 });
    expect(sim.time - destroyAt).toBeCloseTo(cfg.economy.carry_delay_s, 1);
  });
});

describe('M4 저장 형식 v1', () => {
  it('왕복: 만들기 → 읽기 → 같은 재화 · Lv · 스테이지 · 자동 진행', () => {
    const sim = new BattleSim(cfg, 3, { stage: 3, autoAdvance: false, debris: 1234, levels: { attack_power: 2, jump_power: 1 } });
    const save = makeSave(sim);
    expect(save).toEqual({ v: 1, debris: 1234, upgrades: { attack_power: 2, attack_speed: 0, jump_power: 1, move_speed: 0 }, stage: 3, auto_advance: false });
    const back = parseSave(JSON.stringify(save), cfg)!;
    const sim2 = new BattleSim(cfg, 1, back);
    expect([sim2.wallet, sim2.levels, sim2.stage.stage, sim2.stage.autoAdvance]).toEqual([1234, save.upgrades, 3, false]);
  });
  it('도전 중이면 도전 전 스테이지 · 자동 진행 OFF로 저장', () => {
    const sim = new BattleSim(cfg, 3);
    sim.stage.autoAdvance = false;
    sim.challenge();
    expect(sim.stage.stage).toBe(4);
    expect(makeSave(sim)).toMatchObject({ stage: 3, auto_advance: false });
  });
  it('깨진 저장 → null (새로 시작): JSON 깨짐 · v ≠ 1 · 타입 틀림', () => {
    expect(parseSave('{oops', cfg)).toBeNull();
    expect(parseSave({ v: 2, debris: 1, upgrades: {}, stage: 1, auto_advance: true }, cfg)).toBeNull();
    expect(parseSave({ v: 1, debris: '1', upgrades: {}, stage: 1, auto_advance: true }, cfg)).toBeNull();
    expect(parseSave({ v: 1, debris: 1, upgrades: [], stage: 1, auto_advance: true }, cfg)).toBeNull();
    expect(parseSave(null, cfg)).toBeNull();
  });
  it('값 정리: 모르는 id 무시 · 빠진 것 0 · Lv > max = max · 음수 0 · 소수 floor · stage < 1 = 1', () => {
    const s = parseSave({ v: 1, debris: 12.9, upgrades: { attack_power: 999, attack_speed: -3, ghost: 5 }, stage: 0, auto_advance: true }, cfg)!;
    expect(s).toEqual({ debris: 12, levels: { attack_power: 20, attack_speed: 0, jump_power: 0, move_speed: 0 }, stage: 1, autoAdvance: true });
  });
  it('H-41: 점프력 최대 Lv가 줄면 (7 → 3) 옛 세이브 Lv 4 ~ 7 = 3으로 자름 · 재화는 그대로 (돌려주지 않음 [프로토만])', () => {
    // 시트 값과 상관없이 max_level 3으로 고정
    const c3 = makeConfig((c) => {
      c.upgrades.rows.find((r) => r.upgrade_id === 'jump_power')!.max_level = 3;
    });
    for (const old of [4, 7]) {
      const s = parseSave({ v: 1, debris: 500, upgrades: { attack_power: 2, jump_power: old }, stage: 4, auto_advance: true }, c3)!;
      expect(s.levels.jump_power).toBe(3);
      expect(s.levels.attack_power).toBe(2);
      expect(s.debris).toBe(500);
    }
    const sim = new BattleSim(c3, 4, parseSave({ v: 1, debris: 500, upgrades: { jump_power: 7 }, stage: 4, auto_advance: true }, c3)!);
    expect(sim.buyUpgrade('jump_power')).toBe('max');
  });
});
