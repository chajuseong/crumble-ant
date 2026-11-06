/**
 * M4 저장 읽고 쓰기 (브라우저) — 형식 · 검증은 core/save.ts. 못 쓰는 환경이면 조용히 새로 시작 (게임은 그대로 돎).
 * 저장 시점 = deposit · upgrade · stageStart · 화면을 떠날 때 · 1초에 한 번 이하 (H-17 ③)
 */
import type { BattleSim, BattleStart } from '../core/battle';
import type { GameConfig } from '../core/config';
import { makeSave, parseSave, SAVE_BAD_KEY, SAVE_KEY } from '../core/save';

/** 저장 읽기 — 없으면 null · 깨졌으면 원본을 .save.bad로 옮기고 null (덮어써서 잃지 않게) */
export function loadStart(cfg: GameConfig): BattleStart | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw === null) return null;
    const start = parseSave(raw, cfg);
    if (!start) {
      localStorage.setItem(SAVE_BAD_KEY, raw);
      localStorage.removeItem(SAVE_KEY);
    }
    return start;
  } catch {
    return null;
  }
}

export class SaveWriter {
  private last = -Infinity;
  private dirty = false;
  constructor(
    private readonly sim: BattleSim,
    private readonly enabled: boolean,
    private readonly minGapMs = 1000,
  ) {}

  /** 저장할 일이 생김 — nowMs = 벽시계 (1초에 한 번 이하로 묶음) */
  request(nowMs: number): void {
    this.dirty = true;
    if (nowMs - this.last >= this.minGapMs) this.flush(nowMs);
  }

  /** 묶여 있던 저장을 내보냄 (매 프레임 · 화면을 떠날 때) */
  tick(nowMs: number): void {
    if (this.dirty && nowMs - this.last >= this.minGapMs) this.flush(nowMs);
  }

  flush(nowMs = 0): void {
    if (!this.enabled) return;
    this.dirty = false;
    this.last = nowMs;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(makeSave(this.sim)));
    } catch {
      /* 저장 못 하는 환경 — 다음에 새로 시작 */
    }
  }

  /** 테스트 빌드 [기록 지우기] — 지우고 다시 불러옴 */
  static reset(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* 무시 */
    }
  }
}
