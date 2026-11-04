import type { GameConfig } from '../core/config';
import { fromData } from '../core/data';
import { RAW_DATA } from '../view/gameData';
import { type BattleEvent, BattleSim } from '../core/battle';

/** 실제 데이터(src/data) → GameConfig 깊은 복사 + 덮어쓰기 */
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
