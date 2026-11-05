/**
 * M4 강화 · 재화 (I-12 · I-13 · H-17) — 순수 함수 (Phaser · DOM 없음 · Unity 이식 대상).
 * 효과 % = 100 + per_level_pct × Lv (정수) · 비용 = 정수 반복 (Lv 0 → 1 = cost_base, 다음 = floor(이전 × growth / 100))
 * 정수화 시점: 데미지 = floor(기본 × % / 100) · 비용 = 매 Lv floor. 실수 곱은 % ≠ 100일 때만 (Lv 0 = 시트 값 그대로 → M3 결과 그대로)
 */
import type { GameConfig, UpgradeRow, UpgradeStat } from './config';

/** 강화 Lv (upgrade_id → Lv). 읽을 때는 항상 시트 행 순서로 (객체 키 순서에 기대지 않음) */
export type Levels = Record<string, number>;

export function upgradeCost(row: UpgradeRow, lv: number): number {
  let c = row.cost_base;
  for (let i = 0; i < lv; i++) c = Math.floor((c * row.cost_growth_pct) / 100);
  return c;
}

export const levelPct = (row: UpgradeRow, lv: number): number => 100 + row.per_level_pct * lv;

export function initialLevels(cfg: GameConfig): Levels {
  const out: Levels = {};
  for (const r of cfg.upgrades.rows) out[r.upgrade_id] = 0;
  return out;
}

/** 강화가 반영된 전투 값 — 시트 원래 값(cfg)은 그대로 */
export interface BattleStats {
  armDamage: number[];
  strikeIntervalS: number;
  /** 자동 점프 최고점 (강점프는 × strong_jump.height_mult) */
  jumpHeight: number;
  /** 상승 속도 — 강화 안 됨 (I-13: 매달려 치는 시간 그대로) */
  riseSpeed: number;
  /** 하강 속도 — 이동속도 강화 (I-13) */
  fallSpeed: number;
}

export function deriveStats(cfg: GameConfig, levels: Levels): BattleStats {
  const pct = (stat: UpgradeStat): number => {
    const row = cfg.upgrades.rows.find((r) => r.stat === stat);
    return row ? levelPct(row, Math.max(0, Math.floor(levels[row.upgrade_id] ?? 0))) : 100;
  };
  const b = cfg.battle;
  const mul = (base: number, p: number) => (p === 100 ? base : (base * p) / 100);
  const pAtk = pct('attack_power');
  const pSpd = pct('attack_speed');
  return {
    armDamage: b.arms.map((a) => (pAtk === 100 ? a.damage : Math.floor((a.damage * pAtk) / 100))),
    strikeIntervalS: pSpd === 100 ? b.strike_interval_s : Math.max(b.strike_interval_min_s ?? 0, (b.strike_interval_s * 100) / pSpd),
    jumpHeight: mul(b.jump.height_ratio, pct('jump_power')),
    riseSpeed: b.jump.speed_ratio_per_s,
    fallSpeed: mul(b.jump.speed_ratio_per_s, pct('move_speed')),
  };
}

export type BuyResult = 'ok' | 'short' | 'max' | 'unknown';

/** 살 수 있는가 + 비용 (MAX · 모르는 id면 cost = null) */
export function buyCheck(cfg: GameConfig, levels: Levels, wallet: number, id: string): { result: BuyResult; cost: number | null; level: number } {
  const row = cfg.upgrades.rows.find((r) => r.upgrade_id === id);
  if (!row) return { result: 'unknown', cost: null, level: 0 };
  const level = levels[id] ?? 0;
  if (level >= row.max_level) return { result: 'max', cost: null, level };
  const cost = upgradeCost(row, level);
  return { result: wallet >= cost ? 'ok' : 'short', cost, level };
}
