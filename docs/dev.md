# 와르르 개미 — 개발 기준 문서 (단일 기준)

> 문서 버전: v0.9 (2026-11-04) — M4 강화 데이터: upgrades 시트 · economy 키 · 문구 · 이벤트 · 연출 · 완료 조건 (H-17 · I-13) · M3 B 머지 기록
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
- 지금 범위: **M3-C 공격 · 점프 모션** (I-14 — 계획 중 · view 전용) → **M4 강화 4종 + 소프트 재화** (I-12 · I-13 · H-17) — 잔해 = 재화 · 강화 공격력 · 공격속도 · 점프력 · 이동속도(하강만) · 강화 패널 · 브라우저 저장 (형식 v1)
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
| name | string | 이름 (표시용, 임시) | 오두막 |
| hp | int | 건물 HP | 60 |
| fall_speed | float | 낙하 속도 (전투 구역 높이 / 초) | 0.1 |
| weight | float | 무게 — 추후 반격용. 지금 로직 없음 (기본 1.0) | 1.0 |
| debris_reward | int | 파괴 시 잔해 — **M4부터 실제 재화** (H-01 #13 → I-12). 파괴 + `economy.carry_delay_s` 뒤 `deposit` | 60 |
| is_boss | bool | 보스 건물 — 지금 로직 없음 (H-01 #14) | FALSE |

### 3-2. `stages.xlsx` › stages → `stages.json` (표)
| Column명 | 데이터 타입 | 설명 | 예시 데이터 |
|---|---|---|---|
| stage | int (PK) | 스테이지 번호. 1부터 빈칸 없이 | 1 |
| building_id | string (FK → buildings.building_id) | 이 스테이지에 떨어지는 건물 | `bld_hut` |
| buildings_to_clear | int | 클리어에 필요한 파괴 수 (착지한 건물은 안 셈 — H-01 #5) | 3 |

- 마지막 행을 넘는 스테이지 = 마지막 행 반복 (`game_config` `stage.beyond_last_row` = `repeat_last`, H-01 #12)

### 3-3. `config.xlsx` › game_config → `game_config.json` (키-값)
| Column명 (key) | 데이터 타입 | 설명 | 예시 데이터 |
|---|---|---|---|
| layout.frame_width · frame_height | int | 프레임 크기 (G-03) | 720 · 1560 |
| layout.hud_ratio · battle_ratio · strip_ratio | float | HUD / 전투 / 띠+메뉴 높이 (프레임 높이 기준, 합 = 1 — 기획서 §6) | 0.06 · 0.84 · 0.1 |
| layout.strip_menu_height_ratio | float | 메뉴 버튼 높이 (띠 높이 기준) | 0.62 |
| layout.challenge_button_y_ratio | float | [도전] 버튼 위쪽 여백 (전투 구역 높이 기준) | 0.06 |
| battle.ant.max_hp | int | 개미 HP (다리 스탯 "체력" 자리) | 100 |
| battle.ant.height_ratio | float | 개미 키 — 건물 밑면이 여기까지 내려오면 착지 | 0.07 |
| battle.ant.width_ratio | float | 개미 그림 폭 (프레임 폭 기준) | 0.16 |
| battle.ant.down_duration_s | float | 기절 시간 (전투 정지) | 1.2 |
| battle.ant.refill_hp_on_stage_start | bool | 스테이지 시작마다 HP 가득 (H-01 #6) | TRUE |
| battle.jump.height_ratio | float | 자동 점프 최고점 (다리 스탯 "점프력" 자리) | 0.42 |
| battle.jump.speed_ratio_per_s | float | 위아래 이동 속도 (다리 스탯 "점프 이동 속도" 자리) | 1.1 |
| battle.jump.ground_delay_s | float | 착지 후 다음 자동 점프까지 | 0.25 |
| battle.strong_jump.height_mult · speed_mult · cooldown_s | float | 강점프 배율 · 속도 배율 · 쿨타임 (기획서 §9 미정 — 임시, H-01 #3) | 1.6 · 1.0 · 0 |
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
| stage.beyond_last_row | string | 표 끝 넘으면 처리 — `repeat_last`만 | repeat_last |
| input.strip_tap_slop_ratio · strip_tap_max_ms | float · int | 띠 탭 판정 (거리 · 시간) | 0.015 · 350 |
| input.strip_swipe_min_dy_ratio · strip_swipe_max_ms | float · int | 띠 아래 스와이프 판정 | 0.03 · 700 |
| input.nest_swipe_up_min_dy_ratio | float | 개미굴 위로 스와이프 → 복귀 | 0.05 |
| strip.worker_speed_ratio_per_s · worker_size_ratio · worker_gap_ratio | float | 일개미 속도 · 크기 · 간격 (연출) | 0.16 · 0.32 · 0.07 |
| strip.ambient_spawn_interval_s · ambient_carry_amount | float · int | 배경 행렬 간격 · 팝업 숫자 (연출). **M4 B에서 `ambient_carry_amount`를 지움** — 배경 행렬은 재화 없음 · "+N" 팝업 없음 (H-17 질문 3) | 1.6 · 5 |
| strip.debris_pieces · debris_pickup_s | int · float | 잔해 조각 수 · 집어가기까지 (기획서 §7 "0.3초") | 6 · 0.3 |
| strip.burrow_x_ratio | float | 굴 입구 위치 (띠 우측 끝 — H-01 #8) | 0.93 |
| strip.popup_rise_ratio · popup_duration_s | float | 운반 팝업 높이 · 시간 | 0.5 · 0.8 |
| economy.carry_delay_s | float | 파괴 → 재화 도착까지 (core 예약 — 평균 운반 시간: 날아감 1.0 + 집기 0.3 + 걷기 2.7초, M4 B에서 실제로 재서 맞춤) | 4.0 |
| economy.start_debris | int | 새로 시작할 때 잔해 | 0 |

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

### 3-5. `art.xlsx` → 아트 배치 (M3 — view만 읽음 · 규격과 맞추는 법 = `docs/art.md`)
pivot · socket · grip = `art/game` 납품본 측정값 · draw_h · anchor · angle = [가정] M1 도형 비율 (`docs/art.md` §6)

| 파일 · 시트 | Column명 | 데이터 타입 | 설명 | 예시 데이터 |
|---|---|---|---|---|
| art_config (키-값) | skin_id · enabled | string · bool | 지금 스킨 · 그림으로 그리기 | black · TRUE |
| | draw_scale · draw_scale_max · weapon_scale · weapon_scale_max | float | 그림 배율 · [ART] 슬라이더 상한 (판정 크기는 그대로 — H-12 Q1) | 1.0 · 2.5 · 1.0 · 2.0 |
| | hit_face_ms | int | 착지 피격 표정 시간 | 600 |
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

### 3-6. `upgrades.xlsx` › upgrades → `upgrades.json` (표 · M4 — core가 읽음)
| Column명 | 데이터 타입 | 설명 | 예시 데이터 |
|---|---|---|---|
| upgrade_id | string (PK) | 강화 ID | attack_power |
| name | string | 카드 이름 | 공격력 |
| stat | enum (attack_power · attack_speed · jump_power · move_speed) | 바꾸는 값 — 코드가 아는 4종 고정, 각 1행 (H-17 질문 5) | attack_power |
| per_level_pct | int (> 0) | Lv당 +% (합산) | 10 |
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

| upgrade_id | per_level_pct · max_level | cost_base · cost_growth_pct | 근거 (지시함 #3 M4 계획 ⑤ 측정) |
|---|---|---|---|
| attack_power 공격력 | 10 · 20 (×3.0) | 60 · 130 | 데미지 10 → 30 (Lv당 +1). 첫 건물 보상 60 = 첫 강화 바로 |
| attack_speed 공격속도 | 8 · 10 (×1.8) | 90 · 135 | 간격 0.120 → 0.067초 · 히트스톱 벽시계 지연 최대 +10.6% |
| jump_power 점프력 | 5 · 7 (×1.35) | 80 · 145 | 천장 ×1.384 바로 아래 · 단독 효과가 커서 비싸게 |
| move_speed 이동속도 | 5 · 6 (×1.3) | 80 · 145 | 효과가 약해서 Lv 짧게 |
- 측정 (자동만 · 가장 싼 것부터 · 이동속도 하강만): 스테이지 3 = 1.4분 · 5 = 7.9분 · 8 = 22.4분 (구매 순서에 따라 8스테이지 약 20 ~ 35분) · 강점프 연타 = 8스테이지 3.5분 — 값은 임시, 폰 확인 뒤 조정

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
| upgrade.title · level · max · short · close | string | 강화 패널 | 강화 · `Lv {n} / {max}` · MAX · 잔해가 부족해요 · ✕ |
| upgrade.reset · reset_confirm | string | 테스트 빌드 기록 지우기 (두 번 눌러 확정 — H-17 질문 7) | 기록 지우기 · 한 번 더 누르면 지워져요 |
| upgrade.fx.{stat} (4) | string | 지금 → 다음 효과 | `데미지 {a} → {b}` · `초당 {a} → {b}회` · `점프 +{a}% → +{b}%` · `하강 +{a}% → +{b}%` |
| upgrade.now.{stat} (4) | string | MAX일 때 지금 효과만 | `데미지 {a}` … |

- `{n}` = 숫자 자리 · `{label}` = 메뉴 이름 자리 (`toast.menu_wip`) · `{a}` · `{b}` · `{max}` = 강화 효과 · 최대 Lv — **view가 core 값으로 채움** (H-05 ⑤-4)

## 4. core → view 이벤트 목록 (이식 계약 — 새 이벤트는 여기 한 줄)
| 이벤트 | 인자 | 언제 |
|---|---|---|
| stageStart | stage · reason (init / advance / repeat / retreat / restart / challenge) | 스테이지 시작 |
| stageClear | stage · wasChallenge | 파괴 수가 buildings_to_clear에 닿았을 때 |
| autoAdvance | on | auto_advance가 바뀔 때 |
| spawn | seq · building_id · hp | 건물 생성 (seq = 화면에 나온 순번) |
| jump | kind (auto / strong) · apex | 점프 시작 |
| strike | arm (1 ~ 4) · damage · hpLeft · **combo** | 팔 1타. combo = 같은 건물에서 이어진 연타 수 (1부터). 마지막 타격 뒤 `battle.combo_window_s` 안에 다음 타격이면 +1, 아니면 1. 건물 파괴 · 착지 · 스테이지 시작 때 0 (M2 · H-10) |
| destroy | seq · y · debrisReward | 건물 HP 0 |
| land | seq · damage · antHp | 건물 착지 — damage = ceil(남은 HP × 계수) (정수화 시점) |
| antDown | stage | 개미 HP 0 |
| tapIgnored | reason (airborne / cooldown / down / pinned) | 강점프를 무시할 때 |
| **deposit** (M4) | amount · wallet | 파괴 뒤 `economy.carry_delay_s`가 지나 잔해가 굴에 도착 — wallet += amount. 후퇴 · 재시작 · 도전이 있어도 예약은 그대로 |
| **upgrade** (M4) | id · level · cost · wallet | 강화 구매 성공. 데미지 · 타격 간격 = 다음 타격부터, 점프력 · 이동속도 = 다음 점프부터 |

**view → core 입력 계약 (InputRouter action)**: strongJump · challenge · menu{id} · openNest{via: tap / swipe_down / button} · closeNest{via: button / swipe_up}
- M4: `buyUpgrade{id}` · `closeUpgrade{via: button / outside}` · `resetSave` (두 번째 누름). InputRouter `upgrade` 모드 = 패널 버튼만 받고 바깥 탭은 닫기 (강점프 안 됨, H-17 질문 6). 구매 결과 = core `buyUpgrade(id)` → ok / short (부족) / max

**저장 (M4 — 형식 v1, H-17 ③)**: 키 `crumble-ant.save` · `{ v: 1, debris, upgrades: {upgrade_id: Lv}, stage, auto_advance }`. 만들기 · 검증 · 버전 변환 = `src/core/save.ts` (읽고 쓰기는 view). 저장 시점 = deposit · upgrade · stageStart · 화면을 떠날 때 (1초에 한 번 이하). 도전 중 = 도전 전 스테이지 · auto_advance OFF로. 운반 중 잔해는 저장 안 함 [프로토만]. 못 읽으면 새로 시작 + 원본을 `crumble-ant.save.bad`로. 시간 기록 없음

**히트스톱 (M2 A)**: view가 그 시간 동안 `sim.update`를 부르지 않는다 (core 시계를 통째로 멈춤 — H-10 ⑥-1). 결과는 게임 시간 기준이라 그대로, 벽시계로만 늦어짐. 방치 · 오프라인 보상이 생기면 게임 시간 기준으로 계산

**결정성**: 고정 스텝 1/120초 (프레임레이트와 무관) · core에 난수 없음 (잔해 흩어짐은 view 연출) · 잔해 팝업 숫자 = floor(debris_reward ÷ 조각 수), 나머지는 첫 조각

## 5. 연출 목록 (새 연출은 여기 한 줄)
| 이름 | 트리거 이벤트 | 시간 | 느낌 | 데이터 키 |
|---|---|---|---|---|
| 점프 늘어남 | jump | 0.14초 | 몸이 위로 늘었다가 돌아옴 (강점프는 더 크게) | — (view 상수) |
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

## 7. 마일스톤 · 완료 조건
| M | 이름 | 완료 조건 | 머지 커밋 (완료 기록) |
|---|---|---|---|
| M0 | 저장소 세팅 | 세로 720×1280 빈 장면 · `npm test` · `build` · `smoke` ✅ · `data` · `data:check` ✅ · CI ✅ | `d57359f` (PR #4) |
| M1 | 코어 루프 (PR #2 이식) | ① 화면 720×1560 · HUD / 전투 / 띠 = 6 / 84 / 10% (core 레이아웃 테스트) ② PR #2 테스트 57개 이식 통과 + [굴] 버튼 테스트 ③ **`npm run measure` 표 = PR #2 본문 표** (다르면 이유를 PR에) ④ `data` · `data:check` ✅ (시트 4개 · PK · FK) ⑤ smoke: 콘솔 오류 0 · 전투 구역 그려짐 · 15초 안에 건물 파괴 수 > 0 ⑥ 화면 6컷 (매달려 연타 · 잔해 → 운반 팝업 · 착지 피격 · 기절 · 후퇴 + [도전] · [굴] → 개미굴) 360 / 390 / 430 폭 ⑦ 이 문서 §3 · §4 · §5 · §7 | `ff3175d` (PR #9) |
| M2 | 타격감 보강 (I-10) | ① **`npm run measure` 표 = M1 표** ② 테스트: M1 59개 + 연타 카운트(core) · 히트스톱 시계 · fx_config 검증 ③ **[FX] 전부 끔 = M1 화면** (같은 장면 M1 빌드와 나란히 · 끈 상태에서 M2 연출 객체 0개 자동 확인) ④ smoke ✅ (콘솔 오류 0 · 첫 탭 전 소리 객체 없음) ⑤ 화면 컷: 연타 중 ("N HIT!" · 번쩍 · 큰 주먹) · 마지막 일격 · "와르르!" 받침 · [FX] 패널 — 360 / 390 / 430 ⑥ 히트스톱 지연 측정 (스테이지 1 · 5 · 7 — 건물당 %) PR 본문에 ⑦ 이 문서 §3 · §4 · §5 · §7 | `d563925` (PR #16) |
| M3 | 아트 적용 — 개미 파츠 + 무기 8종 (I-11 · H-12) · C 모션 (I-14 — 계획 중) | ① **`npm run measure` 표 = M2 표** (core 안 건드림) ② **그림 끔 = M2 화면** (같은 장면 나란히) ③ 그림 켬 화면 컷: 기본 자세 · 매달려 연타 (펀치 과장 + 무기) · 착지 피격 표정 · 기절 표정 · 슬롯별 무기 8종 — 360 / 390 / 430 ④ 폴백 자동 테스트 (파츠 하나 빠짐 → 도형 · 무기 빠짐 → 맨주먹) + 아트 없이 빌드 · smoke ✅ ⑤ smoke 콘솔 오류 0 (그림 켬 기본) ⑥ 데이터 검증: weapons PK · loadout FK · mounts → parts FK · 파일 이름 규칙 · art/game 파일 (폴더 없으면 경고) ⑦ `docs/art.md` · 이 문서 §3 · §5 · §7 | B `d127828` (PR #19) · C 진행 |
| M4 | 강화 4종 + 소프트 재화 (I-12 · I-13 · H-17) | ① 강화 0이면 `npm run measure` 표 = M3 표 ② `npm run measure -- --upgrades` = 진행 표 (§3-6 측정 · PR 본문에) · **단일 강화 Lv 0 ~ max 퇴보 0건** ③ 테스트: 비용 (정수 반복) · 효과 정수화 · 구매 (부족 · MAX) · deposit 시각 · 저장 왕복 · 깨진 저장 → 새로 시작 + `.bad` 보관 · 버전 · 도전 중 저장 · 강화가 다음 타격 · 점프부터 적용 ④ 실제 브라우저: 구매 → 새로고침 → 잔해 · Lv · 스테이지 그대로 ⑤ smoke ✅ + 강화 패널 열기 · 구매 1회 · 콘솔 오류 0 ⑥ 화면 컷: HUD 잔해 · 패널 (가능 · 부족 · MAX) · 구매 순간 — 360 / 390 / 430 ⑦ 이 문서 §3 · §4 · §5 · §7 | |
