import type { GameConfig } from '../core/config';
import { fromData } from '../core/data';
import { RAW_DATA } from '../view/gameData';
import { type BattleEvent, BattleSim } from '../core/battle';

/** 실제 데이터(src/data) → GameConfig 깊은 복사 + 덮어쓰기 */
/** M8-W 웨이브 끔 (시트 값과 상관없이 한 채씩 — 웨이브 밖 규칙만 보는 테스트) */
export function wavesOff(c: GameConfig): void {
  for (const r of c.stages.rows) Object.assign(r, { wave_min: null, wave_max: null, wave_gap: null, wave_rest_s: null });
}

export function makeConfig(patch?: (c: GameConfig) => void): GameConfig {
  const c = structuredClone(fromData(RAW_DATA));
  patch?.(c);
  return c;
}

/** 조건이 맞을 때까지 진행 (최대 maxS초). 그동안 나온 이벤트를 모아 돌려준다 */
export function runUntil(sim: BattleSim, pred: (ev: BattleEvent[]) => boolean, maxS = 120, dt = 1 / 60): BattleEvent[] {
  const all: BattleEvent[] = [];
  for (let t = 0; t < maxS; t += dt) {
    sim.update(dt);
    all.push(...sim.drainEvents());
    if (pred(all)) return all;
  }
  throw new Error(`runUntil: ${maxS}초 안에 조건 미충족`);
}

export function run(sim: BattleSim, seconds: number, dt = 1 / 60): BattleEvent[] {
  const all: BattleEvent[] = [];
  for (let t = 0; t < seconds - 1e-9; t += dt) {
    sim.update(dt);
    all.push(...sim.drainEvents());
  }
  return all;
}

export const has = (type: BattleEvent['type']) => (ev: BattleEvent[]) => ev.some((e) => e.type === type);
