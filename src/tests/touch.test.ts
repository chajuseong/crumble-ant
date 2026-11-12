import { describe, expect, it } from 'vitest';
import { type BattleEvent, BattleSim } from '../core/battle';
import type { GameConfig } from '../core/config';
import { Rng } from '../core/rng';
import { makeConfig } from './helpers';

/** M7 터치 개편 (I-23 · H-51) — 강점프 = 도움닫기 타이밍 · 터치 과녁 · 시드 난수 (core) */
type Patch = (c: GameConfig) => void;
const timing = (over: Partial<NonNullable<GameConfig['battle']['strong_timing']>> = {}, extra?: Patch) =>
  makeConfig((c) => {
    c.battle.strong_jump.mode = 'timing';
    c.battle.strong_timing = { chance_pct: 100, min_gap_jumps: 0, window_to: 0.9, window_s: 0.15, style: 'circle', ...over };
    extra?.(c);
  });
const targets = (over: Partial<NonNullable<GameConfig['battle']['targets']>> = {}, extra?: Patch) =>
  makeConfig((c) => {
    c.battle.targets = { chance_pct: 100, count_min: 2, count_max: 3, life_s: 1.2, radius_ratio: 0.08, min_dist_ratio: 0.22, miss_limit: 2, perfect_bonus_strikes: 1, end_on_hang: true, ...over }; // M7 B 규칙 (매달림 단위 · 닿는 순간) — H-56은 아래 따로
    c.battle.ant.max_hp = 1e9;
    c.battle.strong_jump.mode = 'tap'; // 과녁만 보는 테스트 — 링 기회 도움닫기 (실제 시간)가 섞이지 않게
    extra?.(c);
  });
const step = (sim: BattleSim, seconds: number) => {
  const all: BattleEvent[] = [];
  for (let i = 0; i < Math.round(seconds * 120); i++) {
    sim.update(1 / 120);
    all.push(...sim.drainEvents());
  }
  return all;
};
/** 조건이 맞을 때까지 1/120초씩 (그 스텝 이벤트까지) */
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
const types = (ev: BattleEvent[]) => ev.map((e) => e.type);

describe('M7 시드 난수', () => {
  it('xorshift32 — seed 1 → 270369 · 67634689 · 2647435461 (C#에서 같은 값이어야 함)', () => {
    const r = new Rng(1);
    expect([r.nextU32(), r.nextU32(), r.nextU32()]).toEqual([270369, 67634689, 2647435461]);
    expect(new Rng(0).state).not.toBe(0); // 0이면 고정값으로
  });
});

describe('M7 꺼진 채 (mode tap · count 0) = 지금 규칙', () => {
  it('tapBattle = 지금 강점프 (도움닫기 중 skip) · 과녁 없음', () => {
    // 시트 기본값과 상관없이 끈 상태로 (M7 C에서 시트가 timing · 과녁 2 ~ 3이 됨)
    const sim = new BattleSim(
      makeConfig((c) => {
        c.battle.strong_jump.mode = 'tap';
        c.battle.targets!.count_min = 0;
        c.battle.targets!.count_max = 0;
      }),
    );
    until(sim, (e) => e.some((x) => x.type === 'windupStart'));
    expect(sim.tapBattle(0.5, 0.5)).toBe('strong');
    expect(sim.ant.jumpKind).toBe('strong');
    const ev = step(sim, 20);
    expect(types(ev)).not.toContain('targetsSpawn');
    expect(types(ev)).not.toContain('timingChance');
  });
});

describe('M7 강점프 = 도움닫기 타이밍', () => {
  it('기회 = timingChance · 창 안 탭 = timingResult ok + 강점프', () => {
    const sim = new BattleSim(timing());
    const ev = until(sim, (e) => e.some((x) => x.type === 'timingChance'));
    const ch = ev.find((e) => e.type === 'timingChance') as Extract<BattleEvent, { type: 'timingChance' }>;
    expect(ch.fromS).toBeCloseTo(0.5 - (0.45 - 0.15), 6); // 창 = 경과 0.30 ~ 0.45초 → 남은 0.20 ~ 0.05초
    expect(ch.toS).toBeCloseTo(0.05, 6);
    step(sim, 0.36); // 경과 약 0.36초 = 창 안
    expect(sim.tapBattle(0.3, 0.3)).toBe('strong');
    const after = sim.drainEvents();
    expect(after.find((e) => e.type === 'timingResult')).toEqual({ type: 'timingResult', ok: true, grade: 'good' });
    expect(after.find((e) => e.type === 'jump')).toMatchObject({ kind: 'strong' });
  });

  it('창 밖 탭 = 기회 끝 (한 번만) · 다시 탭 = 무시 · 도움닫기 끝에 보통 점프', () => {
    const sim = new BattleSim(timing());
    until(sim, (e) => e.some((x) => x.type === 'timingChance'));
    step(sim, 0.1); // 경과 약 0.1초 = 창 전
    expect(sim.tapBattle(0.3, 0.3)).toBe('timingMiss');
    expect(sim.tapBattle(0.3, 0.3)).toBe('ignored');
    const ev = until(sim, (e) => e.some((x) => x.type === 'jump'));
    expect(ev.find((e) => e.type === 'timingResult')).toEqual({ type: 'timingResult', ok: false, grade: 'early' });
    expect(ev.find((e) => e.type === 'tapIgnored')).toEqual({ type: 'tapIgnored', reason: 'noChance' });
    expect(ev.find((e) => e.type === 'jump')).toMatchObject({ kind: 'auto' });
  });

  it('기회 없음 (chance 0) = 탭 무시 · 보통 점프 · 건물 없을 때 탭도 무시 (Q6)', () => {
    const sim = new BattleSim(timing({ chance_pct: 0 }));
    expect(sim.tapBattle(0.5, 0.5)).toBe('ignored'); // 시작 직후 = 건물 없음
    expect(sim.drainEvents().find((e) => e.type === 'tapIgnored')).toEqual({ type: 'tapIgnored', reason: 'noBuilding' });
    until(sim, (e) => e.some((x) => x.type === 'windupStart'));
    expect(sim.tapBattle(0.5, 0.5)).toBe('ignored');
    expect(types(until(sim, (e) => e.some((x) => x.type === 'jump')))).not.toContain('timingChance');
    expect(sim.ant.jumpKind).toBe('auto');
  });

  it('min_gap_jumps 2 → 기회 다음 점프 1번은 기회 없음', () => {
    const sim = new BattleSim(timing({ min_gap_jumps: 2 }, (c) => (c.battle.ant.max_hp = 1e9)));
    const flags: boolean[] = [];
    for (let k = 0; k < 6; k++) {
      const ev = until(sim, (e) => e.some((x) => x.type === 'jump'));
      flags.push(ev.some((e) => e.type === 'timingChance'));
    }
    expect(flags).toEqual([true, false, true, false, true, false]);
  });

  it('배속 ×3 = 창 길이 게임 0.45초 (실제 0.15초 · 도움닫기 시작보다 앞으로 안 감)', () => {
    const sim = new BattleSim(timing());
    sim.setTimeScale(3);
    const ev = until(sim, (e) => e.some((x) => x.type === 'timingChance'));
    const ch = ev.find((e) => e.type === 'timingChance') as Extract<BattleEvent, { type: 'timingChance' }>;
    expect(ch.fromS).toBeCloseTo(0.5, 6); // 경과 0 (= 0.45 − 0.45)
    expect(ch.toS).toBeCloseTo(0.05, 6);
  });
});

describe('M7 터치 과녁', () => {
  const spawn = (sim: BattleSim) => {
    const ev = until(sim, (e) => e.some((x) => x.type === 'targetsSpawn'));
    return ev.find((e) => e.type === 'targetsSpawn') as Extract<BattleEvent, { type: 'targetsSpawn' }>;
  };

  it('매달림 시작마다 2 ~ 3개 · 범위 안 · 개미 · HP 바 피함 · 과녁끼리 최소 거리', () => {
    const sim = new BattleSim(targets());
    const asp = (sim.cfg.layout.frame_height * sim.cfg.layout.battle_ratio) / sim.cfg.layout.frame_width;
    for (let k = 0; k < 5; k++) {
      const s = spawn(sim);
      expect(s.targets.length).toBeGreaterThanOrEqual(2);
      expect(s.targets.length).toBeLessThanOrEqual(3);
      const antTop = sim.ant.y + sim.cfg.battle.ant.height_ratio;
      for (const t of s.targets) {
        expect(t.x).toBeGreaterThanOrEqual(0.1);
        expect(t.x).toBeLessThanOrEqual(0.9);
        expect(t.y).toBeGreaterThanOrEqual(0.08);
        expect(t.y).toBeLessThanOrEqual(0.85);
        expect(Math.abs(t.x - 0.5) < sim.cfg.battle.ant.width_ratio * 1.5 && t.y < antTop + 0.05).toBe(false);
        expect(Math.abs(t.y - sim.building!.y)).toBeGreaterThanOrEqual(0.06 - 1e-4);
      }
      for (let i = 0; i < s.targets.length; i++)
        for (let j = i + 1; j < s.targets.length; j++) {
          const a = s.targets[i]!;
          const b = s.targets[j]!;
          expect(Math.hypot(a.x - b.x, (a.y - b.y) * asp)).toBeGreaterThanOrEqual(0.22 - 1e-3);
        }
      step(sim, 0.05);
    }
  });

  it('과녁 탭 = targetHit + 추가 1타 (source target · nextArm · combo +1 · HP 줄어듦)', () => {
    const sim = new BattleSim(targets());
    const s = spawn(sim);
    const hp = sim.building!.hp;
    const floorHp = sim.building!.floorHp[0]!; // M8 층 건물 — 넘친 데미지 버림 (시트 풀 · 층수와 상관없이)
    const combo = sim.combo;
    const arm = sim.ant.nextArm;
    const t = s.targets[0]!;
    expect(sim.tapBattle(t.x + 0.03, t.y)).toBe('target'); // 반지름 안 (그림보다 조금 넓게)
    const ev = sim.drainEvents();
    expect(ev[0]).toEqual({ type: 'targetHit', id: t.id });
    const st = ev.find((e) => e.type === 'strike') as Extract<BattleEvent, { type: 'strike' }>;
    expect(st).toMatchObject({ source: 'target', arm: arm + 1, combo: combo + 1 });
    expect(sim.building!.hp).toBe(hp - Math.min(st.damage, floorHp));
  });

  it('빈 곳 탭 2번 = 묶음 끝 (missLimit) · 탭 하나 = 과녁 하나', () => {
    const sim = new BattleSim(targets({ count_min: 3, count_max: 3, min_dist_ratio: 0.01 }));
    spawn(sim);
    expect(sim.tapBattle(0.01, 0.99)).toBe('miss');
    expect(sim.drainEvents()).toEqual([{ type: 'targetMiss', missesLeft: 1 }]);
    expect(sim.tapBattle(0.01, 0.99)).toBe('miss');
    expect(types(sim.drainEvents())).toEqual(['targetMiss', 'targetsEnd']);
    expect(sim.targets).toEqual([]);
  });

  it('다 맞힘 = targetsEnd perfect + perfect + 보너스 1타 (source bonus)', () => {
    const sim = new BattleSim(targets({}, (c) => c.buildings.rows.forEach((r) => (r.hp = 100000))));
    const s = spawn(sim);
    for (const t of s.targets) sim.tapBattle(t.x, t.y);
    const ev = sim.drainEvents();
    expect(ev.filter((e) => e.type === 'targetHit')).toHaveLength(s.targets.length);
    const i = types(ev).indexOf('perfect');
    expect(ev[i - 1]).toEqual({ type: 'targetsEnd', reason: 'perfect' });
    expect(ev[i + 1]).toMatchObject({ type: 'strike', source: 'bonus' });
  });

  it('매달림이 끝나면 남은 과녁 사라짐 (hangEnd) · 수명 = 실제 시간 (×1 · ×3 같은 벽시계)', () => {
    const sim = new BattleSim(targets());
    spawn(sim);
    const end = until(sim, (e) => e.some((x) => x.type === 'targetsEnd'));
    expect(end.find((e) => e.type === 'targetsEnd')).toMatchObject({ reason: 'hangEnd' }); // 1.2초보다 매달림이 짧음
    const wall = (scale: number) => {
      const s2 = new BattleSim(targets({ life_s: 0.02 })); // ×3이면 게임 0.06초 — 첫 매달림(약 0.067초)보다 짧게
      s2.setTimeScale(scale);
      for (let i = 0; i < 30 * 120; i++) {
        s2.update(scale / 120); // 벽시계 1/120초 = 게임 scale/120초
        if (s2.drainEvents().some((e) => e.type === 'targetsSpawn')) break;
      }
      expect(s2.targetLifeTotal).toBeCloseTo(0.02 * scale, 9); // 게임 시간 = 실제 시간 × 배속
      let frames = 0;
      for (; frames < 1200; frames++) {
        s2.update(scale / 120);
        const e = s2.drainEvents().find((x) => x.type === 'targetsEnd') as Extract<BattleEvent, { type: 'targetsEnd' }> | undefined;
        if (e) return { frames, reason: e.reason };
      }
      return null;
    };
    const w1 = wall(1);
    const w3 = wall(3);
    expect(w1?.reason).toBe('expire');
    expect(w3?.reason).toBe('expire');
    expect(Math.abs(w1!.frames - w3!.frames)).toBeLessThanOrEqual(1); // 실제 0.02초 = 약 2 ~ 3프레임 (×3에서도)
  });

  it('과녁 타격이 마지막 일격이면 파괴 · 남은 과녁 hangEnd', () => {
    const sim = new BattleSim(targets({ count_min: 3, count_max: 3, min_dist_ratio: 0.01 }));
    const s = spawn(sim);
    sim.building!.hp = 1;
    sim.tapBattle(s.targets[0]!.x, s.targets[0]!.y);
    const ev = [...sim.drainEvents(), ...step(sim, 1 / 120)];
    expect(types(ev)).toContain('destroy');
    expect(ev.find((e) => e.type === 'targetsEnd')).toMatchObject({ reason: 'hangEnd' });
  });
});

describe('M7 결정성 · 자동만 그대로', () => {
  const script = (cfg: GameConfig) => {
    const sim = new BattleSim(cfg, 3);
    const log: BattleEvent[] = [];
    for (let i = 0; i < 60 * 120; i++) {
      sim.update(1 / 120);
      const ev = sim.drainEvents();
      log.push(...ev);
      for (const e of ev) {
        if (e.type === 'targetsSpawn') for (const t of e.targets.slice(0, 2)) sim.tapBattle(t.x, t.y);
        if (e.type === 'timingChance') sim.tapBattle(0.5, 0.5);
      }
      if (i % 97 === 0) sim.tapBattle(0.2, 0.7);
      log.push(...sim.drainEvents());
    }
    return log;
  };
  const both = () => {
    const c = timing({ chance_pct: 40, min_gap_jumps: 1 });
    c.battle.targets = targets().battle.targets;
    c.battle.ant.max_hp = 1e9;
    return c;
  };

  it('같은 시드 + 같은 입력 = 같은 이벤트 · 시드가 다르면 다름', () => {
    expect(script(both())).toEqual(script(both()));
    const other = both();
    other.battle.rng_seed = 7;
    expect(script(other)).not.toEqual(script(both()));
  });

  it('탭 없으면 키를 켜도 자동 결과 그대로 (strike · destroy · land · deposit 순서 · 시각)', () => {
    const core = (cfg: GameConfig) => {
      const sim = new BattleSim(cfg, 2);
      const out: string[] = [];
      for (let i = 0; i < 120 * 120; i++) {
        sim.update(1 / 120);
        for (const e of sim.drainEvents()) if (['strike', 'destroy', 'land', 'deposit', 'stageClear', 'jump'].includes(e.type)) out.push(`${sim.time.toFixed(4)} ${JSON.stringify(e)}`);
      }
      return out;
    };
    const off = core(makeConfig((c) => { c.battle.ant.max_hp = 1e9; c.battle.strong_jump.mode = 'tap'; c.battle.targets!.count_max = 0; })); // 시트 기본값과 상관없이 끈 상태 (M7-D C = 링 0.6 슬로 · 체인)
    const on = core(both());
    expect(on.length).toBeGreaterThan(100);
    expect(on).toEqual(off);
  });
});

describe('I-24 줄어드는 링 · H-56 과녁 건물 단위', () => {
  const ring = (over: Partial<NonNullable<GameConfig['battle']['strong_timing']>> = {}, extra?: Patch) =>
    makeConfig((c) => {
      c.battle.strong_jump.mode = 'timing';
      c.battle.strong_jump.perfect_height_mult = 1.9;
      c.battle.strong_timing = { chance_pct: 100, min_gap_jumps: 0, window_to: 0.9, window_s: 0.15, style: 'ring', ring_s: 0.4, perfect_s: 0.05, good_s: 0.1, tap_max_y: 0.5, ...over };
      c.battle.ant.max_hp = 1e9;
      extra?.(c);
    });
  const chance = (sim: BattleSim) => until(sim, (e) => e.some((x) => x.type === 'timingChance'));
  const grade = (ev: BattleEvent[]) => (ev.find((e) => e.type === 'timingResult') as Extract<BattleEvent, { type: 'timingResult' }> | undefined)?.grade;

  it('겹침에 탭 = PERFECT (jump perfect) · ± good 안 = GOOD (strong) · 더 빠름 = 헛발 (끝에 보통 점프)', () => {
    const p = new BattleSim(ring());
    chance(p);
    step(p, 0.4); // 겹침 (0.40초)
    p.tapBattle(0.5, 0.2);
    const pe = p.drainEvents();
    expect(grade(pe)).toBe('perfect');
    expect(pe.find((e) => e.type === 'jump')).toMatchObject({ kind: 'perfect' });

    const g = new BattleSim(ring());
    chance(g);
    step(g, 0.48); // 겹침 + 0.08
    g.tapBattle(0.5, 0.2);
    const ge = g.drainEvents();
    expect(grade(ge)).toBe('good');
    expect(ge.find((e) => e.type === 'jump')).toMatchObject({ kind: 'strong' });

    const e = new BattleSim(ring());
    chance(e);
    step(e, 0.1); // 너무 빠름
    expect(e.tapBattle(0.5, 0.2)).toBe('timingMiss');
    expect(e.tapBattle(0.5, 0.2)).toBe('ignored'); // 첫 탭만
    const rest = [...e.drainEvents(), ...until(e, (x) => x.some((y) => y.type === 'jump'))];
    expect(grade(rest)).toBe('early');
    expect(rest.find((x) => x.type === 'jump')).toMatchObject({ kind: 'auto' });
  });

  it('기회 도움닫기 = 실제 시간 (×3에서도 실제 0.4초에 탭 = PERFECT · 게임 시간은 ×3)', () => {
    const sim = new BattleSim(ring());
    sim.setTimeScale(3);
    chance(sim);
    expect(sim.ant.groundTimer).toBeCloseTo(0.5 * 3, 1); // (ring_s + good_s) × 배속 (그 스텝 1/120초만큼 이미 줄어듦)
    for (let i = 0; i < 48; i++) sim.update(3 / 120); // 실제 0.4초
    sim.drainEvents();
    sim.tapBattle(0.5, 0.2);
    expect(grade(sim.drainEvents())).toBe('perfect');
  });

  it('위쪽 탭 = 타이밍으로 안 셈 (기회 그대로) · 아래쪽만 타이밍', () => {
    const sim = new BattleSim(ring());
    chance(sim);
    step(sim, 0.1);
    expect(sim.tapBattle(0.5, 0.8)).toBe('ignored'); // 위쪽 빈 곳
    expect(sim.ant.timingUsed).toBe(false);
    step(sim, 0.3);
    sim.tapBattle(0.5, 0.2);
    expect(grade(sim.drainEvents())).toBe('perfect');
  });

  it('PERFECT 높이는 전투 구역 위를 넘지 않음 (자름)', () => {
    const sim = new BattleSim(ring({}, (c) => (c.battle.strong_jump.perfect_height_mult = 5)));
    chance(sim);
    step(sim, 0.4);
    sim.tapBattle(0.5, 0.2);
    expect(sim.ant.apex + sim.cfg.battle.ant.height_ratio).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('×1 자동만 = 링을 켜도 그대로 (ring_s + good_s = windup_s)', () => {
    const core = (cfg: GameConfig) => {
      const sim = new BattleSim(cfg, 2);
      const out: string[] = [];
      for (let i = 0; i < 120 * 120; i++) {
        sim.update(1 / 120);
        for (const e of sim.drainEvents()) if (['strike', 'destroy', 'land', 'deposit', 'jump'].includes(e.type)) out.push(`${sim.time.toFixed(4)} ${JSON.stringify(e)}`);
      }
      return out;
    };
    const off = core(makeConfig((c) => { c.battle.ant.max_hp = 1e9; c.battle.strong_jump.mode = 'tap'; c.battle.targets!.count_max = 0; })); // 시트 기본값과 상관없이 끈 상태 (M7-D C = 링 0.6 슬로 · 체인)
    const on = core(ring({ chance_pct: 35, min_gap_jumps: 2 }, (c) => (c.battle.targets = { chance_pct: 100, count_min: 2, count_max: 3, life_s: 1.2, radius_ratio: 0.08, min_dist_ratio: 0.22, miss_limit: 2, perfect_bonus_strikes: 1, end_on_hang: false, lead_s: 0.3 })));
    expect(on).toEqual(off);
  });

  const unitTargets = (extra?: Patch) =>
    ring({ chance_pct: 0 }, (c) => {
      c.battle.targets = { chance_pct: 100, count_min: 3, count_max: 3, life_s: 1.2, radius_ratio: 0.08, min_dist_ratio: 0.22, miss_limit: 2, perfect_bonus_strikes: 1, end_on_hang: false, lead_s: 0.3 };
      c.buildings.rows.forEach((r) => (r.hp = 100000));
      extra?.(c);
    });

  it('과녁 = 닿기 직전에 등장 (상승 중 · 아직 안 닿음) · 위쪽에만', () => {
    const sim = new BattleSim(unitTargets());
    for (let k = 0; k < 3; k++) {
      const ev = until(sim, (e) => e.some((x) => x.type === 'targetsSpawn'));
      const s = ev.find((e) => e.type === 'targetsSpawn') as Extract<BattleEvent, { type: 'targetsSpawn' }>;
      expect(sim.ant.phase).toBe('rise');
      expect(sim.ant.contact).toBe(false);
      for (const t of s.targets) expect(t.y).toBeGreaterThanOrEqual(0.55 - 1e-4);
      until(sim, (e) => e.some((x) => x.type === 'targetsEnd'));
    }
  });

  it('건물 단위: 매달림이 끝나도 남음 · 매달리지 않아도 탭 = 건물에 1타 · 개미가 땅에 닿으면 끝 (H-61)', () => {
    const sim = new BattleSim(unitTargets());
    const ev = until(sim, (e) => e.some((x) => x.type === 'targetsSpawn'));
    const s = ev.find((e) => e.type === 'targetsSpawn') as Extract<BattleEvent, { type: 'targetsSpawn' }>;
    until(sim, () => !sim.ant.contact && sim.ant.phase === 'fall'); // 매달림 끝 · 떨어지는 중
    expect(sim.targets.length).toBe(3);
    const hp = sim.building!.hp;
    sim.tapBattle(s.targets[0]!.x, s.targets[0]!.y);
    const hitEv = sim.drainEvents();
    expect(hitEv.find((e) => e.type === 'strike')).toMatchObject({ source: 'target' });
    expect(sim.building!.hp).toBeLessThan(hp);
    const end = until(sim, (e) => e.some((x) => x.type === 'targetsEnd'));
    expect(end.find((e) => e.type === 'targetsEnd')).toMatchObject({ reason: 'hangEnd' });
    expect(sim.ant.phase).toBe('ground'); // 개미 착지 = 끝
  });

  it('땅에서는 과녁 0개 — 30초 동안 개미가 지면일 때 살아 있는 과녁이 없음 (묶음 · 체인 · ×1 · ×3)', () => {
    for (const mode of ['building', 'chain'] as const)
      for (const speed of [1, 3]) {
        const sim = new BattleSim(unitTargets((c) => { c.battle.targets!.mode = mode; c.battle.targets!.life_s = 60; c.battle.targets!.chain_life_s = 60; }));
        sim.setTimeScale(speed);
        let seen = 0;
        for (let i = 0; i < 30 * 120; i++) {
          sim.update(speed / 120);
          sim.drainEvents();
          if (sim.ant.phase === 'ground') expect(sim.targets).toEqual([]);
          if (sim.targets.length) seen++;
        }
        expect(seen).toBeGreaterThan(0);
      }
  });
});

describe('I-26 매달려 연타 체인 · H-61 계산 슬로', () => {
  const chain = (extra?: Patch) =>
    makeConfig((c) => {
      c.battle.strong_jump.mode = 'tap'; // 과녁만 (링 기회 도움닫기 안 섞이게)
      c.battle.ant.max_hp = 1e9;
      c.battle.targets = { chance_pct: 100, count_min: 1, count_max: 3, life_s: 1.2, radius_ratio: 0.08, min_dist_ratio: 0.15, miss_limit: 2, perfect_bonus_strikes: 1, end_on_hang: false, lead_s: 0.3, mode: 'chain', chain_life_s: 0.6, chain_life_step: 0.1, chain_hold: true, chain_max_speed: 1.5 };
      c.buildings.rows.forEach((r) => (r.hp = 100000));
      extra?.(c);
    });
  const spawnOf = (ev: BattleEvent[]) => ev.find((e) => e.type === 'targetsSpawn') as Extract<BattleEvent, { type: 'targetsSpawn' }> | undefined;

  it('첫 과녁 = 닿기 직전 1개 · 맞히면 그 자리 1타 + 다음 과녁 (수명 0.6 → 0.5) · 버팀 = 매달림 연장', () => {
    const sim = new BattleSim(chain());
    const s1 = spawnOf(until(sim, (e) => e.some((x) => x.type === 'targetsSpawn')))!;
    expect(s1.targets).toHaveLength(1);
    expect(s1.lifeS).toBeCloseTo(0.6, 9);
    expect(sim.ant.contact).toBe(false);
    until(sim, () => sim.ant.contact);
    const before = sim.ant.riseTimeLeft;
    sim.tapBattle(s1.targets[0]!.x, s1.targets[0]!.y);
    const ev = sim.drainEvents();
    expect(types(ev).slice(0, 3)).toEqual(['targetHit', 'strike', 'targetsSpawn']);
    expect(ev.find((e) => e.type === 'strike')).toMatchObject({ source: 'target' });
    expect(spawnOf(ev)!.lifeS).toBeCloseTo(0.5, 9);
    expect(sim.ant.riseTimeLeft).toBeGreaterThanOrEqual(Math.max(before, 0.5) - 1e-9);
  });

  it('빗나가면 바로 체인 끝 · 시간 끝 = 끝 · count_max개 다 맞히면 PERFECT + 보너스', () => {
    const miss = new BattleSim(chain());
    until(miss, (e) => e.some((x) => x.type === 'targetsSpawn'));
    expect(miss.tapBattle(0.01, 0.99)).toBe('miss');
    expect(types(miss.drainEvents())).toEqual(['targetMiss', 'targetsEnd']);

    const all = new BattleSim(chain());
    let s = spawnOf(until(all, (e) => e.some((x) => x.type === 'targetsSpawn')))!;
    until(all, () => all.ant.contact);
    const got: BattleEvent[] = [];
    for (let k = 0; k < 3; k++) {
      all.tapBattle(s.targets[0]!.x, s.targets[0]!.y);
      const ev = all.drainEvents();
      got.push(...ev);
      const next = spawnOf(ev);
      if (next) s = next;
    }
    expect(got.filter((e) => e.type === 'targetHit')).toHaveLength(3);
    expect(types(got)).toContain('perfect');
    expect(got.filter((e) => e.type === 'strike' && e.source === 'bonus')).toHaveLength(1);
  });

  it('배속 > chain_max_speed (×2 · ×3) = 체인 대신 묶음 (2 ~ 3개)', () => {
    const sim = new BattleSim(chain((c) => { c.battle.targets!.count_min = 2; }));
    sim.setTimeScale(3);
    const s = spawnOf(until(sim, (e) => e.some((x) => x.type === 'targetsSpawn'), 60))!;
    expect(s.targets.length).toBeGreaterThanOrEqual(2);
  });

  it('targets.max_speed (없으면 제한 없음): 배속 > max_speed = 과녁 없음 · ×1은 그대로', () => {
    for (const [speed, want] of [[1, true], [2, false], [3, false]] as const) {
      const sim = new BattleSim(chain((c) => { c.battle.targets!.max_speed = 1.5; }));
      sim.setTimeScale(speed);
      let seen = false;
      for (let i = 0; i < 60 * 120 && !seen; i++) {
        sim.update(speed / 120);
        if (sim.drainEvents().some((e) => e.type === 'targetsSpawn')) seen = true;
      }
      expect(seen).toBe(want);
    }
  });

  it('계산 슬로: ring 0.6 + good 0.1 → 슬로 0.5 ÷ 0.7 · 기회 도움닫기 게임 시간 = windup_s 그대로 → ×1 자동 결과 그대로', () => {
    const ringCfg = (r: number) =>
      makeConfig((c) => {
        c.battle.strong_jump.mode = 'timing';
        c.battle.strong_timing = { ...c.battle.strong_timing!, style: 'ring', ring_s: r, good_s: 0.1, perfect_s: 0.05, chance_pct: 35, min_gap_jumps: 2 };
        c.battle.ant.max_hp = 1e9;
      });
    const s = new BattleSim(ringCfg(0.6));
    expect(s.ringSlow).toBeCloseTo(0.5 / 0.7, 12);
    const core = (cfg: GameConfig) => {
      const sim = new BattleSim(cfg, 2);
      const out: string[] = [];
      for (let i = 0; i < 120 * 120; i++) {
        sim.update(1 / 120);
        for (const e of sim.drainEvents()) if (['strike', 'destroy', 'land', 'jump'].includes(e.type)) out.push(JSON.stringify(e));
      }
      return out;
    };
    const steps = (cfg: GameConfig) => {
      const sim = new BattleSim(cfg, 2);
      const out: string[] = [];
      for (let i = 0; i < 200000 && out.length < 400; i++) {
        sim.update(1 / 120);
        for (const e of sim.drainEvents()) if (['strike', 'destroy', 'land', 'jump'].includes(e.type)) out.push(`${sim.time.toFixed(4)} ${JSON.stringify(e)}`);
      }
      return out;
    };
    // 게임 시간 기준 이벤트 순서 · 시각이 ring 0.4 (슬로 없음)와 같음 — 실제 시간만 늘어남
    expect(steps(ringCfg(0.6))).toEqual(steps(ringCfg(0.4)));
    expect(core(ringCfg(0.6)).length).toBeLessThan(core(ringCfg(0.4)).length + 1); // 벽시계 120초 동안은 슬로만큼 덜 진행 (같거나 적음)
  });

  it('링 0.6 + 슬로: 실제 0.6초 (= 게임 0.6 × 0.714)에 탭 = PERFECT (×1 · ×3)', () => {
    for (const speed of [1, 3]) {
      const sim = new BattleSim(
        makeConfig((c) => {
          c.battle.strong_jump.mode = 'timing';
          c.battle.strong_timing = { ...c.battle.strong_timing!, style: 'ring', ring_s: 0.6, good_s: 0.1, perfect_s: 0.05, chance_pct: 100, min_gap_jumps: 0, tap_max_y: 0.5 };
          c.battle.ant.max_hp = 1e9;
        }),
      );
      sim.setTimeScale(speed);
      until(sim, (e) => e.some((x) => x.type === 'timingChance'));
      let wall = 0;
      while (wall < 0.6 - 1e-9) {
        sim.update(speed / 120);
        wall += 1 / 120;
      }
      sim.drainEvents();
      sim.tapBattle(0.5, 0.2);
      const r = sim.drainEvents().find((e) => e.type === 'timingResult') as Extract<BattleEvent, { type: 'timingResult' }>;
      expect(r.grade).toBe('perfect');
    }
  });
});
