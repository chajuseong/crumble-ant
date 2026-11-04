/**
 * M2 A 히트스톱 시계 (view 전용 · Phaser 없음 — 테스트 가능).
 * 멈춰 있는 동안 core에 넘길 시간을 0으로 만든다 → core 시계가 통째로 멈춤 (H-10 ⑥-1).
 * core는 같은 순서 · 같은 고정 스텝으로 돌기 때문에 결과는 그대로이고, 벽시계로만 늦어진다.
 */
export class HitstopClock {
  private leftMs = 0;
  /** 지금까지 멈춘 시간 합 (측정 · 보고용) */
  totalMs = 0;

  /** 멈춤 요청 — 겹치면 긴 쪽, 상한 maxMs */
  add(ms: number, maxMs: number): void {
    if (ms <= 0) return;
    this.leftMs = Math.min(maxMs, Math.max(this.leftMs, ms));
  }

  get stopped(): boolean {
    return this.leftMs > 0;
  }

  /** 벽시계 deltaMs → core에 넘길 ms (멈춘 만큼 뺌) */
  consume(deltaMs: number): number {
    if (this.leftMs <= 0) return deltaMs;
    const stop = Math.min(this.leftMs, deltaMs);
    this.leftMs -= stop;
    this.totalMs += stop;
    return deltaMs - stop;
  }
}
