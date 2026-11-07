// 임시 수치 측정 — 스테이지별로 "자동만" vs "강점프 연타(지면에 닿을 때마다 탭)"를 비교 (PR #2 scripts/measure.ts를 옮김)
// 밸런싱이 아니라, 데이터 임시값으로 코어 루프가 의도대로 갈리는지(수동 효율 > 자동) · 이식 전후 결과가 같은지 확인하는 용도
// 사용: npm run measure   (CI에는 넣지 않음 — H-05 ⑤-3. 결과는 PR 본문에)
//       npm run measure -- --upgrades  M4 강화 진행 표 (자동만 · 강점프 연타 — 살 수 있는 가장 싼 강화를 바로 구매 · 강화하면 [도전]) + 단일 강화 퇴보 검사
//       npm run measure -- --hitstop   히트스톱으로 늘어나는 벽시계 시간 (스테이지 1 · 5 · 7) — M2 (일반 · 마지막) vs M3-D (+ 4연타 마무리 · 일반 ≤ 간격 × hit_ratio_max)
//       npm run measure -- --touch     M7 터치 개편 — 매달림 길이 · 사람 모델 (과녁 맞히는 비율 × 타이밍 성공률 → 60분 진행) · 반응 모델 (×1 · ×2 · ×3) · 연타 모델
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
    // 측정용 난수 (사람 손 흉내 — core 난수와 따로 · 결정적)
    let seed = 12345;
    const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const gauss = () => { const u = Math.max(1e-9, rnd()); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
    const on = (base) => {
      const c = structuredClone(base);
      if ((c.battle.strong_jump.mode ?? "tap") === "tap") c.battle.strong_jump.mode = "timing";
      if (!c.battle.targets || c.battle.targets.count_max === 0) c.battle.targets = { ...(c.battle.targets ?? {}), count_min: 2, count_max: 3 };
      return c;
    };
    const cfgOn = on(config);
    const tg = cfgOn.battle.targets, st = cfgOn.battle.strong_timing;
    console.log(`\nM7 터치 측정 — mode timing · 과녁 ${tg.count_min} ~ ${tg.count_max} · 수명 ${tg.life_s}초 · 기회 ${st.chance_pct}% (최소 간격 ${st.min_gap_jumps}) · 창 끝 ${st.window_to} · 창 ${st.window_s}초 (실제 시간)`);

    // ① 매달림 길이 (과녁은 매달림이 끝나면 사라짐) — 스테이지 1 · 3 · 5 · 8 · 자동만 · 강화 0
    console.log("① 매달림 길이 (게임 초 · 자동만 · 강화 0) — stage | 평균 | 최소 | 최대 | 과녁 묶음 수");
    for (const stage of [1, 3, 5, 8]) {
      const c = structuredClone(cfgOn); c.battle.ant.max_hp = 1e12; c.stages.rows = c.stages.rows.map((r) => ({ ...r, buildings_to_clear: 1e9 }));
      const sim = new BattleSim(c, stage); const hangs = []; let t0 = null, batches = 0;
      for (let i = 0; i < 120 * 300 && hangs.length < 200; i++) {
        const was = sim.ant.contact; sim.update(1 / 120);
        for (const e of sim.drainEvents()) if (e.type === "targetsSpawn") batches++;
        if (!was && sim.ant.contact) t0 = sim.time; if (was && !sim.ant.contact && t0 !== null) { hangs.push(sim.time - t0); t0 = null; }
      }
      const avg = hangs.reduce((a, b) => a + b, 0) / hangs.length;
      console.log(`${String(stage).padStart(5)} | ${avg.toFixed(2)} | ${Math.min(...hangs).toFixed(2)} | ${Math.max(...hangs).toFixed(2)} | ${batches}`);
    }

    // 사람 손: 과녁 = 나온 뒤 반응 (0.35 + 0.25 × 순서 초, 실제 시간) 뒤 탭 (비율 pT) · 타이밍 = 창 가운데 탭 (비율 pW, 실패 = 창 앞에 탭)
    const play = (cfg, { pT, pW, speed = 1, minutes = 60, mash = false, reaction = false }) => {
      const sim = new BattleSim(structuredClone(cfg), 1); sim.setTimeScale(speed);
      const rows = cfg.upgrades.rows; const first = {}; let earned = 0, wall = 0;
      const plan = []; // { at: 실제 초, x, y, chance? (타이밍 탭이면 그 기회 번호) }
      let chanceNo = 0;
      const s = { targets: 0, hits: 0, chances: 0, timingOk: 0, perfect: 0 };
      const dtw = 1 / 120;
      for (let i = 0; i < minutes * 60 * 120; i++) {
        wall += dtw; sim.update(dtw * speed);
        for (const e of sim.drainEvents()) {
          if (e.type === "deposit") earned += e.amount;
          if (e.type === "stageClear" && !(e.stage in first)) first[e.stage] = sim.time / 60 / speed;
          if (e.type === "perfect") s.perfect++;
          if (e.type === "timingResult" && e.ok) s.timingOk++;
          if (e.type === "targetHit") s.hits++;
          if (mash) continue;
          if (e.type === "targetsSpawn") { s.targets += e.targets.length; e.targets.forEach((t, k) => { if (rnd() < pT) plan.push({ at: wall + 0.35 + 0.25 * k, x: t.x, y: t.y, target: t.id }); }); }
          if (e.type === "timingChance") {
            s.chances++; chanceNo++;
            const w = cfg.battle.jump.windup_s; const win = [(w - e.fromS) / speed, (w - e.toS) / speed]; // 실제 초 (도움닫기 시작부터)
            let at;
            if (reaction) at = 0.30 + 0.08 * gauss(); // 원이 뜬 뒤 반응 (실제 시간)
            else at = rnd() < pW ? (win[0] + win[1]) / 2 : Math.max(0, win[0] - 0.08);
            plan.push({ at: wall + at, x: 0.5, y: 0.5, chance: chanceNo });
          }
        }
        if (mash && i % 12 === 0) { const r = sim.tapBattle(0.1 + rnd() * 0.8, 0.08 + rnd() * 0.77); void r; }
        plan.sort((a, b) => a.at - b.at);
        while (plan.length && plan[0].at <= wall) {
          const p = plan.shift();
          if (p.chance !== undefined && (p.chance !== chanceNo || !sim.ant.winding)) { s.dropped = (s.dropped ?? 0) + 1; continue; } // 지난 기회 탭은 버림 (사람은 원이 없으면 안 누름)
          if (p.target !== undefined && !sim.targets.some((t) => t.id === p.target)) { s.late = (s.late ?? 0) + 1; continue; } // 이미 사라진 과녁은 안 누름 (늦음)
          const r = sim.tapBattle(p.x, p.y);
          if (p.chance !== undefined) s[`t_${r}`] = (s[`t_${r}`] ?? 0) + 1;
        }
        sim.drainEvents().forEach((e) => { if (e.type === "targetHit") s.hits++; if (e.type === "timingResult" && e.ok) s.timingOk++; if (e.type === "perfect") s.perfect++; if (e.type === "deposit") earned += e.amount; });
        let bought = false;
        for (;;) {
          const c = rows.filter((r) => sim.levels[r.upgrade_id] < r.max_level).map((r) => ({ id: r.upgrade_id, cost: upgradeCost(r, sim.levels[r.upgrade_id]) })).sort((a, b) => a.cost - b.cost || (a.id < b.id ? -1 : 1))[0];
          if (!c || sim.buyUpgrade(c.id) !== "ok") break; bought = true;
        }
        const maxed = rows.every((r) => sim.levels[r.upgrade_id] >= r.max_level);
        if ((bought || (maxed && i % (120 * 120) === 0)) && sim.challengeAvailable) sim.challenge(); // 강화를 사면 [도전] · 다 샀으면 2분마다 [도전]
      }
      return { first, earned, ...s };
    };
    const f = (x) => (x === undefined ? "—" : x.toFixed(1));
    // ② 사람 모델 — 60분 · ×1
    console.log("\n② 사람 모델 (60분 · ×1 · 가장 싼 강화부터) — 과녁 맞힘 pT | 타이밍 pW | stage 3 / 5 / 8 첫 클리어 (실제 분) | 60분 번 잔해 | 과녁 맞힌 수 / 나온 수 | 타이밍 성공 / 기회 | PERFECT");
    const auto = play(cfgOn, { pT: 0, pW: 0 });
    console.log(`  자동만 (탭 없음 · 켬) | ${f(auto.first[3])} / ${f(auto.first[5])} / ${f(auto.first[8])} | ${auto.earned}`);
    for (const pT of [0.5, 0.8, 1]) for (const pW of [0.5, 0.8, 1]) {
      const r = play(cfgOn, { pT, pW });
      console.log(`  ${pT} | ${pW} | ${f(r.first[3])} / ${f(r.first[5])} / ${f(r.first[8])} | ${r.earned} | ${r.hits} / ${r.targets} | ${r.timingOk} / ${r.chances} | ${r.perfect}`, process.env.TOUCH_DEBUG ? JSON.stringify({ late: r.late, dropped: r.dropped, strong: r.t_strong, miss: r.t_timingMiss, ign: r.t_ignored, tgt: r.t_target, m: r.t_miss }) : "");
    }
    // ③ 반응 모델 — 원이 뜬 뒤 0.30 ± 0.08초에 탭 · 과녁 반응 0.35 + 0.25 × 순서 (pT 1) · 배속별
    console.log("\n③ 반응 모델 (10분 · 과녁 다 노림 · 타이밍 = 원 뜬 뒤 0.30 ± 0.08초 탭) — 배속 | 타이밍 성공 / 기회 | 과녁 맞힌 수 / 나온 수");
    for (const speed of [1, 2, 3]) { const r = play(cfgOn, { pT: 1, pW: 0, speed, minutes: 10, reaction: true }); console.log(`  ×${speed} | ${r.timingOk} / ${r.chances} (${Math.round((r.timingOk / Math.max(1, r.chances)) * 100)}%) | ${r.hits} / ${r.targets} (${Math.round((r.hits / Math.max(1, r.targets)) * 100)}%)`); }
    // ④ 연타 모델 — 0.1초마다 아무 데나 탭
    const m = play(cfgOn, { pT: 0, pW: 0, minutes: 10, mash: true });
    console.log(`\n④ 연타 모델 (10분 · 0.1초마다 아무 데나) — 과녁 맞힘 ${m.hits} · 타이밍 성공 ${m.timingOk} · PERFECT ${m.perfect} · stage 8 ${f(m.first[8])}분`);
  }
} finally {
  await server.close();
}
