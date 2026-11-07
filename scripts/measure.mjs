// 임시 수치 측정 — 스테이지별로 "자동만" vs "강점프 연타(지면에 닿을 때마다 탭)"를 비교 (PR #2 scripts/measure.ts를 옮김)
// 밸런싱이 아니라, 데이터 임시값으로 코어 루프가 의도대로 갈리는지(수동 효율 > 자동) · 이식 전후 결과가 같은지 확인하는 용도
// 사용: npm run measure   (CI에는 넣지 않음 — H-05 ⑤-3. 결과는 PR 본문에)
//       npm run measure -- --upgrades  M4 강화 진행 표 (자동만 · 강점프 연타 — 살 수 있는 가장 싼 강화를 바로 구매 · 강화하면 [도전]) + 단일 강화 퇴보 검사
//       npm run measure -- --hitstop   히트스톱으로 늘어나는 벽시계 시간 (스테이지 1 · 5 · 7) — M2 (일반 · 마지막) vs M3-D (+ 4연타 마무리 · 일반 ≤ 간격 × hit_ratio_max)
//       npm run measure -- --touch     M7 터치 개편 — 링 예측 모델 (등급 × 배속) · 과녁 반응 모델 · 60분 진행 · 자동만 배속 · 연타 모델
//                                      데이터가 꺼져 있으면 (mode tap · count 0) 측정만 C 값 (timing · 2 ~ 3)으로 켜서 잼 — 결과는 C PR 표에
// core(TypeScript)는 Vite로 불러온다 — 따로 빌드 도구를 늘리지 않음
import fs from "node:fs";
import path from "node:path";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom", logLevel: "silent", optimizeDeps: { noDiscovery: true } });
try {
  const { BattleSim } = await server.ssrLoadModule("/src/core/battle.ts");
  const { upgradeCost } = await server.ssrLoadModule("/src/core/economy.ts");
  const { buildingForStage, validateConfig } = await server.ssrLoadModule("/src/core/config.ts");
  const { fromData } = await server.ssrLoadModule("/src/core/data.ts");
  const read = (f) => JSON.parse(fs.readFileSync(path.join("src/data", `${f}.json`), "utf-8"));
  const config = fromData({ buildings: read("buildings"), stages: read("stages"), game_config: read("game_config"), ui_strings: read("ui_strings"), upgrades: read("upgrades") });
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
    const fxAll = read("fx_config");
    const fx = fxAll.hitstop, fin = fxAll.finisher;
    const iv = config.battle.strike_interval_s * 1000;
    console.log(`\n히트스톱 지연 — 건물 ${BUILDINGS}개 평균 · 상한 ${fx.max_ms}ms`);
    console.log(`  M2: 한 타 ${fx.hit_ms} · 마지막 일격 ${fx.final_ms}ms / M3-D: 한 타 min(${fx.hit_ms}, 간격 ${iv}ms × ${fx.hit_ratio_max}) · ${fin.every}연타 마무리 ${fin.hitstop_ms} · 마지막 ${fx.final_ms}ms`);
    console.log("stage | 방식 | 게임 시간/건물 | 타격/건물 | 마무리/건물 | 멈춤/건물 M2 → M3-D | 늦어짐 M2 → M3-D");
    for (const stage of [1, 5, 7]) for (const policy of ["auto", "strong"]) {
      const cfg = structuredClone(config);
      cfg.battle.ant.max_hp = 1e12;
      cfg.stages.rows = cfg.stages.rows.map((r) => ({ ...r, buildings_to_clear: 1e9 }));
      const sim = new BattleSim(cfg, stage);
      let n = 0, strikes = 0, stopMs = 0, stopD = 0, fins = 0, start = null, gameS = 0;
      for (let t = 0; t < 3600 && n < BUILDINGS; t += 1 / 60) {
        if (policy === "strong" && sim.ant.phase === "ground") sim.tapStrongJump();
        sim.update(1 / 60);
        for (const e of sim.drainEvents()) {
          if (e.type === "spawn") start = sim.time;
          else if (e.type === "strike") {
            strikes++;
            stopMs += Math.min(fx.max_ms, e.hpLeft <= 0 ? fx.final_ms : fx.hit_ms);
            const isFin = e.hpLeft > 0 && e.combo % fin.every === 0; // src/view/hitFeel.ts strikeKind와 같은 규칙
            if (isFin) fins++;
            stopD += Math.min(fx.max_ms, e.hpLeft <= 0 ? fx.final_ms : isFin ? fin.hitstop_ms : Math.min(fx.hit_ms, iv * fx.hit_ratio_max));
          }
          else if ((e.type === "destroy" || e.type === "land") && start !== null) { n++; gameS += sim.time - start; start = null; }
        }
      }
      const g = gameS / n, st = stopMs / n / 1000, sd = stopD / n / 1000;
      console.log(`${String(stage).padStart(5)} | ${policy === "auto" ? "자동  " : "강점프"} | ${g.toFixed(2).padStart(6)}초 | ${(strikes / n).toFixed(1).padStart(5)} | ${(fins / n).toFixed(1)} | ${st.toFixed(2)} → ${sd.toFixed(2)}초 | +${((st / g) * 100).toFixed(1)}% → +${((sd / g) * 100).toFixed(1)}%`);
    }
  }
  if (process.argv.includes("--upgrades")) {
    // M4 (H-17 ⑤): core의 buyUpgrade · deposit 그대로 — 측정은 구매 순서만 흉내
    const rows = config.upgrades.rows;
    const progression = (policy, minutes) => {
      const sim = new BattleSim(structuredClone(config), 1);
      const first = {};
      let buys = 0, earned = 0;
      for (let i = 0; i < minutes * 60 * 60; i++) {
        if (policy === "strong" && sim.ant.phase === "ground") sim.tapStrongJump();
        sim.update(1 / 60);
        for (const e of sim.drainEvents()) {
          if (e.type === "deposit") earned += e.amount;
          if (e.type === "stageClear" && !(e.stage in first)) first[e.stage] = { min: sim.time / 60, buys, earned, lv: rows.map((r) => sim.levels[r.upgrade_id]).join("/") };
        }
        let bought = false;
        for (;;) {
          const c = rows.map((r) => ({ id: r.upgrade_id, lv: sim.levels[r.upgrade_id], row: r })).filter((x) => x.lv < x.row.max_level)
            .map((x) => ({ id: x.id, cost: upgradeCost(x.row, x.lv) })).sort((a, b) => a.cost - b.cost || (a.id < b.id ? -1 : 1))[0];
          if (!c || sim.buyUpgrade(c.id) !== "ok") break;
          buys++; bought = true;
        }
        if (bought && sim.challengeAvailable) sim.challenge();
      }
      return { first, levels: rows.map((r) => sim.levels[r.upgrade_id]).join("/"), wallet: sim.wallet, earned };
    };
    console.log(`\nM4 강화 진행 (60분 · 살 수 있는 가장 싼 강화를 바로 · 강화하면 [도전] · 재화 = deposit) — Lv 순서 ${rows.map((r) => r.upgrade_id).join("/")}`);
    console.log("첫 클리어 | 자동만: 분 | 강화 횟수 | 누적 잔해 | 그때 Lv | 강점프 연타: 분");
    const a = progression("auto", 60), b = progression("strong", 60);
    for (let st = 1; st <= config.stages.rows.length; st++) {
      const x = a.first[st], y = b.first[st];
      console.log(`stage ${st} | ${x ? x.min.toFixed(1) : "—"} | ${x ? x.buys : "—"} | ${x ? x.earned : "—"} | ${x ? x.lv : "—"} | ${y ? y.min.toFixed(1) : "—"}`);
    }
    console.log(`60분 끝 (자동): Lv ${a.levels} · 남은 잔해 ${a.wallet} · 번 잔해 ${a.earned}`);
    // 단일 강화 Lv 0 ~ max: 스테이지 3 ~ 8 자동 파괴율이 내려가는 경우 (H-17 · I-13 — 0건이어야 함)
    const bad = [];
    for (const r of rows) {
      const prev = {};
      for (let lv = 0; lv <= r.max_level; lv++) {
        for (let st = 3; st <= config.stages.rows.length; st++) {
          const cfg = structuredClone(config);
          cfg.battle.ant.max_hp = 1e12;
          cfg.stages.rows = cfg.stages.rows.map((x) => ({ ...x, buildings_to_clear: 1e9 }));
          const sim = new BattleSim(cfg, st, { stage: st, autoAdvance: true, debris: 0, levels: { [r.upgrade_id]: lv } });
          let d = 0, l = 0;
          for (let t = 0; t < 3600 && d + l < 20; t += 1 / 60) {
            sim.update(1 / 60);
            for (const e of sim.drainEvents()) { if (e.type === "destroy") d++; else if (e.type === "land") l++; }
          }
          const rate = d / (d + l);
          if (prev[st] !== undefined && rate < prev[st] - 1e-9) bad.push(`${r.upgrade_id} Lv${lv} 스테이지 ${st}: ${(prev[st] * 100).toFixed(0)}% → ${(rate * 100).toFixed(0)}%`);
          prev[st] = rate;
        }
      }
    }
    console.log(`단일 강화 퇴보: ${bad.length ? bad.join(" · ") : "0건"}`);
  }

  if (process.argv.includes("--touch")) {
    // M7 (I-23 · H-56 · I-24) — 데이터가 꺼져 있으면 (mode tap · count 0) C 값 (timing · 과녁 2 ~ 3)으로 켜서 잼. 사람 손 = 측정용 난수 (core와 따로 · 결정적)
    let seed = 777;
    const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const gauss = () => { const u = Math.max(1e-9, rnd()); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
    const on = (base) => {
      const c = structuredClone(base);
      if ((c.battle.strong_jump.mode ?? "tap") === "tap") c.battle.strong_jump.mode = "timing";
      if (!c.battle.targets || c.battle.targets.count_max === 0) c.battle.targets = { ...(c.battle.targets ?? {}), count_min: 2, count_max: 3 };
      return c;
    };
    const cfgOn = on(config);
    const st = cfgOn.battle.strong_timing, tg = cfgOn.battle.targets;
    const ringMode = (st.style ?? "circle") === "ring";
    console.log(`\nM7 터치 측정 — ${st.style ?? "circle"} · 기회 ${st.chance_pct}% (간격 ${st.min_gap_jumps}) · 링 ${st.ring_s}초 · PERFECT ±${st.perfect_s} · GOOD ±${st.good_s} · 탭 구역 ${st.tap_max_y} · 과녁 ${tg.count_min} ~ ${tg.count_max} · 수명 ${tg.life_s} · 등장 ${tg.lead_s ?? "닿을 때"} · 건물 단위 ${tg.end_on_hang === false}`);
    // 사람: sigma = 링 겹침 (circle은 창 가운데) 기준 탭 오차 · tgt = 과녁 다 노림 (반응 0.35 + 0.25 × 순서 실제 초) · mash = 0.1초마다 아래 / 위 절반
    const play = (cfg, { sigma = null, tgt = false, speed = 1, minutes = 60, mash = null, buy = true }) => {
      const sim = new BattleSim(structuredClone(cfg), 1); sim.setTimeScale(speed);
      const rows = cfg.upgrades.rows; const first = {}; let earned = 0, wall = 0, chanceNo = 0; const plan = [];
      const g = { perfect: 0, good: 0, early: 0, chances: 0, tHit: 0, tAll: 0, batch: 0 };
      const zoneY = (cfg.battle.strong_timing.tap_max_y ?? 0.5) / 2;
      const handle = (ev) => { for (const e of ev) {
        if (e.type === "deposit") earned += e.amount;
        if (e.type === "stageClear" && !(e.stage in first)) first[e.stage] = wall / 60;
        if (e.type === "timingResult") g[e.grade]++;
        if (e.type === "targetHit") g.tHit++;
        if (e.type === "perfect") g.batch++;
        if (e.type === "targetsSpawn") { g.tAll += e.targets.length; if (tgt) e.targets.forEach((t, k) => plan.push({ at: wall + 0.35 + 0.25 * k, x: t.x, y: t.y, target: t.id })); }
        if (e.type === "timingChance") { g.chances++; chanceNo++;
          if (sigma !== null) { const aim = ringMode ? cfg.battle.strong_timing.ring_s : ((cfg.battle.jump.windup_s - e.fromS) + (cfg.battle.jump.windup_s - e.toS)) / 2 / speed;
            plan.push({ at: wall + aim + sigma * gauss(), x: 0.5, y: zoneY, chance: chanceNo }); } }
      } };
      for (let i = 0; i < minutes * 60 * 120; i++) {
        wall += 1 / 120; sim.update(speed / 120); handle(sim.drainEvents());
        if (mash && i % 12 === 0) sim.tapBattle(0.1 + rnd() * 0.8, mash === "low" ? rnd() * zoneY * 2 : zoneY * 2 + rnd() * (1 - zoneY * 2));
        plan.sort((a, b) => a.at - b.at);
        while (plan.length && plan[0].at <= wall) {
          const p = plan.shift();
          if (p.chance !== undefined && (p.chance !== chanceNo || !sim.ant.winding)) continue; // 지난 기회 탭은 버림
          if (p.target !== undefined && !sim.targets.some((t) => t.id === p.target)) continue; // 사라진 과녁은 안 누름
          sim.tapBattle(p.x, p.y);
        }
        handle(sim.drainEvents());
        if (buy) {
          let bought = false;
          for (;;) { const c = rows.filter((r) => sim.levels[r.upgrade_id] < r.max_level).map((r) => ({ id: r.upgrade_id, cost: upgradeCost(r, sim.levels[r.upgrade_id]) })).sort((a, b) => a.cost - b.cost || (a.id < b.id ? -1 : 1))[0]; if (!c || sim.buyUpgrade(c.id) !== "ok") break; bought = true; }
          const maxed = rows.every((r) => sim.levels[r.upgrade_id] >= r.max_level);
          if ((bought || (maxed && i % (120 * 120) === 0)) && sim.challengeAvailable) sim.challenge(); // 강화를 사면 [도전] · 다 샀으면 2분마다
        }
      }
      return { first, earned, ...g };
    };
    const pct = (a, b) => `${Math.round((a / Math.max(1, b)) * 100)}%`;
    const f = (x) => (x === undefined ? "—" : x.toFixed(1));
    console.log("① 예측 모델 (10분 · 기회만 셈) — σ (실제 초) | ×1 PERFECT / GOOD 이상 / 헛발 | ×2 | ×3");
    for (const sigma of [0.04, 0.08]) {
      const cells = [1, 2, 3].map((speed) => { const r = play(cfgOn, { sigma, speed, minutes: 10, buy: false }); return `${pct(r.perfect, r.chances)} / ${pct(r.perfect + r.good, r.chances)} / ${pct(r.early, r.chances)}`; });
      console.log(`  ${sigma} | ${cells.join(" | ")}`);
    }
    console.log("② 과녁 반응 모델 (10분 · 다 노림) — ×1 맞힘 · PERFECT 묶음 | ×2 | ×3");
    console.log(`  ${[1, 2, 3].map((speed) => { const r = play(cfgOn, { tgt: true, speed, minutes: 10 }); return `${pct(r.tHit, r.tAll)} · ${r.batch}`; }).join(" | ")}`);
    console.log("③ 60분 진행 (×1) — 설정 | stage 3 / 5 / 8 (실제 분) | 60분 잔해 | PERFECT / GOOD / 기회 | 과녁 맞힘");
    const offR = play(structuredClone(config), {});
    console.log(`  키 끔 (지금 데이터 그대로) | ${f(offR.first[3])} / ${f(offR.first[5])} / ${f(offR.first[8])} | ${offR.earned}`);
    const autoR = play(cfgOn, {});
    console.log(`  켬 · 자동만 (탭 없음) | ${f(autoR.first[3])} / ${f(autoR.first[5])} / ${f(autoR.first[8])} | ${autoR.earned} | 기회 ${autoR.chances}`);
    for (const [name, o] of [["σ 0.08 · 과녁 안 노림", { sigma: 0.08 }], ["σ 0.08 · 과녁 다 노림", { sigma: 0.08, tgt: true }]]) {
      const r = play(cfgOn, o);
      console.log(`  ${name} | ${f(r.first[3])} / ${f(r.first[5])} / ${f(r.first[8])} | ${r.earned} | ${r.perfect} / ${r.good} / ${r.chances} | ${pct(r.tHit, r.tAll)}`);
    }
    console.log("④ 자동만 · 배속 (실제 20분) — 설정 | ×2 stage 8 · 잔해 | ×3 stage 8 · 잔해");
    for (const [name, c] of [["키 끔", structuredClone(config)], ["켬", cfgOn]]) console.log(`  ${name} | ${[2, 3].map((speed) => { const r = play(c, { speed, minutes: 20 }); return `${f(r.first[8])} · ${r.earned}`; }).join(" | ")}`);
    const mL = play(cfgOn, { mash: "low", minutes: 10 }), mH = play(cfgOn, { mash: "high", minutes: 10 });
    console.log(`⑤ 연타 (10분 · 0.1초마다) — 아래 절반: 강점프 ${mL.perfect + mL.good} · 헛발 ${mL.early} / 기회 ${mL.chances} | 위 절반: 과녁 ${mH.tHit} / ${mH.tAll} · PERFECT 묶음 ${mH.batch} · 강점프 ${mH.perfect + mH.good}`);
  }
} finally {
  await server.close();
}
