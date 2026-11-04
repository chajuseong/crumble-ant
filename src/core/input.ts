/**
 * 땅속 띠 제스처 판정 (순수 함수).
 * 규칙 (기획서 §6 땅속 띠 7): 버튼 터치 우선 · 스와이프는 시작점이 띠 안일 때만 인정.
 * 버튼 우선은 렌더러가 보장 (버튼이 띠 입력 영역보다 위에 있고, 버튼에 닿은 입력은 여기로 오지 않음).
 */
import type { InputConfig } from './config';
import { type Layout, zoneAt } from './layout';

export interface PointerTrace {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  durationMs: number;
}

export type StripGesture = 'tap' | 'swipe_down' | 'none';

export function classifyStripGesture(layout: Layout, cfg: InputConfig, t: PointerTrace): StripGesture {
  if (zoneAt(layout, t.startY) !== 'strip') return 'none';
  const dx = t.endX - t.startX;
  const dy = t.endY - t.startY; // 아래 = +
  const slop = cfg.strip_tap_slop_ratio * layout.height;
  if (Math.hypot(dx, dy) <= slop && t.durationMs <= cfg.strip_tap_max_ms) return 'tap';
  const minDy = cfg.strip_swipe_min_dy_ratio * layout.height;
  if (dy >= minDy && Math.abs(dy) > Math.abs(dx) && t.durationMs <= cfg.strip_swipe_max_ms) return 'swipe_down';
  return 'none';
}

/** 개미굴 화면에서 위로 스와이프 → 전투로 복귀 */
export function isSwipeUp(layout: Layout, cfg: InputConfig, t: PointerTrace): boolean {
  const dx = t.endX - t.startX;
  const dy = t.startY - t.endY; // 위 = +
  return dy >= cfg.nest_swipe_up_min_dy_ratio * layout.height && Math.abs(dy) > Math.abs(dx);
}
