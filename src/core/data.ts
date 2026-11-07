/**
 * src/data/*.json (design/tables 시트 변환 결과) → core가 쓰는 GameConfig 모양.
 * 파일 경로 · JSON 읽기는 하지 않는다 (view · 테스트가 JSON을 넘김 — Unity에서는 ScriptableObject 등에서 같은 모양으로).
 * 검사는 두 번: 시트 변환 때 tools/validate_data.mjs, 시작할 때 validateConfig (화면에 오류 표시).
 */
import type { ArmConfig, BuildingRow, GameConfig, StageRow, UpgradeRow } from './config';

/** src/data/*.json 묶음 (파일 이름 = 키) */
export interface RawGameData {
  buildings: BuildingRow[];
  stages: StageRow[];
  game_config: Record<string, unknown>;
  ui_strings: Record<string, unknown>;
  /** M4 — 없으면 강화 없음 */
  upgrades?: UpgradeRow[];
}

type Obj = Record<string, unknown>;
const o = (v: unknown): Obj => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});

export function fromData(raw: RawGameData): GameConfig {
  const g = o(raw.game_config);
  const battle = o(g.battle);
  const armDamage = Array.isArray(battle.arm_damage) ? (battle.arm_damage as unknown[]) : [];
  const arms: ArmConfig[] = armDamage.map((damage, i) => ({ slot: i + 1, damage: damage as number }));
  return {
    layout: o(g.layout) as unknown as GameConfig['layout'],
    battle: {
      ant: o(battle.ant) as unknown as GameConfig['battle']['ant'],
      jump: o(battle.jump) as unknown as GameConfig['battle']['jump'],
      strong_jump: o(battle.strong_jump) as unknown as GameConfig['battle']['strong_jump'],
      arms,
      strike_interval_s: battle.strike_interval_s as number,
      strike_interval_min_s: typeof battle.strike_interval_min_s === 'number' ? battle.strike_interval_min_s : 0,
      combo_window_s: battle.combo_window_s as number,
      arm_order_resets_each_jump: battle.arm_order_resets_each_jump as boolean,
      landing_damage_coeff: battle.landing_damage_coeff as number,
      building: o(battle.building) as unknown as GameConfig['battle']['building'],
      // M7 (I-23 · H-51) — 없으면 끔 (mode tap · 과녁 없음)
      ...(typeof battle.strong_timing === 'object' && battle.strong_timing !== null ? { strong_timing: o(battle.strong_timing) as unknown as NonNullable<GameConfig['battle']['strong_timing']> } : {}),
      ...(typeof battle.targets === 'object' && battle.targets !== null ? { targets: o(battle.targets) as unknown as NonNullable<GameConfig['battle']['targets']> } : {}),
      ...(typeof battle.rng_seed === 'number' ? { rng_seed: battle.rng_seed } : {}),
    },
    buildings: { rows: Array.isArray(raw.buildings) ? raw.buildings : [] },
    stages: {
      rows: Array.isArray(raw.stages) ? raw.stages : [],
      beyond_last_row: o(g.stage).beyond_last_row as 'repeat_last',
    },
    input: o(g.input) as unknown as GameConfig['input'],
    strip: o(g.strip) as unknown as GameConfig['strip'],
    // 정렬 = sort → upgrade_id (객체 · 배열 순서에 기대지 않음)
    upgrades: { rows: (Array.isArray(raw.upgrades) ? [...raw.upgrades] : []).sort((a, b) => a.sort - b.sort || (a.upgrade_id < b.upgrade_id ? -1 : a.upgrade_id > b.upgrade_id ? 1 : 0)) },
    economy: {
      carry_delay_s: typeof o(g.economy).carry_delay_s === 'number' ? (o(g.economy).carry_delay_s as number) : 0,
      start_debris: typeof o(g.economy).start_debris === 'number' ? (o(g.economy).start_debris as number) : 0,
    },
  };
}
