/**
 * M7 시드 난수 (xorshift32 — I-23 · H-51). Unity C#에서도 같은 수열 (uint 연산 · >>> = 부호 없는 시프트).
 * core만 씀 (Math.random 금지 — CLAUDE.md 이식 원칙 3). 뽑는 순서는 battle.ts가 고정.
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    const v = Math.floor(seed) >>> 0;
    this.s = v === 0 ? 0x9e3779b9 : v; // 0이면 xorshift가 멈춤 → 고정값
  }

  /** 다음 32비트 부호 없는 정수 */
  nextU32(): number {
    let x = this.s;
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    this.s = x;
    return x;
  }

  /** [0, 1) — u32 ÷ 2³² (C#: (double)u / 4294967296.0) */
  float(): number {
    return this.nextU32() / 4294967296;
  }

  /** 0 ~ n-1 정수 (floor) */
  int(n: number): number {
    return Math.floor(this.float() * n);
  }

  /** 지금 상태 (테스트 · 디버그) */
  get state(): number {
    return this.s;
  }
}
