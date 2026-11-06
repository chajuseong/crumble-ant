import { describe, expect, it } from 'vitest';
import { HitstopClock } from '../view/hitstop';
import { allToggles, FX_TOGGLES } from '../view/fx';
// @ts-expect-error — tools/는 .mjs (타입 없음)
import { readDataDir, validateAll } from '../../tools/validate_data.mjs';

describe('M2 A 히트스톱 시계', () => {
  it('멈춘 동안 core에 넘기는 시간 = 0, 끝나면 남은 만큼만', () => {
    const c = new HitstopClock();
    c.add(40, 120);
    expect(c.consume(16)).toBe(0);
    expect(c.consume(16)).toBe(0);
    expect(c.consume(16)).toBe(8); // 40ms 중 남은 8ms만 멈춤
    expect(c.consume(16)).toBe(16);
    expect(c.totalMs).toBe(40);
  });

  it('겹치면 긴 쪽 · 상한 max_ms', () => {
    const c = new HitstopClock();
    c.add(40, 120);
    c.add(90, 120);
    expect(c.consume(1000)).toBe(1000 - 90);
    c.add(500, 120);
    expect(c.consume(1000)).toBe(1000 - 120);
  });

  it('0 이하는 무시', () => {
    const c = new HitstopClock();
    c.add(0, 120);
    expect(c.stopped).toBe(false);
    expect(c.consume(16)).toBe(16);
  });
});

describe('M2 [FX] 토글 · fx_config', () => {
  it('토글 12개 (A ~ G + 대비 + M3-C 모션 + M3-D 마무리 · 충격 + M6 파괴 그림) · 기본 = 전부 켬', () => {
    expect(FX_TOGGLES.map((t) => t.id)).toEqual(['hitstop', 'flash', 'shake', 'combo', 'punch', 'hitDebris', 'sfx', 'contrast', 'motion', 'finisher', 'impact', 'envFx']);
    expect(Object.values(allToggles(true)).every(Boolean)).toBe(true);
  });

  it('저장소 src/data (fx_config 포함)는 데이터 검증을 통과한다', () => {
    expect(validateAll(readDataDir('src/data'))).toEqual([]);
  });
});
