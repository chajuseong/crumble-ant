// 와르르 개미 — 데이터 원본 시트(design/tables/*.xlsx) → src/data/*.json 변환 + 검증
// 사용: npm run data
//       node tools/build_data.mjs [입력 폴더 또는 xlsx] [출력 폴더]
// 시트 규칙: design/tables/README.md (잼병 원정대 tools/build_data.mjs 구조를 따름 — 시트 이름은 와르르 것만)
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { validateAll } from "./validate_data.mjs";

// 변환할 시트 목록 — 새 시트는 여기 한 줄 (kind: "kv" = key/type/value, "table" = 1행 키 · 2행 타입 · 3행 설명 · 4행~ 데이터)
const SHEETS = [
  { sheet: "buildings", kind: "table", out: "buildings" },
  { sheet: "stages", kind: "table", out: "stages" },
  { sheet: "game_config", kind: "kv", out: "game_config" },
  { sheet: "ui_strings", kind: "kv", out: "ui_strings" },
];

const IN = process.argv[2] || "design/tables";
const OUT = process.argv[3] || "src/data";
const problems = [];
const fileOf = new Map();   // 시트 이름 → 파일 이름 (오류에)
const label = (sheet) => (fileOf.has(sheet) ? `${fileOf.get(sheet)} › ${sheet}` : sheet);
const fail = (sheet, where, msg) => problems.push(`[${label(sheet)}] ${where}: ${msg}`);

// ---------- 셀 값 ----------
function raw(cell) {
  let v = cell.value;
  if (v === null || v === undefined) return null;
  if (typeof v === "object") {
    if (v.richText) v = v.richText.map((t) => t.text).join("");
    else if ("formula" in v || "sharedFormula" in v) {
      const f = String(v.formula ?? v.sharedFormula ?? "").replace(/\s/g, "").toUpperCase();
      if (f === "TRUE()" || f === "TRUE") v = true;
      else if (f === "FALSE()" || f === "FALSE") v = false;
      else v = v.result ?? null;
    } else if (v.text !== undefined) v = v.text;
    else if (v instanceof Date) v = v.toISOString();
  }
  if (typeof v === "string" && v.trim() === "") return null;
  return v;
}

function convert(v, type, sheet, where) {
  const nullable = type.endsWith("?");
  const t = nullable ? type.slice(0, -1) : type;
  if (v === null) {
    if (nullable) return null;
    if (t === "string") return "";
    fail(sheet, where, `값 필요 (타입 ${type})`);
    return null;
  }
  const num = (x, isInt) => {
    const n = typeof x === "number" ? x : Number(String(x).trim());
    if (!Number.isFinite(n)) { fail(sheet, where, `숫자가 아님 "${x}"`); return null; }
    if (isInt && !Number.isInteger(n)) { fail(sheet, where, `정수가 아님 "${x}"`); return null; }
    return n;
  };
  switch (t) {
    case "int": return num(v, true);
    case "float": return num(v, false);
    case "bool": {
      if (typeof v === "boolean") return v;
      const s = String(v).trim().toUpperCase();
      if (["TRUE", "1"].includes(s)) return true;
      if (["FALSE", "0"].includes(s)) return false;
      fail(sheet, where, `TRUE/FALSE가 아님 "${v}"`); return null;
    }
    case "string": return String(v);
    case "int[]": return String(v).split(",").map((x) => x.trim()).filter(Boolean).map((x) => num(x, true));
    case "float[]": return String(v).split(",").map((x) => x.trim()).filter(Boolean).map((x) => num(x, false));
    case "string[]": return String(v).split("|").map((x) => x.trim());
    default: fail(sheet, where, `알 수 없는 타입 "${type}"`); return null;
  }
}

// 표 시트: 1행 키 / 2행 타입 / 3행 설명 / 4행~ 데이터. #열 · A열이 #인 행 제외
function readTable(ws, name) {
  const cols = [];
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell, c) => {
    const key = String(raw(cell) ?? "").trim();
    if (!key || key.startsWith("#")) return;
    const type = String(raw(ws.getRow(2).getCell(c)) ?? "").trim();
    if (!type) fail(name, key, "2행 타입 없음");
    cols.push({ c, key, type });
  });
  const rows = [];
  if (!cols.length) return rows;
  for (let r = 4; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    if (cols.every(({ c }) => raw(row.getCell(c)) === null)) continue;
    const first = raw(row.getCell(cols[0].c));
    if (typeof first === "string" && first.startsWith("#")) continue;
    const obj = {};
    for (const { c, key, type } of cols) obj[key] = convert(raw(row.getCell(c)), type, name, `${r}행 ${key}`);
    rows.push(obj);
  }
  return rows;
}

// 키-값 시트: key / type / value (1행 머리글, 2행~). 점(.) 키는 묶음
function readKV(ws, name) {
  const out = {};
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const key = raw(row.getCell(1));
    if (key === null || String(key).startsWith("#")) continue;
    const type = String(raw(row.getCell(2)) ?? "").trim();
    const val = convert(raw(row.getCell(3)), type, name, `${r}행 ${key}`);
    const parts = String(key).split(".");
    let o = out;
    for (const p of parts.slice(0, -1)) {
      if (o[p] !== undefined && (typeof o[p] !== "object" || o[p] === null)) { fail(name, `${r}행 ${key}`, `"${p}"가 이미 값으로 쓰임`); break; }
      o = o[p] ??= {};
    }
    if (parts.at(-1) in o) fail(name, `${r}행 ${key}`, "키 중복");
    o[parts.at(-1)] = val;
  }
  return out;
}

// ---------- 읽기: 폴더면 모든 .xlsx ----------
const inputs = fs.statSync(IN).isDirectory()
  ? fs.readdirSync(IN).filter((f) => f.endsWith(".xlsx") && !f.startsWith("~$")).sort().map((f) => path.join(IN, f))
  : [IN];
if (!inputs.length) { console.error(`${IN}에 .xlsx가 없습니다`); process.exit(1); }
const sheets = new Map();   // 시트 이름 → 워크시트 (폴더 전체에서 하나)
for (const file of inputs) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(file);
  for (const ws of book.worksheets) {
    if (ws.name === "README" || ws.name.startsWith("_")) continue;   // 안내 · 작업용 시트
    const name = path.basename(file);
    if (sheets.has(ws.name)) { problems.push(`[${ws.name}] -: 시트가 두 파일에 있음 — ${fileOf.get(ws.name)} · ${name}`); continue; }
    sheets.set(ws.name, ws);
    fileOf.set(ws.name, name);
  }
}

const data = {};
for (const { sheet, kind, out } of SHEETS) {
  const ws = sheets.get(sheet);
  if (!ws) { fail(sheet, "-", `시트 없음 (${IN}의 어느 파일에도 없음)`); continue; }
  data[out] = kind === "kv" ? readKV(ws, sheet) : readTable(ws, sheet);
}
for (const name of sheets.keys()) {
  if (!SHEETS.some((s) => s.sheet === name)) problems.push(`[${label(name)}] -: SHEETS 목록에 없는 시트 (tools/build_data.mjs에 한 줄 추가하거나 이름을 _로 시작)`);
}

if (problems.length) {
  console.error(`변환 실패 ${problems.length}건 (JSON을 쓰지 않았습니다)`);
  problems.forEach((p) => console.error(" - " + p));
  process.exit(1);
}
const errors = validateAll(data);
if (errors.length) {
  console.error(`검증 실패 ${errors.length}건 (JSON을 쓰지 않았습니다)`);
  errors.forEach((e) => console.error(" - " + e));
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });
for (const [name, obj] of Object.entries(data)) fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(obj, null, 2) + "\n", "utf-8");
console.log(`변환 · 검증 통과 → ${OUT} (${inputs.length}파일 · 시트 ${sheets.size}개)`);
