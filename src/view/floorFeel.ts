/**
 * M8-D 층 손맛 (H-84 · H-85) — 층 금 단계 · 층 순서 세기를 정하는 순수 함수 (Phaser 없음 · 테스트 대상).
 * 입력 = core 값 (floorBreak.floor · floorHp[0] · floorMax)만 — view가 따로 세지 않음 (이식 원칙 1). 값 = fx_config floor_break.*
 */
import { FX, type FxConfig } from './fx';

/**
 * 층 금 단계 — 지금 맞는 층 HP가 crack_at_pct (내림차순) 각 값 % 이하면 한 단계씩.
 * 정수 비교 (hpLeft × 100 ≤ pct × max) — 반올림 없이 경계 그대로 (50% 정확히 = 1단계)
 */
export function floorCrackStep(hpLeft: number, max: number, fx: FxConfig = FX): number {
  if (max <= 0) return 0;
  let n = 0;
  for (const pct of fx.floor_break.crack_at_pct) if (hpLeft * 100 <= pct * max) n += 1;
  return n;
}

/** 층 순서 세기 — 1 + scale_per_floor × (깨진 층 − 1) · 1층 = 1 (floor = core floorBreak.floor · 1부터) */
export function floorScale(floor: number, fx: FxConfig = FX): number {
  return 1 + fx.floor_break.scale_per_floor * (Math.max(1, floor) - 1);
}

/** 층 깨짐 히트스톱 (ms) — 1층 기준 × 세기 (배속 상관없이 · 상한은 HitstopClock의 hitstop.max_ms) */
export function floorHitstopMs(floor: number, fx: FxConfig = FX): number {
  return Math.round(fx.floor_break.hitstop_ms * floorScale(floor, fx));
}

/** 층 깨짐 화면 흔들림 세기 — 1층 기준 × 세기 */
export function floorShake(floor: number, fx: FxConfig = FX): number {
  return fx.floor_break.camera_intensity * floorScale(floor, fx);
}
