/**
 * 게임 수치 타입 정의 + 검증. 값의 원본 = design/tables/*.xlsx → src/data/*.json (npm run data),
 * src/data JSON → 이 모양으로 바꾸는 것은 core/data.ts fromData.
 * 모든 길이 · 위치는 px가 아니라 비율이다 (Unity 이식 대비).
 *  - *_ratio (전투)   : 전투 구역 높이(= 1.0) 기준
 *  - *_ratio_per_s    : 전투 구역 높이 / 초
 *  - layout · input   : Safe Area(= 게임 프레임) 높이 기준 (frame_width · frame_height만 px — G-03)
 *  - strip            : 가로는 프레임 폭, 세로는 띠 높이 기준
 */

export interface LayoutConfig {
  /** 프레임 크기 px (G-03 — 720×1560, 9:19.5) */
  frame_width: number;
  frame_height: number;
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
    /** M5 도움닫기 — 0 / 없음 = 끔 (ground_delay_s). 0보다 크면 자동 점프 전 대기 = 이 값 (I-19 · I-20) */
    windup_s?: number;
  };
  strong_jump: {
    height_mult: number;
    speed_mult: number;
    cooldown_s: number;
    /** M7 강점프 입력 — tap = 아무 데나 탭 (지금 · 없으면 tap) · timing = 도움닫기 타이밍 (I-23 · H-51) */
    mode?: 'tap' | 'timing';
    /** I-24 링 PERFECT 높이 배수 (GOOD = height_mult) — 전투 구역 위를 넘으면 자름 */
    perfect_height_mult?: number;
  };
  /** M7 도움닫기 타이밍 기회 (mode timing일 때) */
  strong_timing?: {
    chance_pct: number;
    min_gap_jumps: number;
    /** 맞는 창 끝 = 도움닫기 경과 비율 */
    window_to: number;
    /** 맞는 창 길이 — 실제 시간 (게임 시간 = × 배속) */
    window_s: number;
    /** I-24 circle = 지금 (창) · ring = 줄어드는 링 (없으면 circle) */
    style?: 'circle' | 'ring';
    /** ring: 링이 발밑 원에 겹치기까지 실제 시간 (기회 도움닫기 = ring_s + good_s · 실제 시간) */
    ring_s?: number;
    /** ring: PERFECT · GOOD 판정 폭 ± (실제 초) */
    perfect_s?: number;
    good_s?: number;
    /** H-54 ③ 도움닫기 중 이 높이 (전투 구역 비율) 아래 탭만 타이밍 · 위 = 과녁 (없으면 구역 전체) */
    tap_max_y?: number;
  };
  /** M7 터치 과녁 (count_max 0 = 끔) */
  targets?: {
    chance_pct: number;
    count_min: number;
    count_max: number;
    /** 수명 — 실제 시간 (게임 시간 = × 배속) */
    life_s: number;
    radius_ratio: number;
    min_dist_ratio: number;
    miss_limit: number;
    perfect_bonus_strikes: number;
    /** H-54 ① FALSE = 건물 단위 (매달림이 끝나도 수명 동안 남음 · 탭 = 떨어지는 건물에 1타) · 없으면 TRUE (매달림 단위) */
    end_on_hang?: boolean;
    /** H-56 ① 개미가 건물에 닿기 이만큼 (실제 초) 전에 나옴 · 없으면 닿는 순간 */
    lead_s?: number;
    /** I-26 building = 묶음 (M7 C) · chain = 매달려 연타 체인 (1개씩 · 맞히면 매달림 연장 → 다음) */
    mode?: 'building' | 'chain';
    /** chain: 첫 과녁 수명 · 다음마다 줄임 (실제 초) */
    chain_life_s?: number;
    chain_life_step?: number;
    /** I-26 맞히면 다음 과녁 수명 동안 매달려 버팀 */
    chain_hold?: boolean;
    /** H-61 이 배속보다 높으면 체인 대신 building 묶음 */
    chain_max_speed?: number;
    /** 이 배속보다 높으면 과녁 없음 (없으면 제한 없음 — ×2 · ×3은 개미가 실제 0.3초 안에 착지해서 과녁을 못 누름) */
    max_speed?: number;
  };
  /** M7 core 시드 난수 시작값 */
  rng_seed?: number;
  arms: ArmConfig[];
  strike_interval_s: number;
  /** M4 공격속도 강화 하한 (없으면 0) */
  strike_interval_min_s?: number;
  /** 연타가 이어지는 시간 (같은 건물 · 마지막 타격 뒤) — M2 D, 결과에는 영향 없음 */
  combo_window_s: number;
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

/** 건물 테이블 (요청서 #1 §3 스키마). building_id = PK */
export interface BuildingRow {
  building_id: string;
  name: string;
  hp: number;
  /** 전투 구역 높이 / 초 */
  fall_speed: number;
  /** 기본 1.0 — 추후 반격(밀어 올리기) 밸런싱용. 지금은 로직에서 쓰지 않음 */
  weight: number;
  /** 파괴 시 잔해 운반 팝업 합계 (연출 — 재화 아님) */
  debris_reward: number;
  /** 보스 건물 여부 — 지금은 로직 없음 */
  is_boss: boolean;
}

export interface BuildingsConfig {
  rows: BuildingRow[];
}

export interface StageRow {
  stage: number;
  /** FK → buildings.rows[].building_id */
  building_id: string;
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
  debris_pieces: number;
  debris_pickup_s: number;
  burrow_x_ratio: number;
  popup_rise_ratio: number;
  popup_duration_s: number;
}

/** M4 강화 (upgrades 시트 — docs/dev.md §3-6). stat = 코드가 아는 4종 */
export type UpgradeStat = 'attack_power' | 'attack_speed' | 'jump_power' | 'move_speed';
export interface UpgradeRow {
  upgrade_id: string;
  name: string;
  stat: UpgradeStat;
  per_level_pct: number;
  max_level: number;
  cost_base: number;
  cost_growth_pct: number;
  sort: number;
}

/** M4 재화 (game_config economy.*) */
export interface EconomyConfig {
  /** 파괴 → 재화 도착까지 (게임 시간 초) */
  carry_delay_s: number;
  start_debris: number;
}

export interface GameConfig {
  layout: LayoutConfig;
  battle: BattleConfig;
  buildings: BuildingsConfig;
  stages: StagesConfig;
  input: InputConfig;
  strip: StripConfig;
  /** M4 — 시트가 없으면 빈 목록 (강화 0 = M3 결과 그대로) */
  upgrades: { rows: UpgradeRow[] };
  economy: EconomyConfig;
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
  const buildings = obj(root.buildings);
  const input = obj(root.input);
  const strip = obj(root.strip);

  const checks: Check[] = [
    num('layout.frame_width', layout.frame_width, { min: 180, int: true }),
    num('layout.frame_height', layout.frame_height, { min: 180, int: true }),
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
    ...(jump.windup_s !== undefined ? [num('battle.jump.windup_s', jump.windup_s, { min: 0 })] : []),
    num('battle.strong_jump.height_mult', strong.height_mult, { gt: 0 }),
    num('battle.strong_jump.speed_mult', strong.speed_mult, { gt: 0 }),
    num('battle.strong_jump.cooldown_s', strong.cooldown_s, { min: 0 }),
    // M7 (I-23 · H-51) — 키가 있을 때만
    (e) => {
      if (strong.mode !== undefined && strong.mode !== 'tap' && strong.mode !== 'timing') e.push(`battle.strong_jump.mode: tap / timing 중 하나 (${String(strong.mode)})`);
    },
    ...(battle.strong_timing !== undefined
      ? ((t) => [
          num('battle.strong_timing.chance_pct', t.chance_pct, { min: 0, max: 100 }),
          num('battle.strong_timing.min_gap_jumps', t.min_gap_jumps, { min: 0 }),
          num('battle.strong_timing.window_to', t.window_to, { gt: 0, max: 1 }),
          num('battle.strong_timing.window_s', t.window_s, { gt: 0 }),
        ])(obj(battle.strong_timing))
      : []),
    ...(battle.targets !== undefined
      ? ((t) => [
          num('battle.targets.chance_pct', t.chance_pct, { min: 0, max: 100 }),
          num('battle.targets.count_min', t.count_min, { min: 0, int: true }),
          num('battle.targets.count_max', t.count_max, { min: 0, int: true }),
          num('battle.targets.life_s', t.life_s, { gt: 0 }),
          num('battle.targets.radius_ratio', t.radius_ratio, { gt: 0, max: 0.25 }),
          num('battle.targets.min_dist_ratio', t.min_dist_ratio, { min: 0, max: 0.5 }),
          num('battle.targets.miss_limit', t.miss_limit, { min: 1, int: true }),
          num('battle.targets.perfect_bonus_strikes', t.perfect_bonus_strikes, { min: 0, int: true }),
          (e: string[]) => {
            if (typeof t.count_min === 'number' && typeof t.count_max === 'number' && t.count_min > t.count_max) e.push('battle.targets: count_min ≤ count_max');
          },
        ])(obj(battle.targets))
      : []),
    num('battle.strike_interval_s', battle.strike_interval_s, { gt: 0 }),
    num('battle.combo_window_s', battle.combo_window_s, { gt: 0 }),
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
    num('strip.debris_pieces', strip.debris_pieces, { min: 0, int: true }),
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

  // 건물 테이블: building_id PK 중복 없음
  const ids = new Set<string>();
  const bRows = buildings.rows;
  if (!Array.isArray(bRows) || bRows.length === 0) {
    errors.push('buildings.rows: 1행 이상 필요');
  } else {
    bRows.forEach((r, i) => {
      const row = obj(r);
      const p = `buildings.rows[${i}]`;
      if (typeof row.building_id !== 'string' || row.building_id === '') errors.push(`${p}.building_id: 빈 문자열 불가`);
      else if (ids.has(row.building_id)) errors.push(`${p}.building_id: PK 중복 (${row.building_id})`);
      else ids.add(row.building_id);
      if (typeof row.name !== 'string' || row.name === '') errors.push(`${p}.name: 빈 문자열 불가`);
      num(`${p}.hp`, row.hp, { gt: 0, int: true })(errors);
      num(`${p}.fall_speed`, row.fall_speed, { gt: 0 })(errors);
      num(`${p}.weight`, row.weight, { gt: 0 })(errors);
      num(`${p}.debris_reward`, row.debris_reward, { min: 0, int: true })(errors);
      bool(`${p}.is_boss`, row.is_boss)(errors);
    });
  }

  // 스테이지 표: 1부터 빈칸 없이, building_id는 건물 테이블에 있어야 함 (FK)
  const rows = stages.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    errors.push('stages.rows: 1행 이상 필요');
  } else {
    rows.forEach((r, i) => {
      const row = obj(r);
      num(`stages.rows[${i}].stage`, row.stage, { int: true })(errors);
      if (typeof row.building_id !== 'string' || !ids.has(row.building_id)) {
        errors.push(`stages.rows[${i}].building_id: 건물 테이블에 없음 (FK ${JSON.stringify(row.building_id)})`);
      }
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

/** 스테이지 → 그 스테이지에 떨어지는 건물 행 (FK 조회) */
export function buildingForStage(cfg: Pick<GameConfig, 'stages' | 'buildings'>, stage: number): BuildingRow {
  const row = stageRow(cfg.stages, stage);
  const b = cfg.buildings.rows.find((x) => x.building_id === row.building_id);
  if (!b) throw new Error(`building_id ${row.building_id} 없음 (config 검증을 먼저 통과해야 함)`);
  return b;
}
