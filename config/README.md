# config — 게임 수치

코드에 수치를 박지 않고 여기 JSON으로 분리한다 (Unity 이식 시 ScriptableObject · 테이블로 옮길 대상).
값을 바꾸면 `npm test`가 형식을 검사한다 (`src/core/config.ts` `validateConfig`). 오류가 있으면 게임이 시작하지 않고 화면에 오류를 띄운다.

**단위 규칙** — px를 쓰지 않는다.

| 접미사 | 기준 |
|---|---|
| `*_ratio` (battle · stages) | 전투 구역 높이 = 1.0 (y = 0 지면, 1 = 전투 구역 맨 위). `width_ratio`만 프레임 폭 기준 |
| `*_ratio_per_s` | 전투 구역 높이 / 초 |
| layout · input `*_ratio` | Safe Area(= 게임 프레임) 높이 기준 |
| strip | 가로 = 프레임 폭, 세로 = 띠 높이 기준 |

**상태 표기** — `기획` = 기획서 v0.2에 있는 값 · `임시` = 기획서에 없어 동작용으로 둔 값 (DD 확인 필요) · `연출` = 게임 규칙에 영향 없음

## layout.json — 화면 구역

| Column | 데이터 타입 | 설명 | 예시 | 상태 |
|---|---|---|---|---|
| frame_aspect_w / frame_aspect_h | number | 세로 프레임 비율 | 9 / 19.5 | 기획 (요청서) |
| render_width_px | int | 웹 렌더 해상도 가로 (세로는 비율로 계산 → 1080×2340) | 1080 | 연출 |
| hud_ratio | number | HUD 높이 | 0.06 | 기획 |
| battle_ratio | number | 전투 구역 높이 | 0.84 | 기획 |
| strip_ratio | number | 땅속 띠 + 하단 메뉴 높이. 세 값 합 = 1 | 0.10 | 기획 |
| strip_menu_height_ratio | number | 메뉴 버튼 높이 (띠 높이 기준) | 0.62 | 임시 |
| challenge_button_y_ratio | number | [도전] 버튼 위쪽 여백 (전투 구역 높이 기준) | 0.06 | 임시 |

## battle.json — 개미 · 점프 · 팔 · 건물

| Column | 데이터 타입 | 설명 | 예시 | 상태 |
|---|---|---|---|---|
| ant.max_hp | number | 개미 HP (다리 스탯 "체력" 자리) | 100 | 임시 |
| ant.height_ratio | number | 개미 키. 건물 밑면이 여기까지 내려오면 착지(피격) | 0.07 | 임시 |
| ant.width_ratio | number | 개미 그림 폭 (프레임 폭 기준) | 0.16 | 연출 |
| ant.down_duration_s | number | 기절 연출 시간. 이 동안 전투 정지 | 1.2 | 임시 |
| ant.refill_hp_on_stage_start | bool | 스테이지 시작마다 HP 회복 (false면 HP 0일 때만 회복) | true | 임시 |
| jump.height_ratio | number | 자동 점프 최고점 (발 기준) — 다리 스탯 "점프력" 자리 | 0.42 | 임시 |
| jump.speed_ratio_per_s | number | 위아래 이동 속도 — 다리 스탯 "점프 이동 속도" 자리 | 1.1 | 임시 |
| jump.ground_delay_s | number | 지면에 닿은 뒤 다음 자동 점프까지 | 0.25 | 임시 |
| strong_jump.height_mult | number | 강점프 최고점 = 자동 점프 × 배율 | 1.6 | 임시 (기획서 §9 미정) |
| strong_jump.speed_mult | number | 강점프 이동 속도 배율 | 1.0 | 임시 |
| strong_jump.cooldown_s | number | 강점프 쿨타임 | 0 | 임시 (기획서 §9 미정) |
| arms[].slot | int | 팔 슬롯 번호 1 ~ 4 (순서 고정) | 1 | 기획 |
| arms[].damage | number | 그 팔 1타 데미지 (장비 자리) | 10 | 임시 |
| strike_interval_s | number | 매달려 있는 동안 팔 타격 간격 | 0.12 | 임시 |
| arm_order_resets_each_jump | bool | true = 점프마다 팔 1부터 / false = 이어서 (1→2→3→4→1…) | false | 임시 |
| landing_damage_coeff | number | 착지 데미지 = ceil(건물 남은 HP × 계수) | 0.5 | 기획(비례) + 임시(계수) |
| building.height_ratio | number | 건물 높이 | 0.16 | 연출 |
| building.width_ratio | number | 건물 폭 (프레임 폭 기준) | 0.5 | 연출 |
| building.spawn_bottom_ratio | number | 건물이 나타나는 높이 (밑면) | 1.0 | 임시 |
| building.spawn_delay_s | number | 다음 건물이 떨어지기까지 | 0.6 | 임시 |
| building.landed_linger_s | number | 착지한 건물이 남아 있는 시간 (깔린 동안 탭 무시) | 0.6 | 임시 |

## stages.json — 스테이지 표

| Column | 데이터 타입 | 설명 | 예시 | 상태 |
|---|---|---|---|---|
| rows[].stage | int (PK) | 스테이지 번호. 1부터 빈칸 없이 | 1 | — |
| rows[].building_hp | number | 건물 HP | 60 | 임시 (기획서 §9 미정) |
| rows[].fall_speed_ratio_per_s | number | 건물 낙하 속도 | 0.1 | 임시 (기획서 §9 미정) |
| rows[].buildings_to_clear | int | 클리어에 필요한 파괴 수 (착지한 건물은 안 셈) | 3 | 임시 (기획서에 없음) |
| beyond_last_row | enum | 마지막 행을 넘는 스테이지 처리. 지금은 `repeat_last`만 | repeat_last | 임시 |

## input.json — 입력 판정

| Column | 데이터 타입 | 설명 | 예시 | 상태 |
|---|---|---|---|---|
| strip_tap_slop_ratio | number | 이 거리 안에서 떼면 탭 | 0.015 | 임시 |
| strip_tap_max_ms | number | 탭으로 보는 최대 시간 | 350 | 임시 |
| strip_swipe_min_dy_ratio | number | 아래로 이만큼 끌면 스와이프 | 0.03 | 임시 |
| strip_swipe_max_ms | number | 스와이프로 보는 최대 시간 | 700 | 임시 |
| nest_swipe_up_min_dy_ratio | number | 개미굴에서 위로 이만큼 끌면 복귀 | 0.05 | 임시 |

## strip.json — 땅속 띠 연출 (경제 로직 없음)

| Column | 데이터 타입 | 설명 | 예시 | 상태 |
|---|---|---|---|---|
| worker_speed_ratio_per_s | number | 일개미 이동 속도 (프레임 폭 / 초) | 0.16 | 연출 |
| worker_size_ratio | number | 일개미 크기 (띠 높이 기준, 1080 기준 ≈ 75px) | 0.32 | 연출 (기획서 60~80px) |
| worker_gap_ratio | number | 일개미 줄 간격 | 0.07 | 연출 |
| ambient_spawn_interval_s | number | 배경 행렬 일개미 등장 간격 | 1.6 | 연출 |
| ambient_carry_amount | number | 배경 행렬 일개미 팝업 숫자 | 5 | 연출 (재화 아님) |
| debris_pieces | int | 파괴 시 잔해 조각 수 (= 운반 일개미 수) | 6 | 연출 |
| debris_carry_amount_per_piece | number | 잔해 운반 일개미 팝업 숫자 | 20 | 연출 (재화 아님) |
| debris_pickup_s | number | 잔해가 지면에 닿고 일개미가 집어가기까지 | 0.3 | 기획 (§7 "0.3초 정도") |
| burrow_x_ratio | number | 굴 입구 위치 (띠 우측 끝) | 0.93 | 연출 |
| popup_rise_ratio / popup_duration_s | number | 팝업이 떠오르는 높이 · 시간 | 0.5 / 0.8 | 연출 |
