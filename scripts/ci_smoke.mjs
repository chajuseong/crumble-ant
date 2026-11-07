// 배포 빌드 화면 확인 — ① 콘솔 오류 0 ② 전투 구역이 그려짐 ③ 전투가 돎 = 건물 파괴 수가 오름 (docs/dev.md §7 M1 ⑤)
//   + M2 첫 탭 전 소리 객체 없음 · M3 개미 그림 상태 (그림 다 있음 = 그림 / 없음 = 도형 폴백) · M4 강화 패널 열기 · 구매 1회
// 사용: npm run build → npm run smoke
//   브라우저: CI는 러너에 깔린 Chrome (channel "chrome"). 다른 브라우저는 SMOKE_CHROME=<실행 파일 경로>
// 결과: 통과 exit 0 / 실패 exit 1 — ci-smoke/에 스크린샷 · result.json (CI는 실패 때 Actions 산출물로 남김)
// ③은 core 누적 파괴 수(BattleScene이 #game data-destroyed에 남김). 스테이지 1은 자동만으로도 100% 파괴 (measure 표)
import fs from "node:fs";
import path from "node:path";
import { preview } from "vite";
import { chromium } from "playwright-core";

const OUT = "ci-smoke";
const VIEW = { width: 360, height: 780 };   // 폰 세로 한 크기 — 프레임 720×1560 (G-03)과 같은 비율
const SETTLE_MS = 1000;                     // 첫 화면이 뜬 뒤 처음 읽기까지
const RUN_MS = 15000;                       // ③ 이 시간 안에 건물 파괴 수가 올라야 함 (H-05 ③-5)
const LIMIT_MS = 45000;                     // 전체 상한
const MIN_COLORS = 30;                      // ② 전투 구역 색 종류가 이보다 많아야 "그려짐" (빈 캔버스 = 1색 · 하늘 그라데이션만 있어도 넘음 — 너무 낮지 않게)
const IGNORE_ERRORS = [];                   // ① 의도한 오류 (정규식) — 지금은 없음

const t0 = Date.now();
const result = { ok: false, checks: {}, renderer: null, ms: {} };
fs.mkdirSync(OUT, { recursive: true });
const finish = (code) => {
  result.ms.total = Date.now() - t0;
  fs.writeFileSync(path.join(OUT, "result.json"), JSON.stringify(result, null, 2));
  process.exit(code);
};
setTimeout(() => { console.log(`❌ ${LIMIT_MS / 1000}초 안에 끝나지 않음`); result.timeout = true; finish(1); }, LIMIT_MS).unref();

const exe = process.env.SMOKE_CHROME;
let server, browser;
try {
  server = await preview({ preview: { strictPort: false }, logLevel: "silent" });   // dist/
  browser = await chromium.launch(exe ? { executablePath: exe } : { channel: "chrome" });
} catch (e) {
  console.log(`❌ 준비 실패 (미리보기 서버 · 브라우저): ${String(e.message ?? e).split("\n")[0]}`);
  result.error = String(e.message ?? e);
  finish(1);
}
const url = server.resolvedUrls.local[0];
const ctx = await browser.newContext({ viewport: VIEW, isMobile: true, hasTouch: true });
// M3-E: SMOKE_SPEED=3 → 배속을 고른 채로 확인 (브라우저 키 crumble-ant.speed)
if (process.env.SMOKE_SPEED) await ctx.addInitScript((v) => { try { localStorage.setItem("crumble-ant.speed", v); } catch {} }, process.env.SMOKE_SPEED);
// M6: SMOKE_ENV=1 / 0 → [ART] "건물 · 배경 그림"을 켠 / 끈 채로 확인 (브라우저 키 crumble-ant.art-settings — 나머지는 시트 기본값)
//     없으면 시트 기본값 (art_config.env_enabled)
const ENV_WANT = process.env.SMOKE_ENV ? process.env.SMOKE_ENV !== "0" : !!JSON.parse(fs.readFileSync("src/data/art_config.json", "utf-8")).env_enabled;
if (process.env.SMOKE_ENV) await ctx.addInitScript((on) => { try { localStorage.setItem("crumble-ant.art-settings", JSON.stringify({ env: on })); } catch {} }, ENV_WANT);
const page = await ctx.newPage();
page.setDefaultTimeout(10000);
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 300)); });
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 300)));

const attr = (name) => page.evaluate((n) => Number(document.getElementById("game")?.getAttribute(n) ?? NaN), name);
const destroyed = () => attr("data-destroyed");
let before = null, after = null, drawn = { colors: 0 };
try {
  await page.goto(url);
  await page.waitForSelector("#game canvas");
  if (await page.$("#config-error")) throw new Error("데이터 오류 화면");
  await page.waitForTimeout(SETTLE_MS);
  before = (await destroyed()) || 0;
  const start = Date.now();
  do {
    await page.waitForTimeout(250);
    after = await destroyed();
  } while (!(after > before) && Date.now() - start < RUN_MS);
  result.ms.rise = after > before ? Date.now() - start : null;
  // ② 전투 구역(프레임 높이 6% ~ 90%)을 스크린샷으로 — WebGL 캔버스는 직접 못 읽음
  const png = await page.screenshot({ clip: { x: 0, y: VIEW.height * 0.06, width: VIEW.width, height: VIEW.height * 0.84 } });
  drawn = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    const colors = new Set();
    for (let i = 0; i < d.length; i += 4 * 7) colors.add(((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3));
    return { colors: colors.size };
  }, png.toString("base64"));
  // M2 G: 첫 탭 전에는 소리 객체(AudioContext)를 만들지 않음 (브라우저 정책 · 콘솔 경고 방지)
  // M4: 재화가 들어오면 강화 패널을 열고 가장 싼 강화 1번 구매 (콘솔 오류 0 · Lv 1 · 재화 줄어듦)
  result.upgrade = await page.evaluate(async () => {
    const s = window.__game.scene.getScene("battle");
    // 재화가 자연히 모이길 잠깐만 기다리고 (느린 러너에서 전체 45초를 넘지 않게), 모자라면 시험용으로 채움 — deposit 자체는 economy.test가 확인
    const cost = 60;
    const deadline = performance.now() + 6000;
    while (s.sim.wallet < cost && performance.now() < deadline) await new Promise((r) => setTimeout(r, 200));
    const seeded = s.sim.wallet < cost;
    if (seeded) s.sim.wallet = cost;
    const before = s.sim.wallet;
    s.openUpgrade();
    s.dispatch([{ type: "buyUpgrade", id: "attack_power" }]);
    const r = { open: s.upgradePanel.isOpen, before, after: s.sim.wallet, level: s.sim.levels.attack_power, seeded };
    s.dispatch([{ type: "closeUpgrade", via: "button" }]);
    return r;
  });
  result.speed = await page.evaluate(() => window.__game?.scene.getScene("battle")?.speed ?? null);
  result.audio_before_tap = await page.evaluate(() => window.__game?.scene.getScene("battle")?.sfx?.created ?? null);
  // M3: 개미 그림 상태 — art/game 그림이 다 있으면 그림, 없으면 도형 폴백 (docs/art.md §5). 계획과 실제 그린 쪽이 같아야 함
  result.art = await page.evaluate(() => {
    const s = window.__game?.scene.getScene("battle");
    const p = s?.artPlan;
    return p ? { mode: p.mode, reason: p.reason, missing: p.missing.length, missing_weapons: p.missingWeapons.length, loaded: s.artLoaded.length, drawn: s.ant?.artMode ?? null } : null;
  });
  // M6: 건물 · 배경 그림 상태 — 계획과 실제 그린 쪽이 같아야 함 (끔 = 도형)
  result.env = await page.evaluate(() => {
    const s = window.__game?.scene.getScene("battle");
    const p = s?.envPlan;
    if (!p) return null;
    const bld = Object.values(p.buildings);
    return { on: p.on, buildings: bld.filter(Boolean).length, of: bld.length, sky: !!p.sky, strip: !!p.strip, missing: p.missing.length, strip_drawn: s.strip?.artMode ?? null };
  });
  result.renderer = await page.evaluate(() => {
    const c = document.querySelector("#game canvas");
    if (!c) return null;
    return c.getContext("webgl2") || c.getContext("webgl") ? "WebGL" : c.getContext("2d") ? "Canvas" : "?";
  });
  await page.screenshot({ path: path.join(OUT, "screen.png") });
} catch (e) {
  errors.push(`확인 중 예외: ${String(e.message ?? e).split("\n")[0]}`);
  await page.screenshot({ path: path.join(OUT, "screen.png") }).catch(() => {});
}

const realErrors = errors.filter((e) => !IGNORE_ERRORS.some((re) => re.test(e)));
result.checks = {
  console_errors: { ok: realErrors.length === 0, errors: realErrors },
  battle_drawn: { ok: drawn.colors > MIN_COLORS, colors: drawn.colors, min: MIN_COLORS },
  no_audio_before_tap: { ok: result.audio_before_tap === false, created: result.audio_before_tap },
  art_state: { ok: !!result.art && result.art.drawn === result.art.mode && (result.art.mode === "image" ? result.art.missing === 0 : result.art.reason !== null), ...(result.art ?? {}) },
  upgrade: { ok: !!result.upgrade && result.upgrade.open && result.upgrade.level === 1 && result.upgrade.after < result.upgrade.before, ...(result.upgrade ?? {}) },
  speed: { ok: result.speed === Number(process.env.SMOKE_SPEED || 1), speed: result.speed },
  env_state: {
    ok: !!result.env && result.env.on === ENV_WANT && result.env.strip_drawn === (result.env.strip ? "image" : "shape") && (!result.env.on || (result.env.missing === 0 && result.env.buildings === result.env.of)),
    ...(result.env ?? {}),
  },
  battle_runs: { ok: Number.isFinite(after) && after > before, destroyed_before: before, destroyed_after: after, rise_ms: result.ms.rise, limit_ms: RUN_MS },
};
result.ok = Object.values(result.checks).every((c) => c.ok);
await browser.close();
await server.close();
for (const [k, c] of Object.entries(result.checks)) console.log(`${c.ok ? "✅" : "❌"} ${k} ${JSON.stringify(c)}`);
console.log(result.ok ? `✅ 화면 확인 통과 (${result.renderer})` : "❌ 화면 확인 실패 — ci-smoke/screen.png · result.json");
finish(result.ok ? 0 : 1);
