# 와르르 개미 — 개발 기준 문서 (단일 기준)

> 문서 버전: v0.29 (2026-11-12) — **M8 층 건물 + 섞어 나오기 데이터 (꺼진 채)** (I-25 · H-62): stage_pool 시트 (스테이지마다 지금 건물 · 1층) · spawn_jitter_ratio · double_pct · double_delay_s · building_art cut_roof_ratio · floor_*_file (주택 쌓기 F-09) · fx floor_break.* · 이벤트 floorBreak · 규칙 · 연출 · 완료 조건
> v0.28 (2026-11-12) — I-33 · H-78 받쳐! 과녁 확률 70 (체인도 chance_pct · 안 나온 점프 = 체인 건너뜀) · 난수 순서 한 줄
> v0.27 (2026-11-11) — H-76 "과녁은 ×1에서만" 토스트: toast.targets_x1 · fx targets_x1.toast_ms (배속이 max_speed를 넘는 순간 · 처음 켤 때)
> v0.26 (2026-11-11) — **M7-E C 켬** (H-73): 체력 30 · 강화 7종 · action defend · tap_route state · 힘 0.12 · 반동 1.5 (새 키) · 과녁 자리 dx 0.3 · 운반 6 · 0.2 · fx lift_ms · recoil_* · hint_count · art_config 받쳐! 그림 3 · 문구 2 · **받치기 반동 규칙 (I-32 — "같이 올라감" 대체)** · B · B2 다르게 한 점 · 측정 표 · M7-E A · B · B2 머지 기록
> v0.25 (2026-11-10) — M7-E 체력 + 받치기 데이터 (꺼진 채): targets.action · tap_route · battle.defend.* · economy.carry_ants · carry_interval_s · upgrades.per_level_add 칸 (강화 3행 = C) · fx defend.* · ring.plate_alpha · 문구 10 · 이벤트 defend · deposit index · count · 치트 `?cheat` · 완료 조건 (I-27 · I-28 · H-66 · H-67 · H-69 · I-30) · M7-D C 머지 기록
> v0.24 (2026-11-09) — M7-D C 켬 (H-64): targets.mode chain · chain_life 0.7 · 0 · chain_max_speed 1.0 · **targets.max_speed 1.0 (새 키 — ×1.5 이상 과녁 없음 = 링만)** · ring_s 0.6 · 문구 "완벽 점프!" · "점프!" · 완료 조건 고침 · 측정 표
> v0.23 (2026-11-09) — M7-D 터치 다듬기 데이터 (지금 그대로): targets.mode · chain_* · ring.body_px · hint_count · 문구 2 · 개미 착지 = 과녁 끝 · 계산 슬로 · 연출 · 완료 조건 (I-26 · H-61)
> v0.22 (2026-11-09) — M7 C 켬: strong_jump.mode timing · targets.count 2 · 3 · 측정 표 · M7 머지 기록
> v0.21 (2026-11-07) — M7 링 데이터 (꺼진 채): strong_timing.style ring · ring_s · perfect_s · good_s · tap_max_y · perfect_height_mult · targets.end_on_hang · lead_s · 등급 이벤트 · 링 연출 · 완료 조건 (I-24 · H-56 · 대표 결정)
> v0.20 (2026-11-07) — M7 터치 개편 데이터 (꺼진 채): strong_jump.mode · strong_timing.* · targets.* · rng_seed · fx · 문구 · 이벤트 7개 · 연출 · 완료 조건 (I-23 · H-51)
> v0.19 (2026-11-07) — M6 마무리: art_config.strip_popup_y ("+N" = 굴 입구 높이) · 금 = 건물 그림 모양으로 가림 (H-49) · M6 B · C 머지 기록
> v0.18 (2026-11-07) — M6 C 켬: art_config.env_enabled TRUE · impact_file impact.png · 로딩 시간 측정 · M6 A 머지 기록
> v0.17 (2026-11-06) — M6 건물 · 배경 아트 데이터 (꺼진 채): buildings.art_id · building_art 시트 · art_config env_* · fx_config 파괴 이펙트 · 연출 · 완료 조건 (H-42)
> v0.16 (2026-11-06) — M5-D 점프력 A안: 12%/Lv · 최대 Lv 3 · 비용 다시 맞춤 · 단일 강화 퇴보 0건 · 옛 세이브 Lv 자르기 (H-41)
> v0.15 (2026-11-06) — M5-D 균형: 강화 비용 낮춤 (도움닫기 0.5 유지 — I-21) · 측정 · 점프력 퇴보 1건 남음 (효과 안은 [계획 먼저])
> v0.14 (2026-11-06) — M5 C 도움닫기 켬: battle.jump.windup_s 0.5 · strip.ambient_carry_amount 지움 · 측정 (0 · 0.3 · 0.5) · M5 A · B 머지 기록
> v0.13 (2026-11-06) — M5 도움닫기 데이터: battle.jump.windup_s (0 = 끔) · windupStart 이벤트 · 웅크림 = 도움닫기 전체 · 완료 조건 (H-34 · I-20) · M3-E · M4 머지 기록
> v0.12 (2026-11-05) — M3-E 배속 데이터: speed.levels · speed_fx.* · motion.strike.min_wall_ms · hud.speed · 입력 · 연출 · 완료 조건 (H-28) · M3-D 머지 기록
> v0.11 (2026-11-05) — M3-D 공격 손맛 데이터: fx_config finisher.* · impact.* · hitstop.hit_ratio_max · art_config.impact_file · 연출 · 완료 조건 (H-27)
> v0.10 (2026-11-04) — M3-C 모션 데이터: fx_config motion.* · art_config 기본값 (그림 ×1.5 · 무기 ×1.3 · 머리 ×1.3 · 표정 900ms) · 연출 · 완료 조건 (H-21 · H-22)
> v0.9 (2026-11-04) — M4 강화 데이터: upgrades 시트 · economy 키 · 문구 · 이벤트 · 연출 · 완료 조건 (H-17 · I-13) · M3 B 머지 기록
> v0.8 (2026-11-04) — §3-5 아트 좌표 = art/game 납품본 측정값 · 무기 이름 = README
> v0.7 (2026-11-04) — M2 머지 커밋 기록
> v0.6 (2026-11-04) — M3 아트 데이터: art.xlsx 5시트 · 연출 목록 · 완료 조건 (H-12 계획 승인). 규격 = `docs/art.md`
> v0.5 (2026-11-04) — M2 타격감: fx_config · strike combo 인자 · 연출 목록 · 완료 조건 (H-10 계획 승인)
> v0.4 (2026-11-04) — M1 머지 커밋 기록
> v0.3 (2026-11-04) — M1 데이터 구조 · 이벤트 목록 · 연출 목록 · 완료 조건 (H-05 계획 승인)
> v0.2 (2026-11-04) — M0 머지 커밋 기록 · 기획서 회차 v0.4
> v0.1 (2026-11-04) — 뼈대 (M0 저장소 세팅). 마일스톤 요청서가 올 때마다 채운다

## 0. 개발 규칙
- `CLAUDE.md` "반드시 지킬 규칙" · "Unity 이식 원칙" 그대로
- 기획 정본 = 기획서 Artifact (지금 v0.4 — https://claude.ai/artifact/7mVinfNzvJsdpBkU972TxZ). 이 문서는 기획서를 **구현 기준**으로 옮긴 것
- v0.4 변경: §6 그림 굴 입구 = 띠 우측 끝 · [굴] 버튼으로도 개미굴 진입 · §10 DD 위치 (기획 + DD 겸하는 Claude Code 창) · §11 요청서 #1 원문

## 1. 범위
- 지금 범위: **M7 터치 개편** (I-23 · H-51 → H-56 · I-24) — 강점프 = **줄어드는 링** (기회는 가끔 · 링이 발밑 원에 겹칠 때 아래 절반 탭 · PERFECT = 초강점프 · GOOD = 강점프 · 너무 빠름 = 헛발) · **터치 과녁 = 건물 단위** (닿기 직전 등장 · 위쪽만 · 탭 = 추가 1타 · 다 맞히면 PERFECT 보너스 1타). **core 규칙 변경** (시드 난수 · `battleTap` · 배속 = core 입력 `setTimeScale` · 기회 도움닫기만 실제 시간). C부터 켬 (`strong_jump.mode` timing · 과녁 2 ~ 3 — [ART] · [FX]로 그림만 끌 수 있음 · 판정은 키로)
- M6 (끝): 건물 · 배경 아트 (`183f214`) · view만
- M4는 core 규칙이 바뀐다 (재화 · 강화 반영 전투 값). 강화 0이면 `npm run measure` = M3 표
- 범위 밖: 체력 강화 · 하드 재화 · 오프라인 보상 · 장비 수치 · 개미굴 방 기능 · 필살기 · 반격
- 끝난 것: M1 코어 루프 · M2 타격감 · M3 아트 적용 B (파츠 조립 · [ART] 패널) — §7

## 2. 폴더 구조
```
src/core/    규칙 · 판정 · 수치 (엔진 · DOM 참조 금지 — Unity 이식)
src/view/    그리기 · 연출 · UI (Phaser)
src/data/    *.json (design/tables/*.xlsx → npm run data — 직접 편집 금지)
src/tests/   Vitest
design/tables/  데이터 원본 시트 (README.md)
tools/       build_data · validate_data
scripts/     ci_smoke
art/production/ (원본) · art/game/ (게임용) — 아트가 들어올 때 만든다
```

## 3. 데이터 구조

원본 = `design/tables/*.xlsx` → `npm run data` → `src/data/*.json`. 검사 = `tools/validate_data.mjs` (PK 중복 · FK · 스테이지 연속 · 비율 합 · 범위 · 필수 문구 키).

### 3-1. `buildings.xlsx` › buildings → `buildings.json` (표)
| Column명 | 데이터 타입 | 설명 | 예시 데이터 |
|---|---|---|---|
| building_id | string (PK) | 건물 ID. 중복 불가 | `bld_hut` |
| name | string | 이름 (표시용) — **M6부터 그림 이름** (H-42 Q2 · `building_id`는 그대로 — 세이브 · FK) | 주택 |
| art_id | string? (FK → `art.xlsx` building_art) | **M6** 건물 그림 — 빈칸 = 도형. 8행 ↔ 그림 6장 = 그림 높이 순 · 7 · 8 = 사무실 · 시청 색 바꿈 (H-42 Q1) | house |
| hp | int | 건물 HP | 60 |
| fall_speed | float | 낙하 속도 (전투 구역 높이 / 초) | 0.1 |
| weight | float | 무게 — **M7-E 받치기** lift ÷ weight (I-28). 지금 모두 1.0 · 스테이지별 값 = C 측정 제안 | 1.0 |
| debris_reward | int | 파괴 시 잔해 — **M4부터 실제 재화** (H-01 #13 → I-12). 파괴 + `economy.carry_delay_s` 뒤 `deposit` | 60 |
| is_boss | bool | 보스 건물 — 지금 로직 없음 (H-01 #14) | FALSE |

### 3-2. `stages.xlsx` › stages → `stages.json` (표)
| Column명 | 데이터 타입 | 설명 | 예시 데이터 |
|---|---|---|---|
| stage | int (PK) | 스테이지 번호. 1부터 빈칸 없이 | 1 |
| building_id | string (FK → buildings.building_id) | 이 스테이지에 떨어지는 건물 | `bld_hut` |
| buildings_to_clear | int | 클리어에 필요한 파괴 수 (착지한 건물은 안 셈 — H-01 #5) | 3 |

- 마지막 행을 넘는 스테이지 = 마지막 행 반복 (`game_config` `stage.beyond_last_row` = `repeat_last`, H-01 #12)
- **M8**: 실제로 떨어지는 건물 · 층수 = 아래 `stage_pool` (`stages.building_id`는 풀에 그 스테이지 행이 없을 때만 — 검증이 막음)

### 3-2b. `stages.xlsx` › stage_pool → `stage_pool.json` (표 · **M8** — I-25 · H-62 · core가 읽음)
| Column명 | 데이터 타입 | 설명 | 예시 데이터 |
|---|---|---|---|
| stage | int (FK → stages.stage) | 스테이지 | 3 |
| building_id | string (FK → buildings.building_id) | 이 스테이지에 나올 수 있는 건물 | `bld_villa` |
| weight | int (≥ 1) | 뽑힐 비중 (스테이지 안 합으로 나눔) | 3 |
| floors_min · floors_max | int (1 ~ 6 · min ≤ max) | 층수 범위 (같으면 고정) | 2 · 3 |

- 건물이 생길 때마다 **시드 난수**: 건물 1번 (그 스테이지 행이 2개 이상일 때만) · 층수 1번 (min < max일 때만) → **고를 게 없으면 안 뽑음 = 난수 순서 그대로**
- 행 순서 = `building_id` 순 (시트 순서 · 객체 키 순서에 안 기댐) · 누적 비중 `rng.int(합)` (정수)
- 검증: FK 2개 · 비중 ≥ 1 · 층수 1 ~ 6 · min ≤ max · 스테이지마다 1행 이상 · 같은 (스테이지, 건물) 한 번
- **A = 꺼진 채**: 스테이지마다 1행 = 지금 `stages.building_id` · 비중 1 · 1층 → 지금 그대로. 값 = **C 측정** (`measure --seeds` 시드 5개 평균 — H-79)
- **층 건물 규칙 (H-62)**: 층 N개 · 층 HP = `floor(건물 HP ÷ N)` · 나머지 = 1층 (합 = 건물 HP) · 타격 = 맨 아래층부터 · 층 HP 0 = `floorBreak` (그 층만) · **넘친 데미지 = 버림** · 마지막 층 (지붕) 0 = `destroy` (지금 그대로) · 착지 데미지 = `ceil(남은 층 HP 합 × landing_damage_coeff)` · core는 밑면 y만 (판정 · 낙하 · 착지 그대로) · 잔해 = 파괴 때 한 번 (경제 그대로) · 과녁 · 링 = 건물 단위 (체인 = 지금 규칙) · N = 1이면 지금 그대로

### 3-3. `config.xlsx` › game_config → `game_config.json` (키-값)
| Column명 (key) | 데이터 타입 | 설명 | 예시 데이터 |
|---|---|---|---|
| layout.frame_width · frame_height | int | 프레임 크기 (G-03) | 720 · 1560 |
| layout.hud_ratio · battle_ratio · strip_ratio | float | HUD / 전투 / 띠+메뉴 높이 (프레임 높이 기준, 합 = 1 — 기획서 §6) | 0.06 · 0.84 · 0.1 |
| layout.strip_menu_height_ratio | float | 메뉴 버튼 높이 (띠 높이 기준) | 0.62 |
| layout.challenge_button_y_ratio | float | [도전] 버튼 위쪽 여백 (전투 구역 높이 기준) | 0.06 |
| battle.ant.max_hp | int | 개미 HP (다리 스탯 "체력" 자리) — **M7-E C 30** (I-27 · 체력 강화 +10 × 7 = 최대 100) | 30 |
| battle.ant.height_ratio | float | 개미 키 — 건물 밑면이 여기까지 내려오면 착지 | 0.07 |
| battle.ant.width_ratio | float | 개미 그림 폭 (프레임 폭 기준) | 0.16 |
| battle.ant.down_duration_s | float | 기절 시간 (전투 정지) | 1.2 |
| battle.ant.refill_hp_on_stage_start | bool | 스테이지 시작마다 HP 가득 (H-01 #6) | TRUE |
| battle.jump.height_ratio | float | 자동 점프 최고점 (다리 스탯 "점프력" 자리) | 0.42 |
| battle.jump.speed_ratio_per_s | float | 위아래 이동 속도 (다리 스탯 "점프 이동 속도" 자리) | 1.1 |
| battle.jump.ground_delay_s | float | 착지 후 다음 자동 점프까지 (도움닫기를 켜면 안 씀) | 0.25 |
| battle.jump.windup_s | float | **M5 도움닫기** — 0 = 끔 (지금처럼 ground_delay_s). 0보다 크면 자동 점프 전 대기 = 이 값 (방식 A — ground_delay_s 대신). 도움닫기 중 탭 = 바로 강점프 (skip — I-20) · 강화 대상 아님 · M5 C에서 0.5로 켬 (균형은 폰 확인 뒤 DD) | 0.5 |
| battle.strong_jump.height_mult · speed_mult · cooldown_s | float | 강점프 배율 · 속도 배율 · 쿨타임 (기획서 §9 미정 — 임시, H-01 #3) | 1.6 · 1.0 · 0 |
| battle.strong_jump.mode | enum (tap · timing) | **M7** 강점프 입력 — `tap` = 지금 (전투 구역 아무 데나 탭 · 도움닫기 중 skip — I-07 · I-20) · `timing` = 도움닫기 타이밍 (기회일 때 창 안 탭만). A · B = tap (꺼진 채) → **C = timing** | timing |
| battle.strong_jump.perfect_height_mult | float | **I-24** 링 PERFECT 초강점프 높이 배수 (GOOD = height_mult) — 전투 구역 위를 넘으면 자름. 측정: 1.6 · 1.9 · 2.2에서 60분 수입 차이 거의 없음 → 느낌용 (값어치는 나중 황금 과녁) | 1.9 |
| battle.strong_timing.chance_pct · min_gap_jumps | int | **M7** 도움닫기마다 기회 확률 (%) · 기회 사이 최소 점프 수 — 시드 난수 [가정] | 35 · 2 |
| battle.strong_timing.window_to · window_s | float | **M7** `style` circle 전용 — 맞는 창 끝 = 도움닫기 경과 비율 · 창 길이 = **실제 시간** (게임 시간 = × 배속, 창 시작은 도움닫기 시작보다 앞으로 안 감 — H-51 Q8). 창 밖 탭 = 기회 끝 (한 번만) | 0.9 · 0.15 |
| battle.strong_timing.style | enum (circle · ring) | **I-24** 타이밍 방식 — circle = 창 (M7 B) · **ring = 줄어드는 링** | ring |
| battle.strong_timing.ring_s · good_s | float | **I-24** ring: 링이 몸 원에 겹치기까지 실제 시간 · GOOD 폭 ± (실제 초). 기회 도움닫기 = `ring_s` + `good_s` **실제 시간** (배속 무시 — 기회 도움닫기만). 0.40 + 0.10 = 0.5초 = 보통 도움닫기 → ×1 자동 결과 그대로 (측정) · **H-64 C = 0.60** (계산 슬로 0.714 — 게임 결과 그대로 · 측정 GOOD 이상 σ 0.08 = 72 / 75 / 73% ×1 / ×2 / ×3) | 0.60 · 0.10 |
| (계산) 기회 슬로 | — | **H-61** 링 기회 도움닫기 동안 게임 시간 × `windup_s ÷ (ring_s + good_s)` (키 없음 — 기회 도움닫기 = 게임 시간으로 정확히 `windup_s` → 게임 결과 그대로 · 실제 시간만 늘어남). ring 0.4 = 1.0 (슬로 없음) · **0.6 = 0.714 (C)** | — |
| battle.strong_timing.perfect_s | float | **I-24** PERFECT 폭 ± (실제 초) ≤ good_s. 측정 (겹침 ± σ 0.08초): PERFECT 48 / 47 / 36% · GOOD 이상 73 / 71 / 62% (×1 / ×2 / ×3) | 0.05 |
| battle.strong_timing.tap_max_y | float | **H-54 ③** 이 높이 (전투 구역 비율) **아래 탭 = 타이밍만 · 위 = 과녁만** (엉뚱한 탭이 기회를 날리지 않게) · 과녁은 이 높이 + 0.05 위에만 (`action` strike). **M7-E `tap_route` state면 "과녁 없을 때 위쪽 탭 무시"로만** (H-69 — H-54 ③ 바뀜) | 0.5 |
| battle.targets.chance_pct · count_min · count_max | int | **M7** 매달림마다 과녁 확률 (%) · 과녁 수 (`count_max` 0 = 끔 → **C 2 · 3**). **I-33 체인도 읽음** — 닿기 직전 등장 때 난수 1번 (100이면 안 뽑음) · 안 나온 점프 = 체인 건너뜀 (받치기 체인 순서는 같은 건물 동안 그대로 · 건물이 바뀌면 1부터). **H-78 대표 70** — 측정 (`--defend --chance` · 시드 3개 평균): 100 / 70 / 50 = 자동 st 8 23.4 / 23.3 / 22.4분 · 손 st 8 6.9 / 7.4 / 7.0분 · 후퇴 0.7 / 1.0 / 1.3 · 잔해 96,260 / 103,880 / 106,850 · PERFECT 164 / 92 / 46 · 체인 셋째 53 / 53 / 51% | 70 · 2 · 3 |
| battle.targets.life_s | float | **M7** 과녁 수명 — **실제 시간** (core는 게임 시간 `life_s × 배속`으로 셈 — `setTimeScale`) | 1.2 |
| battle.targets.radius_ratio · min_dist_ratio | float | **M7** 판정 반지름 · 과녁끼리 최소 거리 ÷ 전투 구역 폭 (그림 지름 96px = 0.067 → 판정 조금 넓게) | 0.08 · 0.22 |
| battle.targets.miss_limit · perfect_bonus_strikes | int | **M7** 빈 곳 탭 이 횟수면 그 묶음 끝 (연타 · 매크로 막기) · 다 맞히면 보너스 타 (재화 아님) | 2 · 1 |
| battle.targets.end_on_hang | bool | **H-54 ①** FALSE = 건물 단위 (매달림이 끝나도 수명 동안 남음 · 끝 = 수명 · 파괴 · 착지 · 탭 = 떨어지는 건물에 1타) · TRUE = 매달림 단위 (M7 B — 매달림 약 0.2초라 사람이 못 맞힘) | FALSE |
| battle.targets.lead_s | float | **H-56 ①** 개미가 건물에 닿기 이만큼 전 (실제 초)에 등장 — 상승 중 · 정점 전에 닿을 때만 · 남은 과녁 있으면 안 나옴. 측정 (반응 모델 · 다 노림): 0.3 = 맞힘 75 / 73 / 61% (×1 / ×2 / ×3) | 0.3 |
| battle.targets.mode | enum (building · chain) | **I-26** building = 건물 단위 묶음 (M7 C) · **chain = 매달려 연타 체인** — 첫 과녁 = 닿기 `lead_s` 전 · 1개씩 · 맞히면 그 자리 1타 + 다음 과녁 (수명 = 첫 수명 − 순서 × step) · 놓침 · 빗나감 · 시간 끝 = 체인 끝 · `count_max`개 다 맞히면 PERFECT 보너스 · `count_max` 0 = 끔. A · B = building → **C = chain (H-64)** | chain |
| battle.targets.chain_life_s · chain_life_step | float | **I-26** 체인 첫 과녁 수명 · 다음마다 줄임 (실제 초 · 최소 0.15). **H-64 0.7 · 0** — 후보 중 PERFECT 묶음 가장 많음 (측정 ×1 1 / 2 / 3번째 48 / 74 / 19% · 셋째 ~ 20% = 어려움으로 받아들임) | 0.7 · 0 |
| battle.targets.chain_hold | bool | **I-26** 맞히면 다음 과녁 수명 동안 매달려 버팀 (닿기 전에 맞히면 닿을 때 붙임) | TRUE |
| battle.targets.chain_max_speed | float | **H-61** 이 배속보다 높으면 체인 대신 building 묶음 (×2 · ×3 매달림이 실제 0.1초 아래 — 측정). **H-64 1.0** (×1.5 첫 과녁 15% — 측정) | 1.0 |
| battle.targets.max_speed | float (> 0 · 비우면 제한 없음) | **H-64** 이 배속보다 높으면 **과녁 없음 = 링만** (×2 · ×3은 닿은 뒤 실제 0.3초 안에 착지 → 착지 = 끝이면 묶음 19 / 0% — 측정 · 과녁 없어도 ×3 손 수입 그대로). 1.0 = **과녁은 ×1만** · 묶음 방식은 키로 남김 | 1.0 |
| battle.targets.action | enum (strike · defend) | **M7-E (I-28 · I-32 · H-73)** 과녁 탭 = `strike` 1타 / `defend` **받치기** — 맞힘 = 그 건물 받치기 + **개미 반동** (아래 "받치기 반동") · 과녁 자리 = `battle.defend.target_*` · **체인 = 점프를 넘어서 셈** (한 점프 = 과녁 하나 · 버팀 없음) · `defend`면 `tap_route` state 필요 (검증). A · B · B2 = strike → **C = defend** | defend |
| battle.targets.tap_route | enum (zone · state) | **H-69** 탭 길 — `zone` = H-54 ③ (아래 = 링 · 위 = 과녁) / `state` = **과녁이 살아 있으면 화면 어디든 과녁** (빗나가면 체인 끝 = 연타 막음 그대로) · 없으면 링 기회. H-61 "착지 = 과녁 끝"이라 과녁과 링 기회 (땅에서 도움닫기)가 같은 시간에 없음. A · B = zone → **C = state** | state |
| battle.defend.push_power | float (> 0) | **I-28** 무게 1 · 받치는 힘 강화 0일 때 lift (전투 구역 높이 비율). **lift = push_power × 받치는 힘 % ÷ 100 ÷ weight × (1 − decay_pct ÷ 100)^n × (자동이면 auto_power_ratio)** · n = 이 건물을 이미 받친 수 · 건물 밑면 = min(`lift_max_y`, 밑면 + lift) (내려가지 않음 · **core는 바로 · 그림만 ease-out** `defend.lift_ms`). **H-73 C 0.12** — 쓸기 0.08 · 0.12 · 0.15 × 자동 비용 80 · 160 · 320 (§7 측정) · 0.15는 건물이 점프 높이 위로 떠 헛점프가 늘어 느려짐 | 0.12 |
| battle.defend.push_s | float (≥ 0) | 받친 뒤 건물 낙하 멈춤 (게임 초) | 0.15 [가정] |
| battle.defend.decay_pct · max_per_building | int | 같은 건물 다음 받치기마다 줄어듦 % (0 ~ 99) · 건물당 최대 (손 + 자동 합 — 넘으면 안 받침) | 30 · 3 [가정] |
| battle.defend.lift_max_y | float (> 0) | 건물 밑면이 이보다 높아지지 않음 — **자르는 곳은 이 키 하나** (M9 월드 좌표 때 이 키만 바꿈 — I-29 · 그래서 위 상한 검증 없음) | 0.9 [가정] |
| battle.defend.auto_power_ratio | float (0 ~ 1) | 자동 받치기 힘 = 손 × 이 값 (수동 > 자동) | 0.5 [가정] |
| battle.defend.auto_pct | int (0 ~ 100) | 강화 0일 때 자동 받치기 % — **매달림 시작마다 시드 난수 1번** (손 · 자동 공통 · 자동 % 합 = 0이면 **안 뽑음 → 난수 순서 그대로**). 0 = 끔 | 0 |
| battle.defend.target_dx_ratio · target_dy_ratio · target_jitter_ratio | float | **H-66 · H-72** 받치기 과녁 자리 (core가 정함) — x = 개미 가운데 ± dx (폭 비율 · 체인 순서마다 좌우 번갈아) · y = 건물 밑면 (등장 순간) − dy (높이 비율) · x · y ± jitter (시드 난수). **C dx 0.3** — 개미 · 링과 안 겹침 (화면 컷 · 손 모델은 자리와 상관없이 시간으로만 맞힘을 셈) | 0.3 · 0.04 · 0.04 |
| battle.defend.recoil_fall_mult | float (> 0) | **I-32 (H-73)** 반동 — 받친 뒤 개미 하강 속도 배수. 없으면 1 | 1.5 [가정 — 폰 확인] |
| (규칙) 받치기 반동 | — | **I-32 · H-73** (H-69 "개미 같이 올라감 · 매달림 연장" 대체): **손** = 매달려 있으면 바로 받치기 + 반동 (매달림 끝 · 하강 × `recoil_fall_mult` — 그 점프 타격 끝) · **닿기 전에 맞힘** = 닿는 순간 1타 친 뒤 받치기 + 반동 · **끝내 못 닿고 정점** = 그 자리에서 받침 (B) · **자동** = 난수는 매달림 시작 (순서 그대로) · 받침은 **매달림이 끝날 때** (치고 내려오며 — 손으로 받친 매달림은 자동 없음) · **체인** = 같은 건물에서 다음 점프 과녁 = n + 1 · 놓침 · 빗나감 · 건물 바뀜 = 끝 · **3 / 3 = 그 순간 마무리 1타 (`perfect_bonus_strikes`) → 받치기 + 반동** | — |
| (규칙) 개미 착지 = 과녁 끝 | — | **H-61** 묶음 · 체인 공통 — 개미가 땅에 닿으면 남은 과녁 즉시 끝 ("착지했는데 때림" 고침 · 키 아님) | — |
| battle.rng_seed | int (1 ~ 2³²−1) | **M7** core 시드 난수 (xorshift32) 시작값. 뽑는 순서 고정: 도움닫기 시작마다 1번 (기회) · 과녁 묶음마다 확률 1번 + 개수 1번 + 위치 시도 · **I-33 체인 = 닿기 직전 등장 때 확률 1번 (`chance_pct` < 100일 때만)** → 받치기 과녁 흔들기 x · y (나올 때) · **M7-E** 매달림 시작마다 자동 받치기 1번 (자동 % > 0일 때만) · **M8** 건물 생성마다 건물 1번 (풀 2행 이상일 때) · 층수 1번 (min < max일 때) · 다음 건물까지 흔들기 1번 (`spawn_jitter_ratio` > 0) · 연달아 1번 (`double_pct` > 0) — 고를 게 없으면 안 뽑음. 세이브에 난수 상태 안 넣음 [프로토만] | 20261107 |
| battle.arm_damage | int[] (4개) | 팔 1 ~ 4 슬롯 1타 데미지 (장비 회차에 표로) | 10,10,10,10 |
| battle.strike_interval_s | float | 매달려 있는 동안 팔 타격 간격 | 0.12 |
| battle.strike_interval_min_s | float | 공격속도 강화 하한 — 간격이 이보다 짧아지지 않음 (M4 · 지금 표 최대 Lv = 0.067초라 안 닿는 안전값) | 0.06 |
| battle.combo_window_s | float | 연타가 이어지는 시간 — 같은 건물에서 마지막 타격 뒤 이 안에 다음 타격 (M2 · H-10: 자동 점프 한 사이클 ≈ 1.0초) | 1.2 |
| battle.arm_order_resets_each_jump | bool | TRUE = 점프마다 팔 1부터 / FALSE = 이어서 (H-01 #2) | FALSE |
| battle.landing_damage_coeff | float | 착지 데미지 = ceil(건물 남은 HP × 계수) (I-08) | 0.5 |
| battle.building.height_ratio · width_ratio | float | 건물 크기 | 0.16 · 0.5 |
| battle.building.spawn_bottom_ratio | float | 건물이 나타나는 높이 (밑면) | 1.0 |
| battle.building.spawn_delay_s | float | 다음 건물까지 | 0.6 |
| battle.building.landed_linger_s | float | 착지한 건물이 남는 시간 (깔린 동안 탭 무시) | 0.6 |
| battle.building.spawn_jitter_ratio | float (0 ~ 0.9) | **M8 (I-25 · H-62)** 다음 건물까지 = `spawn_delay_s` × (1 ± 이 값) — 시드 난수 1번 (0이면 안 뽑음). 0 = 끔 (지금 그대로) → C 측정 | 0 |
| battle.building.double_pct · double_delay_s | int (0 ~ 100) · float | **M8** 이 확률로 다음 건물이 짧은 간격 (`double_delay_s`)으로 연달아 — 리듬 깨기 · 한 번에 한 채 그대로 · 시드 난수 1번 (0이면 안 뽑음). 0 = 끔 → C 측정 | 0 · 0.15 [가정] |
| stage.beyond_last_row | string | 표 끝 넘으면 처리 — `repeat_last`만 | repeat_last |
| input.strip_tap_slop_ratio · strip_tap_max_ms | float · int | 띠 탭 판정 (거리 · 시간) | 0.015 · 350 |
| input.strip_swipe_min_dy_ratio · strip_swipe_max_ms | float · int | 띠 아래 스와이프 판정 | 0.03 · 700 |
| input.nest_swipe_up_min_dy_ratio | float | 개미굴 위로 스와이프 → 복귀 | 0.05 |
| strip.worker_speed_ratio_per_s · worker_size_ratio · worker_gap_ratio | float | 일개미 속도 · 크기 · 간격 (연출) | 0.16 · 0.32 · 0.07 |
| strip.ambient_spawn_interval_s | float | 배경 행렬 간격 (연출). 배경 행렬은 재화 없음 · "+N" 팝업 없음 (H-17 질문 3) — 팝업 숫자 키 `ambient_carry_amount`는 M5 C에서 지움 | 1.6 |
| strip.debris_pieces · debris_pickup_s | int · float | 잔해 조각 수 · 집어가기까지 (기획서 §7 "0.3초") — **M7-E**: `economy.carry_ants` > 1이면 조각 수 = core `count` (view가 안 셈 — H-69) · 1이면 이 값 (지금 그대로) | 6 · 0.3 |
| strip.burrow_x_ratio | float | 굴 입구 위치 (띠 우측 끝 — H-01 #8) | 0.93 |
| strip.popup_rise_ratio · popup_duration_s | float | 운반 팝업 높이 · 시간 | 0.5 · 0.8 |
| economy.carry_delay_s | float | 파괴 → 재화 도착까지 (core 예약 — 평균 운반 시간: 날아감 1.0 + 집기 0.3 + 걷기 2.7초, M4 B에서 실제로 재서 맞춤) | 4.0 |
| economy.carry_ants | int (≥ 1) | **I-30** 건물 하나 잔해 R을 나르는 개미 수 K — 양 = `floor(R ÷ K)` · 나머지 = 마지막 개미 (합 = R) · **개미 한 마리 = `deposit` 한 번** (M10에서 그대로 넓힘 — I-31). **C 6** | 6 |
| economy.carry_interval_s | float (≥ 0) | **I-30** 개미 i (0 ~ K−1) 도착 = 파괴 + `carry_delay_s` + i × 이 값 (게임 초). **C 0.2** (측정: 0.1 · 0.2 · 0.4 = 8스테이지 25.8 · 25.8 · 25.9분 — 총액 · 경제 그대로) | 0.2 |
| economy.start_debris | int | 새로 시작할 때 잔해 | 0 |
| speed.levels | float[] | **M3-E** 배속 단계 — HUD 버튼을 누를 때마다 다음 (끝 → 처음). 첫 값 = 1 · 오름차순. **게임 시간만 빨라짐** (core는 dt만 받음 · 고정 스텝 그대로) · 고른 값은 브라우저 키 `crumble-ant.speed` (저장 형식 v1에 안 넣음 — H-28) | 1,1.5,2,3 |

### 3-4. `fx.xlsx` › fx_config → `fx_config.json` (키-값 · M2 타격 연출 — view만 읽음)
px = 1080폭 기준 (view가 프레임 폭에 비례해 줄임) · ms = 밀리초. 값은 기개발 제안 임시값 (폰 확인 뒤 조정 — H-10). "M1 값" = M1 view 상수를 옮긴 것 (H-10 ⑥-4)

| Column명 (key) | 데이터 타입 | 설명 | 예시 데이터 |
|---|---|---|---|
| hitstop.hit_ms · final_ms · max_ms | int | A 히트스톱 — 한 타 · 마지막 일격 · 겹칠 때 상한 | 40 · 90 · 120 |
| flash.alpha · flash.ms | float · int | B 건물 흰색 번쩍 세기 · 시간 | 0.7 · 80 |
| building_shake.px · ms | float · int | 건물 흔들림 (M1 값) | 10 · 90 |
| crack.steps | int | 금 단계 수 — HP 비율 (M1 값) | 6 |
| camera.hit_ms · hit_intensity | int · float | C 매 타격 화면 흔들림 | 60 · 0.002 |
| camera.final_ms · final_intensity | int · float | C 마지막 일격 · 파괴 흔들림 | 180 · 0.010 |
| camera.destroy_ms · destroy_intensity | int · float | C 끔일 때 파괴 흔들림 (M1 값) | 140 · 0.006 |
| combo.min_show · text_px · pop_scale · ms | int · float · float · int | D "N HIT!" — 최소 연타 · 크기 · 튕김 · 남는 시간 | 2 · 64 · 1.4 · 600 |
| damage.pop_scale · text_px · ms | float · float · int | 데미지 숫자 (M1 값) | 1.25 · 44 · 750 |
| arm.stretch | float | 팔 찌르기 늘어남 — E 끔일 때 (M1 값) | 1.35 |
| punch.stretch · fist_scale · ms | float · float · int | E 펀치 과장 늘어남 · 주먹 커짐 · 시간 (ms = M1 값) | 1.8 · 1.6 · 110 |
| hit_debris.count · speed_px · life_ms · size_px | int · float · int · float | F 타격 파편 · 먼지 | 5 · 420 · 300 · 14 |
| crumble_text.px · plate_alpha · stroke_px · ms | float · float · float · int | "와르르!" 크기 (M1) · 받침 판 · 테두리 · 시간 (M1) | 110 · 0.55 · 14 · 750 |
| sfx.volume · hit_hz · hit_ms · final_hz · final_ms · crumble_ms | float · float · int · float · int · int | G 임시 합성음 — 볼륨 · 타격음 · 마지막 일격 · 붕괴음 | 0.5 · 220 · 70 · 110 · 180 · 600 |
| sfx.combo_pitch_step · combo_pitch_max | float · int | G 연타마다 음 높이 증가 비율 · 상한 연타 | 0.04 · 8 |
| motion.blend_ms | int | **M3-C** 자세 단계가 바뀔 때 이어지는 시간 (63%에 닿는 시간) | 80 |
| motion.crouch.lead_s · body_drop · leg_fold_deg | float | 웅크림 — 자동 점프 전 지면 대기 마지막 몇 초 (core 점프 시각 그대로 — H-21 Q2) · 몸 낮춤 (개미 키) · 다리 벌림 | 0.15 · 0.06 · 30 |
| motion.launch.ms · stretch | int · float | 도약 몸 늘어남 (M1 점프 늘어남 값을 키로) | 140 · 1.12 |
| motion.rise.leg_tuck_deg · arm_gather | float | 상승 — 다리 모음 · 팔 기본 각도를 이만큼 위로 모음 (0 ~ 1) | 35 · 0.5 |
| motion.hang.leg_dangle_deg · sway_deg | float | 매달림 — 다리 늘어뜨림 · 몸 흔들림 | 10 · 3 |
| motion.fall.leg_spread_deg · arm_spread | float | 하강 — 다리 벌림 · 팔 벌림 (기본 각도 배율) | 25 · 1.2 |
| motion.land.squash · ms | float · int | 땅에 닿을 때 찌그러짐 (착지 피격 0.55보다 약하게) | 0.82 · 120 |
| motion.strike.span · pull_ratio · thrust_ratio | float | 공격 모션 길이 = **타격 간격 × span** · 당기기 · 내지르기 비율 (나머지 = 복귀, 합 ≤ 1) | 0.9 · 0.3 · 0.3 |
| motion.strike.pull_deg · weapon_spin_deg · min_pull_ms | float · float · int | 당기기 (바깥 아래로) · 내지르기 무기 회전 · 당기기가 이보다 짧으면 생략 | 20 · 25 · 16 |
| motion.strike.body_tilt_deg | float | 치는 쪽으로 몸통 반동 | 6 |
| motion.strike.art_stretch_max · art_thrust | float | **그림 모드** 팔 늘어남 상한 · 넘는 길이 중 팔 전체를 밀어내는 비율 (고무 팔 고침 — H-21 Q6) | 1.1 · 0.6 |
| motion.strong_scale | float | 강점프 모션 크기 | 1.4 |
| hitstop.hit_ratio_max | float | **M3-D** 일반 타격 히트스톱 ≤ 타격 간격 × 이 값 (공격속도가 빨라져도 리듬 유지 — H-27 Q3. 0.12초 간격 = 39.6ms · 공속 최대 0.067초 = 22ms) | 0.33 |
| finisher.every | int | **M3-D A** 4연타 마무리 — core `combo`가 이 값의 배수 (마지막 일격 제외 — 마지막 일격이 이김, H-27 Q1 · Q2) | 4 |
| finisher.hitstop_ms · camera_ms · camera_intensity | int · int · float | 마무리 히트스톱 (일반 40 · 마지막 90 사이) · 화면 흔들림 (M1 파괴 세기) | 70 · 120 · 0.006 |
| finisher.stretch_mult · star_scale | float | 마무리 팔 늘어남 · 충격 별 크기 배율 | 1.2 · 1.8 |
| finisher.chunk_count · chunk_px | int · float | 마무리 · 마지막 일격 큰 조각 (1080폭 기준) | 2 · 56 |
| finisher.sfx_hz · sfx_ms | float · int | 마무리 효과음 "쾅" (일반 220Hz · 70ms보다 낮고 길게) | 150 · 140 |
| impact.star_px · inner_ratio · points · ms | float · float · int · int | **M3-D B** 충격 별 (무기 끝 x · 건물 밑면 y — H-27 Q4) | 70 · 0.45 · 8 · 140 |
| speed_fx.light_from · hit_sfx_every | float · int | **M3-E** 배속 ≥ light_from이면 가벼운 연출 — 일반 타격 히트스톱 · 매 타격 흔들림 끔 (마무리 · 마지막 일격만, 길이 ÷ 배속) · 일반 타격음 hit_sfx_every타에 1번 (H-28 ② · 질문 2) | 2 · 3 |
| motion.strike.min_wall_ms | int | **M3-E** 공격 모션 최소 길이 (벽시계 · 60fps 2프레임) — ×3 · 공속 최대에서도 보이게 (같은 팔은 4타마다라 안 겹침) | 33 |
| final_ring.px · ms | float · int | **M6** 마지막 일격 충격파 링 (`art_config.ring_file`) — 다 퍼진 지름 (1080폭) · 시간. 별(140ms)보다 길고 "와르르!"(750ms)보다 짧게 [가정] | 520 · 280 |
| destroy_dust.count · px · spread_px · ms | int · float · float · int | **M6** 파괴 먼지 (`art_config.dust_file`) — 수 · 크기 · 퍼지는 거리 · 시간 [가정] | 3 · 240 · 160 · 500 |
| debris_img.size_mult · flip_ratio | float | **M6** 파편 그림 = 도형 조각 크기 × size_mult (그림 둘레가 투명해서) · 좌우 뒤집기 비율. 회전 · 크기 흔들림 · 움직임은 지금 도형 조각 값 그대로 (H-42 Q5 · 반복 티 줄이기) | 1.6 · 0.5 |
| target.px · timing.ring_px · perfect.text_px | float | **M7** 과녁 지름 (1080폭 — 720폭 96px) · 타이밍 원 시작 지름 · "PERFECT!" 글자 크기 [가정] | 144 · 260 · 110 |
| ring.px · ring.flash_ms | float · int | **I-24** 줄어드는 링 시작 지름 (1080폭) · 기회 순간 개미 반짝 [가정] | 340 · 200 |
| ring.body_px · ring.hint_count | float · int | **I-26** 링이 줄어들어 닿는 개미 몸 원 지름 (1080폭) · 겹침 때 "탭!"을 보여 줄 횟수 (이 브라우저 처음 N번) [가정] | 220 · 3 |
| defend.target_px · pop_scale · pop_ms · blink_ms | float · float · int · int | **M7-E (H-66)** 받치기 과녁 지름 (1080폭 — 144에서 키움 · 후보 180 · 200) · 들어올 때 튀어나옴 배율 → 1 · 시간 · 수명 마지막 깜빡 (실제 ms) | 180 · 1.4 · 120 · 200 [가정] |
| defend.hitstop_ms · shake_px · shake_ms · chain_grow | int · float · int · float | **M7-E** 받치기 탭 히트스톱 (core 시계 멈춤 — 결과 그대로) · 흔들림 · 체인 순서마다 글자 · 흔들림 + 비율 (그림만 · core 감쇠 그대로) | 30 · 6 · 120 · 0.25 [가정] |
| defend.text_px · arm_deg · pose_ms · dust_count | float · float · int · int | **M7-E** "버텨!" 크기 · 팔 위로 미는 자세 (파츠 회전 °) · 유지 · 먼지 조각 수 | 72 · 30 · 180 · 6 [가정] |
| defend.miss_drop_px · miss_ms · auto_scale | float · int · float | **M7-E** 놓침 = 건물이 툭 내려앉는 흔들림 (그림만) · 시간 · 자동 받치기 연출 배율 (글자 없음 · 먼지만) | 10 · 160 · 0.5 [가정] |
| ring.plate_alpha | float (0 ~ 1) | **M7-E (H-66 메모)** 링 뒤 진한 받침 — 밝은 하늘 위 노랑 링 대비 (L-05) | 0.45 [가정] |
| defend.lift_ms · recoil_squash · recoil_ms · hint_count | int · float · int · int | **M7-E C (I-32 · H-72)** 받친 건물이 올라가는 그림 시간 (ease-out — core는 바로) · 개미 반동 찌그러짐 세로 배율 (가로 = 2 − 값) · 돌아오는 시간 · 받쳐! 손가락 안내 + "눌러!" 횟수 (이 브라우저에서 처음 N번). 키가 없으면 바로 · 찌그러짐 없음 · 안내 없음 | 250 · 0.7 · 180 · 3 [가정] |
| targets_x1.toast_ms | int (> 0) | **H-76** "과녁은 ×1에서만" 토스트 머무는 시간 (나타남 0.12 · 사라짐 0.3초는 토스트 그대로) | 1500 |
| floor_break.drop_ms · camera_ms · camera_intensity · chunk_count | int · int · float · int | **M8 (H-62)** 층 깨짐 = 작은 와르르 — 위층이 한 칸 털썩 내려앉는 시간 (그림만) · 흔들림 시간 · 세기 (파괴보다 작게) · 조각 수 (파편 그림 재사용 · 일개미 안 주워 감) · 지붕 = 지금 파괴 연출 | 120 · 90 · 0.005 · 4 [가정] |
| impact.push_px · push_ms | float · int | 건물 **그림만** 위로 밀렸다 돌아옴 (core 건물 y 그대로 · 히트스톱 중에도 진행 — H-27 Q5). 마무리 = × star_scale | 8 · 90 |

### 3-5. `art.xlsx` → 아트 배치 (M3 — view만 읽음 · 규격과 맞추는 법 = `docs/art.md`)
pivot · socket · grip = `art/game` 납품본 측정값 · draw_h · anchor · angle = [가정] M1 도형 비율 (`docs/art.md` §6)

| 파일 · 시트 | Column명 | 데이터 타입 | 설명 | 예시 데이터 |
|---|---|---|---|---|
| art_config (키-값) | skin_id · enabled | string · bool | 지금 스킨 · 그림으로 그리기 | black · TRUE |
| | draw_scale · draw_scale_max · weapon_scale · weapon_scale_max | float | 그림 배율 · [ART] 슬라이더 상한 (판정 크기는 그대로 — H-12 Q1). 기본값 = 대표 폰 확인 (H-22) | 1.5 · 2.5 · 1.3 · 2.0 |
| | head_scale | float | 머리만 따로 배율 (목 기준) — 표정 가독성 (H-22). 390pt 폰에서 머리 높이 45 → 58pt | 1.3 |
| | impact_file? | string (빈칸 = 도형 별) | **M3-D** 충격 별 그림 (`art/game/` 안 파일 이름 — `env/impact.png`) — **M6 C부터 impact.png** | impact.png |
| | defend_target_file? · defend_ring_file? · defend_hit_file? | string (빈칸 = 도형) | **M7-E (H-72 · 아트 #96)** 받쳐! 과녁 버튼 · 남은 시간 링 (1 → 0.8로 줄어듦) · 맞힘 번쩍 — `art/game/ui/` 게임용 사본은 **아트 PR로 따로** · 파일이 없으면 노랑 도형 (검증 = 경고만) | target_defend.png · target_defend_ring.png · target_defend_hit.png |
| | env_enabled | bool | **M6** 건물 · 하늘 · 띠 · 파괴 이펙트를 그림으로 (A · B = FALSE 꺼진 채 → **C = TRUE**). [ART]에서 끄거나 파일 없음 = 도형. 켬이면 그림 약 6.9MB를 시작할 때 읽음 [프로토만] — 첫 화면 0.9 → 3.5초 (20Mbps · 60ms 측정) | TRUE |
| | sky_file? · strip_file? | string | 하늘 (전체 화면 9:19.5) · 지면/굴 띠 (1440×312) — `art/game/env/` · 빈칸 = 도형 | sky.png · ground_strip.png |
| | strip_ground_ratio | float | 띠 그림 풀 윗선 높이 ÷ 그림 높이 — 이 선 = 지면(groundY). 위 = 덤불 (건물 · 개미 뒤) · 아래 = 땅 (일개미 층) | 0.24 |
| | strip_popup_y? | float | **H-49** 그림 켬일 때 굴 입구 "+N" 높이 = 굴 입구 가운데 ÷ 띠 그림 높이 (잼 71 ~ 123px / 312) — 일개미 줄은 그대로 · 비우거나 그림 끔 = 일개미 줄 위 | 0.31 |
| | strip_burrow_x | float | 띠 그림 굴 입구 가운데 — **그림 켬일 때만** 일개미 도착점 · "+N" 자리 (끄면 `strip.burrow_x_ratio` 0.93) | 0.887 |
| | ring_file? · dust_file? · debris_file? | string | 마지막 일격 링 · 파괴 먼지 · 공용 파편 (`art/game/fx/`) — 빈칸 = 그 연출 없음 / 도형 조각 | shock_ring.png · dust.png · debris.png |
| | hit_face_ms | int | 착지 피격 표정 시간 — 짓눌림 0.26초 + 건물이 깔고 남는 0.6초 동안 보이게 | 900 |
| ant_parts (표) | skin_id · part_id | string (PK 둘) | 스킨 + 파츠 (body · head_normal · head_hit · head_down · arm · leg) | black · arm |
| | file | string | `ant_<skin>_<part>.png` (art/game/ant/) | ant_black_arm.png |
| | pivot_x · pivot_y · socket_x? · socket_y? · draw_h | float | 그림 안 점 (0 ~ 1) · 팔만 손 · 그림 높이 (개미 키 기준) | 0.479 · 0.938 · 0.51 · 0.073 · 0.36 |
| ant_mounts (표) | mount_id | string (PK) | leg_l · leg_r · arm_1 ~ arm_4 · body · head | arm_1 |
| | part_id | string (FK → ant_parts) | 붙일 파츠 (머리 = head_normal, 표정은 head_ 이름으로 바꿈) | arm |
| | anchor_x · anchor_y · angle_deg · layer · mirror | float · float · float · int · bool | 개미 기준 자리 · 기본 각도 · 그리는 순서 · 좌우 반전 | -0.181 · 0.475 · -35 · 30 · TRUE |
| weapons (표) | weapon_id | string (PK) | club · drill · flail · hammer · mace · mallet · pickaxe · wrench | hammer |
| | name · file | string | 한글 이름 (`art/game/weapons/README.md`) · `weapon_<id>.png` | 망치 · weapon_hammer.png |
| | grip_x · grip_y · scale · angle_deg | float | 손잡이 점 · 그림 높이 (개미 키 기준) · 손에서의 각도 | 0.496 · 0.887 · 0.5 · 0 |
| ant_loadout (표) | slot · weapon_id? | int (PK) · string (FK → weapons, 빈칸 = 맨주먹) | 팔 슬롯 1 ~ 4 장착 (외형만) | 1 · hammer |
| building_art (표 · M6) | art_id | string (PK) | 건물 그림 + 색 조합 — `buildings.art_id`가 가리킴 | townhall_b |
| | file | string | `building_<이름>.png` (`art/game/buildings/`) | building_townhall.png |
| | pivot_y | float | 밑면 y (0 ~ 1 · 기준점 x = 가운데). **그림 밑면 = core 건물 밑면** (치는 곳 · 깔리는 곳) — `npm run art:pivots` | 0.996 |
| | draw_w | float | 그림 폭 ÷ 건물 폭 (`width_ratio`) · 세로는 비율대로 (위로 341 ~ 387px — 판정은 밑면만이라 결과 그대로, H-42 Q3) | 1.0 |
| | tint? · debris_file? | string | 곱하기 색 `#rrggbb` (같은 그림 다시 쓸 때) · 건물별 파편 `debris_<이름>.png` (`art/game/fx/building_debris/` — 빈칸 = 공용 debris_file) | #b8c4ff · debris_office.png |
| | cut_roof_ratio | float (0 ~ 0.9] | **M8 자르기** — 층 조각 파일이 없을 때 그림 1장을 층수만큼 가로로 나눔 · 지붕 칸 = 그림 높이 × 이 값 · 나머지를 아래층들이 같게 (그림 1장 높이 고정) | 0.35 [가정] |
| | floor_base_file? · floor_mid_file? · floor_roof_file? | string (3칸 다 / 다 빈칸) | **M8 쌓기 (F-09)** — `art/game/buildings/floors/` 조각 · 1층 + 중간 × (N − 2) + 지붕 → **층수만큼 키가 커짐** (720폭 그림 기준 1층 230 · 중간 230 · 지붕 362px — 3층 = 822 · 6층 = 1,512) · 다 비우면 자르기 · 키 큰 건물 HUD 가림 [프로토만] | house: `house_floor_base.png` · `house_floor_mid.png` · `house_floor_roof.png` |

### 3-6. `upgrades.xlsx` › upgrades → `upgrades.json` (표 · M4 — core가 읽음)
| Column명 | 데이터 타입 | 설명 | 예시 데이터 |
|---|---|---|---|
| upgrade_id | string (PK) | 강화 ID | attack_power |
| name | string | 카드 이름 | 공격력 |
| stat | enum (attack_power · attack_speed · jump_power · move_speed · **max_hp · push_power · auto_defend**) | 바꾸는 값 — 코드가 아는 것만 · 앞 4종 = 각 1행 필수 (H-17 질문 5) · **M7-E 3종 = 있으면 1행** (H-67 · I-28) | attack_power |
| per_level_pct | int (> 0 · 고정값 stat은 0) | Lv당 +% (합산) | 10 |
| per_level_add | int (≥ 0) | **M7-E (H-67)** Lv당 +고정값 (합산) — `max_hp` (HP) · `auto_defend` (%p)만 > 0 · 이 둘은 `per_level_pct` 0 · 나머지 stat = 0 (검증) | 0 |
| max_level | int (≥ 1) | 최대 Lv | 20 |
| cost_base | int (≥ 1) | Lv 0 → 1 비용 (잔해) | 60 |
| cost_growth_pct | int (≥ 100) | 다음 Lv 비용 배율 % | 130 |
| sort | int | 카드 순서 (중복 불가) | 1 |

- 효과 % = `100 + per_level_pct × Lv` (정수). 비용 = 정수 반복: Lv 0 → 1 = `cost_base`, 다음 = `floor(이전 × cost_growth_pct / 100)` (H-17 질문 4 — `pow` 실수 계산은 JS · C# 경계값이 다를 수 있음)

| stat | 바뀌는 값 | 계산 (정수화) | 한계 (검증) |
|---|---|---|---|
| attack_power | `battle.arm_damage` (4슬롯 공통) | `floor(기본 × % / 100)` | — |
| attack_speed | `battle.strike_interval_s` | `기본 × 100 / %` | 최대 Lv 간격 ≥ `battle.strike_interval_min_s` |
| jump_power | `battle.jump.height_ratio` | `기본 × % / 100` | 최대 Lv에서 강점프 최고점 + 개미 키 ≤ 1.0 (전투 구역 맨 위) |
| move_speed | **하강 속도만** (`jump.speed_ratio_per_s` — 상승 · 매달려 치는 시간은 그대로, I-13) | `기본 × % / 100` | — |
| **max_hp** (M7-E) | `battle.ant.max_hp` | 기본 + `per_level_add` × Lv (정수) | 구매 = 늘어난 만큼 HP 채움 · 기절 중 = 최대만 (H-67) |
| **push_power** (M7-E) | 받치는 힘 (`battle.defend.push_power`) | `push_power × % / 100` (lift 식 — §3-3) | — |
| **auto_defend** (M7-E) | 자동 받치기 % (`battle.defend.auto_pct`) | 기본 + `per_level_add` × Lv (정수 %) | 최대 Lv ≤ 100% (검증) |

- **M7-E 3종 행 = C에서 넣음** (A에 넣으면 B 코드 전에 세이브 · 강화 패널이 바뀜 — H-70): 체력 +10 × 7 (60 · 135% — H-67) · 받치는 힘 +8% × 10 (70 · 135%) · 자동 받치기 +3%p × 10 (80 · 140% — 쓸기: 160 · 320이면 자동 stage 8 24.6 ~ 38.2분으로 느려짐) · 패널 = 7줄 한 목록 · 5줄 넘으면 스크롤. 세이브에 없는 키 = Lv 0 → 형식 v1 그대로 · **단일 강화 퇴보 0건** (`--upgrades`)

| upgrade_id | per_level_pct · max_level | cost_base · cost_growth_pct (M5-D — 괄호 = M4) | 근거 (지시함 #3 M4 계획 ⑤ 측정) |
|---|---|---|---|
| attack_power 공격력 | 10 · 20 (×3.0) | 60 · **126** (M4 60 · 130) | 데미지 10 → 30 (Lv당 +1). 첫 건물 보상 60 = 첫 강화 바로 |
| attack_speed 공격속도 | 8 · 10 (×1.8) | **70 · 135** (M4 90 · 135) | 간격 0.120 → 0.067초 · 히트스톱 벽시계 지연 최대 +10.6% |
| jump_power 점프력 | **12 · 3 (×1.36)** (M4 5 · 7) | **65 · 138** (M4 80 · 145) | 천장 ×1.384 바로 아래 · **H-41**: 5%/Lv는 Lv3 (+15%)이 "매달림 타수가 한 계단 내려가는 구간" (+14 ~ 20%)에 걸려 퇴보 → +12 · 24 · 36%로 그 구간을 건너뜀 |
| move_speed 이동속도 | 5 · 6 (×1.3) | **65 · 138** (80 · 145) | 효과가 약해서 Lv 짧게 |
- 측정 (자동만 · 가장 싼 것부터 · 이동속도 하강만): 스테이지 3 = 1.4분 · 5 = 7.9분 · 8 = 22.4분 (구매 순서에 따라 8스테이지 약 20 ~ 35분) · 강점프 연타 = 8스테이지 3.5분 — 값은 임시, 폰 확인 뒤 조정
- **M5 C 도움닫기 0.5 켠 뒤** (`npm run measure -- --upgrades`): 자동만 스테이지 3 / 5 / 8 = 1.5 / **11.5** / **34.7분** (끔 1.4 / 7.9 / 23.1 · 0.3이면 1.5 / 2.7 / 29.2) · 강점프 연타 3.4분 그대로 (탭 = skip) · 60분 번 잔해 99,520 → 67,870 · 단일 강화 퇴보 1건 (jump_power Lv3 · 스테이지 3 자동 100% → 0%)
- **M5-D 비용 낮춘 뒤 (H-40 — 점프력 5%/Lv 때)** (I-21 · 도움닫기 0.5 그대로): 자동만 스테이지 3 / 5 / 8 = 1.5 / 8.7 / **21.9분** (목표 M4 23.1분 ± 15%) · 강점프 연타 3.3분 · 첫 강화 13초 (60) · 60분 번 잔해 92,350 · 비용 ±2%p를 바꿔도 8스테이지 21.3 ~ 25.2분 (구매 순서에 민감해서 가운데 값으로 고름) · **점프력 Lv3 퇴보 1건은 비용과 무관** (점프 높이 +14 ~ +20%에서 스테이지 3 자동 타수가 10 → 9) — 점프력 효과 안은 지시함 #3 `[계획 먼저]`
- **M5-D 점프력 A안 뒤 (H-41 — 지금 값)**: 자동만 스테이지 3 / 5 / 6 / 8 = 1.4 / **2.7** / 8.6 / **22.7분** · 강점프 연타 3.1분 · 60분 번 잔해 93,340 · **단일 강화 퇴보 0건**. 스테이지 5가 M4 (7.9분)보다 빨라짐 — 점프력 Lv1 한 번에 +12%라 (기록만). 옛 세이브 점프력 Lv 4 ~ 7 = 읽을 때 3 (재화는 돌려주지 않음 [프로토만])

### 3-7. `ui_strings.xlsx` › ui_strings → `ui_strings.json` (키-값, 전부 string)
| Column명 (key) | 데이터 타입 | 설명 | 예시 데이터 |
|---|---|---|---|
| hud.stage · hud.hp · hud.auto_on · hud.auto_off | string | HUD | `STAGE {n}` · `HP` · `자동 진행 ON ▶` · `자동 진행 OFF ■` |
| challenge.title · challenge.sub | string | [도전] 버튼 | `도전!` · `스테이지 {n}` |
| toast.advance · retreat · restart · challenge · breakthrough · menu_wip | string | 토스트 | `후퇴… 스테이지 {n} 반복 · 자동 진행 OFF` |
| menu.upgrade · equip · nest · shop | string | 하단 메뉴 | 강화 · 장비 · 굴 · 상점 |
| fx.crumble · fx.combo · ant.down | string | 파괴 · 연타 카운트 (M2 D) · 기절 글자 | `와르르!` · `{n} HIT!` · `@ @ 기절!` |
| nest.title · nest.sub · nest.back | string | 개미굴 화면 | 개미굴 · … · `▲ 전투로` |
| hud.debris | string | HUD 보유 잔해 (M4) | `잔해 {n}` |
| hud.speed | string | **M3-E** 배속 버튼 | `×{n}` |
| fx.perfect · fx.timing_ok | string | **M7** 과녁 묶음 다 맞힘 · 타이밍 강점프 성공 | `PERFECT!` · `타이밍!` |
| fx.timing_perfect · timing_good · timing_early | string | **I-24** 링 등급 — **H-64 C "완벽 점프!" · "점프!"** (H-61 · 과녁 묶음 "PERFECT!"와 안 겹치게) | `완벽 점프!` · `점프!` · `헛발!` |
| fx.timing_hint · timing_alert | string | **I-26** 겹침 안내 · 기회 예고 (개미 머리 위) | `탭!` · `!` |
| fx.defend_target · defend_hold · defend_miss · chain_count | string | **M7-E (H-66)** 받치기 과녁 글자 (↑ 화살표 + 손바닥은 도형) · 맞힘 · 놓침 · 체인 칸 (`{n}` 순서 · `{m}` 최대) | `받쳐!` · `버텨!` · `놓침` · `{n} / {m}` |
| fx.defend_tap · hud.targets_x1 | string | **M7-E C (H-72)** 받쳐! 손가락 안내 · 배속 > `targets.max_speed`일 때 배속 버튼 아래 안내 (H-64 "안내 안 만듦" 바뀜 — 대표 폰: 저장된 배속 때문에 과녁을 못 봄) | `눌러!` · `과녁 ×1` |
| toast.targets_x1 | string | **H-76** 배속이 `targets.max_speed`를 넘는 순간 · 처음 켤 때 (저장된 배속) 전투 구역 위쪽 토스트 (작은 "과녁 ×1"은 그대로) | `과녁은 ×1에서만` |
| upgrade.title · level · max · short · close | string | 강화 패널 | 강화 · `Lv {n} / {max}` · MAX · 잔해가 부족해요 · ✕ |
| upgrade.reset · reset_confirm | string | 테스트 빌드 기록 지우기 (두 번 눌러 확정 — H-17 질문 7) | 기록 지우기 · 한 번 더 누르면 지워져요 |
| upgrade.fx.{stat} (4) | string | 지금 → 다음 효과 | `데미지 {a} → {b}` · `초당 {a} → {b}회` · `점프 +{a}% → +{b}%` · `하강 +{a}% → +{b}%` |
| upgrade.now.{stat} (4) | string | MAX일 때 지금 효과만 | `데미지 {a}` … |
| upgrade.fx · upgrade.now .{max_hp · push_power · auto_defend} | string | **M7-E** 강화 3종 효과 (행은 C) | `체력 {a} → {b}` · `받치는 힘 +{a}% → +{b}%` · `자동 받치기 {a}% → {b}%` · `체력 {a}` … |

- `{n}` = 숫자 자리 · `{label}` = 메뉴 이름 자리 (`toast.menu_wip`) · `{a}` · `{b}` · `{max}` = 강화 효과 · 최대 Lv — **view가 core 값으로 채움** (H-05 ⑤-4)

## 4. core → view 이벤트 목록 (이식 계약 — 새 이벤트는 여기 한 줄)
| 이벤트 | 인자 | 언제 |
|---|---|---|
| stageStart | stage · reason (init / advance / repeat / retreat / restart / challenge) | 스테이지 시작 |
| stageClear | stage · wasChallenge | 파괴 수가 buildings_to_clear에 닿았을 때 |
| autoAdvance | on | auto_advance가 바뀔 때 |
| spawn | seq · building_id · hp · **floors · floorHp** (M8) | 건물 생성 (seq = 화면에 나온 순번) · M8: 층수 · 층마다 HP (아래층부터 · 합 = hp) |
| jump | kind (auto / strong / **perfect** — I-24 링 PERFECT) · apex | 점프 시작 |
| strike | arm (1 ~ 4) · damage · hpLeft · **combo** · **source** (M7: auto · target · bonus) · **floorHpLeft** (M8 — 맨 아래층 남은 HP) | 팔 1타. combo = 같은 건물에서 이어진 연타 수 (1부터). 마지막 타격 뒤 `battle.combo_window_s` 안에 다음 타격이면 +1, 아니면 1. 건물 파괴 · 착지 · 스테이지 시작 때 0 (M2 · H-10) |
| destroy | seq · y · debrisReward | 건물 HP 0 (M8: 지붕 층 HP 0) |
| **floorBreak** (M8) | seq · floor (1부터 · 아래층부터) · floorsLeft · hpLeft | 맨 아래층 HP 0 → 그 층만 와르르 (지붕 아님) · 넘친 데미지 버림 · 뒤이어 위층 내려앉음 (그림만) |
| land | seq · damage · antHp | 건물 착지 — damage = ceil(남은 HP × 계수) (정수화 시점 · M8: 남은 층 HP 합) |
| antDown | stage | 개미 HP 0 |
| tapIgnored | reason (airborne / cooldown / down / pinned / **noChance** / **noBuilding** — M7) | 탭을 무시할 때 (M7: 기회 없음 · 건물 없음 · 위쪽 빈 곳) |
| **windupStart** (M5) | — | 도움닫기 시작 (지면 · 건물이 떨어지는 중 · `windup_s` > 0). 남은 시간 = `ant.windupLeft`. 깔리면 (land) 취소 · 다음 건물이 떨어지면 처음부터. 스테이지 시작 · 후퇴 · 재시작 · [도전] · 기절 회복 뒤 첫 점프에도 (H-34) |
| **timingChance** (M7) | fromS · toS (circle = 창의 남은 도움닫기 시간 · ring = GOOD 시작까지 남은 시간 · 0) | 이번 도움닫기에 강점프 기회 (`mode` timing · 확률 · 최소 간격). windupStart 바로 뒤 · ring이면 이 도움닫기는 실제 시간 (`ring_s` + `good_s`) |
| **timingResult** (M7) | ok · **grade** (perfect · good · early — I-24) | 기회 중 첫 탭 — ring: 겹침 ± perfect_s = perfect (jump perfect) · ± good_s = good (jump strong) · 더 빠름 = early (헛발 · 기회 끝 · 끝에 보통 점프). circle: 창 안 = good · 밖 = early |
| **targetsSpawn** (M7) | targets [{id, x, y}] (전투 구역 비율 좌표) · lifeS (실제 시간) | 매달림 시작 (contact) · 확률 · 개수 = 시드 난수 |
| **targetHit** (M7) | id | 과녁 탭 → 뒤이어 strike (source target · nextArm · combo · 마무리 · 마지막 일격 규칙 그대로). **M7-E `action` defend면 strike 대신 defend + 반동** (닿기 전이면 닿는 순간 1타 뒤 · 3 / 3이면 `targetsEnd perfect` · `perfect` · strike bonus 뒤 defend) |
| **defend** (M7-E) | seq · lift · auto · n | 받치기 — 건물 밑면 += lift (≤ `lift_max_y` · core는 바로) · 낙하 멈춤 `push_s` · n = 이 건물 받친 순번 (1부터 · ≤ `max_per_building`). **손 = 과녁 맞힘 → 개미 반동 (매달림 끝)** · 자동 (auto true) = 매달림 시작에 뽑고 **매달림이 끝날 때** (I-28 · I-32 · H-73) |
| **targetMiss** (M7) | missesLeft | 과녁이 있는 동안 빈 곳 탭 |
| **targetsEnd** (M7) | reason (expire · missLimit · hangEnd · perfect) | 남은 과녁 사라짐 (벌칙 없음) — expire = 수명 · missLimit = 위쪽 빈 곳 탭 miss_limit번 · hangEnd = 매달림 끝 (`end_on_hang` TRUE · 체인) / 건물 파괴 · 착지 (FALSE = 건물 단위) / **개미 착지 (공통 — H-61)** · perfect = 다 맞힘 |
| **perfect** (M7) | — | 묶음을 다 맞힘 → 뒤이어 strike (source bonus) × `perfect_bonus_strikes` |
| **deposit** (M4) | amount · wallet · **index · count** (M7-E) | 파괴 뒤 `economy.carry_delay_s` (+ index × `carry_interval_s`)가 지나 잔해가 굴에 도착 — wallet += amount. 후퇴 · 재시작 · 도전이 있어도 예약은 그대로. **M7-E: 운반 개미 한 마리 = 한 번** (index 0 ~ count−1 · 합 = debris_reward — I-30) |
| **upgrade** (M4) | id · level · cost · wallet | 강화 구매 성공. 데미지 · 타격 간격 = 다음 타격부터, 점프력 · 이동속도 = 다음 점프부터 · **M7-E 체력 = 바로 (HP + 늘어난 만큼 · 기절 중 = 최대만) · 받치는 힘 · 자동 받치기 = 다음 받치기 · 다음 매달림부터** |

**view → core 입력 계약 (InputRouter action)**: strongJump · challenge · menu{id} · openNest{via: tap / swipe_down / button} · closeNest{via: button / swipe_up}
- M3-E: `cycleSpeed` — HUD [×1] 버튼 (InputRouter 버튼 · 강점프와 안 겹침). 배속 값은 view가 들고 `sim.update(dt × 배속)` · 히트스톱 · 트윈 · 모션 · 잔해 · 일개미도 같은 배속 · 효과음 높이는 그대로 · core가 한 번에 받는 시간 상한 0.25초 그대로 (×3이면 12fps 이하부터 게임 시간이 늦어짐 — `?debug`에 실제 배속)
- M4: `buyUpgrade{id}` · `closeUpgrade{via: button / outside}` · `resetSave` (두 번째 누름). InputRouter `upgrade` 모드 = 패널 버튼만 받고 바깥 탭은 닫기 (강점프 안 됨, H-17 질문 6). 구매 결과 = core `buyUpgrade(id)` → ok / short (부족) / max
- **M7-E 치트 (`?cheat` · [프로토만])**: core 입력 `setCheat({ autoDefendPct, pushMult, weightMult, infiniteHp })` · `addDebrisCheat(n)` — `setTimeScale`처럼 시트 값을 덮기만 (끄면 시트 값) · 세이브 안 함 · 목록 = §6
- **M7-E 탭 길 (`tap_route` state)**: `tapBattle` = 과녁 살아 있음 → 과녁 (화면 어디든) · 없음 → 링 기회 · 없음 + `tap_max_y` 위 → 무시

**저장 (M4 — 형식 v1, H-17 ③)**: 키 `crumble-ant.save` · `{ v: 1, debris, upgrades: {upgrade_id: Lv}, stage, auto_advance }`. 만들기 · 검증 · 버전 변환 = `src/core/save.ts` (읽고 쓰기는 view). 저장 시점 = deposit · upgrade · stageStart · 화면을 떠날 때 (1초에 한 번 이하). 도전 중 = 도전 전 스테이지 · auto_advance OFF로. 운반 중 잔해는 저장 안 함 [프로토만] · **M7-E: 운반 개미가 여럿이면 deposit 저장 = 마지막 개미 (index = count − 1)일 때만** (I-30). 못 읽으면 새로 시작 + 원본을 `crumble-ant.save.bad`로. 시간 기록 없음

**히트스톱 (M2 A)**: view가 그 시간 동안 `sim.update`를 부르지 않는다 (core 시계를 통째로 멈춤 — H-10 ⑥-1). 결과는 게임 시간 기준이라 그대로, 벽시계로만 늦어짐. 방치 · 오프라인 보상이 생기면 게임 시간 기준으로 계산

**결정성**: 고정 스텝 1/120초 (프레임레이트와 무관) · core에 난수 없음 (잔해 흩어짐은 view 연출) · 잔해 팝업 숫자 = floor(debris_reward ÷ 조각 수), 나머지는 첫 조각 (`carry_ants` 1일 때) · **M7-E `carry_ants` > 1이면 팝업 = deposit amount 그대로 (core가 나눔)**

## 5. 연출 목록 (새 연출은 여기 한 줄)
| 이름 | 트리거 이벤트 | 시간 | 느낌 | 데이터 키 |
|---|---|---|---|---|
| 점프 늘어남 | jump | 0.14초 | 몸이 위로 늘었다가 돌아옴 (강점프는 더 크게) — **M3-C 모션 켬이면 "도약"으로 바뀜** | — (모션 끔) · `motion.launch.*` (켬) |
| 강점프 먼지 고리 | jump (strong) | 0.32초 | 발밑 흰 고리가 퍼짐 | — |
| 팔 찌르기 | strike | 0.11초 | 그 슬롯 팔이 위로 찌름 (슬롯별 색) | `fx_config` arm.stretch · punch.ms |
| 건물 흔들림 · 금 | strike | 0.09초 | 좌우로 흔들림 · HP가 줄수록 금이 늘어남 (6단계) | `fx_config` building_shake.* · crack.steps |
| 데미지 숫자 | strike | 0.75초 | 흰 숫자가 떠오르며 사라짐 | `fx_config` damage.* |
| 와르르! 글자 | destroy | 0.75초 | 큰 노란 글자 | `fx.crumble` (문구) · `fx_config` crumble_text.px · ms |
| 잔해 버스트 · 화면 흔들림 | destroy | 조각이 지면에 닿을 때까지 · 0.14초 | 조각이 튀었다 떨어짐 · 약한 흔들림 | `strip.debris_pieces` · `fx_config` camera.destroy_* |
| **M2 A** 히트스톱 | strike (hpLeft 0 = 마지막 일격) | 0.04초 · 0.09초 | 맞는 순간 전체가 멈칫 (core 시계 정지) | `fx_config` hitstop.* |
| **M2 B** 건물 번쩍 | strike | 0.08초 | 건물이 흰색으로 번쩍 | `fx_config` flash.* |
| **M2 C** 타격 흔들림 | strike · destroy | 0.06초 · 0.18초 | 매 타격 약하게 · 마지막 일격 · 파괴는 크게 (M1 파괴 흔들림 대체) | `fx_config` camera.hit_* · final_* |
| **M2 D** 연타 카운트 | strike (combo) | 0.6초 | 데미지 숫자 팝 + 2타부터 건물 옆 "N HIT!"이 칠 때마다 튕김 | `fx_config` combo.* · `fx.combo` (문구) |
| **M2 E** 펀치 과장 | strike | 0.11초 | 팔이 1.8배 늘고 팔 끝 주먹이 커졌다 돌아옴 (코믹 과장) | `fx_config` punch.* |
| **M2 F** 타격 파편 · 먼지 | strike | 0.3초 | 타격점(건물 밑면)에서 작은 조각 · 먼지가 튐 | `fx_config` hit_debris.* |
| **M2 G** 임시 합성음 | strike · strike(마지막) · destroy | 0.07초 · 0.18초 · 0.6초 | "퍽"(연타마다 조금씩 높게) · "쾅" · 내려가는 "와르르" — WebAudio 생성, 첫 탭 뒤 | `fx_config` sfx.* |
| **M2** "와르르!" 대비 | destroy | 0.75초 | 어두운 받침 판 + 굵은 테두리 (잼병 L-05) | `fx_config` crumble_text.plate_alpha · stroke_px |
| **M2** [FX] 패널 | (HUD 가운데 [FX] 버튼) | — | A ~ G · 대비를 하나씩 켜고 끔 (기본 전부 켬). 끄면 그 연출은 M1 모습 그대로 | — (테스트 빌드 확인용) |
| **M3-C** 점프 모션 | ground (지면 대기) · jump · rise · contact · fall · phase fall → ground | 대기 0.15초 · 0.14초 · 단계 동안 · 0.12초 | 웅크림 (다리 접힘 · 몸 낮춤) → 도약 (몸 늘어남) → 상승 (다리 모음 · 팔 위로) → 매달림 (다리 늘어뜨림 · 흔들림) → 하강 (다리 · 팔 벌림) → 땅에 닿음 (찌그러짐 + 먼지 고리). 강점프 = × strong_scale. 도형 · 그림 같음 | `fx_config` motion.crouch · launch · rise · hang · fall · land · strong_scale · blend_ms |
| **M5** 도움닫기 웅크림 | windupStart → 점프 | windup_s (0.5초 · ×3에서 벽시계 약 0.17초) | 도움닫기가 켜지면 M3-C 웅크림이 도움닫기 전체에 걸침 (`crouch.lead_s` 대신 `windup_s`) · 탭하면 바로 강점프 | `battle.jump.windup_s` · `fx_config` motion.crouch.* |
| **M3-C** 공격 모션 | strike | 타격 간격 × 0.9 (0.12초 → 108ms · 0.067초 → 60ms) | 당기기 (바깥 아래로) → 내지르기 (위로 곧게 · 무기 회전 · E 켬이면 늘어남 · 무기 커짐) → 복귀 + 치는 쪽으로 몸통 반동. 히트스톱 중엔 같이 멈춤 (H-21 Q3). 그림 모드는 팔이 늘어나지 않고 팔 전체가 튀어나감 | `fx_config` motion.strike.* |
| **M3-D A** 4연타 마무리 | strike (combo % finisher.every == 0 · 마지막 일격 아님) | 0.07초 멈춤 · 0.12초 흔들림 | "다다다 쾅!" — 긴 히트스톱 · 큰 흔들림 · 큰 별 · 큰 조각 · 낮은 "쾅" · 팔 늘어남 ×1.2 | `fx_config` finisher.* |
| **M3-D B** 충격 별 · 건물 밀림 | strike | 0.14초 · 0.09초 | 무기 끝에 노란 별 (어두운 테두리 — L-05) · 건물 그림이 위로 살짝 튕김. 그림 파일이 있으면 별 대신 그림 | `fx_config` impact.* · `art_config.impact_file` |
| **M3-D** [FX] 토글 2개 | ([FX] 패널) | — | "4연타 마무리" · "충격 · 밀림" — 끄면 M3 모습 | — (테스트 빌드 확인용) |
| **M6** 건물 · 배경 그림 | (늘 · `env_enabled`) | — | 건물 = 그림 (밑면 = core 밑면 · 폭 = 건물 폭) · 번쩍 = 그림 흰색 칠 · 금 = 밑면 쪽 판정 상자 안 (그림 켬 = 건물 그림 모양으로 가림 — H-49) · HP 바 · 흔들림 · 밀림 · 착지 납작 그대로. 하늘 = 전체 화면 · 띠 = 한 장을 두 번 잘라 덤불(건물 뒤) / 땅(일개미 층) · 띠 아래 빈 곳 = 그림 맨 아래 흙색 | `art.xlsx` building_art · art_config env_* |
| **M6** 마지막 일격 링 | strike (hpLeft 0) | 0.28초 | 충격 별과 같이, 타격점에서 링이 퍼지며 사라짐 | `fx_config` final_ring.* · `art_config.ring_file` |
| **M6** 파괴 파편 · 먼지 | destroy · strike (마무리 · 마지막) | 조각 = 지금 그대로 · 먼지 0.5초 | 잔해 조각 (일개미가 주워 감) · M3-D 큰 조각 = 건물별 파편 그림 (회전 · 크기 · 좌우 뒤집기) · 먼지가 퍼지며 사라짐. 매 타격 작은 파편 (M2 F)은 도형 그대로 | `fx_config` debris_img.* · destroy_dust.* · `building_art.debris_file` |
| **M6** [ART] · [FX] 토글 | ([ART] · [FX] 패널) | — | [ART] "건물 · 배경 그림" · [FX] "파괴 그림 이펙트" — 끄면 지금 화면 | — (테스트 빌드 확인용) |
| **M7** 터치 과녁 | targetsSpawn (H-56: 닿기 직전) · targetHit · targetsEnd | 수명 (실제 1.2초 · 체인 0.7초 — H-64) · 터짐 0.12초 · 사라짐 0.15초 | 720폭 지름 96px · 흰 받침 + 진한 테두리 (L-05) · 가운데 빨강 표적 · 바깥 고리가 남은 시간만큼 줄어듦 (core 값). 탭 = 그 자리 충격 별 + 팔 한 번 더 · 터짐. 놓침 = 조용히 작아지며 사라짐 | `fx_config` target.px · `battle.targets.*` |
| **M7** 타이밍 원 | timingChance → timingResult · jump | 도움닫기 동안 | 기회일 때만 개미 발밑 원 (지름 260px → 개미 폭) · 창 안 = 노랑 굵게 · 성공 = "타이밍!" + 강점프 먼지 고리 · 실패 = 회색으로 꺼짐 | `fx_config` timing.ring_px · `fx.timing_ok` |
| **I-24** 줄어드는 링 | timingChance → timingResult · jump | 기회 도움닫기 (실제 0.5초) | 기회 = 개미 반짝 + 큰 링 (지름 340px → 발밑 원) · 웅크림이 같이 깊어짐 · 겹침 = 발밑 원 노랑. PERFECT = "PERFECT!" + 흔들림 · 초강점프 · GOOD = "GOOD!" · 헛발 = "헛발!" + 링 회색으로 꺼짐 · 판정 시각은 core 값으로만 그림 | `fx_config` ring.* · `fx.timing_*` · `strong_timing.*` |
| **I-26** 링 다듬기 · 체인 과녁 | timingChance · targetsSpawn · targetHit | 기회 도움닫기 (실제 0.7초 · ring 0.6) · 체인 과녁 수명 | 링 = **개미 몸 중심** (받침 + 굵은 테두리 · 몸 원 220px로 줄어듦) · 기회 = 머리 위 "!" + 화면 아래 절반 살짝 밝힘 · 겹침 = 안쪽 원 번쩍 + 처음 3번 "탭!" · 기회 동안 슬로 (계산). 체인 과녁 = 1개씩 건물 그림 안 · 맞히면 그 자리 별 + 팔 한 번 더 · 다음 과녁 | `fx_config` ring.* · `targets.chain_*` · `fx.timing_*` |
| **M7** PERFECT | perfect | 0.75초 | "PERFECT!" (받침 판 — "와르르!"와 같은 대비) + 보너스 1타는 마무리 크기 연출 | `fx_config` perfect.text_px · `fx.perfect` |
| **M7-E** 받치기 과녁 | targetsSpawn (`action` defend) · targetsEnd | 체인 과녁 수명 · 튀어나옴 0.12초 · 마지막 0.2초 깜빡 | **노랑 · 주황 버튼 + 흰 위 화살표** (그림 `art_config.defend_*_file`이 있으면 그림 · 없으면 같은 모양 도형 · 진한 테두리 L-05 — H-72 · 아트 #96) · 지름 180px · 자리 = core (개미 옆 dx 0.3) · 아래 "받쳐!" · 위 체인 칸 "n / m" (점프를 넘어 이어짐) · 남은 시간 = 줄어드는 링 (그림) / 테두리 호 (도형) · **처음 3번 손가락 톡톡 + "눌러!"** | `fx_config` defend.target_px · pop_* · blink_ms · hint_count · `art_config` defend_*_file · `fx.defend_target` · `fx.defend_tap` · `fx.chain_count` |
| **M7-E** 받치기 | defend (auto false) | 히트스톱 30ms · 흔들림 0.12초 · 자세 0.18초 · 건물 0.25초 · 반동 0.18초 | 짧은 멈칫 · **건물이 크게 올라감 (core 바로 · 그림 ease-out)** · **개미 튕겨 내려옴 + 찌그러짐 (I-32)** · 위 두 팔 위로 · 아래 팔 벌림 (콘티 F-10) · 위 팔 손끝 번쩍 · 먼지 · "버텨!" · 체인 순서마다 글자 · 흔들림 +25% (그림만) · 3 / 3 = "PERFECT!" | `fx_config` defend.* · `fx.defend_hold` |
| **M7-E** 받치기 놓침 | targetsEnd (perfect 아닌 끝 전부 — H-71: 체인 과녁은 거의 다 매달림 끝으로 끝남 · 파괴면 건물이 없어 안 그림) | 0.16초 | "놓침" + 건물이 툭 내려앉는 흔들림 (그림만 · 벌 없음 · 체인 끝) | `fx_config` defend.miss_* · `fx.defend_miss` |
| **M7-E** 자동 받치기 | defend (auto true) | 받치기 × 0.5 | 같은 연출을 작게 · 글자 없음 · 먼지만 | `fx_config` defend.auto_scale |
| **M7-E** 링 대비 (H-66 메모) | timingChance | — | 흰 링 → **진한 받침 위 노랑 링** · "!" = 머리 옆 (더듬이 피함) · depth = HP 바 위 (×2 겹침) | `fx_config` ring.plate_alpha |
| **M7-E** "과녁 ×1" 안내 | (배속 > `targets.max_speed`) · 넘는 순간 · 처음 켤 때 | 토스트 0.12 + 1.5 + 0.3초 | 배속 버튼 아래 노랑 글자 + 진한 받침 (H-72) · **넘는 순간 · 저장된 배속으로 켤 때 전투 구역 위쪽 토스트 "과녁은 ×1에서만" (H-76 — 작은 글자는 HUD 오른쪽 위라 못 봄)** | `hud.targets_x1` · `toast.targets_x1` · `fx_config` targets_x1.toast_ms |
| **M8** 층 건물 그림 | spawn (floors) | — | 층 조각 파일 3칸 있으면 **쌓기** (1층 + 중간 × (N − 2) + 지붕 · 키 커짐) · 없으면 **자르기** (그림 1장을 N칸 · 지붕 = `cut_roof_ratio`) · 금 = 맨 아래층 안에만 · HP 바 = 지금 층 HP + 층 칸 (□□■) | `building_art` cut_roof_ratio · floor_*_file |
| **M8** 층 깨짐 | floorBreak | 흔들림 0.09초 · 내려앉음 0.12초 | 그 층 조각이 떨어져 나감 (파편 그림 재사용 · 일개미 안 주워 감) · 작은 흔들림 · 위층이 한 칸 털썩 · 층마다 작게 — 지붕 (destroy) = 지금 파괴 연출 크게 | `fx_config` floor_break.* |
| **M7-E** 운반 개미마다 +N | deposit (index · count) | 운반 팝업 0.8초 | 개미마다 "+N" · HUD 잔해 톡 (I-30) · 조각 수 = core count · 배경 행렬 = 빈손 그대로 · 소리 = 이번엔 안 함 (제안만) | `economy.carry_*` · `strip.popup_*` |
| **M7** [FX] 토글 | ([FX] 패널) | — | "M7 과녁 · 타이밍 원" — 끄면 그림만 안 보임 (판정은 그대로 — 테스트용) | — |
| **M3-E** 배속 버튼 · 가벼운 연출 | (HUD 오른쪽 아래 [×1]) · 배속 ≥ 2 | — | 누를 때마다 ×1 → ×1.5 → ×2 → ×3 → ×1. ×2 이상: 일반 타격 멈춤 · 흔들림 끔 · 일반 타격음 3타에 1번 · 공격 모션 최소 33ms | `speed.levels` · `fx_config` speed_fx.* · motion.strike.min_wall_ms · `hud.speed` |
| **M3-C** [FX] 모션 토글 | ([FX] 패널) | — | 끄면 M3 모습 (팔 찌르기 트윈 · 점프 늘어남) | — (테스트 빌드 확인용) |
| **M3** 표정 바꾸기 | land · antDown | hit_face_ms · 기절 동안 | 착지 피격 = head_hit · 기절 = head_down · 그 외 head_normal | `art_config.hit_face_ms` |
| **M3** 파츠 그림 | (늘) | — | 도형 대신 파츠 그림 조립. M2 연출(펀치 과장 = 팔 늘이기 + 손 소켓 키우기 · 찌그러짐 등)은 같게 | `art.xlsx` 전부 |
| **M3** [ART] 패널 | ([FX] 옆 [ART] 버튼) | — | 그림 켜기 / 끄기 · 팔 슬롯별 무기 (8종 + 맨주먹) · 기준점 보기 · 크기 슬라이더 | `art_config.*_max` (테스트 빌드 확인용) |
| 잔해 집어가기 | (잔해가 지면에 닿음) | 0.3초 대기 + 0.16초 | 땅속으로 쏙 → 띠에 운반 일개미 | `strip.debris_pickup_s` |
| 운반 행렬 | (계속) | — | 일개미가 좌 → 우로 걸음 (메뉴 뒤 레이어) | `strip.worker_*` · `strip.ambient_*` |
| 운반 팝업 | (일개미가 굴 입구 도착) → **M4: deposit** | 0.8초 | `+N`이 떠오름. M4부터 = 실제 재화 도착 (core 시각에 맞춰 일개미가 걸음) · 배경 행렬은 팝업 없음 | `strip.popup_*` · `debris_reward` |
| **M4** HUD 잔해 | deposit · upgrade | 0.2초 | 숫자가 톡 튀어오름 (들어올 때) · 줄어들 때는 바로 | `hud.debris` |
| **M4** 강화 패널 | ([강화] 버튼) · upgrade | 0.22초 · 0.15초 | 아래에서 올라옴 · 산 카드가 짧게 튐 · 부족하면 버튼이 좌우로 흔들림 | `upgrade.*` (문구) |
| 착지 짓눌림 · 화면 흔들림 · 피격 숫자 | land | 0.26초 · 0.26초 · 0.75초 | 개미 납작 · 강한 흔들림 · 빨간 `-N` | — |
| 착지 건물 사라짐 | (landed_linger 끝) | 0.22초 | 납작해지며 사라짐 | `battle.building.landed_linger_s` (대기) |
| 기절 | antDown | down_duration_s | 납작 + "@ @ 기절!" 흔들림 | `battle.ant.down_duration_s` · `ant.down` |
| 토스트 | stageStart · stageClear · 메뉴 | 0.12초 + 1.5초 + 0.3초 | 전투 구역 위쪽 안내 | `toast.*` |
| [도전] 강조 | autoAdvance (off) | 0.52초 왕복 | 숨쉬기 1.0 ↔ 1.08 + 빛 번짐 (기획서 §4-2) | — |
| 개미굴 열기 · 닫기 | openNest · closeNest | 0.28초 · 0.22초 | 아래에서 올라옴 · 내려감 | — |

- "—" = view 상수 (점프 늘어남 · 먼지 고리 · 개미굴 열기 등 — M2가 건드리지 않는 연출, H-10 ⑥-4)

## 6. 디버그 패널
| # | 기능 |
|---|---|
| `?cheat` (M7-E · [프로토만]) | 왼쪽 위 HUD 아래 작은 DOM 패널 — 주소에 `?cheat`가 있을 때만. 자동 받치기 % (입력 · ±5) · 받치는 힘 × (0.5 · 1 · 2) · 무게 × (0.5 · 1 · 2) · 체력 무한 · 잔해 +1000. core 입력 `setCheat` · `addDebrisCheat` (§4) · 세이브 안 함 (I-28) |

## 7. 마일스톤 · 완료 조건
| M | 이름 | 완료 조건 | 머지 커밋 (완료 기록) |
|---|---|---|---|
| M0 | 저장소 세팅 | 세로 720×1280 빈 장면 · `npm test` · `build` · `smoke` ✅ · `data` · `data:check` ✅ · CI ✅ | `d57359f` (PR #4) |
| M1 | 코어 루프 (PR #2 이식) | ① 화면 720×1560 · HUD / 전투 / 띠 = 6 / 84 / 10% (core 레이아웃 테스트) ② PR #2 테스트 57개 이식 통과 + [굴] 버튼 테스트 ③ **`npm run measure` 표 = PR #2 본문 표** (다르면 이유를 PR에) ④ `data` · `data:check` ✅ (시트 4개 · PK · FK) ⑤ smoke: 콘솔 오류 0 · 전투 구역 그려짐 · 15초 안에 건물 파괴 수 > 0 ⑥ 화면 6컷 (매달려 연타 · 잔해 → 운반 팝업 · 착지 피격 · 기절 · 후퇴 + [도전] · [굴] → 개미굴) 360 / 390 / 430 폭 ⑦ 이 문서 §3 · §4 · §5 · §7 | `ff3175d` (PR #9) |
| M2 | 타격감 보강 (I-10) | ① **`npm run measure` 표 = M1 표** ② 테스트: M1 59개 + 연타 카운트(core) · 히트스톱 시계 · fx_config 검증 ③ **[FX] 전부 끔 = M1 화면** (같은 장면 M1 빌드와 나란히 · 끈 상태에서 M2 연출 객체 0개 자동 확인) ④ smoke ✅ (콘솔 오류 0 · 첫 탭 전 소리 객체 없음) ⑤ 화면 컷: 연타 중 ("N HIT!" · 번쩍 · 큰 주먹) · 마지막 일격 · "와르르!" 받침 · [FX] 패널 — 360 / 390 / 430 ⑥ 히트스톱 지연 측정 (스테이지 1 · 5 · 7 — 건물당 %) PR 본문에 ⑦ 이 문서 §3 · §4 · §5 · §7 | `d563925` (PR #16) |
| M3 | 아트 적용 — 개미 파츠 + 무기 8종 (I-11 · H-12) · C 모션 (I-14 · H-21) | ① **`npm run measure` 표 = M2 표** (core 안 건드림) ② **그림 끔 = M2 화면** (같은 장면 나란히) ③ 그림 켬 화면 컷: 기본 자세 · 매달려 연타 (펀치 과장 + 무기) · 착지 피격 표정 · 기절 표정 · 슬롯별 무기 8종 — 360 / 390 / 430 ④ 폴백 자동 테스트 (파츠 하나 빠짐 → 도형 · 무기 빠짐 → 맨주먹) + 아트 없이 빌드 · smoke ✅ ⑤ smoke 콘솔 오류 0 (그림 켬 기본) ⑥ 데이터 검증: weapons PK · loadout FK · mounts → parts FK · 파일 이름 규칙 · art/game 파일 (폴더 없으면 경고) ⑦ `docs/art.md` · 이 문서 §3 · §5 · §7 / **C (모션)**: ⑧ measure = M3 표 ⑨ [FX] 모션 끔 = M3 화면 (같은 장면 픽셀 비교 · 끈 상태에서 모션 객체 0) ⑩ 모션 화면 컷: 점프 6단계 · 공격 3단계 · 강점프 — 그림 · 도형 둘 다 (390) · 그림 ×1.5 · 무기 ×1.3 기본값 · 표정 3종이 390폭에서 구별됨 ⑪ 0.067초 간격 연타 (순수 함수 테스트 + 브라우저) ⑫ 테스트: 단계 자세 · 간격 비례 · 히트스톱 중 정지 · 모션 끔 = 기본 자세 · 그림 팔 늘어남 상한 ⑬ smoke ✅ | B `d127828` (PR #19) · C `500f6aa` (PR #28) · CA-002 `1ba2fe8` (PR #31) |
| M3-D | 공격 손맛 — 4연타 마무리 · 충격 별 · 건물 밀림 (I-16 · H-27) | ① `npm run measure` = M3 표 ② [FX] 마무리 · 충격 끔 = M3 화면 (픽셀 비교) · 전부 끔 fxCount 0 ③ 화면 컷 (그림 · 도형): 일반 타격 별 · 4번째 마무리 (큰 별 · 큰 조각 · 흔들림) · 파괴 일격 (마지막이 이김) — 390 ④ 테스트: 마무리 판정 (combo % every · 마지막 일격 제외) · 히트스톱 길이 (hit_ratio_max) · 별 크기 ⑤ 히트스톱 지연 표 `npm run measure -- --hitstop` (마무리 포함) ⑥ smoke ✅ ⑦ 이 문서 §3-4 · §5 · §7 | A `a794430` (PR #32) · B `74cf239` (PR #33) |
| M3-E | 배속 ×1 · ×1.5 · ×2 · ×3 (I-17 · H-28) | ① `npm run measure` 그대로 ② **배속별 같은 게임 시간 결과 동일** (테스트 — dt × 배속으로 돌린 sim과 ×1 sim이 같은 고정 스텝 수에서 상태 · 이벤트 같음) ③ ×3 smoke (콘솔 오류 0 · 파괴 수 오름) ④ 버튼 화면 컷 (×1 · ×1.5 · ×2 · ×3) ⑤ ×2 이상 가벼운 연출 · 모션 최소 길이 테스트 ⑥ 기절 · 후퇴 · [도전] · 개미굴 중 배속 유지 ⑦ PR에 "무료 ×3 = 재화 ×3" 확인 문구 (M4 운반 예약은 게임 시간) ⑧ 이 문서 §3 · §4 · §5 · §7 | A `c8d9c14` (PR #35) · B `6a257f1` (PR #36) |
| M4 | 강화 4종 + 소프트 재화 (I-12 · I-13 · H-17) | ① 강화 0이면 `npm run measure` 표 = M3 표 ② `npm run measure -- --upgrades` = 진행 표 (§3-6 측정 · PR 본문에) · **단일 강화 Lv 0 ~ max 퇴보 0건** ③ 테스트: 비용 (정수 반복) · 효과 정수화 · 구매 (부족 · MAX) · deposit 시각 · 저장 왕복 · 깨진 저장 → 새로 시작 + `.bad` 보관 · 버전 · 도전 중 저장 · 강화가 다음 타격 · 점프부터 적용 ④ 실제 브라우저: 구매 → 새로고침 → 잔해 · Lv · 스테이지 그대로 ⑤ smoke ✅ + 강화 패널 열기 · 구매 1회 · 콘솔 오류 0 ⑥ 화면 컷: HUD 잔해 · 패널 (가능 · 부족 · MAX) · 구매 순간 — 360 / 390 / 430 ⑦ 이 문서 §3 · §4 · §5 · §7 | B `d5b82af` (PR #38) · A `7d483d7` (PR #24) |
| M5 | 점프 도움닫기 (I-19 · I-20 · H-34) | ① `windup_s` 0 = M4 measure · `--upgrades` 표 그대로 (diff 0) ② 테스트: 도움닫기 길이 · `windupStart` · 도움닫기 중 탭 = 바로 강점프 1회 · 깔리면 취소 · 첫 점프에도 · 배속별 같은 결과 · 강화와 무관 ③ view: 웅크림 = 도움닫기 전체 · ×1 · ×3 화면 컷 ④ 켜는 C PR (0.5): measure · `--upgrades` 표 (0.3 · 0.5 비교) · smoke ⑤ 이 문서 §3 · §4 · §5 · §7 | A `5620daf` (PR #42) · B `f652c4c` (PR #43) · C `2218e36` (PR #46) |
| M6 | 건물 · 배경 아트 적용 (I-22 · H-42) | ① `npm run measure` · `--upgrades` = M5-D 표 그대로 (diff 0) ② **[ART] 건물 · 배경 끔 = 지금 화면** (같은 장면 픽셀 비교) · [FX] 파괴 그림 끔 = 지금 ③ 그림 켬 화면 컷 (390 · 360 · 430): 8스테이지 건물마다 매달려 치는 순간 · 착지 · 마지막 일격 (별 + 링) · 파괴 (파편 · 먼지) · 일개미 굴 입구 도착 + "+N" · 덤불 뒤 개미 ④ 폴백 테스트 (순수 함수): 건물 그림 하나 없음 · `art_id` 빈칸 · 하늘 / 띠 없음 · 끔 ⑤ 데이터 검증: `art_id` FK · building_art PK · 파일 이름 · 파일 있는지 (이름으로 · 겹침 오류) · tint 형식 · `strip_*` 범위 ⑥ smoke ×1 · ×3 콘솔 오류 0 · 첫 화면까지 시간 (전 → 후 — 그림 약 6MB 시작 때 읽기 [프로토만]) ⑦ 이 문서 §3 · §5 · §7 · `docs/art.md` §7 | A `b0176fa` (PR #57) · B `147e8ea` (PR #59) · C `183f214` (PR #60) |
| M7 | 터치 개편 — 강점프 = 줄어드는 링 · 터치 과녁 건물 단위 (I-23 · H-51 · H-56 · I-24) | ① 키 끔 (`mode` tap · `count_max` 0) = M6 measure · `--upgrades` **그대로** (diff 0) ② 테스트 (core): 같은 시드 + 같은 입력 = 같은 이벤트 · 링 등급 (perfect · good · early) · 첫 탭만 · 기회 도움닫기 실제 시간 (×1 · ×3 같음) · 아래 / 위 구역 · 과녁 닿기 직전 등장 · 건물 단위 끝 (수명 · 파괴 · 착지) · 추가 타 · miss_limit · perfect · PERFECT 높이 자름 ③ **×1 자동만 = 키 켜도 그대로** (ring_s + good_s = windup_s) ④ view: 링 · 과녁 화면 컷 (390 · ×1 · ×3) · [FX] 끔 = 그림 없음 · 실제 탭 ⑤ smoke ✅ (C 켬) ⑥ C `measure --touch`: **예측 모델 σ 0.08 GOOD 이상 ×1 · ×2 · ×3 모두 50 ~ 80%** · **반응 모델 과녁 ≥ 40%** · **연타 강점프 0 · PERFECT 0** · ×2 · ×3 자동 진행 변화 (기록) ⑦ 이 문서 §3 · §4 · §5 · §7 | A `1140975` (PR #65) · B `9ecc01a` (PR #66) · 링 키 `7c7c274` (PR #68) · 링 `de81232` (PR #69) |
| M7-D | 터치 다듬기 — 체인 과녁 · 링 보이게 (I-26 · H-61) | ① A · B = 지금 그대로 (measure · `--upgrades` diff 0 · `mode` building · ring 0.4 → 슬로 1.0) ② 테스트: 체인 (닿기 직전 · 1개씩 · 버팀 · 빗나감 / 시간 끝 = 끝 · 다 맞힘 = PERFECT) · `chain_max_speed` 넘으면 묶음 · **`max_speed` 넘으면 과녁 없음** · **땅에서 과녁 0개** · 계산 슬로 = 게임 결과 그대로 · ×1 · ×3 실제 시간 ③ C `--touch` (H-64): **링 GOOD 이상 ×1 · ×2 · ×3 50 ~ 80%** (σ 0.08) · **체인 ×1 1번째 ≥ 45%** · **PERFECT 묶음 > 0** · 연타 0 · ×2 · ×3 = 과녁 없음 (링만) · 손 ÷ 자동 기록 (~ 7.6배) ④ 화면 컷 (×1 링 몸 · "!" · 체인 · ×2 링만) · smoke ⑤ 이 문서 §3 · §4 · §5 · §7 | A `a65fb71` (PR #78) · B `78d98bb` (PR #79) · 테스트 `5abdcea` (PR #83) · C `dda3848` (PR #84) |
| M7-E | 체력 + 받치기 (반동) · 과녁 "받쳐!" · 운반 개미마다 돈 (I-27 · I-28 · H-66 · H-67 · H-69 · I-30 · I-32 · H-72 · H-73) | ① A · B · B2 · B3 = 지금 그대로 (measure · `--upgrades` · `--touch` diff 0) ② 테스트 (core): 받치기 (lift 식 · 감쇠 · 건물당 상한 · `lift_max_y` · 낙하 멈춤) · **반동** (하강 × `recoil_fall_mult` · 그 점프 과녁 하나) · **체인 점프 넘김** (1 → 2 → 3 / 3 · 놓침 = 1부터 · PERFECT = 마무리 1타 → 받치기) · 닿기 전 = 1타 뒤 · 못 닿고 정점 · 자동 = 매달림 끝 (타격 뒤 · 손으로 받친 매달림은 없음) · 탭 길 state · 체력 강화 · 운반 (합 = R · 시각) · 치트 · 세이브 왕복 · **테스트 = 시트 값과 상관없게** (C 켜도 그대로) ③ **C 측정 (H-73 — ✅)**: 자동 stage 8 **22.4 / 24.0분** ✅ (가장 싼 것 / 공격 우선 · 20 ~ 27) · lift 손 192px · 자동 124px ✅ · 손 stage 8 7.2분 = **손 ÷ 자동 3.1배** ✅ · **수동 > 자동 = 진행 · 후퇴로** (후퇴 손 1 · 자동 13) ✅ — **손 60분 잔해 95,650 = 자동 +9%** (B 176,640에서 줄어듦 — 받치면 그 점프 타격 끝 · H-73 ①) · 체인 ×1 1 / 2 / 3번째 **56 / 56 / 53%** ✅ (≥ 45 · ≥ 40) · 연타 강점프 0 · 과녁 연타 0 / 270 ✅ · 헛점프 29% (받치기 없을 때 34%) · 아슬 2% · 맞으며 깬 판 9 ~ 11% (기록만 → M8) · 단일 강화 퇴보 0건 · 받치기 1번 = 건물 공중 약 +1.4초 ④ 화면 컷 (실제 플레이 순서 — L-04): 새로 시작 → 첫 과녁 (약 6초 · 손가락 "눌러!" · 1 / 3) · 받친 순간 (건물 올라감 · 개미 반동) · ×2 "과녁 ×1" · 그림 사본을 넣으면 그림 과녁 · smoke ⑤ 이 문서 §3 · §4 · §5 · §7 | A `aa70930` (PR #91) · B `49f0967` (PR #93) · B2 `6f296a3` (PR #98) |
| M8 | 층 건물 + 섞어 나오기 (I-25 · H-62) | ① A · B = 지금 그대로 (풀 = 지금 건물 · 1층 · 흔들기 · 연달아 0 → measure · `--upgrades` · `--touch` · `--defend` diff 0) ② 테스트 (core): 층 HP 나눔 (합 = HP · 나머지 1층) · 아래층부터 · 넘친 데미지 버림 · floorBreak · 지붕 = destroy · 착지 = 남은 층 합 · 풀 비중 · 층수 범위 · 고를 게 없으면 안 뽑음 · 흔들기 범위 · 연달아 · 같은 시드 = 같은 결과 ③ C 측정 (**시드 5개 평균 + 가장 느린 시드** — H-79 `measure --seeds`): 자동 stage 8 20 ~ 27분 (두 정책) · 손 ÷ 자동 · 체인 · **아슬아슬 (맞으며 깬 판) 다시 잼 (H-67)** · 층수 분포 · 층당 타수 · 버려진 데미지 (`--floors`) ④ 화면 컷 (실제 플레이 순서 — 쌓기 주택 · 자르기 · 층 깨짐 · 위층 내려앉음 · HP 바 층 칸 · 키 큰 건물 HUD) · smoke ⑤ 이 문서 §3 · §4 · §5 · §7 | — |
