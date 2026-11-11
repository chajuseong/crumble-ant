/**
 * 전투 시뮬레이션 (순수 로직 — Phaser 의존 없음, Unity 이식 대상).
 *
 * 좌표: 전투 구역 세로 1축만 쓴다. y = 0 지면, y = 1 전투 구역 맨 위 (단위 = 전투 구역 높이).
 *  - 개미 y = 발 위치, 건물 y = 밑면 위치.
 *  - 개미와 건물은 같은 세로줄에 있다고 본다 (가로 판정 없음).
 *
 * 한 사이클:
 *   건물 낙하 → 개미 자동 점프 (지면 대기 후) → 상승 중 머리가 건물 밑면에 닿으면 매달려서
 *   팔 1→2→3→4 순서로 타격 (strike_interval_s 간격, 남은 상승 시간 동안) → 하강 → 착지 → 다시 점프
 *   ├ 건물 HP 0 → 파괴 (잔해) → 진행도 +1 → 다 부수면 스테이지 클리어
 *   └ 건물 밑면이 개미 키까지 내려옴 → 착지 → 개미 피격 (남은 HP × landing_damage_coeff)
 *       └ 개미 HP 0 → 기절 → 스테이지 1이면 재시작, 아니면 후퇴 + auto_advance OFF
 */

import { type GameConfig, buildingForStage, stageRow } from './config';
import { type BattleStats, type BuyResult, buyCheck, deriveStats, initialLevels, type Levels } from './economy';
import { Rng } from './rng';

export type AntPhase = 'ground' | 'rise' | 'fall' | 'down';
/** I-24: perfect = 링 PERFECT 초강점프 */
export type JumpKind = 'auto' | 'strong' | 'perfect';
export type TimingGrade = 'perfect' | 'good' | 'early' | 'miss';
export type StageStartReason = 'init' | 'advance' | 'repeat' | 'retreat' | 'restart' | 'challenge';
export type TapIgnoredReason = 'airborne' | 'cooldown' | 'down' | 'pinned' | 'noChance' | 'noBuilding';
/** M7 타격 출처 — auto = 자동 연타 · target = 과녁 탭 · bonus = PERFECT 보너스 */
export type StrikeSource = 'auto' | 'target' | 'bonus';
export type TargetsEndReason = 'expire' | 'missLimit' | 'hangEnd' | 'perfect';

/** M7 터치 과녁 — 좌표 = 전투 구역 비율 (x: 0 왼쪽 ~ 1 오른쪽 · y: 0 지면 ~ 1 맨 위) */
export interface TargetState {
  id: number;
  x: number;
  y: number;
}

export interface AntState {
  phase: AntPhase;
  /** 발 위치 */
  y: number;
  hp: number;
  maxHp: number;
  /** ground: 다음 자동 점프까지 남은 시간 */
  groundTimer: number;
  /** M5 도움닫기 중인가 (지면 · 건물이 떨어지는 중 · windup_s > 0) — 남은 시간 = windupLeft */
  winding: boolean;
  windupLeft: number;
  /** rise: 남은 상승 시간 (건물에 막혀 매달려 있어도 줄어든다 = 타격 가능 시간) */
  riseTimeLeft: number;
  jumpKind: JumpKind | null;
  /** 상승 속도 */
  jumpSpeed: number;
  /** 하강 속도 (M4 이동속도 강화 = 하강만 — I-13) */
  fallSpeed: number;
  /** 이번 점프의 목표 최고점 (발 기준) */
  apex: number;
  /** 상승 중 건물 밑면에 닿아 매달려 있음 = 타격 중 */
  contact: boolean;
  strikeTimer: number;
  /** 다음에 때릴 팔 슬롯 (0 ~ 3) */
  nextArm: number;
  strongCooldownLeft: number;
  downTimer: number;
  /** M7 이번 도움닫기에 타이밍 기회가 있는가 (mode timing) · 이미 한 번 탭했는가 */
  timingChance: boolean;
  timingUsed: boolean;
  /** M7 맞는 창 = 도움닫기 경과 시간 (게임 초) from ~ to */
  timingFrom: number;
  timingTo: number;
  /** I-24 ring: 링이 겹치는 도움닫기 경과 (게임 초) */
  ringAt: number;
}

export interface BuildingState {
  /** 화면에 나온 순번 (렌더러가 뷰를 맞출 때 씀) */
  id: number;
  /** 건물 테이블 PK */
  buildingId: string;
  name: string;
  weight: number;
  debrisReward: number;
  isBoss: boolean;
  /** 밑면 위치 */
  y: number;
  hp: number;
  maxHp: number;
  fallSpeed: number;
  state: 'falling' | 'landed';
  lingerTimer: number;
  /** M7-E 이 건물을 받친 수 (손 + 자동) · 받친 뒤 낙하 멈춤 남은 시간 (게임 초) */
  defendN: number;
  pauseLeft: number;
}

/** M7-E 치트 (`?cheat` · [프로토만]) — 시트 값을 덮기만 · 세이브 안 함 (docs/dev.md §6) */
export interface CheatState {
  /** 자동 받치기 % 합 (강화 포함)을 이 값으로 — null = 시트 + 강화 */
  autoDefendPct: number | null;
  pushMult: number;
  weightMult: number;
  infiniteHp: boolean;
}

export interface StageState {
  stage: number;
  autoAdvance: boolean;
  /** [도전]으로 들어온 스테이지를 진행 중 */
  challenging: boolean;
  destroyed: number;
  toClear: number;
}

export type BattleEvent =
  | { type: 'stageStart'; stage: number; reason: StageStartReason }
  | { type: 'stageClear'; stage: number; wasChallenge: boolean }
  | { type: 'autoAdvance'; on: boolean }
  | { type: 'spawn'; buildingId: number; hp: number }
  | { type: 'jump'; kind: JumpKind; apex: number }
  /** combo = 같은 건물에서 이어진 연타 수 (1부터) — 표시용, 판정에는 쓰지 않음 (docs/dev.md §4) */
  | { type: 'strike'; arm: number; damage: number; buildingId: number; hpLeft: number; combo: number; source: StrikeSource }
  | { type: 'destroy'; buildingId: number; y: number; debrisReward: number }
  | { type: 'land'; buildingId: number; damage: number; antHp: number }
  | { type: 'antDown'; stage: number }
  | { type: 'tapIgnored'; reason: TapIgnoredReason }
  /** M5: 도움닫기 시작 — 끝나면 자동 점프 · 그 사이 탭 = 바로 강점프 (skip — I-20) · 깔리면 취소 */
  | { type: 'windupStart' }
  /** M7: 이번 도움닫기에 강점프 기회 — 창 = 남은 도움닫기 시간 fromS ~ toS (fromS > toS) */
  | { type: 'timingChance'; fromS: number; toS: number }
  /** M7: 기회 중 탭 — ok = 창 안 (뒤이어 jump strong) · false = 창 밖 (기회 끝) */
  | { type: 'timingResult'; ok: boolean; grade: TimingGrade }
  /** M7: 매달림 시작 — 과녁 묶음 (lifeS = 실제 시간) */
  | { type: 'targetsSpawn'; targets: TargetState[]; lifeS: number }
  | { type: 'targetHit'; id: number }
  | { type: 'targetMiss'; missesLeft: number }
  | { type: 'targetsEnd'; reason: TargetsEndReason }
  | { type: 'perfect' }
  /** M4: 파괴 뒤 economy.carry_delay_s가 지나 잔해가 굴에 도착 — wallet += amount (docs/dev.md §4) */
  | { type: 'deposit'; amount: number; wallet: number; index: number; count: number }
  /** M7-E: 받치기 — 건물 밑면 += lift · n = 이 건물 받친 순번 (1부터) · auto = 자동 받치기 (docs/dev.md §4) */
  | { type: 'defend'; buildingId: number; lift: number; auto: boolean; n: number }
  /** M4: 강화 구매 — 데미지 · 간격은 다음 타격부터, 점프력 · 이동속도는 다음 점프부터 */
  | { type: 'upgrade'; id: string; level: number; cost: number; wallet: number };

/** 시작 상태 (M4 저장에서 읽은 값 — src/core/save.ts) */
export interface BattleStart {
  stage: number;
  autoAdvance: boolean;
  debris: number;
  levels: Levels;
}

export const FIXED_STEP_S = 1 / 120;
const EPS = 1e-9;
/** M7 과녁 자리 범위 (전투 구역 비율 — 모양 상수: 화면 가장자리 · 위쪽 [도전] 줄 · 지면 피함) · 과녁마다 위치 시도 횟수 */
const TARGET_X: readonly [number, number] = [0.1, 0.9];
const TARGET_Y: readonly [number, number] = [0.08, 0.85];
const TARGET_TRIES = 24;

export class BattleSim {
  readonly cfg: GameConfig;
  ant: AntState;
  building: BuildingState | null = null;
  stage: StageState;
  /** 다음 건물이 떨어지기까지 남은 시간 (건물이 없을 때만 줄어듦) */
  spawnTimer = 0;
  /** 누적 시뮬레이션 시간 (초) */
  time = 0;
  /** 누적 파괴 수 (스테이지가 바뀌어도 이어짐 — 확인 · 측정용) */
  totalDestroyed = 0;
  /** 연타 카운터 (M2 D) — 판정 · 결과에 쓰지 않음 */
  combo = 0;
  /** M4 보유 잔해 (정수) */
  wallet = 0;
  /** M4 강화 Lv (upgrade_id → Lv) */
  levels: Levels;
  /** M4 강화가 반영된 전투 값 (시트 값은 cfg 그대로) */
  stats: BattleStats;
  /** M4 운반 중인 잔해 (도착 시각 순 — 지연이 일정해서 넣은 순서 = 도착 순서) */
  readonly carrying: { at: number; amount: number; index: number; count: number }[] = [];
  private comboBuildingId = -1;
  private lastStrikeTime = -Infinity;
  private accumulator = 0;
  private nextBuildingId = 1;
  private events: BattleEvent[] = [];
  // ── M7 터치 개편 (I-23 · H-51) ──
  /** 시드 난수 — 뽑는 순서: 도움닫기 시작마다 1번 (mode timing) · 매달림 시작마다 확률 1번 + 개수 1번 + 위치 시도 (count_max > 0) */
  private readonly rng: Rng;
  /** 배속 (view가 알려 줌) — 과녁 수명 · 타이밍 창을 실제 시간으로 맞출 때만 씀. 자동 결과에는 영향 없음 */
  private timeScale = 1;
  /** 지금 살아 있는 과녁 · 남은 수명 (게임 초) · 이번 묶음 빈 곳 탭 수 */
  targets: TargetState[] = [];
  targetLifeLeft = 0;
  targetLifeTotal = 0;
  private targetMisses = 0;
  private targetBatch = 0;
  private nextTargetId = 1;
  /** 마지막 기회 뒤 점프 수 (min_gap_jumps) — 처음은 바로 기회 가능 */
  private jumpsSinceChance = Number.MAX_SAFE_INTEGER;
  /** H-56 ① 이번 점프에서 아직 '닿기 직전' 과녁을 안 냈음 (점프마다 다시 켬) */
  private leadArmed = false;

  constructor(cfg: GameConfig, startStage = 1, start: BattleStart | null = null) {
    this.cfg = cfg;
    const b = cfg.battle;
    this.rng = new Rng(b.rng_seed ?? 1);
    this.levels = { ...initialLevels(cfg), ...(start?.levels ?? {}) };
    this.stats = deriveStats(cfg, this.levels);
    this.wallet = start ? start.debris : cfg.economy.start_debris;
    this.ant = {
      phase: 'ground',
      y: 0,
      hp: b.ant.max_hp + this.stats.hpAdd,
      maxHp: b.ant.max_hp + this.stats.hpAdd,
      groundTimer: (b.jump.windup_s ?? 0) > 0 ? b.jump.windup_s! : b.jump.ground_delay_s,
      winding: false,
      windupLeft: 0,
      riseTimeLeft: 0,
      jumpKind: null,
      jumpSpeed: b.jump.speed_ratio_per_s,
      fallSpeed: b.jump.speed_ratio_per_s,
      apex: 0,
      contact: false,
      strikeTimer: 0,
      nextArm: 0,
      strongCooldownLeft: 0,
      downTimer: 0,
      timingChance: false,
      timingUsed: false,
      timingFrom: 0,
      timingTo: 0,
      ringAt: 0,
    };
    this.stage = { stage: 1, autoAdvance: start ? start.autoAdvance : true, challenging: false, destroyed: 0, toClear: 1 };
    this.startStage(Math.max(1, Math.floor(start ? start.stage : startStage)), 'init');
  }

  /** 쌓인 이벤트를 꺼낸다 (렌더러가 매 프레임 호출) */
  drainEvents(): BattleEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  /** 가변 프레임 dt → 고정 스텝으로 나눠 진행 (프레임레이트와 무관하게 같은 결과) */
  update(dtSeconds: number): void {
    // H-61 링 기회 동안 슬로 (게임 시간 × windup_s ÷ (ring_s + good_s) — 기회 도움닫기 = 게임 시간 그대로 · 실제 시간만 늘어남)
    this.accumulator += Math.max(0, Math.min(dtSeconds, 0.25)) * this.slowNow;
    while (this.accumulator >= FIXED_STEP_S - EPS) {
      this.step(FIXED_STEP_S);
      this.accumulator -= FIXED_STEP_S;
    }
  }

  /** 전투 구역 탭 = 강점프. 지면에 있을 때만 즉시 발동. */
  tapStrongJump(): boolean {
    const a = this.ant;
    if (a.phase === 'down') return this.ignore('down');
    if (a.phase !== 'ground') return this.ignore('airborne');
    if (this.building?.state === 'landed') return this.ignore('pinned'); // 착지한 건물에 깔려 있음
    if (a.strongCooldownLeft > EPS) return this.ignore('cooldown');
    this.beginJump('strong');
    a.strongCooldownLeft = this.cfg.battle.strong_jump.cooldown_s;
    return true;
  }

  /** I-26 지금 슬로 배수 (링 기회 도움닫기 중 · 아직 안 누름) */
  get slowNow(): number {
    const a = this.ant;
    return a.winding && a.timingChance && !a.timingUsed ? this.ringSlow : 1;
  }

  /** H-61 링 슬로 배수 = windup_s ÷ (ring_s + good_s) (키 없음 — 링 방식 · 도움닫기 켬일 때만 · 1을 넘지 않음) */
  get ringSlow(): number {
    const t = this.cfg.battle.strong_timing;
    const w = this.cfg.battle.jump.windup_s ?? 0;
    if (!t || (t.style ?? 'circle') !== 'ring' || w <= 0) return 1;
    const real = (t.ring_s ?? w) + (t.good_s ?? 0);
    return real > w ? w / real : 1;
  }

  /** H-61 체인 과녁 켬 (mode chain · 배속 ≤ chain_max_speed) — 아니면 building 묶음 */
  private get chainOn(): boolean {
    const t = this.cfg.battle.targets;
    return t?.mode === 'chain' && this.timeScale <= (t.chain_max_speed ?? Infinity) + EPS;
  }

  /** M7 강점프 입력 방식 (없으면 tap = 지금) */
  get strongMode(): 'tap' | 'timing' {
    return this.cfg.battle.strong_jump.mode ?? 'tap';
  }

  /** M7 배속 알림 (view) — 과녁 수명 · 타이밍 창 = 실제 시간 기준 (H-51 Q2 · Q8). 자동 결과에는 영향 없음 */
  setTimeScale(scale: number): void {
    this.timeScale = Math.max(0.01, scale);
  }

  /** M7-E 치트 (`?cheat` · [프로토만]) — 시트 값을 덮기만 (setTimeScale처럼) · 세이브 안 함 */
  readonly cheat: CheatState = { autoDefendPct: null, pushMult: 1, weightMult: 1, infiniteHp: false };
  setCheat(c: Partial<CheatState>): void {
    Object.assign(this.cheat, c);
    if (this.cheat.infiniteHp && this.ant.phase !== 'down') this.ant.hp = this.ant.maxHp;
  }
  /** M7-E 치트 잔해 + n (운반 없이 바로 · 이벤트 없음 — view가 HUD를 다시 그림) */
  addDebrisCheat(n: number): void {
    this.wallet += Math.max(0, Math.floor(n));
  }

  /** M7-E 자동 받치기 % 합 (시트 + 강화 · 치트면 그 값) — battle.defend 없으면 0 */
  get autoDefendPct(): number {
    const d = this.cfg.battle.defend;
    if (!d) return 0;
    return this.cheat.autoDefendPct ?? d.auto_pct + this.stats.autoDefendAdd;
  }

  /** M7-E 체인 칸 "n / m" (view 표시용 — 지금 과녁 순서 · 체인 최대) · 체인이 아니면 null */
  get chainStep(): { n: number; m: number } | null {
    return this.targetsChain && this.targets.length > 0 ? { n: this.chainIndex + 1, m: this.cfg.battle.targets?.count_max ?? 0 } : null;
  }

  /** M7-E 과녁 탭 = 받치기 (targets.action defend) */
  get defendOn(): boolean {
    return this.cfg.battle.targets?.action === 'defend' && this.cfg.battle.defend !== undefined;
  }

  /**
   * M7 전투 구역 탭 (x · y = 전투 구역 비율 좌표). 판정 순서: 과녁 → 강점프 (tap / timing) → 무시
   * 반환 = 무엇을 했나 (테스트 · 측정용)
   */
  tapBattle(x: number, y: number): 'target' | 'miss' | 'strong' | 'timingMiss' | 'ignored' {
    const zone = this.cfg.battle.strong_timing?.tap_max_y;
    if (this.strongMode === 'timing' && zone !== undefined && this.cfg.battle.targets?.tap_route === 'state') {
      // M7-E (H-69) 탭 길 = 상태: 과녁 있으면 어디든 과녁 · 없으면 아래 = 링 기회 · 위 = 무시
      if (this.targets.length > 0) return this.tapTargets(x, y);
      return y <= zone ? this.tapTiming() : this.ignore('noChance') || 'ignored';
    }
    if (this.strongMode === 'timing' && zone !== undefined) {
      // H-54 ③ 아래 = 타이밍만 · 위 = 과녁만 (엉뚱한 탭이 기회를 날리지 않게)
      if (y <= zone) return this.tapTiming();
      return this.targets.length > 0 ? this.tapTargets(x, y) : this.ignore('noChance') || 'ignored';
    }
    if (this.targets.length > 0) return this.tapTargets(x, y);
    if (this.strongMode === 'tap') return this.tapStrongJump() ? 'strong' : 'ignored';
    return this.tapTiming();
  }

  /** [도전] 버튼 — auto_advance OFF이고 도전 중이 아닐 때만. 실패했던 스테이지(현재 + 1)를 다시 시작. */
  challenge(): boolean {
    if (!this.challengeAvailable || this.ant.phase === 'down') return false;
    this.stage.challenging = true;
    this.startStage(this.stage.stage + 1, 'challenge');
    return true;
  }

  /** M4 강화 구매 — 결과 ok / short (부족) / max / unknown. ok면 upgrade 이벤트 */
  buyUpgrade(id: string): BuyResult {
    const c = buyCheck(this.cfg, this.levels, this.wallet, id);
    if (c.result !== 'ok' || c.cost === null) return c.result;
    this.wallet -= c.cost;
    this.levels[id] = c.level + 1;
    this.stats = deriveStats(this.cfg, this.levels);
    // M7-E 체력 강화 (H-67): 늘어난 만큼 바로 채움 · 기절 중이면 최대만 (회복 = 스테이지 시작 때 최대)
    const maxHp = this.cfg.battle.ant.max_hp + this.stats.hpAdd;
    if (maxHp !== this.ant.maxHp) {
      if (this.ant.phase !== 'down') this.ant.hp = Math.max(0, this.ant.hp + maxHp - this.ant.maxHp);
      this.ant.maxHp = maxHp;
    }
    this.events.push({ type: 'upgrade', id, level: c.level + 1, cost: c.cost, wallet: this.wallet });
    return 'ok';
  }

  /** [도전] 버튼을 보여야 하는가 — 도전 중에는 숨김 (CA-001: 다시 누르면 깨지 않은 스테이지를 건너뛰었음) */
  get challengeAvailable(): boolean {
    return !this.stage.autoAdvance && !this.stage.challenging;
  }

  // ──────────────────────────────────────────────────────────

  private step(dt: number): void {
    this.time += dt;
    const a = this.ant;
    const bc = this.cfg.battle;

    // M4 재화 도착 (기절 · 후퇴 중에도 — 예약은 그대로)
    while (this.carrying.length > 0 && this.carrying[0]!.at <= this.time + EPS) {
      const c = this.carrying.shift()!;
      this.wallet += c.amount;
      this.events.push({ type: 'deposit', amount: c.amount, wallet: this.wallet, index: c.index, count: c.count });
    }

    if (a.strongCooldownLeft > 0) a.strongCooldownLeft = Math.max(0, a.strongCooldownLeft - dt);

    // 기절 중에는 전투 정지 → 끝나면 후퇴 / 재시작
    if (a.phase === 'down') {
      a.downTimer -= dt;
      if (a.downTimer <= EPS) this.resolveKnockout();
      return;
    }

    // 건물 생성 · 낙하 · 착지 후 남아 있기
    const bld = this.building;
    if (!bld) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= EPS) this.spawnBuilding();
    } else if (bld.state === 'falling') {
      if (bld.pauseLeft > EPS) bld.pauseLeft = Math.max(0, bld.pauseLeft - dt); // M7-E 받친 뒤 낙하 멈춤
      else bld.y -= bld.fallSpeed * dt;
    } else {
      bld.lingerTimer -= dt;
      if (bld.lingerTimer <= EPS) {
        this.building = null;
        this.spawnTimer = bc.building.spawn_delay_s;
      }
    }

    // 개미 이동
    const falling = this.building && this.building.state === 'falling' ? this.building : null;
    switch (a.phase) {
      case 'ground':
        if (falling) {
          // M5: 도움닫기가 켜져 있으면 건물이 떨어지는 동안의 지면 대기 = 도움닫기 (windupStart 한 번)
          if (this.windupOn && !a.winding) {
            a.winding = true;
            this.events.push({ type: 'windupStart' });
            this.rollTimingChance();
          }
          a.groundTimer -= dt;
          if (a.winding) a.windupLeft = Math.max(0, a.groundTimer);
          if (a.groundTimer <= EPS) this.beginJump('auto');
        }
        break;
      case 'rise':
        a.riseTimeLeft -= dt;
        a.y = Math.min(a.apex, a.y + a.jumpSpeed * dt);
        if (a.riseTimeLeft <= EPS) {
          a.phase = 'fall';
          a.contact = false;
          // M7-E 닿기 전에 맞힌 받치기인데 끝내 못 닿고 정점 (닿기 직전 과녁은 아슬아슬한 점프에도 나옴) → 그 자리에서 받침 (탭을 버리지 않음)
          if (this.pendingDefend > 0 && falling) {
            const n = this.pendingDefend;
            this.pendingDefend = 0;
            for (let i = 0; i < n; i++) this.defend(falling, false);
          }
        }
        break;
      case 'fall':
        a.y -= a.fallSpeed * dt;
        if (a.y <= 0) this.toGround();
        break;
    }

    // 건물 밑면에 막힘 (개미가 건물을 뚫지 못함)
    if (falling) {
      const antH = bc.ant.height_ratio;
      const head = a.y + antH;
      if (head >= falling.y - EPS) {
        a.y = Math.max(0, falling.y - antH);
        const wasContact = a.contact;
        a.contact = a.phase === 'rise';
        if (a.contact && !wasContact) {
          a.strikeTimer = 0; // 닿는 순간 첫 타격
          if (bc.arm_order_resets_each_jump) a.nextArm = 0;
          if (bc.targets?.lead_s === undefined) {
            if (this.chainOn) this.startChain(falling);
            else this.spawnTargets(falling);
          } else if (this.chainOn && this.pendingExtend > 0) {
            a.riseTimeLeft += this.pendingExtend; // 닿기 전에 맞힌 연장
            this.pendingExtend = 0;
          }
          // M7-E 받치기: 닿기 전에 맞힌 받치기 → 닿는 순간 · 그다음 자동 받치기 난수 1번 (자동 % 합 > 0일 때만 — 순서 고정)
          const pend = this.pendingDefend;
          this.pendingDefend = 0;
          for (let i = 0; i < pend; i++) this.defend(falling, false);
          const autoPct = this.autoDefendPct;
          if (autoPct > 0 && this.rng.int(100) < autoPct) this.defend(falling, true);
        }
        if (a.phase === 'fall' && a.y <= 0) this.toGround();
      } else if (a.contact) {
        a.contact = false;
      }

      // 타격
      if (a.contact) {
        a.strikeTimer -= dt;
        while (a.strikeTimer <= EPS && this.building === falling) {
          this.strike(falling, 'auto');
          a.strikeTimer += this.stats.strikeIntervalS;
        }
      }

      // 착지 판정: 건물 밑면이 개미 키까지 내려옴 (= 개미를 지면까지 눌렀음)
      if (this.building === falling && falling.y <= antH + EPS) this.landBuilding(falling);
    }

    // H-56 ① 닿기 직전 등장 — 상승 중 · 닿을 때까지 남은 시간 ≤ lead_s (실제) · 정점 전에 닿을 때만 · 남은 과녁 있으면 안 나옴
    const tg = bc.targets;
    const fb = this.building && this.building.state === 'falling' ? this.building : null;
    if (tg && tg.lead_s !== undefined && fb && a.phase === 'rise' && !a.contact && this.targets.length === 0 && this.leadArmed) {
      const gap = fb.y - (a.y + bc.ant.height_ratio);
      const close = a.jumpSpeed + fb.fallSpeed;
      const t = close > 0 ? gap / close : Infinity;
      if (t >= 0 && t <= Math.min(a.riseTimeLeft, tg.lead_s * this.timeScale) + EPS) {
        this.leadArmed = false;
        if (this.chainOn) this.startChain(fb);
        else this.spawnTargets(fb);
      }
    }
    // M7 과녁 끝: 매달림 단위 = 매달림 끝 · 건물 단위 (H-54 ①) = 수명 · 파괴 · 착지 · 수명 = 게임 시간 (= 실제 × 배속)
    if (this.targets.length > 0) {
      const chain = this.targetsChain;
      const perHang = chain || (tg?.end_on_hang ?? true);
      if (chain && (a.phase === 'fall' || a.phase === 'ground' || !this.building || this.building.state !== 'falling')) this.endTargets('hangEnd'); // 체인: 개미가 떨어지거나 땅 · 건물 끝 = 즉시 끝 (닿기 직전은 OK)
      else if (!chain && perHang && !a.contact) this.endTargets('hangEnd');
      else if (!perHang && (!this.building || this.building.state !== 'falling')) this.endTargets('hangEnd');
      else {
        this.targetLifeLeft -= dt;
        if (this.targetLifeLeft <= EPS) this.endTargets('expire');
      }
    }
  }

  private beginJump(kind: JumpKind): void {
    const a = this.ant;
    const sj = this.cfg.battle.strong_jump;
    const st = this.stats;
    const strongish = kind !== 'auto';
    const mult = kind === 'perfect' ? (sj.perfect_height_mult ?? sj.height_mult) : sj.height_mult;
    const ceiling = 1 - this.cfg.battle.ant.height_ratio; // 전투 구역 위를 넘지 않게 (PERFECT만 — 강점프는 데이터 검증이 막음)
    const height = kind === 'auto' ? st.jumpHeight : kind === 'perfect' ? Math.min(st.jumpHeight * mult, ceiling) : st.jumpHeight * mult;
    const speed = strongish ? st.riseSpeed * sj.speed_mult : st.riseSpeed;
    this.leadArmed = true;
    this.pendingDefend = 0;
    a.phase = 'rise';
    a.jumpKind = kind;
    a.jumpSpeed = speed;
    a.winding = false; // 도움닫기 중 탭 = 남은 도움닫기를 건너뛰고 바로 강점프 (skip — I-20)
    a.windupLeft = 0;
    a.timingChance = false;
    if (this.jumpsSinceChance < Number.MAX_SAFE_INTEGER) this.jumpsSinceChance += 1;
    a.fallSpeed = strongish ? st.fallSpeed * sj.speed_mult : st.fallSpeed;
    a.apex = height;
    a.riseTimeLeft = height / speed;
    a.contact = false;
    this.events.push({ type: 'jump', kind, apex: height });
  }

  private toGround(): void {
    const a = this.ant;
    a.y = 0;
    a.phase = 'ground';
    a.contact = false;
    a.jumpKind = null;
    a.groundTimer = this.groundDelay;
    a.winding = false; // 깔리면 · 다시 시작하면 도움닫기 취소 → 다음 건물이 떨어질 때 처음부터
    a.windupLeft = 0;
    a.timingChance = false;
    this.pendingDefend = 0;
    if (this.targets.length > 0) this.endTargets('hangEnd'); // H-61 개미 착지 = 과녁 끝 (묶음 · 체인 공통)
  }

  /** M5 도움닫기 켜짐 (windup_s > 0) */
  private get windupOn(): boolean {
    return (this.cfg.battle.jump.windup_s ?? 0) > 0;
  }

  /** 자동 점프 전 지면 대기 — 도움닫기가 켜지면 windup_s (방식 A: ground_delay_s 대신) */
  private get groundDelay(): number {
    return this.windupOn ? this.cfg.battle.jump.windup_s! : this.cfg.battle.jump.ground_delay_s;
  }

  /** M7-E 과녁 맞힘 — strike 1타 / defend 받치기 (닿기 전이면 닿는 순간 — 손 · 건물이 같은 순간에 움직이게) */
  private pendingDefend = 0;
  private targetAction(b: BuildingState): void {
    if (!this.defendOn) {
      this.strike(b, 'target');
      return;
    }
    if (this.ant.phase === 'rise' && !this.ant.contact) this.pendingDefend += 1;
    else this.defend(b, false);
  }

  /**
   * M7-E 받치기 (I-28) — lift = push_power × 받치는 힘 % ÷ 100 ÷ (weight × 치트) × (1 − decay)^n × (자동 ratio) × 치트
   * 밑면 = min(lift_max_y, 밑면 + lift) (내려가지는 않음) · 낙하 멈춤 push_s · 닿아 있는 개미 같이 올라감 · 건물당 max_per_building
   */
  private defend(b: BuildingState, auto: boolean): void {
    const d = this.cfg.battle.defend;
    if (!d || b.state !== 'falling' || b.defendN >= d.max_per_building) return;
    const weight = b.weight * this.cheat.weightMult;
    const raw = ((d.push_power * this.stats.pushPct) / 100 / weight) * Math.pow(1 - d.decay_pct / 100, b.defendN) * (auto ? d.auto_power_ratio : 1) * this.cheat.pushMult;
    const y = Math.max(b.y, Math.min(d.lift_max_y, b.y + raw));
    const lift = Math.round((y - b.y) * 1e6) / 1e6;
    b.defendN += 1;
    b.y = y;
    b.pauseLeft = d.push_s;
    const a = this.ant;
    if (a.contact) {
      a.y = b.y - this.cfg.battle.ant.height_ratio; // 개미도 같이 올라감 = 매달림 유지 (자동 공격 계속 — H-69)
      a.apex = Math.max(a.apex, a.y);
    }
    this.events.push({ type: 'defend', buildingId: b.id, lift, auto, n: b.defendN });
  }

  private strike(b: BuildingState, source: StrikeSource): void {
    const a = this.ant;
    const damage = this.stats.armDamage[a.nextArm]!;
    b.hp = Math.max(0, b.hp - damage);
    // 연타: 같은 건물에서 마지막 타격 뒤 combo_window_s 안이면 이어짐 (비교 전 반올림 — 결정성)
    const gap = Math.round((this.time - this.lastStrikeTime) * 1e6) / 1e6;
    this.combo = this.comboBuildingId === b.id && gap <= this.cfg.battle.combo_window_s ? this.combo + 1 : 1;
    this.comboBuildingId = b.id;
    this.lastStrikeTime = this.time;
    this.events.push({ type: 'strike', arm: a.nextArm + 1, damage, buildingId: b.id, hpLeft: b.hp, combo: this.combo, source });
    a.nextArm = (a.nextArm + 1) % this.cfg.battle.arms.length;
    if (b.hp <= 0) this.destroyBuilding(b);
  }

  // ── M7 ─────────────────────────────────────────────────

  /** 도움닫기 시작 — mode timing이면 기회 뽑기 (난수 1번 · 최소 간격은 뽑은 뒤 적용 — 뽑는 순서 고정) */
  private rollTimingChance(): void {
    const a = this.ant;
    a.timingChance = false;
    a.timingUsed = false;
    const t = this.cfg.battle.strong_timing;
    if (this.strongMode !== 'timing' || !t) return;
    const roll = this.rng.int(100);
    if (roll >= t.chance_pct || this.jumpsSinceChance < t.min_gap_jumps) return;
    const w = this.groundDelay;
    const to = Math.min(w, Math.max(0, t.window_to * w));
    const from = Math.max(0, to - t.window_s * this.timeScale); // 창 길이 = 실제 시간 × 배속 · 도움닫기 시작보다 앞으로 안 감 (H-51 Q8)
    a.timingChance = true;
    this.jumpsSinceChance = 0;
    if ((t.style ?? 'circle') === 'ring') {
      // I-24 링: 기회 도움닫기만 실제 시간 (배속 무시) — 겹침 = ring_s · 끝 = ring_s + good_s (늦게 누를 틈)
      const k = this.timeScale * this.ringSlow; // 실제 1초 = 게임 배속 × 슬로 (슬로 = 계산 — 기회 도움닫기 게임 시간 = windup_s × 배속)
      const ring = (t.ring_s ?? w) * k;
      const good = (t.good_s ?? 0) * k;
      a.groundTimer = this.ringSlow < 1 ? w * this.timeScale : ring + good; // 슬로면 게임 시간으로 정확히 (반올림 오차 없게)
      a.windupLeft = a.groundTimer;
      a.ringAt = ring;
      a.timingFrom = Math.max(0, ring - good);
      a.timingTo = ring + good;
      this.events.push({ type: 'timingChance', fromS: a.groundTimer - a.timingFrom, toS: 0 });
      return;
    }
    a.timingFrom = from;
    a.timingTo = to;
    this.events.push({ type: 'timingChance', fromS: w - from, toS: w - to });
  }

  /** mode timing 탭 — 기회 · 도움닫기 중 · 한 번만 */
  private tapTiming(): 'strong' | 'timingMiss' | 'ignored' {
    const a = this.ant;
    if (a.phase === 'down') return this.ignore('down') || 'ignored';
    if (a.phase !== 'ground') return this.ignore('airborne') || 'ignored';
    if (!this.building || this.building.state !== 'falling') return this.ignore(this.building ? 'pinned' : 'noBuilding') || 'ignored';
    if (!a.winding || !a.timingChance || a.timingUsed) return this.ignore('noChance') || 'ignored';
    a.timingUsed = true;
    const t = this.cfg.battle.strong_timing!;
    if ((t.style ?? 'circle') === 'ring') {
      // I-24 등급 = 겹침과의 차이 (실제 초) — PERFECT ± perfect_s · GOOD ± good_s · 그보다 빠름 = 헛발 (기회 끝 · 끝에 보통 점프)
      const total = a.timingTo; // 기회 도움닫기 전체 (게임 초)
      const elapsed = Math.round((total - a.groundTimer) * 1e6) / 1e6;
      const d = Math.round(((elapsed - a.ringAt) / (this.timeScale * this.ringSlow)) * 1e6) / 1e6;
      const grade: TimingGrade = Math.abs(d) <= (t.perfect_s ?? 0) + EPS ? 'perfect' : Math.abs(d) <= (t.good_s ?? 0) + EPS ? 'good' : 'early';
      const ok = grade !== 'early' && a.strongCooldownLeft <= EPS;
      this.events.push({ type: 'timingResult', ok, grade: ok ? grade : 'early' });
      if (!ok) return 'timingMiss';
      this.beginJump(grade === 'perfect' ? 'perfect' : 'strong');
      a.strongCooldownLeft = this.cfg.battle.strong_jump.cooldown_s;
      return 'strong';
    }
    const elapsed = Math.round((this.groundDelay - a.groundTimer) * 1e6) / 1e6; // 문턱 비교 전 반올림 (결정성)
    const ok = elapsed >= a.timingFrom - EPS && elapsed <= a.timingTo + EPS && a.strongCooldownLeft <= EPS;
    this.events.push({ type: 'timingResult', ok, grade: ok ? 'good' : 'early' });
    if (!ok) return 'timingMiss';
    this.beginJump('strong');
    a.strongCooldownLeft = this.cfg.battle.strong_jump.cooldown_s;
    return 'strong';
  }

  /** 전투 구역 세로 ÷ 가로 (비율 좌표 거리를 가로 폭 단위로 재려고) */
  private get aspect(): number {
    const l = this.cfg.layout;
    return (l.frame_height * l.battle_ratio) / l.frame_width;
  }

  /** 과녁끼리 · 탭과 과녁 사이 거리 (가로 폭 단위) */
  private dist(ax: number, ay: number, bx: number, by: number): number {
    const dx = ax - bx;
    const dy = (ay - by) * this.aspect;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** 매달림 시작 — 과녁 묶음 (확률 1번 · 개수 1번 · 과녁마다 위치 시도 최대 24번 — 뽑는 순서 고정) */
  private spawnTargets(b: BuildingState): void {
    const t = this.cfg.battle.targets;
    if (!t || t.count_max <= 0) return;
    if (this.targets.length > 0) this.endTargets('hangEnd');
    this.targetsChain = false;
    if (!this.targetsAllowed) return;
    const roll = this.rng.int(100);
    const n = t.count_min + this.rng.int(t.count_max - t.count_min + 1);
    if (roll >= t.chance_pct || n <= 0) return;
    const ant = this.cfg.battle.ant;
    const antTop = this.ant.y + ant.height_ratio;
    const out: TargetState[] = [];
    for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < TARGET_TRIES; tries++) {
        const x = TARGET_X[0] + this.rng.float() * (TARGET_X[1] - TARGET_X[0]);
        const y0 = Math.max(TARGET_Y[0], (this.cfg.battle.strong_timing?.tap_max_y ?? -1) + 0.05); // H-54 ③ 과녁은 탭 구역 위쪽만
        const y = y0 + this.rng.float() * (TARGET_Y[1] - y0);
        const nearAnt = Math.abs(x - 0.5) < ant.width_ratio * 1.5 && y < antTop + 0.05; // 개미 둘레 (머리 위까지)
        const onHpBar = Math.abs(y - b.y) < 0.06; // 건물 밑면 HP 바 줄
        const crowded = out.some((o) => this.dist(o.x, o.y, x, y) < t.min_dist_ratio);
        if (nearAnt || onHpBar || crowded) continue;
        out.push({ id: this.nextTargetId++, x: Math.round(x * 1e4) / 1e4, y: Math.round(y * 1e4) / 1e4 });
        break;
      }
    }
    if (out.length === 0) return;
    this.targets = out;
    this.targetBatch = out.length;
    this.targetMisses = 0;
    this.targetLifeTotal = t.life_s * this.timeScale; // 실제 시간 → 게임 시간
    this.targetLifeLeft = this.targetLifeTotal;
    this.events.push({ type: 'targetsSpawn', targets: out.map((o) => ({ ...o })), lifeS: t.life_s });
  }

  /** 과녁이 있을 때 탭 — 반지름 안 가장 가까운 과녁 하나 (같은 거리면 id 작은 것) · 빗나가면 miss */
  // ── I-26 매달려 연타 체인 ──
  private chainIndex = 0;
  /** 지금 과녁이 체인으로 나왔는가 (배속이 중간에 바뀌어도 그 과녁은 그 규칙대로) */
  private targetsChain = false;
  private pendingExtend = 0;
  private chainPrev: { x: number; y: number } | null = null;

  /** 배속이 targets.max_speed보다 높으면 과녁 없음 */
  private get targetsAllowed(): boolean {
    return this.timeScale <= (this.cfg.battle.targets?.max_speed ?? Infinity) + EPS;
  }

  private startChain(b: BuildingState): void {
    if (this.targets.length > 0) this.endTargets('hangEnd');
    if (!this.targetsAllowed || (this.cfg.battle.targets?.count_max ?? 0) <= 0) return; // count_max 0 = 끔 (묶음과 같음)
    this.targetsChain = true;
    this.chainIndex = 0;
    this.chainPrev = null;
    this.pendingExtend = 0;
    this.spawnChainTarget(b);
  }

  /** 체인 과녁 1개 — 건물 그림 안 (밑면 위 0.04 ~ 0.22 · 탭 구역 위) · 앞 과녁과 min_dist 떨어짐 · 수명 = 첫 수명 − 순서 × step (실제 초) */
  private spawnChainTarget(b: BuildingState): void {
    const t = this.cfg.battle.targets!;
    const zone = (this.cfg.battle.strong_timing?.tap_max_y ?? -1) + 0.05;
    const lo = Math.max(b.y + 0.04, zone, TARGET_Y[0]);
    const hi = Math.max(lo + 0.05, Math.min(b.y + 0.22, TARGET_Y[1]));
    let pos = { x: 0.5, y: lo };
    const d = this.cfg.battle.defend;
    if (this.defendOn && d) {
      // M7-E (H-66) 받칠 곳 = 건물 밑면 바로 아래 · 개미 옆 (체인마다 좌우 번갈아 · 흔들기 = 난수 2번)
      const side = this.chainIndex % 2 === 0 ? -1 : 1;
      const jx = (this.rng.float() * 2 - 1) * d.target_jitter_ratio;
      const jy = (this.rng.float() * 2 - 1) * d.target_jitter_ratio;
      pos = {
        x: Math.min(TARGET_X[1], Math.max(TARGET_X[0], 0.5 + side * d.target_dx_ratio + jx)),
        y: Math.max(TARGET_Y[0], b.y - d.target_dy_ratio + jy), // 위는 자르지 않음 (M9 월드 좌표)
      };
    } else for (let tries = 0; tries < TARGET_TRIES; tries++) {
      const x = 0.3 + this.rng.float() * 0.4;
      const y = lo + this.rng.float() * (hi - lo);
      pos = { x, y };
      if (!this.chainPrev || this.dist(this.chainPrev.x, this.chainPrev.y, x, y) >= t.min_dist_ratio) break;
    }
    const o = { id: this.nextTargetId++, x: Math.round(pos.x * 1e4) / 1e4, y: Math.round(pos.y * 1e4) / 1e4 };
    this.chainPrev = o;
    this.targets = [o];
    this.targetBatch = 1;
    this.targetMisses = 0;
    const life = Math.max(0.15, (t.chain_life_s ?? t.life_s) - (t.chain_life_step ?? 0) * this.chainIndex);
    this.targetLifeTotal = life * this.timeScale;
    this.targetLifeLeft = this.targetLifeTotal;
    this.events.push({ type: 'targetsSpawn', targets: [{ ...o }], lifeS: life });
  }

  private tapChain(x: number, y: number): 'target' | 'miss' {
    const t = this.cfg.battle.targets!;
    const o = this.targets[0]!;
    if (Math.round(this.dist(o.x, o.y, x, y) * 1e6) / 1e6 > t.radius_ratio + EPS) {
      this.events.push({ type: 'targetMiss', missesLeft: 0 });
      this.endTargets('missLimit'); // 체인은 빗나가면 바로 끝
      return 'miss';
    }
    this.targets = [];
    this.events.push({ type: 'targetHit', id: o.id });
    const b = this.building;
    if (b && b.state === 'falling') this.targetAction(b);
    this.chainIndex += 1;
    const nextLife = Math.max(0.15, (t.chain_life_s ?? t.life_s) - (t.chain_life_step ?? 0) * this.chainIndex) * this.timeScale;
    const ext = t.chain_hold && this.chainIndex < t.count_max ? nextLife : 0;
    if (this.ant.contact) this.ant.riseTimeLeft = t.chain_hold ? Math.max(this.ant.riseTimeLeft, ext) : this.ant.riseTimeLeft + ext; // 맞히면 매달림 연장 (게임 초)
    else this.pendingExtend += ext;
    const cur = this.building;
    if (!cur || cur !== b || cur.state !== 'falling') return 'target';
    if (this.chainIndex >= t.count_max) {
      this.targetBatch = 0;
      this.events.push({ type: 'targetsEnd', reason: 'perfect' });
      this.events.push({ type: 'perfect' });
      for (let i = 0; i < t.perfect_bonus_strikes; i++) {
        const c2 = this.building;
        if (!c2 || c2 !== b || c2.state !== 'falling') break;
        this.strike(c2, 'bonus');
      }
    } else if (this.ant.phase === 'rise') this.spawnChainTarget(cur);
    return 'target';
  }

  private tapTargets(x: number, y: number): 'target' | 'miss' {
    const t = this.cfg.battle.targets!;
    if (this.targetsChain) return this.tapChain(x, y);
    let best: TargetState | null = null;
    let bestD = Infinity;
    for (const o of this.targets) {
      const d = Math.round(this.dist(o.x, o.y, x, y) * 1e6) / 1e6;
      if (d <= t.radius_ratio + EPS && (d < bestD || (d === bestD && best !== null && o.id < best.id))) {
        best = o;
        bestD = d;
      }
    }
    if (!best) {
      this.targetMisses += 1;
      const left = Math.max(0, t.miss_limit - this.targetMisses);
      this.events.push({ type: 'targetMiss', missesLeft: left });
      if (left <= 0) this.endTargets('missLimit');
      return 'miss';
    }
    const hit = best;
    this.targets = this.targets.filter((o) => o !== hit);
    this.events.push({ type: 'targetHit', id: hit.id });
    const b = this.building;
    if (b && b.state === 'falling') this.targetAction(b);
    if (this.targets.length === 0 && this.targetBatch > 0) {
      this.targetBatch = 0;
      this.events.push({ type: 'targetsEnd', reason: 'perfect' });
      this.events.push({ type: 'perfect' });
      for (let i = 0; i < t.perfect_bonus_strikes; i++) {
        const cur = this.building;
        if (!cur || cur !== b || cur.state !== 'falling') break;
        this.strike(cur, 'bonus');
      }
    }
    return 'target';
  }

  private endTargets(reason: TargetsEndReason): void {
    if (this.targets.length === 0) return;
    this.targets = [];
    this.targetBatch = 0;
    this.targetLifeLeft = 0;
    this.events.push({ type: 'targetsEnd', reason });
  }

  private resetCombo(): void {
    this.combo = 0;
    this.comboBuildingId = -1;
    this.lastStrikeTime = -Infinity;
  }


  private spawnBuilding(): void {
    const row = buildingForStage(this.cfg, this.stage.stage);
    const b: BuildingState = {
      id: this.nextBuildingId++,
      buildingId: row.building_id,
      name: row.name,
      weight: row.weight,
      debrisReward: row.debris_reward,
      isBoss: row.is_boss,
      y: this.cfg.battle.building.spawn_bottom_ratio,
      hp: row.hp,
      maxHp: row.hp,
      fallSpeed: row.fall_speed,
      state: 'falling',
      lingerTimer: 0,
      defendN: 0,
      pauseLeft: 0,
    };
    this.building = b;
    this.events.push({ type: 'spawn', buildingId: b.id, hp: b.hp });
  }

  private destroyBuilding(b: BuildingState): void {
    this.resetCombo();
    this.events.push({ type: 'destroy', buildingId: b.id, y: b.y, debrisReward: b.debrisReward });
    // M4: 잔해는 운반 예약 → carry_delay_s 뒤 deposit (H-17 질문 2 — core가 도착 시각을 정함)
    // M7-E (I-30) 운반 개미 K마리로 나눔 — floor(R ÷ K) · 나머지 = 마지막 개미 (합 = R) · 개미 i 도착 = + i × 간격
    if (b.debrisReward > 0) {
      const e = this.cfg.economy;
      const k = Math.max(1, Math.floor(e.carry_ants ?? 1));
      const each = Math.floor(b.debrisReward / k);
      for (let i = 0; i < k; i++) {
        const amount = i === k - 1 ? b.debrisReward - each * (k - 1) : each;
        this.carrying.push({ at: this.time + e.carry_delay_s + i * (e.carry_interval_s ?? 0), amount, index: i, count: k });
      }
    }
    this.building = null;
    this.ant.contact = false;
    // 파괴 후에도 남은 상승은 계속 (잔해를 뚫고 올라감) → 하강
    this.stage.destroyed += 1;
    this.totalDestroyed += 1;
    if (this.stage.destroyed >= this.stage.toClear) {
      this.clearStage();
    } else {
      this.spawnTimer = this.cfg.battle.building.spawn_delay_s;
    }
  }

  private landBuilding(b: BuildingState): void {
    this.resetCombo();
    const a = this.ant;
    const bc = this.cfg.battle;
    b.state = 'landed';
    b.y = bc.ant.height_ratio;
    b.lingerTimer = bc.building.landed_linger_s;
    const damage = Math.ceil(b.hp * bc.landing_damage_coeff);
    if (!this.cheat.infiniteHp) a.hp = Math.max(0, a.hp - damage); // M7-E 치트 체력 무한
    this.toGround();
    this.events.push({ type: 'land', buildingId: b.id, damage, antHp: a.hp });
    if (a.hp <= 0) {
      a.phase = 'down';
      a.downTimer = bc.ant.down_duration_s;
      this.events.push({ type: 'antDown', stage: this.stage.stage });
    }
  }

  private clearStage(): void {
    const s = this.stage;
    const wasChallenge = s.challenging;
    this.events.push({ type: 'stageClear', stage: s.stage, wasChallenge });
    if (wasChallenge) {
      s.challenging = false;
      this.setAutoAdvance(true); // [도전] 클리어 → 자동 진행 복귀
    }
    if (s.autoAdvance) this.startStage(s.stage + 1, 'advance');
    else this.startStage(s.stage, 'repeat'); // 자동 진행 OFF → 같은 스테이지 반복 파밍
  }

  private resolveKnockout(): void {
    const s = this.stage;
    if (s.stage <= 1) {
      // 스테이지 1 실패 → 후퇴 없이 같은 스테이지 재시작 (auto_advance 그대로)
      s.challenging = false;
      this.startStage(1, 'restart');
      return;
    }
    s.challenging = false;
    this.setAutoAdvance(false);
    this.startStage(s.stage - 1, 'retreat');
  }

  private setAutoAdvance(on: boolean): void {
    if (this.stage.autoAdvance === on) return;
    this.stage.autoAdvance = on;
    this.events.push({ type: 'autoAdvance', on });
  }

  private startStage(stage: number, reason: StageStartReason): void {
    this.resetCombo();
    const row = stageRow(this.cfg.stages, stage);
    const s = this.stage;
    s.stage = stage;
    s.destroyed = 0;
    s.toClear = row.buildings_to_clear;
    this.building = null;
    this.spawnTimer = this.cfg.battle.building.spawn_delay_s;
    const a = this.ant;
    if (this.cfg.battle.ant.refill_hp_on_stage_start || a.hp <= 0) a.hp = a.maxHp;
    if (reason === 'advance' || reason === 'repeat') {
      // 클리어 직후 이어지는 스테이지: 개미 동작은 끊지 않음
      if (a.phase === 'ground') {
        a.groundTimer = this.groundDelay;
        a.winding = false;
        a.windupLeft = 0;
      }
    } else {
      this.toGround(); // 후퇴 · 재시작 · 도전 · 처음: 개미를 지면에서 다시 시작
    }
    this.events.push({ type: 'stageStart', stage, reason });
  }

  private ignore(reason: TapIgnoredReason): false {
    this.events.push({ type: 'tapIgnored', reason });
    return false;
  }
}
