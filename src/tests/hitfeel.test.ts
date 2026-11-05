import { describe, expect, it } from 'vitest';
import { FX } from '../view/fx';
import { dropsChunks, hitstopMs, impactScale, strikeKind } from '../view/hitFeel';

/** M3-D 공격 손맛 (I-16 · H-27) — 타격 종류 · 히트스톱 · 충격 크기 (view 전용 순수 함수) */
describe('M3-D 4연타 마무리 판정 (core combo로만)', () => {
  it('combo가 finisher.every(4)의 배수면 마무리 — 4 · 8 · 12번째', () => {
    expect([1, 2, 3, 4, 5, 8, 12].map((c) => strikeKind(c, 50, true))).toEqual(['hit', 'hit', 'hit', 'finisher', 'hit', 'finisher', 'finisher']);
  });
  it('마지막 일격(hpLeft 0)이 이김 — 4번째라도 final (H-27 Q2)', () => {
    expect(strikeKind(4, 0, true)).toBe('final');
    expect(strikeKind(3, 0, false)).toBe('final');
  });
  it("[FX] A' 끔 = 마무리 없음 (M3 모습)", () => {
    expect(strikeKind(4, 50, false)).toBe('hit');
  });
});

describe('M3-D 히트스톱 길이', () => {
  it('일반 = min(hit_ms, 타격 간격 × hit_ratio_max) — 0.12초 = 39.6ms · 공속 최대 0.067초 = 22ms (H-27 Q3)', () => {
    expect(hitstopMs('hit', 0.12)).toBeCloseTo(Math.min(FX.hitstop.hit_ms, 120 * FX.hitstop.hit_ratio_max), 6);
    expect(hitstopMs('hit', 0.12 / 1.8)).toBeCloseTo((120 / 1.8) * FX.hitstop.hit_ratio_max, 6);
    expect(hitstopMs('hit', 1)).toBe(FX.hitstop.hit_ms);
  });
  it('마무리 · 마지막 일격은 간격과 무관', () => {
    expect(hitstopMs('finisher', 0.067)).toBe(FX.finisher.hitstop_ms);
    expect(hitstopMs('final', 0.067)).toBe(FX.hitstop.final_ms);
  });
});

describe('M3-D 충격 크기 · 큰 조각', () => {
  it('마무리 · 마지막 일격 = star_scale · 큰 조각 / 일반 = 1 · 조각 없음', () => {
    expect(impactScale('hit')).toBe(1);
    expect(impactScale('finisher')).toBe(FX.finisher.star_scale);
    expect(impactScale('final')).toBe(FX.finisher.star_scale);
    expect([dropsChunks('hit'), dropsChunks('finisher'), dropsChunks('final')]).toEqual([false, true, true]);
  });
});
