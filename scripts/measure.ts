/**
 * 임시 수치 측정 — 스테이지별로 "자동만" vs "강점프 연타(지면에 닿을 때마다 탭)"를 비교한다.
 * 밸런싱이 아니라, config 임시값으로 코어 루프가 의도대로 갈리는지(수동 효율 > 자동) 확인하는 용도.
 *   npm run measure
 */
import { BattleSim, type BattleEvent } from '../src/core/battle';
import { loadGameConfig } from '../src/gameConfig';

const { config, errors } = loadGameConfig();
if (errors.length) throw new Error(`config 오류:\n${errors.join('\n')}`);

type Policy = 'auto' | 'strong';
const BUILDINGS = 40;

function measure(stage: number, policy: Policy) {
  // 후퇴가 결과를 흐리지 않게 HP는 사실상 무한, 스테이지 고정
  const cfg = structuredClone(config);
  cfg.battle.ant.max_hp = 1e12;
  cfg.stages.rows = cfg.stages.rows.map((r) => ({ ...r, buildings_to_clear: 1e9 }));
  const sim = new BattleSim(cfg, stage);
  let destroyed = 0, landed = 0, strikes = 0, landDamage = 0, jumps = 0;
  const dt = 1 / 60;
  for (let t = 0; t < 3600 && destroyed + landed < BUILDINGS; t += dt) {
    if (policy === 'strong' && sim.ant.phase === 'ground') sim.tapStrongJump();
    sim.update(dt);
    for (const e of sim.drainEvents() as BattleEvent[]) {
      if (e.type === 'destroy') destroyed++;
      else if (e.type === 'land') { landed++; landDamage += e.damage; }
      else if (e.type === 'strike') strikes++;
      else if (e.type === 'jump') jumps++;
    }
  }
  const n = destroyed + landed;
  return {
    destroyRate: destroyed / n,
    strikesPerBuilding: strikes / n,
    avgLandDamage: landed ? landDamage / landed : 0,
    jumpsPerBuilding: jumps / n,
  };
}

const pct = (v: number) => `${(v * 100).toFixed(0)}%`.padStart(5);
const f1 = (v: number) => v.toFixed(1).padStart(5);
console.log(`건물 ${BUILDINGS}개씩 · 개미 HP 무한 · 스테이지 고정`);
console.log('stage | HP  | 낙하 | 자동: 파괴율 타격/건물 착지뎀 | 강점프: 파괴율 타격/건물 착지뎀');
for (const row of config.stages.rows) {
  const a = measure(row.stage, 'auto');
  const s = measure(row.stage, 'strong');
  console.log(
    `${String(row.stage).padStart(5)} | ${String(row.building_hp).padStart(3)} | ${row.fall_speed_ratio_per_s.toFixed(2)} |` +
      `       ${pct(a.destroyRate)}   ${f1(a.strikesPerBuilding)}   ${f1(a.avgLandDamage)} |` +
      `         ${pct(s.destroyRate)}   ${f1(s.strikesPerBuilding)}   ${f1(s.avgLandDamage)}`,
  );
}
