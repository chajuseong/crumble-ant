/**
 * M3-E 배속 (I-17 · H-28) — view가 들고 있는 배속 값 (core는 그대로 dt만 받음). Phaser 없음 · 테스트 대상.
 * 단계 = game_config speed.levels · 가벼운 연출 기준 = fx_config speed_fx.* · 고른 값 = 브라우저 키 (저장 형식 v1 밖)
 */
import game_config from '../data/game_config.json';
import { FX, type FxConfig } from './fx';

export const SPEED_LEVELS: readonly number[] = game_config.speed.levels;
const STORE_KEY = 'crumble-ant.speed';

/** 다음 배속 (끝 → 처음). 목록에 없는 값이면 처음 */
export function nextSpeed(cur: number, levels: readonly number[] = SPEED_LEVELS): number {
  const i = levels.indexOf(cur);
  return levels[i < 0 || i === levels.length - 1 ? 0 : i + 1] ?? 1;
}

/** 저장해 둔 값 정리 — 목록에 없으면 첫 값 (×1) */
export function sanitizeSpeed(raw: unknown, levels: readonly number[] = SPEED_LEVELS): number {
  const v = typeof raw === 'string' ? Number(raw) : raw;
  return typeof v === 'number' && levels.includes(v) ? v : (levels[0] ?? 1);
}

export function loadSpeed(): number {
  try {
    return sanitizeSpeed(localStorage.getItem(STORE_KEY));
  } catch {
    return SPEED_LEVELS[0] ?? 1;
  }
}

export function saveSpeed(v: number): void {
  try {
    localStorage.setItem(STORE_KEY, String(v));
  } catch {
    /* 무시 — 다음에 ×1 */
  }
}

/** ×2 이상 = 가벼운 연출 (일반 타격 멈춤 · 흔들림 끔 · 타격음 솎음) — H-28 ② */
export const lightFx = (speed: number, fx: FxConfig = FX): boolean => speed >= fx.speed_fx.light_from;

/** 가벼운 연출일 때 일반 타격음을 낼 차례인가 — core combo로 (1 · 4 · 7 …번째) */
export const hitSoundTurn = (combo: number, speed: number, fx: FxConfig = FX): boolean =>
  !lightFx(speed, fx) || (Math.max(1, combo) - 1) % fx.speed_fx.hit_sfx_every === 0;
