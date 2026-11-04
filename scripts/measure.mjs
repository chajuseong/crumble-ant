// 임시 수치 측정 — 스테이지별로 "자동만" vs "강점프 연타(지면에 닿을 때마다 탭)"를 비교 (PR #2 scripts/measure.ts를 옮김)
// 밸런싱이 아니라, 데이터 임시값으로 코어 루프가 의도대로 갈리는지(수동 효율 > 자동) · 이식 전후 결과가 같은지 확인하는 용도
// 사용: npm run measure   (CI에는 넣지 않음 — H-05 ⑤-3. 결과는 PR 본문에)
//       npm run measure -- --hitstop   M2 A 히트스톱으로 늘어나는 벽시계 시간 (스테이지 1 · 5 · 7, fx_config hitstop.*)
// core(TypeScript)는 Vite로 불러온다 — 따로 빌드 도구를 늘리지 않음
import fs from "node:fs";
import path from "node:path";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom", logLevel: "silent", optimizeDeps: { noDiscovery: true } });
try {
  const { BattleSim } = await server.ssrLoadModule("/src/core/battle.ts");
  const { buildingForStage, validateConfig } = await server.ssrLoadModule("/src/core/config.ts");
  const { fromData } = await server.ssrLoadModule("/src/core/data.ts");
  const read = (f) => JSON.parse(fs.readFileSync(path.join("src/data", `${f}.json`), "utf-8"));
  const config = fromData({ buildings: read("buildings"), stages: read("stages"), game_config: read("game_config"), ui_strings: read("ui_strings") });
  const errors = validateConfig(config);
  if (errors.length) throw new Error(`데이터 오류:\n${errors.join("\n")}`);

  const BUILDINGS = 40;
  const measure = (stage, policy) => {
    // 후퇴가 결과를 흐리지 않게 HP는 사실상 무한, 스테이지 고정
    const cfg = structuredClone(config);
    cfg.battle.ant.max_hp = 1e12;
    cfg.stages.rows = cfg.stages.rows.map((r) => ({ ...r, buildings_to_clear: 1e9 }));
    const sim = new BattleSim(cfg, stage);
    let destroyed = 0, landed = 0, strikes = 0, landDamage = 0;
    const dt = 1 / 60;
    for (let t = 0; t < 3600 && destroyed + landed < BUILDINGS; t += dt) {
      if (policy === "strong" && sim.ant.phase === "ground") sim.tapStrongJump();
      sim.update(dt);
      for (const e of sim.drainEvents()) {
        if (e.type === "destroy") destroyed++;
        else if (e.type === "land") { landed++; landDamage += e.damage; }
        else if (e.type === "strike") strikes++;
      }
    }
    const n = destroyed + landed;
    return { destroyRate: destroyed / n, strikesPerBuilding: strikes / n, avgLandDamage: landed ? landDamage / landed : 0 };
  };

  const pct = (v) => `${(v * 100).toFixed(0)}%`.padStart(5);
  const f1 = (v) => v.toFixed(1).padStart(5);
  console.log(`건물 ${BUILDINGS}개씩 · 개미 HP 무한 · 스테이지 고정`);
  console.log("stage | 건물 | HP  | 낙하 | 자동: 파괴율 타격/건물 착지뎀 | 강점프: 파괴율 타격/건물 착지뎀");
  for (const row of config.stages.rows) {
    const b = buildingForStage(config, row.stage);
    const a = measure(row.stage, "auto");
    const s = measure(row.stage, "strong");
    console.log(
      `${String(row.stage).padStart(5)} | ${b.building_id} | ${String(b.hp).padStart(3)} | ${b.fall_speed.toFixed(2)} |` +
        `       ${pct(a.destroyRate)}   ${f1(a.strikesPerBuilding)}   ${f1(a.avgLandDamage)} |` +
        `         ${pct(s.destroyRate)}   ${f1(s.strikesPerBuilding)}   ${f1(s.avgLandDamage)}`,
    );
  }
  if (process.argv.includes("--hitstop")) {
    // 히트스톱은 core 시계를 멈출 뿐이라 결과는 위 표 그대로. 늘어나는 것은 벽시계뿐 → 건물당 몇 % 늦어지는지
    const fx = read("fx_config").hitstop;
    console.log(`\n히트스톱 지연 (한 타 ${fx.hit_ms}ms · 마지막 일격 ${fx.final_ms}ms · 상한 ${fx.max_ms}ms) — 건물 ${BUILDINGS}개 평균`);
    console.log("stage | 방식 | 게임 시간/건물 | 타격/건물 | 멈춤/건물 | 늦어짐");
    for (const stage of [1, 5, 7]) for (const policy of ["auto", "strong"]) {
      const cfg = structuredClone(config);
      cfg.battle.ant.max_hp = 1e12;
      cfg.stages.rows = cfg.stages.rows.map((r) => ({ ...r, buildings_to_clear: 1e9 }));
      const sim = new BattleSim(cfg, stage);
      let n = 0, strikes = 0, stopMs = 0, start = null, gameS = 0;
      for (let t = 0; t < 3600 && n < BUILDINGS; t += 1 / 60) {
        if (policy === "strong" && sim.ant.phase === "ground") sim.tapStrongJump();
        sim.update(1 / 60);
        for (const e of sim.drainEvents()) {
          if (e.type === "spawn") start = sim.time;
          else if (e.type === "strike") { strikes++; stopMs += Math.min(fx.max_ms, e.hpLeft <= 0 ? fx.final_ms : fx.hit_ms); }
          else if ((e.type === "destroy" || e.type === "land") && start !== null) { n++; gameS += sim.time - start; start = null; }
        }
      }
      const g = gameS / n, st = stopMs / n / 1000;
      console.log(`${String(stage).padStart(5)} | ${policy === "auto" ? "자동  " : "강점프"} | ${g.toFixed(2).padStart(6)}초 | ${(strikes / n).toFixed(1).padStart(5)} | ${st.toFixed(2)}초 | +${((st / g) * 100).toFixed(1)}%`);
    }
  }
} finally {
  await server.close();
}
