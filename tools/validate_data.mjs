// 와르르 개미 — src/data/*.json 검증
// 사용: npm run data:check   (npm run data는 변환 뒤 이 검증을 같이 돈다)
// 새 시트를 추가하면: build_data.mjs SHEETS에 한 줄 + 아래 REQUIRED / 검사에 한 줄
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// 있어야 하는 JSON (build_data.mjs SHEETS의 out과 같아야 함)
export const REQUIRED = ["game_config", "ui_strings"];

const KEY_PART = /^[a-z][a-z0-9_]*$/;   // 키 조각: 영문 소문자 · 숫자 · _ (점 묶음의 각 조각)
const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

function walk(obj, where, errors, leaf) {
  for (const [k, v] of Object.entries(obj)) {
    const p = where ? `${where}.${k}` : k;
    if (!KEY_PART.test(k)) errors.push(`${p}: 키 형식 (영문 소문자 · 숫자 · _)`);
    if (isPlainObject(v)) walk(v, p, errors, leaf);
    else leaf(p, v);
  }
}

/** data = { 파일 이름(확장자 없이): 내용 } → 오류 목록 (빈 배열 = 통과) */
export function validateAll(data) {
  const errors = [];
  for (const name of REQUIRED) {
    if (!(name in data)) errors.push(`${name}.json: 없음`);
    else if (!isPlainObject(data[name])) errors.push(`${name}.json: 객체(키-값)여야 함`);
  }
  // 깨진 글자 (엑셀 밖에서 저장할 때 U+FFFD로 깨지는 경우 — 잼병 원정대에서 실제로 있었음)
  for (const [name, obj] of Object.entries(data)) {
    if (JSON.stringify(obj).includes("�")) errors.push(`${name}.json: 깨진 글자(U+FFFD)가 있음 — 시트 저장 방식을 확인`);
  }
  if (isPlainObject(data.game_config)) {
    walk(data.game_config, "game_config", errors, (p, v) => {
      if (v === undefined) errors.push(`${p}: 값 없음`);
    });
  }
  if (isPlainObject(data.ui_strings)) {
    walk(data.ui_strings, "ui_strings", errors, (p, v) => {
      if (typeof v !== "string") errors.push(`${p}: 문구는 문자열이어야 함`);
    });
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
