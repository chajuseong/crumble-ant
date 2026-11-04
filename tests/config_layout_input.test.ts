import { describe, expect, it } from 'vitest';
import { stageRow, validateConfig } from '../src/core/config';
import { computeLayout, frameHeightForWidth, zoneAt, battleToScreenY } from '../src/core/layout';
import { classifyStripGesture, isSwipeUp } from '../src/core/input';
import { RAW_CONFIG } from '../src/gameConfig';
import { makeConfig } from './helpers';

describe('config 검증', () => {
  it('저장소의 config/*.json 은 오류가 없다', () => {
    expect(validateConfig(RAW_CONFIG)).toEqual([]);
  });

  it('레이아웃 비율 합이 1이 아니면 오류', () => {
    const c = makeConfig((x) => (x.layout.hud_ratio = 0.1));
    expect(validateConfig(c).join('\n')).toContain('비율 합');
  });

  it('팔이 4개가 아니면 오류', () => {
    const c = makeConfig((x) => x.battle.arms.pop());
    expect(validateConfig(c).join('\n')).toContain('battle.arms');
  });

  it('스테이지 표에 빈칸이 있으면 오류', () => {
    const c = makeConfig((x) => (x.stages.rows[1]!.stage = 5));
    expect(validateConfig(c).join('\n')).toContain('stages.rows[1].stage');
  });

  it('음수 · 문자열 수치는 오류', () => {
    const c = makeConfig((x) => {
      x.battle.jump.speed_ratio_per_s = -1;
      (x.battle.strong_jump as unknown as Record<string, unknown>).height_mult = '1.6';
    });
    const errs = validateConfig(c).join('\n');
    expect(errs).toContain('battle.jump.speed_ratio_per_s');
    expect(errs).toContain('battle.strong_jump.height_mult');
  });

  it('마지막 행을 넘는 스테이지는 마지막 행을 반복', () => {
    const c = makeConfig();
    const last = c.stages.rows[c.stages.rows.length - 1]!;
    expect(stageRow(c.stages, 999)).toBe(last);
    expect(stageRow(c.stages, 1).stage).toBe(1);
  });
});

describe('레이아웃 (Safe Area 높이 기준)', () => {
  const cfg = makeConfig().layout;
  const W = 1080;
  const H = frameHeightForWidth(cfg, W);
  const L = computeLayout(cfg, W, H);

  it('프레임 = 9 : 19.5', () => {
    expect(H).toBe(2340);
  });

  it('HUD 6% / 전투 84% / 띠 10%, 빈틈 없이 이어진다', () => {
    expect(L.hud.height / H).toBeCloseTo(0.06, 6);
    expect(L.battle.height / H).toBeCloseTo(0.84, 6);
    expect(L.strip.height / H).toBeCloseTo(0.1, 6);
    expect(L.hud.bottom).toBeCloseTo(L.battle.top);
    expect(L.battle.bottom).toBeCloseTo(L.strip.top);
    expect(L.strip.bottom).toBeCloseTo(H);
    expect(L.groundY).toBe(L.battle.bottom);
  });

  it('1080×2340 기준 띠 높이 ≈ 234px (기획서 §6 참고값)', () => {
    expect(L.strip.height).toBeCloseTo(234, 0);
  });

  it('zoneAt 구역 판정', () => {
    expect(zoneAt(L, 10)).toBe('hud');
    expect(zoneAt(L, H * 0.5)).toBe('battle');
    expect(zoneAt(L, H - 5)).toBe('strip');
    expect(zoneAt(L, -1)).toBe('outside');
  });

  it('전투 좌표 → 화면 y: 0 = 지면, 1 = 전투 구역 맨 위', () => {
    expect(battleToScreenY(L, 0)).toBeCloseTo(L.groundY);
    expect(battleToScreenY(L, 1)).toBeCloseTo(L.battle.top);
  });
});

describe('땅속 띠 입력', () => {
  const c = makeConfig();
  const L = computeLayout(c.layout, 1080, 2340);
  const inStrip = L.strip.top + L.strip.height / 2;

  it('띠 안에서 짧게 탭 → tap', () => {
    expect(classifyStripGesture(L, c.input, { startX: 100, startY: inStrip, endX: 105, endY: inStrip + 3, durationMs: 120 })).toBe('tap');
  });

  it('띠 안에서 아래로 스와이프 → swipe_down', () => {
    expect(classifyStripGesture(L, c.input, { startX: 300, startY: L.strip.top + 10, endX: 310, endY: L.strip.top + 140, durationMs: 250 })).toBe('swipe_down');
  });

  it('시작점이 전투 구역이면 띠 스와이프로 인정하지 않는다', () => {
    const startY = L.battle.bottom - 60;
    expect(classifyStripGesture(L, c.input, { startX: 300, startY, endX: 300, endY: startY + 200, durationMs: 200 })).toBe('none');
  });

  it('옆으로 끌거나 위로 올리면 none', () => {
    expect(classifyStripGesture(L, c.input, { startX: 100, startY: inStrip, endX: 400, endY: inStrip + 80, durationMs: 200 })).toBe('none');
    expect(classifyStripGesture(L, c.input, { startX: 100, startY: inStrip, endX: 100, endY: inStrip - 150, durationMs: 200 })).toBe('none');
  });

  it('개미굴에서 위로 스와이프 → 복귀', () => {
    expect(isSwipeUp(L, c.input, { startX: 500, startY: 1500, endX: 510, endY: 1300, durationMs: 200 })).toBe(true);
    expect(isSwipeUp(L, c.input, { startX: 500, startY: 1500, endX: 510, endY: 1480, durationMs: 200 })).toBe(false);
  });
});
