// 와르르 개미 — 파츠 그림의 투명 영역을 재서 기준점(pivot · socket · grip)을 제안한다 (docs/art.md §4)
// 사용: node tools/suggest_pivots.mjs [그림 폴더]   (기본 art/game — 하위 폴더까지)
// 결과는 제안값일 뿐. 시트(design/tables/art.xlsx)에 옮긴 뒤 [ART] 패널 "기준점 보기"로 눈으로 맞춘다
// 규칙 (docs/art.md 자세 규격): 팔 = 아래 끝 가운데가 어깨(pivot) · 위 끝 가운데가 손(socket)
//                               다리 = 위 끝 가운데가 엉덩이(pivot) · 몸통 · 머리 = 아래 끝 가운데(pivot)
//                               무기 = 아래 끝에서 손잡이 길이의 10% 위가 grip
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const DIR = process.argv[2] || "art/game";
const ALPHA = 16;   // 이 값보다 불투명한 픽셀만 그림으로 봄

function files(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p) : e.name.endsWith(".png") ? [p] : [];
  }).sort();
}

function bbox(png) {
  let x0 = png.width, y0 = png.height, x1 = -1, y1 = -1;
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
    if (png.data[(y * png.width + x) * 4 + 3] > ALPHA) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

// 가로줄 y에서 그림이 있는 가운데 x (손 · 어깨 같은 끝부분 중심)
function midX(png, y) {
  let a = -1, b = -1;
  for (let x = 0; x < png.width; x++) if (png.data[(y * png.width + x) * 4 + 3] > ALPHA) { if (a < 0) a = x; b = x; }
  return a < 0 ? png.width / 2 : (a + b) / 2;
}

const r3 = (v) => Math.round(v * 1000) / 1000;
const list = files(DIR);
if (!list.length) { console.log(`${DIR}: PNG 없음`); process.exit(0); }
console.log("file | 크기 | 여백(상 하 좌 우 px) | 제안");
for (const f of list) {
  const png = PNG.sync.read(fs.readFileSync(f));
  const b = bbox(png);
  const name = path.basename(f);
  if (!b) { console.log(`${name} | ${png.width}×${png.height} | 전부 투명`); continue; }
  const W = png.width, H = png.height, h = b.y1 - b.y0;
  const at = (y) => ({ x: r3(midX(png, Math.round(y)) / W), y: r3(y / H) });
  let s;
  if (/_arm\.png$/.test(name)) { const p = at(b.y1 - h * 0.04), k = at(b.y0 + h * 0.06); s = `pivot ${p.x}, ${p.y} · socket ${k.x}, ${k.y}`; }
  else if (/_leg\.png$/.test(name)) { const p = at(b.y0 + h * 0.05); s = `pivot ${p.x}, ${p.y}`; }
  else if (/^weapon_/.test(name)) { const g = at(b.y1 - h * 0.1); s = `grip ${g.x}, ${g.y}`; }
  else { const p = at(b.y1 - 1); s = `pivot ${p.x}, ${p.y}`; }
  const margin = [b.y0, H - 1 - b.y1, b.x0, W - 1 - b.x1];
  const warn = margin.some((m) => m > 4) ? " · ⚠ 여백 4px 넘음 (docs/art.md §2)" : "";
  console.log(`${name} | ${W}×${H} | ${margin.join(" ")} | ${s}${warn}`);
}
