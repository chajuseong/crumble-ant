/**
 * config/*.json 타입 정의 + 검증.
 * 모든 길이 · 위치는 px가 아니라 비율이다 (Unity 이식 대비).
 *  - *_ratio (전투)   : 전투 구역 높이(= 1.0) 기준
 *  - *_ratio_per_s    : 전투 구역 높이 / 초
 *  - layout · input   : Safe Area(= 게임 프레임) 높이 기준
 *  - strip            : 가로는 프레임 폭, 세로는 띠 높이 기준
 */

export interface LayoutConfig {
  frame_aspect_w: number;
  frame_aspect_h: number;
  render_width_px: number;
  hud_ratio: number;
  battle_ratio: number;
  strip_ratio: number;
  strip_menu_height_ratio: number;
  challenge_button_y_ratio: number;
}

export interface ArmConfig {
  slot: number;
  damage: number;
}

export interface BattleConfig {
  ant: {
    max_hp: number;
    height_ratio: number;
    width_ratio: number;
    down_duration_s: number;
    refill_hp_on_stage_start: boolean;
  };
  jump: {
    height_ratio: number;
    speed_ratio_per_s: number;
    ground_delay_s: number;
  };
  strong_jump: {
    height_mult: number;
    speed_mult: number;
    cooldown_s: number;
  };
  arms: ArmConfig[];
  strike_interval_s: number;
  arm_order_resets_each_jump: boolean;
  landing_damage_coeff: number;
  building: {
    height_ratio: number;
    width_ratio: number;
    spawn_bottom_ratio: number;
    spawn_delay_s: number;
    landed_linger_s: number;
  };
}

export interface StageRow {
  stage: number;
  building_hp: number;
  fall_speed_ratio_per_s: number;
  buildings_to_clear: number;
}

export interface StagesConfig {
  rows: StageRow[];
  beyond_last_row: 'repeat_last';
}

export interface InputConfig {
  strip_tap_slop_ratio: number;
  strip_tap_max_ms: number;
  strip_swipe_min_dy_ratio: number;
  strip_swipe_max_ms: number;
  nest_swipe_up_min_dy_ratio: number;
}

export interface StripConfig {
  worker_speed_ratio_per_s: number;
  worker_size_ratio: number;
  worker_gap_ratio: number;
  ambient_spawn_interval_s: number;
  ambient_carry_amount: number;
  debris_pieces: number;
  debris_carry_amount_per_piece: number;
  debris_pickup_s: number;
  burrow_x_ratio: number;
  popup_rise_ratio: number;
  popup_duration_s: number;
}

export interface GameConfig {
  layout: LayoutConfig;
  battle: BattleConfig;
  stages: StagesConfig;
  input: InputConfig;
  strip: StripConfig;
}

export const ARM_SLOT_COUNT = 4;

type Check = (errors: string[]) => void;

function num(path: string, v: unknown, opts: { min?: number; max?: number; gt?: number; int?: boolean } = {}): Check {
  return (errors) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      errors.push(`${path}: 숫자가 아님 (${JSON.stringify(v)})`);
      return;
    }
    if (opts.int && !Number.isInteger(v)) errors.push(`${path}: 정수여야 함 (${v})`);
    if (opts.min !== undefined && v < opts.min) errors.push(`${path}: ${opts.min} 이상이어야 함 (${v})`);
    if (opts.max !== undefined && v > opts.max) errors.push(`${path}: ${opts.max} 이하여야 함 (${v})`);
    if (opts.gt !== undefined && v <= opts.gt) errors.push(`${path}: ${opts.gt}보다 커야 함 (${v})`);
  };
}

function bool(path: string, v: unknown): Check {
  return (errors) => {
    if (typeof v !== 'boolean') errors.push(`${path}: true/false여야 함 (${JSON.stringify(v)})`);
  };
}

function obj(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

/** config 전체 검증. 문제가 없으면 빈 배열. */
export function validateConfig(raw: unknown): string[] {
  const errors: string[] = [];
  const root = obj(raw);
  const layout = obj(root.layout);
  const battle = obj(root.battle);
  const ant = obj(battle.ant);
  const jump = obj(battle.jump);
  const strong = obj(battle.strong_jump);
  const building = obj(battle.building);
  const stages = obj(root.stages);
  const input = obj(root.input);
  const strip = obj(root.strip);

  const checks: Check[] = [
    num('layout.frame_aspect_w', layout.frame_aspect_w, { gt: 0 }),
    num('layout.frame_aspect_h', layout.frame_aspect_h, { gt: 0 }),
    num('layout.render_width_px', layout.render_width_px, { min: 180, int: true }),
    num('layout.hud_ratio', layout.hud_ratio, { gt: 0, max: 1 }),
    num('layout.battle_ratio', layout.battle_ratio, { gt: 0, max: 1 }),
    num('layout.strip_ratio', layout.strip_ratio, { gt: 0, max: 1 }),
    num('layout.strip_menu_height_ratio', layout.strip_menu_height_ratio, { gt: 0, max: 1 }),
    num('layout.challenge_button_y_ratio', layout.challenge_button_y_ratio, { min: 0, max: 1 }),

    num('battle.ant.max_hp', ant.max_hp, { gt: 0 }),
    num('battle.ant.height_ratio', ant.height_ratio, { gt: 0, max: 0.5 }),
    num('battle.ant.width_ratio', ant.width_ratio, { gt: 0, max: 1 }),
    num('battle.ant.down_duration_s', ant.down_duration_s, { min: 0 }),
    bool('battle.ant.refill_hp_on_stage_start', ant.refill_hp_on_stage_start),
    num('battle.jump.height_ratio', jump.height_ratio, { gt: 0, max: 1 }),
    num('battle.jump.speed_ratio_per_s', jump.speed_ratio_per_s, { gt: 0 }),
    num('battle.jump.ground_delay_s', jump.ground_delay_s, { min: 0 }),
    num('battle.strong_jump.height_mult', strong.height_mult, { gt: 0 }),
    num('battle.strong_jump.speed_mult', strong.speed_mult, { gt: 0 }),
    num('battle.strong_jump.cooldown_s', strong.cooldown_s, { min: 0 }),
    num('battle.strike_interval_s', battle.strike_interval_s, { gt: 0 }),
    bool('battle.arm_order_resets_each_jump', battle.arm_order_resets_each_jump),
    num('battle.landing_damage_coeff', battle.landing_damage_coeff, { min: 0 }),
    num('battle.building.height_ratio', building.height_ratio, { gt: 0, max: 1 }),
    num('battle.building.width_ratio', building.width_ratio, { gt: 0, max: 1 }),
    num('battle.building.spawn_bottom_ratio', building.spawn_bottom_ratio, { gt: 0 }),
    num('battle.building.spawn_delay_s', building.spawn_delay_s, { min: 0 }),
    num('battle.building.landed_linger_s', building.landed_linger_s, { min: 0 }),

    num('input.strip_tap_slop_ratio', input.strip_tap_slop_ratio, { gt: 0, max: 1 }),
    num('input.strip_tap_max_ms', input.strip_tap_max_ms, { gt: 0 }),
    num('input.strip_swipe_min_dy_ratio', input.strip_swipe_min_dy_ratio, { gt: 0, max: 1 }),
    num('input.strip_swipe_max_ms', input.strip_swipe_max_ms, { gt: 0 }),
    num('input.nest_swipe_up_min_dy_ratio', input.nest_swipe_up_min_dy_ratio, { gt: 0, max: 1 }),

    num('strip.worker_speed_ratio_per_s', strip.worker_speed_ratio_per_s, { gt: 0 }),
    num('strip.worker_size_ratio', strip.worker_size_ratio, { gt: 0, max: 1 }),
    num('strip.worker_gap_ratio', strip.worker_gap_ratio, { min: 0, max: 1 }),
    num('strip.ambient_spawn_interval_s', strip.ambient_spawn_interval_s, { gt: 0 }),
    num('strip.ambient_carry_amount', strip.ambient_carry_amount, { min: 0 }),
    num('strip.debris_pieces', strip.debris_pieces, { min: 0, int: true }),
    num('strip.debris_carry_amount_per_piece', strip.debris_carry_amount_per_piece, { min: 0 }),
    num('strip.debris_pickup_s', strip.debris_pickup_s, { min: 0 }),
    num('strip.burrow_x_ratio', strip.burrow_x_ratio, { gt: 0, max: 1 }),
    num('strip.popup_rise_ratio', strip.popup_rise_ratio, { min: 0 }),
    num('strip.popup_duration_s', strip.popup_duration_s, { gt: 0 }),
  ];
  for (const c of checks) c(errors);

  // 레이아웃 3구역 합 = 1 (Safe Area 높이 기준)
  const sum = Number(layout.hud_ratio) + Number(layout.battle_ratio) + Number(layout.strip_ratio);
  if (Number.isFinite(sum) && Math.abs(sum - 1) > 1e-6) {
    errors.push(`layout: hud + battle + strip 비율 합이 1이어야 함 (${sum})`);
  }

  // 팔 4슬롯
  const arms = battle.arms;
  if (!Array.isArray(arms) || arms.length !== ARM_SLOT_COUNT) {
    errors.push(`battle.arms: 정확히 ${ARM_SLOT_COUNT}개여야 함`);
  } else {
    arms.forEach((a, i) => {
      const arm = obj(a);
      num(`battle.arms[${i}].slot`, arm.slot, { int: true })(errors);
      num(`battle.arms[${i}].damage`, arm.damage, { min: 0 })(errors);
      if (arm.slot !== i + 1) errors.push(`battle.arms[${i}].slot: ${i + 1}이어야 함 (순서대로 1~4)`);
    });
  }

  // 스테이지 표: 1부터 빈칸 없이
  const rows = stages.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    errors.push('stages.rows: 1행 이상 필요');
  } else {
    rows.forEach((r, i) => {
      const row = obj(r);
      num(`stages.rows[${i}].stage`, row.stage, { int: true })(errors);
      num(`stages.rows[${i}].building_hp`, row.building_hp, { gt: 0 })(errors);
      num(`stages.rows[${i}].fall_speed_ratio_per_s`, row.fall_speed_ratio_per_s, { gt: 0 })(errors);
      num(`stages.rows[${i}].buildings_to_clear`, row.buildings_to_clear, { min: 1, int: true })(errors);
      if (row.stage !== i + 1) errors.push(`stages.rows[${i}].stage: ${i + 1}이어야 함 (1부터 빈칸 없이)`);
    });
  }
  if (stages.beyond_last_row !== 'repeat_last') {
    errors.push(`stages.beyond_last_row: "repeat_last"만 지원 (${JSON.stringify(stages.beyond_last_row)})`);
  }

  return errors;
}

/** 스테이지 번호 → 표의 행. 마지막 행을 넘으면 마지막 행 반복 (beyond_last_row = repeat_last). */
export function stageRow(stages: StagesConfig, stage: number): StageRow {
  const idx = Math.min(Math.max(1, Math.floor(stage)), stages.rows.length) - 1;
  return stages.rows[idx]!;
}
