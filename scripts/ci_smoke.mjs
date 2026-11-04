// 배포 빌드 화면 확인 ⑥ — ① 콘솔 오류 0 ② 장면이 그려짐 ③ 장면이 돎 (잼병 원정대 ci_smoke 구조를 와르르 M0 빈 장면에 맞춤)
// 사용: npm run build → npm run smoke
//   브라우저: CI는 러너에 깔린 Chrome (channel "chrome"). 다른 브라우저는 SMOKE_CHROME=<실행 파일 경로>
// 결과: 통과 exit 0 / 실패 exit 1 — ci-smoke/에 스크린샷 · result.json (CI는 실패 때 Actions 산출물로 남김)
// 마일스톤이 진행되면 ②③ 기준을 게임 화면에 맞게 바꾼다 (예: ③ = 건물이 부서짐) — docs/dev.md §7 완료 조건과 함께
import fs from "node:fs";
import path from "node:path";
import { preview } from "vite";
import { chromium } from "playwright-core";

const OUT = "ci-smoke";
const VIEW = { width: 405, height: 720 };   // 폰 세로 한 크기 — 장면 720×1280 [가정]과 같은 비율
const SETTLE_MS = 1000;                     // 첫 화면이 뜬 뒤 프레임 수를 처음 읽기까지
const RUN_MS = 10000;                       // ③ 이 시간 안에 프레임 수가 올라야 함
const LIMIT_MS = 45000;                     // 전체 상한
const MIN_COLORS = 3;                       // ② 화면 색 종류가 이보다 많아야 "그려짐" (빈 캔버스 = 1색. M0 빈 장면 = 하늘 · 땅 · 글자)
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
const page = await ctx.newPage();
page.setDefaultTimeout(10000);
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 300)); });
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 300)));

const frames = () => page.evaluate(() => Number(document.getElementById("game")?.getAttribute("data-frames") ?? NaN));
let before = null, after = null, drawn = { colors: 0 };
try {
  await page.goto(url);
  await page.waitForSelector("#game canvas");
  await page.waitForTimeout(SETTLE_MS);
  before = await frames();
  const start = Date.now();
  do {
    await page.waitForTimeout(250);
    after = await frames();
  } while (!(after > before) && Date.now() - start < RUN_MS);
  // ② WebGL 캔버스는 직접 못 읽어서 스크린샷으로 색 종류를 센다
  const png = await page.screenshot();
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
  scene_drawn: { ok: drawn.colors > MIN_COLORS, colors: drawn.colors, min: MIN_COLORS },
  scene_runs: { ok: Number.isFinite(before) && after > before, before, after, limit_ms: RUN_MS },
};
result.ok = Object.values(result.checks).every((c) => c.ok);
await browser.close();
await server.close();
for (const [k, c] of Object.entries(result.checks)) console.log(`${c.ok ? "✅" : "❌"} ${k} ${JSON.stringify(c)}`);
console.log(result.ok ? `✅ 화면 확인 통과 (${result.renderer})` : "❌ 화면 확인 실패 — ci-smoke/screen.png · result.json");
finish(result.ok ? 0 : 1);
