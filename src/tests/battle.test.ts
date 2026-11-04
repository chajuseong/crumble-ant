import { describe, expect, it } from 'vitest';
import { BattleSim, type BattleEvent } from '../core/battle';
import { has, makeConfig, run, runUntil } from './helpers';

/** 아주 약한 건물 / 아주 센 건물 config */
const easy = () =>
  makeConfig((c) => {
    c.buildings.rows = c.buildings.rows.map((r) => ({ ...r, hp: 10 }));
    c.stages.rows = c.stages.rows.map((r) => ({ ...r, buildings_to_clear: 2 }));
  });
const impossible = () =>
  makeConfig((c) => {
    c.buildings.rows = c.buildings.rows.map((r) => ({ ...r, hp: 1_000_000 }));
    c.battle.ant.max_hp = 10;
  });

describe('건물 낙하 → 자동 점프 → 팔 4슬롯 순차 타격', () => {
  it('건물이 생기면 지면 대기 후 자동 점프한다', () => {
    const sim = new BattleSim(makeConfig());
    const ev = runUntil(sim, has('jump'), 5);
    expect(ev.find((e) => e.type === 'jump')).toMatchObject({ kind: 'auto' });
    expect(ev.findIndex((e) => e.type === 'spawn')).toBeLessThan(ev.findIndex((e) => e.type === 'jump'));
  });

  it('건물이 없으면 자동 점프하지 않는다', () => {
    const sim = new BattleSim(makeConfig((c) => (c.battle.building.spawn_delay_s = 100)));
    const ev = run(sim, 3);
    expect(ev.some((e) => e.type === 'jump')).toBe(false);
  });

  it('팔은 1 → 2 → 3 → 4 → 1 순서로 때린다 (점프가 바뀌어도 이어서)', () => {
    const sim = new BattleSim(makeConfig((c) => (c.buildings.rows[0]!.hp = 1_000_000)));
    const ev = runUntil(sim, (e) => e.filter((x) => x.type === 'strike').length >= 9, 60);
    const arms = ev.filter((e): e is Extract<BattleEvent, { type: 'strike' }> => e.type === 'strike').map((e) => e.arm);
    expect(arms.slice(0, 9)).toEqual([1, 2, 3, 4, 1, 2, 3, 4, 1]);
  });

  it('arm_order_resets_each_jump = true 이면 점프마다 팔 1부터', () => {
    const sim = new BattleSim(
      makeConfig((c) => {
        c.buildings.rows[0]!.hp = 1_000_000;
        c.battle.arm_order_resets_each_jump = true;
      }),
    );
    const ev = runUntil(sim, (e) => e.filter((x) => x.type === 'jump').length >= 4, 60);
    // 각 점프 직후 첫 타격은 팔 1
    let afterJump = false;
    for (const e of ev) {
      if (e.type === 'jump') afterJump = true;
      else if (e.type === 'strike' && afterJump) {
        expect(e.arm).toBe(1);
        afterJump = false;
      }
    }
  });

  it('팔 데미지는 config 값 그대로 건물 HP에서 빠진다', () => {
    const cfg = makeConfig((c) => {
      c.buildings.rows[0]!.hp = 1_000_000;
      c.battle.arms = [
        { slot: 1, damage: 1 },
        { slot: 2, damage: 2 },
        { slot: 3, damage: 3 },
        { slot: 4, damage: 4 },
      ];
    });
    const sim = new BattleSim(cfg);
    const ev = runUntil(sim, (e) => e.filter((x) => x.type === 'strike').length >= 4, 60);
    const strikes = ev.filter((e): e is Extract<BattleEvent, { type: 'strike' }> => e.type === 'strike').slice(0, 4);
    expect(strikes.map((s) => s.damage)).toEqual([1, 2, 3, 4]);
    expect(strikes[3]!.hpLeft).toBe(1_000_000 - 10);
  });

  it('개미는 건물을 뚫지 못한다 (머리 ≤ 건물 밑면)', () => {
    const cfg = makeConfig((c) => (c.buildings.rows[0]!.hp = 1_000_000));
    const sim = new BattleSim(cfg);
    for (let i = 0; i < 60 * 20; i++) {
      sim.update(1 / 60);
      sim.drainEvents();
      const b = sim.building;
      if (b && b.state === 'falling') expect(sim.ant.y + cfg.battle.ant.height_ratio).toBeLessThanOrEqual(b.y + 1e-6);
    }
  });

  it('건물 수치는 건물 테이블에서 온다 (hp · fall_speed · weight · debris_reward)', () => {
    const cfg = makeConfig();
    const sim = new BattleSim(cfg, 2);
    runUntil(sim, has('spawn'), 5);
    const row = cfg.buildings.rows.find((b) => b.building_id === cfg.stages.rows[1]!.building_id)!;
    expect(sim.building).toMatchObject({ buildingId: row.building_id, maxHp: row.hp, fallSpeed: row.fall_speed, weight: row.weight, debrisReward: row.debris_reward });
  });

  it('착지 전에 HP 0 → 파괴 이벤트 · 진행도 +1', () => {
    const sim = new BattleSim(easy());
    const ev = runUntil(sim, has('destroy'), 30);
    expect(ev.some((e) => e.type === 'land')).toBe(false);
    expect(sim.stage.destroyed === 1 || sim.stage.stage === 2).toBe(true);
  });
});

describe('파괴 실패 → 착지 → 개미 피격', () => {
  it('착지 데미지 = ceil(건물 남은 HP × landing_damage_coeff)', () => {
    const cfg = makeConfig((c) => {
      c.buildings.rows[0]!.hp = 500;
      c.battle.arms = c.battle.arms.map((a) => ({ ...a, damage: 0 }));
      c.battle.landing_damage_coeff = 0.07;
      c.battle.ant.max_hp = 1000;
    });
    const sim = new BattleSim(cfg);
    const ev = runUntil(sim, has('land'), 60);
    const land = ev.find((e) => e.type === 'land');
    expect(land).toMatchObject({ damage: 35, antHp: 965 });
  });

  it('HP > 0 이면 다음 건물이 이어서 떨어진다', () => {
    const cfg = makeConfig((c) => {
      c.buildings.rows[0]!.hp = 500;
      c.battle.arms = c.battle.arms.map((a) => ({ ...a, damage: 0 }));
      c.battle.ant.max_hp = 1_000_000;
    });
    const sim = new BattleSim(cfg);
    const ev = runUntil(sim, (e) => e.filter((x) => x.type === 'spawn').length >= 2, 60);
    expect(ev.filter((e) => e.type === 'land').length).toBe(1);
    expect(sim.stage.destroyed).toBe(0); // 실패한 건물은 진행도에 안 셈
  });
});

describe('HP 0 → 후퇴 · auto_advance · [도전]', () => {
  it('스테이지 1에서 HP 0 → 후퇴 없이 스테이지 1 재시작, auto_advance 그대로', () => {
    const sim = new BattleSim(impossible());
    const ev = runUntil(sim, (e) => e.some((x) => x.type === 'stageStart' && x.reason === 'restart'), 120);
    expect(ev.some((e) => e.type === 'antDown')).toBe(true);
    expect(sim.stage.stage).toBe(1);
    expect(sim.stage.autoAdvance).toBe(true);
    expect(sim.challengeAvailable).toBe(false);
    expect(sim.ant.hp).toBe(sim.ant.maxHp);
  });

  it('스테이지 N(>1)에서 HP 0 → N-1로 후퇴, auto_advance OFF, [도전] 노출', () => {
    const sim = new BattleSim(impossible(), 4);
    const ev = runUntil(sim, (e) => e.some((x) => x.type === 'stageStart' && x.reason === 'retreat'), 120);
    expect(sim.stage.stage).toBe(3);
    expect(sim.stage.autoAdvance).toBe(false);
    expect(sim.challengeAvailable).toBe(true);
    expect(ev).toContainEqual({ type: 'autoAdvance', on: false });
  });

  it('auto_advance OFF 상태에서 클리어하면 같은 스테이지를 반복 파밍', () => {
    const sim = new BattleSim(easy(), 3);
    sim.stage.autoAdvance = false;
    const ev = runUntil(sim, has('stageClear'), 60);
    expect(ev.find((e) => e.type === 'stageClear')).toMatchObject({ stage: 3, wasChallenge: false });
    expect(sim.stage.stage).toBe(3);
    expect(ev).toContainEqual({ type: 'stageStart', stage: 3, reason: 'repeat' });
  });

  it('[도전] → 실패했던 스테이지 재도전 → 클리어하면 auto_advance ON + 다음 스테이지', () => {
    const sim = new BattleSim(easy(), 3);
    sim.stage.autoAdvance = false;
    expect(sim.challenge()).toBe(true);
    expect(sim.stage.stage).toBe(4);
    expect(sim.stage.challenging).toBe(true);
    const ev = runUntil(sim, has('stageClear'), 60);
    expect(ev.find((e) => e.type === 'stageClear')).toMatchObject({ stage: 4, wasChallenge: true });
    expect(ev).toContainEqual({ type: 'autoAdvance', on: true });
    expect(sim.stage.autoAdvance).toBe(true);
    expect(sim.stage.stage).toBe(5);
  });

  it('[도전] 실패 → 다시 후퇴, auto_advance OFF 유지', () => {
    const sim = new BattleSim(impossible(), 3);
    sim.stage.autoAdvance = false;
    sim.challenge();
    expect(sim.stage.stage).toBe(4);
    runUntil(sim, (e) => e.some((x) => x.type === 'stageStart' && x.reason === 'retreat'), 120);
    expect(sim.stage.stage).toBe(3);
    expect(sim.stage.autoAdvance).toBe(false);
    expect(sim.stage.challenging).toBe(false);
  });

  it('auto_advance ON 상태에서는 [도전]이 동작하지 않는다', () => {
    const sim = new BattleSim(makeConfig(), 2);
    expect(sim.challenge()).toBe(false);
    expect(sim.stage.stage).toBe(2);
  });

  it('기절 중에는 전투가 멈춘다 (건물 낙하 없음)', () => {
    const sim = new BattleSim(impossible(), 2);
    runUntil(sim, has('antDown'), 120);
    const y = sim.building?.y;
    sim.update(0.2);
    expect(sim.building?.y).toBe(y);
    expect(sim.ant.phase).toBe('down');
  });
});

describe('탭 = 강점프', () => {
  it('지면에서 탭 → 즉시 강점프, 최고점 = 점프 높이 × height_mult', () => {
    const cfg = makeConfig();
    const sim = new BattleSim(cfg);
    expect(sim.tapStrongJump()).toBe(true);
    const ev = sim.drainEvents();
    expect(ev).toContainEqual({ type: 'jump', kind: 'strong', apex: cfg.battle.jump.height_ratio * cfg.battle.strong_jump.height_mult });
  });

  it('공중에서는 탭을 무시한다', () => {
    const sim = new BattleSim(makeConfig());
    sim.tapStrongJump();
    sim.update(0.05);
    sim.drainEvents();
    expect(sim.tapStrongJump()).toBe(false);
    expect(sim.drainEvents()).toContainEqual({ type: 'tapIgnored', reason: 'airborne' });
  });

  it('쿨타임 중에는 탭을 무시한다', () => {
    const sim = new BattleSim(makeConfig((c) => (c.battle.strong_jump.cooldown_s = 10)));
    sim.tapStrongJump();
    runUntil(sim, () => sim.ant.phase === 'ground', 10);
    sim.drainEvents();
    expect(sim.tapStrongJump()).toBe(false);
    expect(sim.drainEvents()).toContainEqual({ type: 'tapIgnored', reason: 'cooldown' });
  });

  it('강점프는 자동 점프보다 높은 곳에서 건물에 닿는다 (더 일찍 타격)', () => {
    const firstContactY = (strong: boolean) => {
      const cfg = makeConfig((c) => (c.buildings.rows[0]!.hp = 1_000_000));
      const sim = new BattleSim(cfg);
      // 건물이 생긴 직후부터 지켜봄
      runUntil(sim, has('spawn'), 5);
      for (let i = 0; i < 60 * 30; i++) {
        if (strong && sim.ant.phase === 'ground') sim.tapStrongJump();
        sim.update(1 / 60);
        const ev = sim.drainEvents();
        if (ev.some((e) => e.type === 'strike')) return sim.building?.y ?? 0;
      }
      throw new Error('타격 없음');
    };
    expect(firstContactY(true)).toBeGreaterThan(firstContactY(false));
  });

  it('건물이 착지해 깔린 동안에는 탭을 무시한다', () => {
    const cfg = makeConfig((c) => {
      c.buildings.rows[0]!.hp = 1_000_000;
      c.battle.ant.max_hp = 1e12;
    });
    const sim = new BattleSim(cfg);
    runUntil(sim, has('land'), 60);
    expect(sim.tapStrongJump()).toBe(false);
    expect(sim.drainEvents()).toContainEqual({ type: 'tapIgnored', reason: 'pinned' });
  });
});

describe('결정론', () => {
  it('프레임 dt가 달라도 같은 시간이면 같은 결과', () => {
    const a = new BattleSim(makeConfig(), 2);
    const b = new BattleSim(makeConfig(), 2);
    run(a, 20, 1 / 30);
    run(b, 20, 1 / 120);
    expect(a.stage).toEqual(b.stage);
    expect(a.ant.hp).toBe(b.ant.hp);
    expect(a.building?.hp).toBe(b.building?.hp);
  });
});

describe('M2 연타 카운트 (core — 판정에는 쓰지 않음)', () => {
  type Strike = Extract<BattleEvent, { type: 'strike' }>;
  const strikes = (ev: BattleEvent[]) => ev.filter((e): e is Strike => e.type === 'strike');

  it('같은 건물에서 이어 치면 1, 2, 3 … 으로 늘어난다 (점프를 넘어도 window 안이면 이어짐)', () => {
    const sim = new BattleSim(makeConfig((c) => (c.buildings.rows[0]!.hp = 1_000_000)));
    const ev = runUntil(sim, (e) => strikes(e).length >= 12, 60);
    const combos = strikes(ev).map((s) => s.combo);
    expect(combos.slice(0, 4)).toEqual([1, 2, 3, 4]);
    expect(Math.max(...combos)).toBeGreaterThan(4); // 첫 매달림이 4타보다 적어도, 다음 점프에서 이어짐
  });

  it('window보다 오래 쉬면 1부터 다시', () => {
    const sim = new BattleSim(makeConfig((c) => {
      c.buildings.rows[0]!.hp = 1_000_000;
      c.battle.combo_window_s = 0.05; // 한 매달림 안(0.12초 간격)에서도 끊기게
    }));
    const ev = runUntil(sim, (e) => strikes(e).length >= 6, 60);
    expect(strikes(ev).every((s) => s.combo === 1)).toBe(true);
  });

  it('파괴 · 착지 · 스테이지 시작 때 0으로 돌아간다', () => {
    const sim = new BattleSim(makeConfig((c) => {
      c.buildings.rows = c.buildings.rows.map((r) => ({ ...r, hp: 10 }));
    }));
    runUntil(sim, has('destroy'), 30);
    expect(sim.combo).toBe(0);
    const sim2 = new BattleSim(makeConfig((c) => {
      c.buildings.rows[0]!.hp = 1_000_000;
      c.battle.ant.max_hp = 1e12;
    }));
    runUntil(sim2, has('land'), 60);
    expect(sim2.combo).toBe(0);
    const sim3 = new BattleSim(makeConfig((c) => (c.buildings.rows[0]!.hp = 1_000_000)), 2);
    runUntil(sim3, has('strike'), 30);
    sim3.stage.autoAdvance = false;
    sim3.challenge();
    expect(sim3.combo).toBe(0);
  });

  it('연타 카운터는 결과를 바꾸지 않는다 (window를 바꿔도 같은 결과)', () => {
    const a = new BattleSim(makeConfig((c) => (c.battle.combo_window_s = 0.01)), 3);
    const b = new BattleSim(makeConfig((c) => (c.battle.combo_window_s = 100)), 3);
    run(a, 40);
    run(b, 40);
    expect(a.stage).toEqual(b.stage);
    expect(a.ant.hp).toBe(b.ant.hp);
    expect(a.totalDestroyed).toBe(b.totalDestroyed);
    expect(a.building?.hp).toBe(b.building?.hp);
  });
});
