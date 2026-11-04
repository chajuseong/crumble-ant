// 와르르 개미 — src/data/*.json 검증
// 사용: npm run data:check   (npm run data는 변환 뒤 이 검증을 같이 돈다)
// 새 시트를 추가하면: build_data.mjs SHEETS에 한 줄 + 아래 REQUIRED · 검사에 한 줄
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// 있어야 하는 JSON (build_data.mjs SHEETS의 out과 같아야 함)
export const REQUIRED = ["buildings", "stages", "game_config", "ui_strings", "fx_config", "art_config", "ant_parts", "ant_mounts", "weapons", "ant_loadout", "upgrades"];

// M3 아트 — 파츠 이름 · 파일 이름 규칙 (docs/art.md §3)
export const ART_PARTS = ["body", "head_normal", "head_hit", "head_down", "arm", "leg"];
export const ART_MOUNTS = ["leg_l", "leg_r", "arm_1", "arm_2", "arm_3", "arm_4", "body", "head"];
const ID = /^[a-z0-9_]+$/;

const KEY_PART = /^[a-z][a-z0-9_]*$/;   // 키 조각: 영문 소문자 · 숫자 · _ (점 묶음의 각 조각)
const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

// game_config 필수 키: [키, 종류, 조건] — 종류 int · num · bool · str · int4 (정수 4개 배열)
// 조건: gt = 초과 · min = 이상 · max = 이하 (PR #2 validateConfig 규칙을 옮김)
const CONFIG_KEYS = [
  ["layout.frame_width", "int", { gt: 0 }],
  ["layout.frame_height", "int", { gt: 0 }],
  ["layout.hud_ratio", "num", { gt: 0, max: 1 }],
  ["layout.battle_ratio", "num", { gt: 0, max: 1 }],
  ["layout.strip_ratio", "num", { gt: 0, max: 1 }],
  ["layout.strip_menu_height_ratio", "num", { gt: 0, max: 1 }],
  ["layout.challenge_button_y_ratio", "num", { min: 0, max: 1 }],
  ["battle.ant.max_hp", "int", { gt: 0 }],
  ["battle.ant.height_ratio", "num", { gt: 0, max: 0.5 }],
  ["battle.ant.width_ratio", "num", { gt: 0, max: 1 }],
  ["battle.ant.down_duration_s", "num", { min: 0 }],
  ["battle.ant.refill_hp_on_stage_start", "bool"],
  ["battle.jump.height_ratio", "num", { gt: 0, max: 1 }],
  ["battle.jump.speed_ratio_per_s", "num", { gt: 0 }],
  ["battle.jump.ground_delay_s", "num", { min: 0 }],
  ["battle.strong_jump.height_mult", "num", { gt: 0 }],
  ["battle.strong_jump.speed_mult", "num", { gt: 0 }],
  ["battle.strong_jump.cooldown_s", "num", { min: 0 }],
  ["battle.arm_damage", "int4", { min: 0 }],
  ["battle.strike_interval_s", "num", { gt: 0 }],
  ["battle.strike_interval_min_s", "num", { gt: 0 }],
  ["battle.combo_window_s", "num", { gt: 0 }],
  ["battle.arm_order_resets_each_jump", "bool"],
  ["battle.landing_damage_coeff", "num", { min: 0 }],
  ["battle.building.height_ratio", "num", { gt: 0, max: 1 }],
  ["battle.building.width_ratio", "num", { gt: 0, max: 1 }],
  ["battle.building.spawn_bottom_ratio", "num", { gt: 0 }],
  ["battle.building.spawn_delay_s", "num", { min: 0 }],
  ["battle.building.landed_linger_s", "num", { min: 0 }],
  ["stage.beyond_last_row", "str", { oneOf: ["repeat_last"] }],
  ["input.strip_tap_slop_ratio", "num", { gt: 0, max: 1 }],
  ["input.strip_tap_max_ms", "num", { gt: 0 }],
  ["input.strip_swipe_min_dy_ratio", "num", { gt: 0, max: 1 }],
  ["input.strip_swipe_max_ms", "num", { gt: 0 }],
  ["input.nest_swipe_up_min_dy_ratio", "num", { gt: 0, max: 1 }],
  ["strip.worker_speed_ratio_per_s", "num", { gt: 0 }],
  ["strip.worker_size_ratio", "num", { gt: 0, max: 1 }],
  ["strip.worker_gap_ratio", "num", { min: 0, max: 1 }],
  ["strip.ambient_spawn_interval_s", "num", { gt: 0 }],
  ["strip.ambient_carry_amount", "int", { min: 0 }],
  ["strip.debris_pieces", "int", { min: 0 }],
  ["strip.debris_pickup_s", "num", { min: 0 }],
  ["strip.burrow_x_ratio", "num", { gt: 0, max: 1 }],
  ["strip.popup_rise_ratio", "num", { min: 0 }],
  ["strip.popup_duration_s", "num", { gt: 0 }],
  ["economy.carry_delay_s", "num", { min: 0 }],
  ["economy.start_debris", "int", { min: 0 }],
];

// fx_config 필수 키 (M2 타격 연출 — view만 읽음, core 결과와 무관)
const FX_KEYS = [
  ["hitstop.hit_ms", "int", { min: 0 }], ["hitstop.final_ms", "int", { min: 0 }], ["hitstop.max_ms", "int", { min: 0 }],
  ["flash.alpha", "num", { min: 0, max: 1 }], ["flash.ms", "int", { min: 0 }],
  ["building_shake.px", "num", { min: 0 }], ["building_shake.ms", "int", { min: 0 }],
  ["crack.steps", "int", { min: 1 }],
  ["camera.hit_ms", "int", { min: 0 }], ["camera.hit_intensity", "num", { min: 0, max: 0.1 }],
  ["camera.final_ms", "int", { min: 0 }], ["camera.final_intensity", "num", { min: 0, max: 0.1 }],
  ["camera.destroy_ms", "int", { min: 0 }], ["camera.destroy_intensity", "num", { min: 0, max: 0.1 }],
  ["combo.min_show", "int", { min: 1 }], ["combo.text_px", "num", { gt: 0 }], ["combo.pop_scale", "num", { gt: 0 }], ["combo.ms", "int", { min: 0 }],
  ["damage.pop_scale", "num", { gt: 0 }], ["damage.text_px", "num", { gt: 0 }], ["damage.ms", "int", { min: 0 }],
  ["arm.stretch", "num", { gt: 0 }],
  ["punch.stretch", "num", { gt: 0 }], ["punch.fist_scale", "num", { gt: 0 }], ["punch.ms", "int", { min: 0 }],
  ["hit_debris.count", "int", { min: 0 }], ["hit_debris.speed_px", "num", { min: 0 }], ["hit_debris.life_ms", "int", { min: 0 }], ["hit_debris.size_px", "num", { gt: 0 }],
  ["crumble_text.px", "num", { gt: 0 }], ["crumble_text.plate_alpha", "num", { min: 0, max: 1 }], ["crumble_text.stroke_px", "num", { min: 0 }], ["crumble_text.ms", "int", { min: 0 }],
  ["sfx.volume", "num", { min: 0, max: 1 }], ["sfx.hit_hz", "num", { gt: 0 }], ["sfx.hit_ms", "int", { gt: 0 }], ["sfx.final_hz", "num", { gt: 0 }], ["sfx.final_ms", "int", { gt: 0 }],
  ["sfx.crumble_ms", "int", { gt: 0 }], ["sfx.combo_pitch_step", "num", { min: 0 }], ["sfx.combo_pitch_max", "int", { min: 0 }],
];

// ui_strings 필수 키 (view가 읽는 것)
const UI_KEYS = [
  "hud.stage", "hud.hp", "hud.auto_on", "hud.auto_off",
  "challenge.title", "challenge.sub",
  "toast.advance", "toast.retreat", "toast.restart", "toast.challenge", "toast.breakthrough", "toast.menu_wip",
  "menu.upgrade", "menu.equip", "menu.nest", "menu.shop",
  "fx.crumble", "fx.combo", "ant.down", "nest.title", "nest.sub", "nest.back",
  "hud.debris", "upgrade.title", "upgrade.level", "upgrade.max", "upgrade.short", "upgrade.close", "upgrade.reset", "upgrade.reset_confirm",
  "upgrade.fx.attack_power", "upgrade.fx.attack_speed", "upgrade.fx.jump_power", "upgrade.fx.move_speed",
  "upgrade.now.attack_power", "upgrade.now.attack_speed", "upgrade.now.jump_power", "upgrade.now.move_speed",
];

// 강화 4종 (M4 — I-12 · H-17). stat은 코드가 아는 4종 고정 — 각 1행
const UPGRADE_STATS = ["attack_power", "attack_speed", "jump_power", "move_speed"];
/** C# int 상한 (Unity 이식 — 비용이 넘치면 안 됨) */
const INT32_MAX = 2147483647;
/** 정수 반복 비용 (src/core/economy.ts와 같은 식): Lv 0 → 1 = base, 다음 = floor(이전 × growth / 100) */
export function upgradeCost(row, lv) {
  let c = row.cost_base;
  for (let i = 0; i < lv; i++) c = Math.floor((c * row.cost_growth_pct) / 100);
  return c;
}

const get = (obj, dotted) => dotted.split(".").reduce((o, k) => (isPlainObject(o) ? o[k] : undefined), obj);

function checkRange(where, v, o, errors) {
  if (o.gt !== undefined && !(v > o.gt)) errors.push(`${where}: ${o.gt}보다 커야 함 (${v})`);
  if (o.min !== undefined && !(v >= o.min)) errors.push(`${where}: ${o.min} 이상이어야 함 (${v})`);
  if (o.max !== undefined && !(v <= o.max)) errors.push(`${where}: ${o.max} 이하여야 함 (${v})`);
}

function checkValue(where, v, kind, o = {}, errors) {
  if (v === undefined) return errors.push(`${where}: 없음`);
  switch (kind) {
    case "int": if (!Number.isInteger(v)) return errors.push(`${where}: 정수여야 함 (${JSON.stringify(v)})`); return checkRange(where, v, o, errors);
    case "num": if (!isNum(v)) return errors.push(`${where}: 숫자여야 함 (${JSON.stringify(v)})`); return checkRange(where, v, o, errors);
    case "bool": if (typeof v !== "boolean") errors.push(`${where}: TRUE/FALSE여야 함 (${JSON.stringify(v)})`); return;
    case "str":
      if (typeof v !== "string" || v === "") return errors.push(`${where}: 빈 문자열 불가`);
      if (o.oneOf && !o.oneOf.includes(v)) errors.push(`${where}: ${o.oneOf.join(" / ")} 중 하나 (${v})`);
      return;
    case "int4":
      if (!Array.isArray(v) || v.length !== 4) return errors.push(`${where}: 정확히 4개 (팔 1~4 슬롯)`);
      v.forEach((x, i) => (Number.isInteger(x) ? checkRange(`${where}[${i}]`, x, o, errors) : errors.push(`${where}[${i}]: 정수여야 함`)));
      return;
  }
}

function walkKeys(obj, where, errors, leaf) {
  for (const [k, v] of Object.entries(obj)) {
    const p = where ? `${where}.${k}` : k;
    if (!KEY_PART.test(k)) errors.push(`${p}: 키 형식 (영문 소문자 · 숫자 · _)`);
    if (isPlainObject(v)) walkKeys(v, p, errors, leaf);
    else leaf?.(p, v);
  }
}

/** data = { 파일 이름(확장자 없이): 내용 } → 오류 목록 (빈 배열 = 통과) */
export function validateAll(data) {
  const errors = [];
  for (const name of REQUIRED) if (!(name in data)) errors.push(`${name}.json: 없음`);
  // 깨진 글자 (엑셀 밖에서 저장할 때 U+FFFD로 깨지는 경우 — 잼병 원정대에서 실제로 있었음)
  for (const [name, obj] of Object.entries(data)) {
    if (JSON.stringify(obj).includes("�")) errors.push(`${name}.json: 깨진 글자(U+FFFD)가 있음 — 시트 저장 방식을 확인`);
  }

  // buildings — building_id PK
  const ids = new Set();
  if ("buildings" in data) {
    const rows = data.buildings;
    if (!Array.isArray(rows) || rows.length === 0) errors.push("buildings: 1행 이상 필요");
    else rows.forEach((r, i) => {
      const w = `buildings[${i}]`;
      if (typeof r.building_id !== "string" || r.building_id === "") errors.push(`${w}.building_id: 빈 문자열 불가`);
      else if (ids.has(r.building_id)) errors.push(`${w}.building_id: PK 중복 (${r.building_id})`);
      else ids.add(r.building_id);
      checkValue(`${w}.name`, r.name, "str", {}, errors);
      checkValue(`${w}.hp`, r.hp, "int", { gt: 0 }, errors);
      checkValue(`${w}.fall_speed`, r.fall_speed, "num", { gt: 0 }, errors);
      checkValue(`${w}.weight`, r.weight, "num", { gt: 0 }, errors);
      checkValue(`${w}.debris_reward`, r.debris_reward, "int", { min: 0 }, errors);
      checkValue(`${w}.is_boss`, r.is_boss, "bool", {}, errors);
    });
  }

  // stages — stage PK (1부터 빈칸 없이) · building_id FK
  if ("stages" in data) {
    const rows = data.stages;
    if (!Array.isArray(rows) || rows.length === 0) errors.push("stages: 1행 이상 필요");
    else rows.forEach((r, i) => {
      const w = `stages[${i}]`;
      if (r.stage !== i + 1) errors.push(`${w}.stage: ${i + 1}이어야 함 (1부터 빈칸 없이, 지금 ${JSON.stringify(r.stage)})`);
      if (!ids.has(r.building_id)) errors.push(`${w}.building_id: buildings에 없음 (FK ${JSON.stringify(r.building_id)})`);
      checkValue(`${w}.buildings_to_clear`, r.buildings_to_clear, "int", { min: 1 }, errors);
    });
  }

  // game_config
  if ("game_config" in data) {
    const c = data.game_config;
    if (!isPlainObject(c)) errors.push("game_config.json: 객체(키-값)여야 함");
    else {
      walkKeys(c, "game_config", errors);
      for (const [key, kind, o] of CONFIG_KEYS) checkValue(`game_config.${key}`, get(c, key), kind, o, errors);
      const sum = ["hud_ratio", "battle_ratio", "strip_ratio"].reduce((s, k) => s + Number(get(c, `layout.${k}`)), 0);
      if (Number.isFinite(sum) && Math.abs(sum - 1) > 1e-6) errors.push(`game_config.layout: hud + battle + strip 비율 합이 1이어야 함 (${sum})`);
    }
  }

  // fx_config
  if ("fx_config" in data) {
    const f = data.fx_config;
    if (!isPlainObject(f)) errors.push("fx_config.json: 객체(키-값)여야 함");
    else {
      walkKeys(f, "fx_config", errors);
      for (const [key, kind, o] of FX_KEYS) checkValue(`fx_config.${key}`, get(f, key), kind, o, errors);
    }
  }

  // ── M3 아트 (view만 읽음) ──
  const ratio = (w, k, v, errors) => checkValue(`${w}.${k}`, v, "num", { min: 0, max: 1 }, errors);
  if ("art_config" in data) {
    const a = data.art_config;
    if (!isPlainObject(a)) errors.push("art_config.json: 객체(키-값)여야 함");
    else {
      checkValue("art_config.skin_id", a.skin_id, "str", {}, errors);
      checkValue("art_config.enabled", a.enabled, "bool", {}, errors);
      for (const k of ["draw_scale", "draw_scale_max", "weapon_scale", "weapon_scale_max"]) checkValue(`art_config.${k}`, a[k], "num", { gt: 0 }, errors);
      checkValue("art_config.hit_face_ms", a.hit_face_ms, "int", { min: 0 }, errors);
      if (a.draw_scale > a.draw_scale_max) errors.push("art_config.draw_scale: draw_scale_max 이하여야 함");
      if (a.weapon_scale > a.weapon_scale_max) errors.push("art_config.weapon_scale: weapon_scale_max 이하여야 함");
    }
  }
  const partKeys = new Set();
  if ("ant_parts" in data) {
    const rows = data.ant_parts;
    if (!Array.isArray(rows)) errors.push("ant_parts: 표여야 함");
    else rows.forEach((r, i) => {
      const w = `ant_parts[${i}]`;
      if (typeof r.skin_id !== "string" || !ID.test(r.skin_id)) errors.push(`${w}.skin_id: 영문 소문자 · 숫자 · _`);
      if (!ART_PARTS.includes(r.part_id)) errors.push(`${w}.part_id: ${ART_PARTS.join(" · ")} 중 하나 (${JSON.stringify(r.part_id)})`);
      const key = `${r.skin_id}/${r.part_id}`;
      if (partKeys.has(key)) errors.push(`${w}: PK 중복 (${key})`);
      partKeys.add(key);
      if (r.file !== `ant_${r.skin_id}_${r.part_id}.png`) errors.push(`${w}.file: ant_${r.skin_id}_${r.part_id}.png 여야 함 (${r.file})`);
      ratio(w, "pivot_x", r.pivot_x, errors); ratio(w, "pivot_y", r.pivot_y, errors);
      if (r.part_id === "arm") { ratio(w, "socket_x", r.socket_x, errors); ratio(w, "socket_y", r.socket_y, errors); }
      checkValue(`${w}.draw_h`, r.draw_h, "num", { gt: 0 }, errors);
    });
    const skin = isPlainObject(data.art_config) ? data.art_config.skin_id : undefined;
    for (const p of ART_PARTS) if (skin && !partKeys.has(`${skin}/${p}`)) errors.push(`ant_parts: 스킨 ${skin}의 ${p} 없음`);
  }
  if ("ant_mounts" in data) {
    const rows = data.ant_mounts;
    const ids = new Set();
    if (!Array.isArray(rows)) errors.push("ant_mounts: 표여야 함");
    else rows.forEach((r, i) => {
      const w = `ant_mounts[${i}]`;
      if (!ART_MOUNTS.includes(r.mount_id)) errors.push(`${w}.mount_id: ${ART_MOUNTS.join(" · ")} 중 하나`);
      if (ids.has(r.mount_id)) errors.push(`${w}.mount_id: PK 중복 (${r.mount_id})`);
      ids.add(r.mount_id);
      if (!ART_PARTS.includes(r.part_id)) errors.push(`${w}.part_id: ant_parts에 없음 (FK ${JSON.stringify(r.part_id)})`);
      checkValue(`${w}.anchor_x`, r.anchor_x, "num", { min: -1, max: 1 }, errors);
      checkValue(`${w}.anchor_y`, r.anchor_y, "num", { min: 0, max: 1.5 }, errors);
      checkValue(`${w}.angle_deg`, r.angle_deg, "num", { min: -180, max: 180 }, errors);
      checkValue(`${w}.layer`, r.layer, "int", {}, errors);
      checkValue(`${w}.mirror`, r.mirror, "bool", {}, errors);
    });
    for (const m of ART_MOUNTS) if (Array.isArray(rows) && !ids.has(m)) errors.push(`ant_mounts: ${m} 없음`);
  }
  const weaponIds = new Set();
  if ("weapons" in data) {
    const rows = data.weapons;
    if (!Array.isArray(rows)) errors.push("weapons: 표여야 함");
    else rows.forEach((r, i) => {
      const w = `weapons[${i}]`;
      if (typeof r.weapon_id !== "string" || !ID.test(r.weapon_id)) errors.push(`${w}.weapon_id: 영문 소문자 · 숫자 · _ (${JSON.stringify(r.weapon_id)})`);
      else if (weaponIds.has(r.weapon_id)) errors.push(`${w}.weapon_id: PK 중복 (${r.weapon_id})`);
      weaponIds.add(r.weapon_id);
      checkValue(`${w}.name`, r.name, "str", {}, errors);
      if (r.file !== `weapon_${r.weapon_id}.png`) errors.push(`${w}.file: weapon_${r.weapon_id}.png 여야 함 (${r.file})`);
      ratio(w, "grip_x", r.grip_x, errors); ratio(w, "grip_y", r.grip_y, errors);
      checkValue(`${w}.scale`, r.scale, "num", { gt: 0 }, errors);
      checkValue(`${w}.angle_deg`, r.angle_deg, "num", { min: -180, max: 180 }, errors);
    });
  }
  if ("ant_loadout" in data) {
    const rows = data.ant_loadout;
    if (!Array.isArray(rows) || rows.length !== 4) errors.push("ant_loadout: 정확히 4행 (팔 슬롯 1 ~ 4)");
    else rows.forEach((r, i) => {
      if (r.slot !== i + 1) errors.push(`ant_loadout[${i}].slot: ${i + 1}이어야 함`);
      if (r.weapon_id !== null && !weaponIds.has(r.weapon_id)) errors.push(`ant_loadout[${i}].weapon_id: weapons에 없음 (FK ${JSON.stringify(r.weapon_id)}) — 빈칸 = 맨주먹`);
    });
  }

  // upgrades (M4)
  if ("upgrades" in data) {
    const rows = data.upgrades;
    if (!Array.isArray(rows)) errors.push("upgrades: 표여야 함");
    else {
      const ids = new Set(), stats = new Set(), sorts = new Set();
      rows.forEach((r, i) => {
        const w = `upgrades[${i}]`;
        if (typeof r.upgrade_id !== "string" || !ID.test(r.upgrade_id)) errors.push(`${w}.upgrade_id: 영문 소문자 · 숫자 · _ (${JSON.stringify(r.upgrade_id)})`);
        else if (ids.has(r.upgrade_id)) errors.push(`${w}.upgrade_id: PK 중복 (${r.upgrade_id})`);
        ids.add(r.upgrade_id);
        checkValue(`${w}.name`, r.name, "str", {}, errors);
        if (!UPGRADE_STATS.includes(r.stat)) errors.push(`${w}.stat: ${UPGRADE_STATS.join(" · ")} 중 하나 (${JSON.stringify(r.stat)})`);
        else if (stats.has(r.stat)) errors.push(`${w}.stat: ${r.stat}이 두 번 (4종 각 1행)`);
        stats.add(r.stat);
        checkValue(`${w}.per_level_pct`, r.per_level_pct, "int", { gt: 0 }, errors);
        checkValue(`${w}.max_level`, r.max_level, "int", { min: 1 }, errors);
        checkValue(`${w}.cost_base`, r.cost_base, "int", { min: 1 }, errors);
        checkValue(`${w}.cost_growth_pct`, r.cost_growth_pct, "int", { min: 100 }, errors);
        checkValue(`${w}.sort`, r.sort, "int", {}, errors);
        if (sorts.has(r.sort)) errors.push(`${w}.sort: 중복 (${r.sort})`);
        sorts.add(r.sort);
        if ([r.max_level, r.cost_base, r.cost_growth_pct].every(Number.isInteger) && r.max_level >= 1 && upgradeCost(r, r.max_level - 1) > INT32_MAX)
          errors.push(`${w}: 마지막 Lv 비용이 C# int 상한을 넘음 (${upgradeCost(r, r.max_level - 1)})`);
      });
      for (const st of UPGRADE_STATS) if (!stats.has(st)) errors.push(`upgrades: stat ${st} 행 없음`);
      // 강화 끝까지 올렸을 때 판정이 깨지지 않는지 (game_config와 함께)
      const c = data.game_config, b = isPlainObject(c) ? c.battle : null;
      const maxPct = (st) => { const r = rows.find((x) => x.stat === st); return r && Number.isInteger(r.per_level_pct) && Number.isInteger(r.max_level) ? 100 + r.per_level_pct * r.max_level : null; };
      if (isPlainObject(b)) {
        const jp = maxPct("jump_power");
        const top = jp && isNum(b.jump?.height_ratio) && isNum(b.strong_jump?.height_mult) && isNum(b.ant?.height_ratio) ? (b.jump.height_ratio * jp / 100) * b.strong_jump.height_mult + b.ant.height_ratio : null;
        if (top !== null && top > 1 + 1e-9) errors.push(`upgrades jump_power: 최대 Lv 강점프 최고점 + 개미 키 = ${top.toFixed(3)} — 전투 구역 맨 위(1.0)를 넘음`);
        const sp = maxPct("attack_speed");
        const iv = sp && isNum(b.strike_interval_s) ? (b.strike_interval_s * 100) / sp : null;
        if (iv !== null && isNum(b.strike_interval_min_s) && iv < b.strike_interval_min_s - 1e-9) errors.push(`upgrades attack_speed: 최대 Lv 타격 간격 ${iv.toFixed(3)}초 < 하한 battle.strike_interval_min_s ${b.strike_interval_min_s}`);
      }
    }
  }
  if (isPlainObject(data.game_config?.battle) && isNum(data.game_config.battle.strike_interval_min_s) && isNum(data.game_config.battle.strike_interval_s) && data.game_config.battle.strike_interval_min_s > data.game_config.battle.strike_interval_s)
    errors.push("game_config.battle.strike_interval_min_s: strike_interval_s 이하여야 함");

  // ui_strings
  if ("ui_strings" in data) {
    const u = data.ui_strings;
    if (!isPlainObject(u)) errors.push("ui_strings.json: 객체(키-값)여야 함");
    else {
      walkKeys(u, "ui_strings", errors, (p, v) => { if (typeof v !== "string") errors.push(`${p}: 문구는 문자열이어야 함`); });
      for (const key of UI_KEYS) if (typeof get(u, key) !== "string") errors.push(`ui_strings.${key}: 없음`);
    }
  }
  return errors;
}

/**
 * 시트에 적힌 그림 파일이 art/game에 있는지 (H-12 Q6).
 * art/game 폴더가 없으면 경고만 (아트 납품 전 — 게임은 도형으로 그림), 폴더가 있는데 그 파일만 없으면 오류.
 */
export function artFileIssues(data, root = "art/game") {
  const out = { errors: [], warnings: [] };
  const need = [
    ...(Array.isArray(data.ant_parts) ? data.ant_parts.map((r) => ["ant", r.file]) : []),
    ...(Array.isArray(data.weapons) ? data.weapons.map((r) => ["weapons", r.file]) : []),
  ];
  if (!fs.existsSync(root)) {
    if (need.length) out.warnings.push(`${root} 폴더 없음 — 그림 ${need.length}개는 아트 납품 뒤 (그때까지 게임은 도형으로 그림)`);
    return out;
  }
  for (const [sub, file] of need) if (!fs.existsSync(path.join(root, sub, file))) out.errors.push(`${root}/${sub}/${file}: 파일 없음 (시트에는 있음)`);
  return out;
}

export function readDataDir(dir = "src/data") {
  const data = {};
  if (!fs.existsSync(dir)) return data;
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    data[path.basename(f, ".json")] = JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8"));
  }
  return data;
}

// 직접 실행: src/data/*.json 검증만
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const dir = process.argv[2] || "src/data";
  const data = readDataDir(dir);
  const art = artFileIssues(data);
  for (const w of art.warnings) console.warn(" ⚠ " + w);
  const errors = [...validateAll(data), ...art.errors];
  if (errors.length) {
    console.error(`검증 실패 ${errors.length}건`);
    errors.forEach((e) => console.error(" - " + e));
    process.exit(1);
  }
  console.log(`검증 통과 (${dir})`);
}
