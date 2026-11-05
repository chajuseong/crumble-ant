/**
 * M4 저장 형식 v1 (H-17 ③ 승인) — 만들기 · 검증 · 버전 변환만. localStorage 읽고 쓰기는 view (core는 DOM 참조 금지).
 * { v: 1, debris, upgrades: {upgrade_id: Lv}, stage, auto_advance } — 시간 기록 없음 (단말 시계와 무관)
 */
import type { BattleSim, BattleStart } from './battle';
import type { GameConfig } from './config';
import type { Levels } from './economy';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'crumble-ant.save';
export const SAVE_BAD_KEY = 'crumble-ant.save.bad';

export interface SaveV1 {
  v: 1;
  debris: number;
  upgrades: Levels;
  stage: number;
  auto_advance: boolean;
}

/** 지금 상태 → 저장. 도전 중이면 도전 전 스테이지 · 자동 진행 OFF (다시 열면 [도전]부터). 운반 중 잔해는 안 넣음 [프로토만] */
export function makeSave(sim: BattleSim): SaveV1 {
  const s = sim.stage;
  const upgrades: Levels = {};
  for (const r of sim.cfg.upgrades.rows) upgrades[r.upgrade_id] = sim.levels[r.upgrade_id] ?? 0;
  return {
    v: SAVE_VERSION,
    debris: sim.wallet,
    upgrades,
    stage: s.challenging ? Math.max(1, s.stage - 1) : s.stage,
    auto_advance: s.challenging ? false : s.autoAdvance,
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * 읽기 — JSON 문자열 또는 객체. 형식이 틀리면 null (새로 시작 — view가 원본을 .save.bad로 옮김).
 * 값 정리: 모르는 upgrade_id 무시 · 빠진 것 0 · Lv > max = max · 음수 = 0 · 소수 = floor · stage < 1 = 1 (마지막 행보다 크면 그대로 — repeat_last)
 * 나중에 v2가 생기면 여기서 v1 → v2 변환
 */
export function parseSave(raw: unknown, cfg: GameConfig): BattleStart | null {
  let o: unknown = raw;
  if (typeof raw === 'string') {
    try {
      o = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!isObj(o) || o.v !== SAVE_VERSION) return null;
  if (!isNum(o.debris) || !isNum(o.stage) || typeof o.auto_advance !== 'boolean' || !isObj(o.upgrades)) return null;
  const saved = o.upgrades;
  const levels: Levels = {};
  for (const r of cfg.upgrades.rows) {
    const v = saved[r.upgrade_id];
    levels[r.upgrade_id] = isNum(v) ? Math.min(r.max_level, Math.max(0, Math.floor(v))) : 0;
  }
  return { debris: Math.max(0, Math.floor(o.debris)), levels, stage: Math.max(1, Math.floor(o.stage)), autoAdvance: o.auto_advance };
}
