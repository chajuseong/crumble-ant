/**
 * M3-D 공격 손맛 (I-16 · H-27) — 타격 종류 · 히트스톱 길이 · 충격 크기를 정하는 순수 함수 (Phaser 없음 · 테스트 대상).
 * 마무리 판정은 core가 주는 combo로만 (이식 원칙 1 — view가 따로 세지 않음). 값 = fx_config finisher.* · impact.* · hitstop.*
 */
import { FX, type FxConfig } from './fx';

export type StrikeKind = 'final' | 'finisher' | 'hit';

/** 마지막 일격(hpLeft 0)이 이김 (H-27 Q2) → 그다음 combo % every == 0이면 마무리 (Q1). finisherOn = [FX] A' */
export function strikeKind(combo: number, hpLeft: number, finisherOn: boolean, fx: FxConfig = FX): StrikeKind {
  if (hpLeft <= 0) return 'final';
  if (finisherOn && fx.finisher.every > 0 && combo > 0 && combo % fx.finisher.every === 0) return 'finisher';
  return 'hit';
}

/** 히트스톱 (ms): 일반 = min(hit_ms, 타격 간격 × hit_ratio_max) (Q3) · 마무리 · 마지막 일격 = 그 값 */
export function hitstopMs(kind: StrikeKind, intervalS: number, fx: FxConfig = FX): number {
  if (kind === 'final') return fx.hitstop.final_ms;
  if (kind === 'finisher') return fx.finisher.hitstop_ms;
  return Math.min(fx.hitstop.hit_ms, intervalS * 1000 * fx.hitstop.hit_ratio_max);
}

/** 충격 별 · 건물 밀림 크기 배율 — 마무리 · 마지막 일격 = star_scale (Q2 "별만 마무리 크기") */
export const impactScale = (kind: StrikeKind, fx: FxConfig = FX): number => (kind === 'hit' ? 1 : fx.finisher.star_scale);

/** 큰 조각을 뿌리는가 — 마무리 · 마지막 일격 */
export const dropsChunks = (kind: StrikeKind): boolean => kind !== 'hit';
