import { describe, expect, it } from 'vitest';
import stagePool from '../data/stage_pool.json';
import { floorCrackStep, floorHitstopMs, floorScale, floorShake } from '../view/floorFeel';
import { FX, type FxConfig } from '../view/fx';

/** M8-D 층 손맛 (H-84 · H-85) — 층 금 단계 · 층 순서 세기 (view 전용 순수 함수 · 입력 = core 값) */
const fx = (patch: Partial<FxConfig['floor_break']>): FxConfig => ({ ...FX, floor_break: { ...FX.floor_break, ...patch } });

describe('M8-D 층 금 단계 (crack_at_pct)', () => {
  const f = fx({ crack_at_pct: [50, 25] });
  it('100 → 51% = 0 · 50% 정확히 = 1 · 26% = 1 · 25% = 2 · 0 = 2 (정수 비교 — 반올림 없음)', () => {
    expect([100, 51, 50, 26, 25, 1, 0].map((hp) => floorCrackStep(hp, 100, f))).toEqual([0, 0, 1, 1, 2, 2, 2]);
  });
  it('나누어떨어지지 않는 층 HP도 경계 그대로 (max 41 · 50% = 20.5 → 20이면 1 · 21이면 0)', () => {
    expect([21, 20, 11, 10].map((hp) => floorCrackStep(hp, 41, f))).toEqual([0, 1, 1, 2]);
  });
  it('max 0 = 금 없음', () => {
    expect(floorCrackStep(0, 0, f)).toBe(0);
  });
});

describe('M8-D 층 순서 세기 (scale_per_floor)', () => {
  const f = fx({ scale_per_floor: 0.3, hitstop_ms: 50, camera_intensity: 0.005 });
  it('1층 = ×1 · 2층 = ×1.3 · 3층 = ×1.6 → 히트스톱 · 흔들림이 층 순서로 커짐', () => {
    expect([1, 2, 3].map((k) => floorScale(k, f))).toEqual([1, 1.3, 1 + 0.3 * 2]);
    expect([1, 2, 3].map((k) => floorHitstopMs(k, f))).toEqual([50, 65, 80]);
    const sh = [1, 2, 3].map((k) => floorShake(k, f));
    expect(sh[0]! < sh[1]! && sh[1]! < sh[2]!).toBe(true);
  });
  it('시트 값: 가장 센 층 (stage_pool 최대 층수 − 1) < 파괴 — 흔들림 < camera.final_intensity · 히트스톱 < hitstop.final_ms', () => {
    const maxFloors = Math.max(...stagePool.map((r) => r.floors_max));
    const top = maxFloors - 1; // 지붕 = destroy (층 깨짐 아님)
    expect(top).toBeGreaterThanOrEqual(1);
    expect(floorShake(top)).toBeLessThan(FX.camera.final_intensity);
    expect(floorHitstopMs(top)).toBeLessThan(FX.hitstop.final_ms);
    expect(floorHitstopMs(1)).toBeGreaterThan(0); // 층 깨짐 히트스톱 켜짐 (배속 상관없이 — H-85 ③)
  });
});
