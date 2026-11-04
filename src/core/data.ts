/**
 * src/data/*.json (design/tables 시트 변환 결과) → core가 쓰는 GameConfig 모양.
 * 파일 경로 · JSON 읽기는 하지 않는다 (view · 테스트가 JSON을 넘김 — Unity에서는 ScriptableObject 등에서 같은 모양으로).
 * 검사는 두 번: 시트 변환 때 tools/validate_data.mjs, 시작할 때 validateConfig (화면에 오류 표시).
 */
import type { ArmConfig, BuildingRow, GameConfig, StageRow } from './config';

/** src/data/*.json 묶음 (파일 이름 = 키) */
export interface RawGameData {
  buildings: BuildingRow[];
  stages: StageRow[];
  game_config: Record<string, unknown>;
  ui_strings: Record<string, unknown>;
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
      arm_order_resets_each_jump: battle.arm_order_resets_each_jump as boolean,
      landing_damage_coeff: battle.landing_damage_coeff as number,
      building: o(battle.building) as unknown as GameConfig['battle']['building'],
    },
    buildings: { rows: Array.isArray(raw.buildings) ? raw.buildings : [] },
    stages: {
      rows: Array.isArray(raw.stages) ? raw.stages : [],
      beyond_last_row: o(g.stage).beyond_last_row as 'repeat_last',
    },
    input: o(g.input) as unknown as GameConfig['input'],
    strip: o(g.strip) as unknown as GameConfig['strip'],
  };
}
