// 와르르 개미 — src/data/*.json 검증
// 사용: npm run data:check   (npm run data는 변환 뒤 이 검증을 같이 돈다)
// 새 시트를 추가하면: build_data.mjs SHEETS에 한 줄 + 아래 REQUIRED · 검사에 한 줄
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// 있어야 하는 JSON (build_data.mjs SHEETS의 out과 같아야 함)
export const REQUIRED = ["buildings", "stages", "game_config", "ui_strings"];

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
];

// ui_strings 필수 키 (view가 읽는 것)
const UI_KEYS = [
  "hud.stage", "hud.hp", "hud.auto_on", "hud.auto_off",
  "challenge.title", "challenge.sub",
  "toast.advance", "toast.retreat", "toast.restart", "toast.challenge", "toast.breakthrough", "toast.menu_wip",
  "menu.upgrade", "menu.equip", "menu.nest", "menu.shop",
  "fx.crumble", "ant.down", "nest.title", "nest.sub", "nest.back",
];

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
  const errors = validateAll(readDataDir(dir));
  if (errors.length) {
    console.error(`검증 실패 ${errors.length}건`);
    errors.forEach((e) => console.error(" - " + e));
    process.exit(1);
  }
  console.log(`검증 통과 (${dir})`);
}
