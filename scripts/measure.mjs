// 임시 수치 측정 — 스테이지별로 "자동만" vs "강점프 연타(지면에 닿을 때마다 탭)"를 비교 (PR #2 scripts/measure.ts를 옮김)
// 밸런싱이 아니라, 데이터 임시값으로 코어 루프가 의도대로 갈리는지(수동 효율 > 자동) · 이식 전후 결과가 같은지 확인하는 용도
// 사용: npm run measure   (CI에는 넣지 않음 — H-05 ⑤-3. 결과는 PR 본문에)
//       npm run measure -- --upgrades  M4 강화 진행 표 (자동만 · 강점프 연타 — 살 수 있는 가장 싼 강화를 바로 구매 · 강화하면 [도전]) + 단일 강화 퇴보 검사
//       npm run measure -- --hitstop   히트스톱으로 늘어나는 벽시계 시간 (스테이지 1 · 5 · 7) — M2 (일반 · 마지막) vs M3-D (+ 4연타 마무리 · 일반 ≤ 간격 × hit_ratio_max)
//       npm run measure -- --touch     M7 터치 개편 — 링 예측 모델 (등급 × 배속) · 과녁 반응 모델 · 60분 진행 · 자동만 배속 · 연타 모델
//                                      데이터가 꺼져 있으면 (mode tap · count 0) 측정만 C 값 (timing · 2 ~ 3)으로 켜서 잼 — 결과는 C PR 표에
//       npm run measure -- --defend    M7-E 체력 + 받치기 (I-27 · I-28 · H-69) — 자동 2정책 (가장 싼 것 · 공격 우선) · 손 · 연타 / 후퇴 · 쓰러짐 · 아슬 · 받치기 손 · 자동
//                                      데이터가 꺼져 있으면 (action strike) 측정만 C 후보 (체력 30 · 강화 3행 · defend · state · 운반 6 · 힘 0.12 · 반동 1.5 — H-73)로 켜서 잼
//       npm run measure -- --defend --sweep   + 받치는 힘 0.02 ~ 0.08 × 자동 받치기 비용 쓸기 (C 고르는 표 — H-69)
//       npm run measure -- --defend --chance  + 받쳐! 과녁 확률 targets.chance_pct 100 · 70 · 50 표 (I-33)
//       npm run measure -- --defend --seeds 5 + 시드 N개 (core battle.rng_seed) 평균 · 최소 · 최대 — 범위 판정 (H-79: 평균 + 가장 느린 시드)
//       npm run measure -- --floors    M8 층 건물 + 섞어 나오기 (I-25 · H-62) — 층수 분포 · 층당 타수 · 버려진 데미지 · 자동 진행 (시드 5개)
//                                      데이터가 꺼져 있으면 (풀 = 1층 · 간격 0) 측정만 후보 (스테이지마다 1 ~ 3층 · 흔들기 0.4 · 연달아 15%)로 켜서 잼
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
  const config = fromData({ buildings: read("buildings"), stages: read("stages"), game_config: read("game_config"), ui_strings: read("ui_strings"), upgrades: read("upgrades"), stage_pool: read("stage_pool") });
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
    // H-82 기준: 건물 100채 × 시드 5개 평균 · 앞 Lv보다 3%p 넘게 내려가면 퇴보 (층 · 간격이 무작위라 한 채가 크게 흔들림 — 20채 · 시드 1개는 잡음만 잡음)
    const REG_N = 100, REG_SEEDS = [config.battle.rng_seed ?? 1, 7, 12345, 99, 4242], REG_TOL = 3;
    const bad = [];
    let checks = 0;
    for (const r of rows) {
      const prev = {};
      for (let lv = 0; lv <= r.max_level; lv++) {
        for (let st = 3; st <= config.stages.rows.length; st++) {
          let sum = 0;
          for (const seed of REG_SEEDS) {
            const cfg = structuredClone(config);
            cfg.battle.ant.max_hp = 1e12;
            cfg.battle.rng_seed = seed;
            cfg.stages.rows = cfg.stages.rows.map((x) => ({ ...x, buildings_to_clear: 1e9 }));
            const sim = new BattleSim(cfg, st, { stage: st, autoAdvance: true, debris: 0, levels: { [r.upgrade_id]: lv } });
            let d = 0, l = 0;
            for (let t = 0; t < 7200 && d + l < REG_N; t += 1 / 60) {
              sim.update(1 / 60);
              for (const e of sim.drainEvents()) { if (e.type === "destroy") d++; else if (e.type === "land") l++; }
            }
            sum += d / Math.max(1, d + l);
          }
          const rate = Math.round((sum / REG_SEEDS.length) * 1000) / 10; // % (소수 1자리)
          if (prev[st] !== undefined) {
            checks++;
            if (rate < prev[st] - REG_TOL) bad.push(`${r.upgrade_id} Lv${lv} 스테이지 ${st}: ${prev[st].toFixed(1)}% → ${rate.toFixed(1)}%`);
          }
          prev[st] = rate;
        }
      }
    }
    console.log(`단일 강화 퇴보 (건물 ${REG_N}채 × 시드 ${REG_SEEDS.length}개 평균 · ${REG_TOL}%p 넘게 내려감 · 비교 ${checks}곳): ${bad.length ? bad.join(" · ") : "0건"}`);
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
      const g = { perfect: 0, good: 0, early: 0, chances: 0, tHit: 0, tAll: 0, batch: 0, seq: 0, pos: [0, 0, 0, 0, 0], posHit: [0, 0, 0, 0, 0] };
      const zoneY = (cfg.battle.strong_timing.tap_max_y ?? 0.5) / 2;
      const handle = (ev) => { for (const e of ev) {
        if (e.type === "deposit") earned += e.amount;
        if (e.type === "stageClear" && !(e.stage in first)) first[e.stage] = wall / 60;
        if (e.type === "timingResult") g[e.grade]++;
        if (e.type === "targetHit") g.tHit++;
        if (e.type === "perfect") g.batch++;
        if (e.type === "targetsSpawn") {
          g.tAll += e.targets.length;
          const chain = e.targets.length === 1 && cfg.battle.targets.mode === "chain";
          g.pos[Math.min(g.seq, 4)]++;
          if (tgt) e.targets.forEach((t, k) => plan.push({ at: wall + (chain ? Math.max(0.15, 0.42 + 0.10 * gauss()) : 0.35 + 0.25 * k), x: t.x, y: t.y, target: t.id, p: Math.min(g.seq, 4) }));
        }
        if (e.type === "targetHit") g.seq++;
        if (e.type === "targetsEnd") g.seq = 0;
        if (e.type === "timingChance") { g.chances++; chanceNo++;
          if (sigma !== null) { const aim = ringMode ? cfg.battle.strong_timing.ring_s : ((cfg.battle.jump.windup_s - e.fromS) + (cfg.battle.jump.windup_s - e.toS)) / 2 / speed;
            const floor = ringMode ? 0.30 + 0.08 * gauss() : 0; // 링이 뜬 걸 보고 나서야 누를 수 있음 (반응 하한)
            plan.push({ at: wall + Math.max(floor, aim + sigma * gauss()), x: 0.5, y: zoneY, chance: chanceNo }); } }
      } };
      for (let i = 0; i < minutes * 60 * 120; i++) {
        wall += 1 / 120; sim.update(speed / 120); handle(sim.drainEvents());
        if (mash && i % 12 === 0) sim.tapBattle(0.1 + rnd() * 0.8, mash === "low" ? rnd() * zoneY * 2 : zoneY * 2 + rnd() * (1 - zoneY * 2));
        plan.sort((a, b) => a.at - b.at);
        while (plan.length && plan[0].at <= wall) {
          const p = plan.shift();
          if (p.chance !== undefined && (p.chance !== chanceNo || !sim.ant.winding)) continue; // 지난 기회 탭은 버림
          if (p.target !== undefined && !sim.targets.some((t) => t.id === p.target)) continue; // 사라진 과녁은 안 누름
          const r = sim.tapBattle(p.x, p.y);
          if (p.target !== undefined && r === "target") g.posHit[p.p]++;
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
    // M7-D (I-26 · H-61) — C 값: ring 0.6 (계산 슬로) · 체인 (×1 · ×1.5) · ×2 이상 묶음 수명 후보
    const d = (o = {}) => { const c = structuredClone(cfgOn); Object.assign(c.battle.strong_timing, { ring_s: 0.6 }); Object.assign(c.battle.targets, { mode: "chain", ...o }); return c; };
    const ph = (r) => [0, 1, 2].map((k) => pct(r.posHit[k], r.pos[k])).join(" / ");
    console.log(`⑥ M7-D (ring 0.6 · 슬로 계산 · 체인 lead ${d().battle.targets.lead_s} · 버팀 · 첫 수명 ${d().battle.targets.chain_life_s} · step ${d().battle.targets.chain_life_step} — 지금 데이터)`);
    console.log(`  링 예측 (반응 하한 0.30 ± 0.08 + σ) GOOD 이상 ×1 / ×2 / ×3 — σ 0.06: ${[1, 2, 3].map((speed) => { const r = play(d(), { sigma: 0.06, speed, minutes: 10, buy: false }); return pct(r.perfect + r.good, r.chances); }).join(" / ")} · σ 0.08: ${[1, 2, 3].map((speed) => { const r = play(d(), { sigma: 0.08, speed, minutes: 10, buy: false }); return pct(r.perfect + r.good, r.chances); }).join(" / ")}`);
    for (const speed of [1, 1.5]) { const r = play(d(), { tgt: true, speed, minutes: 10 }); console.log(`  체인 ×${speed} — 1 / 2 / 3번째 맞힘 ${ph(r)} · PERFECT 묶음 ${r.batch}`); }
    for (const life of [1.2, 0.9, 0.7]) console.log(`  묶음 (×2 이상) 수명 ${life} — 맞힘 ×2 / ×3 ${[2, 3].map((speed) => { const r = play(d({ life_s: life }), { tgt: true, speed, minutes: 10 }); return pct(r.tHit, r.tAll); }).join(" / ")}`);
    const autoD = play(d(), {}), handD = play(d(), { sigma: 0.06, tgt: true });
    console.log(`  60분 ×1 — 자동만 stage 8 ${f(autoD.first[8])}분 · ${autoD.earned} | 손 (σ 0.06 · 과녁 다 노림) ${f(handD.first[8])}분 · ${handD.earned} · 손 ÷ 자동 ${autoD.first[8] && handD.first[8] ? (autoD.first[8] / handD.first[8]).toFixed(1) + "배" : "—"}`);
    const a3 = play(d(), { speed: 3, minutes: 20 });
    console.log(`  자동만 ×3 (실제 20분) 잔해 ${a3.earned}`);
    // 후보: targets.max_speed 1.5 (×2 · ×3 과녁 없음 — 착지 = 끝 규칙에서 묶음을 못 누름)
    const a3m = play(d({ max_speed: 1.5 }), { speed: 3, minutes: 20 }), h3m = play(d({ max_speed: 1.5 }), { sigma: 0.06, tgt: true, speed: 3, minutes: 20 }), h3 = play(d(), { sigma: 0.06, tgt: true, speed: 3, minutes: 20 });
    console.log(`  후보 max_speed 1.5 — 자동만 ×3 잔해 ${a3m.earned} · 손 ×3 (σ 0.06) ${h3m.earned} (과녁 있을 때 ${h3.earned})`);
    const mLd = play(d(), { mash: "low", minutes: 10 }), mHd = play(d(), { mash: "high", minutes: 10 });
    console.log(`  연타 — 아래: 강점프 ${mLd.perfect + mLd.good} | 위: 과녁 ${mHd.tHit} / ${mHd.tAll} · PERFECT ${mHd.batch}`);
    console.log(`⑤ 연타 (10분 · 0.1초마다) — 아래 절반: 강점프 ${mL.perfect + mL.good} · 헛발 ${mL.early} / 기회 ${mL.chances} | 위 절반: 과녁 ${mH.tHit} / ${mH.tAll} · PERFECT 묶음 ${mH.batch} · 강점프 ${mH.perfect + mH.good}`);
  }

  if (process.argv.includes("--defend")) {
    // M7-E (I-27 · I-28 · H-67 · H-69) — 사람 손 = 측정용 난수 (core와 따로 · 결정적)
    let seed = 4242;
    const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const gauss = () => { const u = Math.max(1e-9, rnd()); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
    const ROW = { max_hp: { per_level_pct: 0, per_level_add: 10, max_level: 7, cost_base: 60, cost_growth_pct: 135 }, push_power: { per_level_pct: 8, per_level_add: 0, max_level: 10, cost_base: 70, cost_growth_pct: 135 }, auto_defend: { per_level_pct: 0, per_level_add: 3, max_level: 10, cost_base: 80, cost_growth_pct: 140 } };
    const NAME = { max_hp: "체력", push_power: "받치는 힘", auto_defend: "자동 받치기" };
    const off = config.battle.targets?.action !== "defend";
    const on = (base, o = {}) => {
      const c = structuredClone(base);
      if (off) {
        c.battle.ant.max_hp = 30;
        Object.assign(c.battle.targets, { action: "defend", tap_route: "state" });
        Object.assign(c.economy, { carry_ants: 6, carry_interval_s: 0.2 });
        c.battle.defend.push_power = 0.12; // H-73 ④ C 시작 값
        if (c.battle.defend.recoil_fall_mult === undefined) c.battle.defend.recoil_fall_mult = 1.5; // I-32 반동 [가정]
        let sort = Math.max(0, ...c.upgrades.rows.map((r) => r.sort));
        for (const st of Object.keys(ROW)) if (!c.upgrades.rows.some((r) => r.stat === st)) c.upgrades.rows.push({ upgrade_id: st, name: NAME[st], stat: st, ...ROW[st], sort: ++sort });
      }
      if (o.push !== undefined) c.battle.defend.push_power = o.push;
      if (o.autoBase !== undefined) Object.assign(c.upgrades.rows.find((r) => r.stat === "auto_defend"), { cost_base: o.autoBase });
      return c;
    };
    const ATTACK = new Set(["attack_power", "attack_speed"]);
    const PX = config.layout.frame_height * config.layout.battle_ratio; // 전투 구역 높이 (720폭 프레임 px)
    // policy: cheap = 살 수 있는 가장 싼 것 · attack = 살 수 있는 것 중 공격 (공격력 · 공격속도) 먼저 → 없으면 가장 싼 것. 사면 [도전]
    const play = (cfg, { policy = "cheap", hand = false, mash = false, minutes = 60 } = {}) => {
      const sim = new BattleSim(structuredClone(cfg), 1);
      const rows = cfg.upgrades.rows, first = {}, plan = [], perDown = [];
      const r = { earned: 0, retreats: 0, downs: 0, lands: 0, destroyed: 0, low: 0, clears: 0, clearsHit: 0, spawned: 0, dHand: 0, dAuto: 0, lHand: 0, lAuto: 0, seq: 0, pos: [0, 0, 0, 0], posHit: [0, 0, 0, 0], batch: 0, tHit: 0, tAll: 0, strong: 0, jumpsB: 0, whiff: 0, ringJ: 0, ringT: 0, plainJ: 0, plainT: 0 };
      let landsSince = 0, wall = 0, jumpB = false, touched = false, ringNext = false, jRing = false, jTgt = false;
      const handle = (ev) => { for (const e of ev) {
        if (e.type === "deposit") r.earned += e.amount;
        else if (e.type === "spawn") r.spawned++;
        else if (e.type === "land") { r.lands++; landsSince++; }
        else if (e.type === "destroy") { r.destroyed++; if (sim.ant.hp <= sim.ant.maxHp * 0.3) r.low++; }
        else if (e.type === "antDown") { r.downs++; perDown.push(landsSince); }
        else if (e.type === "stageClear") { r.clears++; if (landsSince > 0) r.clearsHit++; if (!(e.stage in first)) first[e.stage] = wall / 60; }
        else if (e.type === "stageStart") { landsSince = 0; if (e.reason === "retreat") r.retreats++; }
        else if (e.type === "defend") { if (e.auto) { r.dAuto++; r.lAuto += e.lift; } else { r.dHand++; r.lHand += e.lift; } }
        else if (e.type === "targetHit") { r.tHit++; r.seq++; }
        else if (e.type === "targetsEnd") r.seq = 0;
        else if (e.type === "perfect") r.batch++;
        else if (e.type === "jump") {
          if (e.kind !== "auto") r.strong++;
          if (jumpB && !touched) r.whiff++; // 헛점프 = 떨어지는 건물이 있었는데 그 점프에 한 번도 안 닿음 (lift가 너무 커서 등)
          if (jumpB) { if (jRing) { r.ringJ++; if (jTgt) r.ringT++; } else { r.plainJ++; if (jTgt) r.plainT++; } } // I-33 링 기회 점프에 과녁이 몰리는지
          jumpB = sim.building?.state === "falling"; touched = false; if (jumpB) r.jumpsB++;
          jRing = ringNext; ringNext = false; jTgt = false;
        }
        else if (e.type === "targetsSpawn") {
          jTgt = true;
          r.tAll += e.targets.length; r.pos[Math.min(r.seq, 3)]++;
          if (hand) for (const t of e.targets) plan.push({ at: wall + Math.max(0.15, 0.42 + 0.1 * gauss()), x: t.x, y: t.y, target: t.id, p: Math.min(r.seq, 3) });
        }
        if (e.type === "timingChance") ringNext = true;
        if (e.type === "timingChance" && hand) plan.push({ at: wall + Math.max(0.3 + 0.08 * gauss(), cfg.battle.strong_timing.ring_s + 0.06 * gauss()), x: 0.5, y: 0.1, chance: true });
      } };
      for (let i = 0; i < minutes * 60 * 120; i++) {
        wall += 1 / 120; sim.update(1 / 120); if (sim.ant.contact) touched = true; handle(sim.drainEvents());
        if (mash && i % 12 === 0) sim.tapBattle(0.1 + rnd() * 0.8, rnd());
        plan.sort((a, b) => a.at - b.at);
        while (plan.length && plan[0].at <= wall) {
          const p = plan.shift();
          if (p.chance && !sim.ant.winding) continue;
          if (p.target !== undefined && !sim.targets.some((t) => t.id === p.target)) continue;
          const res = sim.tapBattle(p.x, p.y);
          if (p.target !== undefined && res === "target") r.posHit[p.p]++;
        }
        handle(sim.drainEvents());
        let bought = false;
        for (;;) {
          const can = rows.filter((x) => sim.levels[x.upgrade_id] < x.max_level).map((x) => ({ id: x.upgrade_id, stat: x.stat, cost: upgradeCost(x, sim.levels[x.upgrade_id]) })).filter((x) => x.cost <= sim.wallet);
          can.sort((a, b) => (policy === "attack" ? Number(!ATTACK.has(a.stat)) - Number(!ATTACK.has(b.stat)) : 0) || a.cost - b.cost || (a.id < b.id ? -1 : 1));
          if (!can.length || sim.buyUpgrade(can[0].id) !== "ok") break;
          bought = true;
        }
        if (bought && sim.challengeAvailable) sim.challenge();
      }
      const avg = (a) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : "—");
      return { ...r, first, perDown: avg(perDown), lv: rows.map((x) => sim.levels[x.upgrade_id]).join("/") };
    };
    const f = (x) => (x === undefined ? "—" : x.toFixed(1));
    const pc = (a, b) => `${Math.round((a / Math.max(1, b)) * 100)}%`;
    const px = (sum, n) => (n ? `${(sum / n).toFixed(3)} (${Math.round((sum / n) * PX)}px)` : "—");
    const line = (name, r) => `  ${name} | ${[6, 7, 8].map((s) => f(r.first[s])).join(" / ")} | ${r.earned} | 후퇴 ${r.retreats} · 쓰러짐 ${r.downs} · 착지→쓰러짐 ${r.perDown} | 아슬 (HP ≤ 30% 깸) ${pc(r.low, r.destroyed)} · 맞으며 깬 판 ${pc(r.clearsHit, r.clears)} | 건물당 받치기 손 ${(r.dHand / Math.max(1, r.spawned)).toFixed(2)} · 자동 ${(r.dAuto / Math.max(1, r.spawned)).toFixed(2)} · lift 손 ${px(r.lHand, r.dHand)} · 자동 ${px(r.lAuto, r.dAuto)} · 헛점프 ${pc(r.whiff, r.jumpsB)}`;
    const c0 = on(config), d = c0.battle.defend;
    console.log(`\nM7-E 받치기 측정 — ${off ? "데이터 꺼짐 → C 후보로 켜서 잼 (체력 30 · 강화 3행 · defend · state · 운반 6 · 0.2)" : "지금 데이터"} · 힘 ${d.push_power} · 반동 × ${d.recoil_fall_mult ?? 1} · 멈춤 ${d.push_s} · 감쇠 ${d.decay_pct}% · 건물당 ${d.max_per_building} · 상한 ${d.lift_max_y} · 자동 힘 × ${d.auto_power_ratio} · 자동 ${d.auto_pct}%`);
    console.log(`  강화 (Lv 순서 ${c0.upgrades.rows.map((x) => x.upgrade_id).join("/")}) — ${c0.upgrades.rows.filter((x) => x.stat in ROW).map((x) => `${x.stat} +${x.per_level_add || x.per_level_pct + "%"} × ${x.max_level} (${x.cost_base} · ${x.cost_growth_pct}%)`).join(" · ")}`);
    console.log("① 60분 (게임 분 = 실제 분 · ×1) — 설정 | stage 6 / 7 / 8 | 60분 잔해 | 후퇴 · 쓰러짐 | 아슬 | 받치기");
    console.log(line("키 끔 (지금 데이터 · 자동)", play(config)));
    const aC = play(c0), aA = play(c0, { policy: "attack" }), hC = play(c0, { hand: true });
    console.log(line("켬 · 자동 · 가장 싼 것", aC));
    console.log(line("켬 · 자동 · 공격 우선", aA));
    console.log(line("켬 · 손 (σ 0.06 · 과녁 다 노림) · 가장 싼 것", hC));
    console.log(`  손 ÷ 자동 (stage 8) ${aC.first[8] && hC.first[8] ? (aC.first[8] / hC.first[8]).toFixed(1) + "배" : "—"} · 손 체인 1 / 2 / 3번째 ${[0, 1, 2].map((k) => pc(hC.posHit[k], hC.pos[k])).join(" / ")} · PERFECT ${hC.batch} · 끝 Lv 자동 ${aC.lv} · 손 ${hC.lv}`);
    const m = play(c0, { mash: true, minutes: 10 });
    console.log(`② 연타 (10분 · 0.1초마다 아무 데나) — 과녁 맞힘 ${m.tHit} / ${m.tAll} · 체인 2번째 이상 ${m.posHit[1] + m.posHit[2]} · PERFECT ${m.batch} · 강점프 ${m.strong} (맞힘 = 우연히 과녁 반지름 안)`);
    const si = process.argv.indexOf("--seeds");
    if (si >= 0) {
      // H-79 범위 판정 = 시드 N개 평균 (+ 가장 느린 시드). 시드 목록 고정 (첫 값 = 지금 데이터 rng_seed)
      const n = Math.max(1, Math.min(10, Number(process.argv[si + 1]) || 5));
      const seeds = [c0.battle.rng_seed ?? 1, 7, 12345, 99, 4242, 31337, 2024, 555, 8080, 1001].slice(0, n);
      const runs = seeds.map((sd) => { const c = structuredClone(c0); c.battle.rng_seed = sd; return { a: play(c), b: play(c, { policy: "attack" }), h: play(c, { hand: true }) }; });
      const st = (xs, d = 1) => { const v = xs.map((x) => x ?? 60); const m = v.reduce((p, q) => p + q, 0) / v.length; return `${m.toFixed(d)} (${Math.min(...v).toFixed(d)} ~ ${Math.max(...v).toFixed(d)})`; };
      console.log(`④ 시드 ${n}개 (${seeds.join(" · ")}) — 평균 (최소 ~ 최대) · 60분 · ×1 · 못 깨면 60분으로 셈`);
      console.log(`  자동 · 가장 싼 것 stage 8 ${st(runs.map((r) => r.a.first[8]))}분 · 후퇴 ${st(runs.map((r) => r.a.retreats))} · 잔해 ${st(runs.map((r) => r.a.earned), 0)}`);
      console.log(`  자동 · 공격 우선 stage 8 ${st(runs.map((r) => r.b.first[8]))}분 · 후퇴 ${st(runs.map((r) => r.b.retreats))}`);
      console.log(`  손 stage 8 ${st(runs.map((r) => r.h.first[8]))}분 · 후퇴 ${st(runs.map((r) => r.h.retreats))} · 잔해 ${st(runs.map((r) => r.h.earned), 0)} · PERFECT ${st(runs.map((r) => r.h.batch), 0)} · 체인 셋째 ${st(runs.map((r) => (r.h.posHit[2] / Math.max(1, r.h.pos[2])) * 100), 0)}%`);
      console.log(`  손 ÷ 자동 ${st(runs.map((r) => (r.a.first[8] ?? 60) / (r.h.first[8] ?? 60)))}배 · 맞으며 깬 판 손 ${st(runs.map((r) => (r.h.clearsHit / Math.max(1, r.h.clears)) * 100), 0)}% · 자동 ${st(runs.map((r) => (r.a.clearsHit / Math.max(1, r.a.clears)) * 100), 0)}%`);
      console.log(`  가장 느린 시드 (자동 두 정책 중 늦은 쪽) = ${seeds[runs.map((r) => Math.max(r.a.first[8] ?? 60, r.b.first[8] ?? 60)).reduce((bi, v, i, arr) => (v > arr[bi] ? i : bi), 0)]}`);
    }
    if (process.argv.includes("--chance")) {
      // I-33 받쳐! 과녁 확률 — 자동은 과녁을 안 누름 (자동 칸은 난수 순서만 바뀜)
      console.log("③ 과녁 확률 (60분 · ×1) — chance | 자동 stage 8 · 후퇴 | 손 stage 8 · 후퇴 · 잔해 | 손 ÷ 자동 | 3 / 3 (PERFECT) · 체인 1 / 2 / 3번째 | 맞으며 깬 판 손 / 자동 | 과녁 나온 점프 (링 기회 점프 / 나머지)");
      for (const chance of [100, 70, 50]) {
        const c = structuredClone(c0); c.battle.targets.chance_pct = chance;
        const a = play(c), h = play(c, { hand: true });
        console.log(`  ${chance} | ${f(a.first[8])} · ${a.retreats} | ${f(h.first[8])} · ${h.retreats} · ${h.earned} | ${a.first[8] && h.first[8] ? (a.first[8] / h.first[8]).toFixed(1) + "배" : "—"} | ${h.batch} · ${[0, 1, 2].map((k) => pc(h.posHit[k], h.pos[k])).join(" / ")} | ${pc(h.clearsHit, h.clears)} / ${pc(a.clearsHit, a.clears)} | ${pc(h.ringT, h.ringJ)} / ${pc(h.plainT, h.plainJ)}`);
      }
      // 시드 3개 평균 (확률을 바꾸면 같은 시드 난수의 다른 뽑기 — 자동 받치기 · 링 — 순서가 밀려 자동 칸도 흔들림)
      console.log("   시드 3개 평균 — chance | 자동 stage 8 | 손 stage 8 · 후퇴 · 잔해 | PERFECT | 체인 셋째");
      const avg = (xs) => xs.reduce((p, q) => p + q, 0) / xs.length;
      for (const chance of [100, 70, 50]) {
        const rows = [20261107, 7, 12345].map((sd) => { const c = structuredClone(c0); c.battle.targets.chance_pct = chance; c.battle.rng_seed = sd; return { a: play(c), h: play(c, { hand: true }) }; });
        console.log(`  ${chance} | ${avg(rows.map((r) => r.a.first[8] ?? 60)).toFixed(1)} | ${avg(rows.map((r) => r.h.first[8] ?? 60)).toFixed(1)} · ${avg(rows.map((r) => r.h.retreats)).toFixed(1)} · ${Math.round(avg(rows.map((r) => r.h.earned)))} | ${Math.round(avg(rows.map((r) => r.h.batch)))} | ${Math.round(avg(rows.map((r) => (r.h.posHit[2] / Math.max(1, r.h.pos[2])) * 100)))}%`);
      }
    }
    if (process.argv.includes("--sweep")) {
      console.log("③ 쓸기 (60분 · 자동) — 힘 | 자동 받치기 비용 | 가장 싼 것 stage 8 · 잔해 · 후퇴 | 공격 우선 stage 8 · 잔해 · 후퇴 | lift (px) — 힘 0.08 ~ 0.15 (H-73 ④)");
      for (const push of [0.08, 0.12, 0.15]) for (const autoBase of [80, 160, 320]) {
        const c = on(config, { push, autoBase }), a = play(c), b = play(c, { policy: "attack" });
        console.log(`  ${push} | ${autoBase} | ${f(a.first[8])} · ${a.earned} · ${a.retreats} | ${f(b.first[8])} · ${b.earned} · ${b.retreats} | ${Math.round(push * PX)}`);
      }
    }
  }

  if (process.argv.includes("--floors")) {
    // M8 (H-62 ⑦) — 자동만 (가장 싼 강화 바로 · 사면 [도전]) · 층 통계는 이벤트로 셈
    const off = (config.stages.pool ?? []).every((r) => r.floors_max <= 1) && !(config.battle.building.spawn_jitter_ratio > 0) && !(config.battle.building.double_pct > 0);
    const cand = (base) => {
      const c = structuredClone(base);
      if (off) {
        c.stages.pool = c.stages.rows.map((r) => ({ stage: r.stage, building_id: r.building_id, weight: 1, floors_min: 1, floors_max: 3 }));
        Object.assign(c.battle.building, { spawn_jitter_ratio: 0.4, double_pct: 15, double_delay_s: c.battle.building.double_delay_s ?? 0.15 });
      }
      return c;
    };
    const run = (c, minutes = 60) => {
      const sim = new BattleSim(structuredClone(c), 1);
      const rows = c.upgrades.rows, first = {};
      const r = { earned: 0, floors: {}, strikes: 0, floorsBroken: 0, waste: 0, dealt: 0, spawns: 0, lands: 0, destroys: 0, retreats: 0, clears: 0, clearsHit: 0, gaps: [] };
      let cur = null, landsSince = 0, lastEnd = null;
      for (let i = 0; i < minutes * 60 * 120; i++) {
        sim.update(1 / 120);
        for (const e of sim.drainEvents()) {
          if (e.type === "spawn") { r.spawns++; r.floors[e.floors] = (r.floors[e.floors] ?? 0) + 1; cur = { hp: e.floorHp[0] }; if (lastEnd !== null) r.gaps.push(sim.time - lastEnd); }
          else if (e.type === "strike" && cur) { r.strikes++; const dealt = cur.hp - e.floorHpLeft; r.dealt += dealt; r.waste += e.damage - dealt; cur.hp = e.floorHpLeft; }
          else if (e.type === "floorBreak") { r.floorsBroken++; cur = { hp: sim.building?.floorHp[0] ?? 0 }; }
          else if (e.type === "destroy") { r.destroys++; cur = null; lastEnd = sim.time; }
          else if (e.type === "land") { r.lands++; landsSince++; cur = null; lastEnd = sim.time + c.battle.building.landed_linger_s; }
          else if (e.type === "deposit") r.earned += e.amount;
          else if (e.type === "stageStart") { landsSince = 0; if (e.reason === "retreat") r.retreats++; }
          else if (e.type === "stageClear") { r.clears++; if (landsSince > 0) r.clearsHit++; if (!(e.stage in first)) first[e.stage] = sim.time / 60; }
        }
        let bought = false;
        for (;;) {
          const can = rows.filter((x) => sim.levels[x.upgrade_id] < x.max_level).map((x) => ({ id: x.upgrade_id, cost: upgradeCost(x, sim.levels[x.upgrade_id]) })).filter((x) => x.cost <= sim.wallet).sort((a, b) => a.cost - b.cost || (a.id < b.id ? -1 : 1));
          if (!can.length || sim.buyUpgrade(can[0].id) !== "ok") break;
          bought = true;
        }
        if (bought && sim.challengeAvailable) sim.challenge();
      }
      return { ...r, first };
    };
    const f1 = (x) => (x === undefined ? "—" : x.toFixed(1));
    const c1 = cand(config);
    const pl = c1.stages.pool ?? [];
    console.log(`\nM8 층 건물 측정 — ${off ? "데이터 꺼짐 → 후보 (스테이지마다 지금 건물 1 ~ 3층 · 흔들기 0.4 · 연달아 15% · " + c1.battle.building.double_delay_s + "초)" : "지금 데이터"} · 풀 ${pl.length}행 · 자동만 60분 · 가장 싼 것`);
    const base = run(config), on1 = run(c1);
    const line = (name, x) => `  ${name} | stage 6 / 7 / 8 ${[6, 7, 8].map((s2) => f1(x.first[s2])).join(" / ")} | 잔해 ${x.earned} | 후퇴 ${x.retreats} · 맞으며 깬 판 ${Math.round((x.clearsHit / Math.max(1, x.clears)) * 100)}%`;
    console.log(line("지금 데이터", base));
    console.log(line(off ? "후보 켬" : "(같음)", on1));
    const tot = Object.values(on1.floors).reduce((a, b) => a + b, 0);
    console.log(`  층수 분포 ${Object.keys(on1.floors).sort().map((k) => `${k}층 ${Math.round((on1.floors[k] / tot) * 100)}%`).join(" · ")} · 깨진 층 ${on1.floorsBroken} · 층당 타수 ${(on1.strikes / Math.max(1, on1.floorsBroken + on1.destroys)).toFixed(1)} · 버려진 데미지 ${Math.round((on1.waste / Math.max(1, on1.waste + on1.dealt)) * 100)}% · 착지 ${on1.lands} / 파괴 ${on1.destroys}`);
    const gs = on1.gaps;
    if (gs.length) console.log(`  건물 사이 간격 (끝 → 다음 등장 · 게임 초) 평균 ${(gs.reduce((a, b) => a + b, 0) / gs.length).toFixed(2)} · 최소 ${Math.min(...gs).toFixed(2)} · 최대 ${Math.max(...gs).toFixed(2)}`);
    const seeds = [c1.battle.rng_seed ?? 1, 7, 12345, 99, 4242];
    const rs = seeds.map((sd) => { const c = structuredClone(c1); c.battle.rng_seed = sd; return run(c); });
    const v = rs.map((x) => x.first[8] ?? 60);
    console.log(`  시드 5개 — 자동 stage 8 평균 ${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1)} (${Math.min(...v).toFixed(1)} ~ ${Math.max(...v).toFixed(1)})분 · 맞으며 깬 판 평균 ${Math.round(rs.reduce((a, x) => a + x.clearsHit / Math.max(1, x.clears), 0) / rs.length * 100)}%`);
  }
} finally {
  await server.close();
}
