# 아트 규격 · 파츠 조립 (M3 · M6)

> 문서 버전: v0.6 (2026-11-07) — §7 M6 C 켬 (기본 = 그림)
> v0.5 (2026-11-06) — §7 건물 · 배경 · 파괴 이펙트 (M6 — H-42) · §3 위치 · 파일 이름으로 찾기
> v0.4 (2026-11-05) — §3 충격 별 그림 자리 `art/game/fx/` (M3-D — H-27)
> v0.3 (2026-11-04) — §6 기본값 = 대표 폰 확인 (그림 ×1.5 · 무기 ×1.3) · 머리 배율 · 표정 시간 (H-22)
> v0.2 (2026-11-04) — §6 좌표를 `art/game` 납품본(아트 #15 `faa5c2c`)으로 다시 잼 · 무기 이름 = README
> v0.1 (2026-11-04) — 📮 #3 [DD→개발] M3 아트 적용 (I-11) · 계획 승인 H-12. 아트(ChatGPT)에 전달된 규격을 정본으로 옮김
> 아트 PR은 `art/`만 고친다 (대표 머지). 게임은 **`art/game/`만** 읽는다 — `art/production/`은 원본 · 초안 보관

## 1. 무엇을 만드나
- 개미는 **파츠 여러 장을 겹쳐 조립**한다 (통째 그림 · 프레임 애니메이션 아님) — 나중에 무기 교체 · 외형(스킨) 변경을 위해
- 파츠: 몸통 · 머리(표정 3종) · 팔 1장(4개에 재사용, 왼쪽은 좌우 반전) · 다리 1장(2개에 재사용). 무기는 팔 끝 "손 소켓"에 붙는다
- 팔 슬롯 1 ~ 4마다 무기 1개 (빈칸 = 맨주먹). 무기는 지금 **외형만** — 데미지는 `battle.arm_damage` 그대로
- 그림 파일이 없거나 못 읽으면 **도형으로 그린다** (폴백 — §5)

## 2. 파일 규격
| 항목 | 규격 |
|---|---|
| 형식 | PNG-32 투명 배경 · sRGB · 파츠마다 한 파일 |
| 여백 | 최소 — 가장자리 4px 이내 (`npm run art:pivots`가 넘으면 ⚠) |
| 기준 크기 | 완성 개미 키 = **384px** (게임 화면 약 96px의 4배 — 폰 고해상도 대비). 원본(`art/production`)은 그 이상 자유 |
| 자세 | 정면 · 팔은 **위로 곧게 뻗은 기본 자세** (어깨 = 아래 끝 · 손 = 위 끝) · 무기는 **위를 향하게** (손잡이 = 아래) |
| 외곽선 | 두께 일정 (게임 크기에서 약 2px). 검은 개미는 어두운 배경에서 안 보이므로 **밝은 테두리 또는 하이라이트** 필수 (잼병 L-05) |

## 3. 파일 이름 · 위치
| 위치 | 파일 |
|---|---|
| `art/game/ant/` | `ant_<skin>_body.png` · `ant_<skin>_head_normal.png` · `ant_<skin>_head_hit.png` · `ant_<skin>_head_down.png` · `ant_<skin>_arm.png` · `ant_<skin>_leg.png` (지금 skin = `black`) |
| `art/game/weapons/` | `weapon_<weapon_id>.png` × 8 — weapon_id = 영문 소문자 · 숫자 · 밑줄 |
| `art/game/weapons/README.md` | 무기 목록 표 `weapon_id | 한글 이름 | 파일` (H-12 Q7) |
| `art/game/env/` | `impact.png` 충격 별 (M3-D — 이름을 art_config `impact_file`에 적으면 도형 별 대신) · `sky.png` 하늘 · `ground_strip.png` 지면/굴 띠 (M6 §7) |
| `art/game/buildings/` | `building_<이름>.png` × 6 + `README.md` 표 (M6 §7) |
| `art/game/fx/` | `shock_ring.png` · `dust.png` · `debris.png` (공용 파편) · `building_debris/debris_<이름>.png` × 6 (건물별 파편) — M6 §7 |

- 지금 무기 8종 (H-12 · 이름 = `art/game/weapons/README.md`): `club` 몽둥이 · `drill` 드릴 · `flail` 도리깨 · `hammer` 망치 · `mace` 철퇴 · `mallet` 나무망치 · `pickaxe` 곡괭이 · `wrench` 렌치
- **게임은 파일 이름만으로 찾는다** (`src/view/artFiles.ts`) — 하위 폴더 어디든 되지만, `art/game/` 안에 **같은 이름이 둘이면 오류** (`npm run data:check`)
- 파일 이름 규칙은 `npm run data:check`가 검사한다. 시트에 있는 파일이 `art/game/`에 없으면: 폴더가 없을 때 = 경고, 폴더가 있을 때 = 오류 (H-12 Q6)

## 4. 좌표 — 아트가 아니라 데이터로 맞춘다 (`design/tables/art.xlsx`)
| 시트 | 무엇 |
|---|---|
| `ant_parts` | 그림 한 장 안의 점: pivot (회전 · 붙는 점) · socket (팔만: 손) · draw_h (그림 높이, 개미 키 기준) |
| `ant_mounts` | 개미 몸의 어느 자리에 몇 도로 붙나: anchor (개미 키 기준, 발 = 0 · 머리 = 1, 가운데 = 0) · angle_deg · layer · mirror |
| `weapons` | 무기 그림의 손잡이 점 grip · 크기 scale (개미 키 기준) · 손에서의 각도 |
| `ant_loadout` | 팔 슬롯 1 ~ 4 → weapon_id (빈칸 = 맨주먹) |
| `art_config` | 스킨 · 그림 켜기 · 그림 배율 (`draw_scale` · `weapon_scale` — 판정 크기는 그대로, H-12 Q1) · 슬라이더 상한 · 피격 표정 시간 |

- 그림 안 비율 좌표: 왼쪽 위 = (0, 0) · 오른쪽 아래 = (1, 1)
- 그리는 순서 (layer): 다리 → 팔 3 · 4 → 팔 1 · 2 → 몸통 → 머리. 무기는 자기 팔과 같이
- 팔 기본 각도 = M1 도형 그대로 (슬롯 1 · 2 = 바깥 35° · 3 · 4 = 바깥 70° — H-12 Q4)
- 표정: 평소 `head_normal` · 착지 피격 때 `head_hit` (`hit_face_ms` 동안) · 기절 때 `head_down` (H-12 Q5)

### 맞추는 순서
1. 아트가 `art/game/`에 넣음 (`[art]` PR · 대표 머지)
2. `npm run art:pivots` — 투명 영역을 재서 pivot · socket · grip을 제안 (팔 = 아래 끝 가운데 · 위 끝 가운데 / 다리 = 위 끝 / 몸통 · 머리 = 아래 끝 / 무기 = 아래에서 손잡이 길이 10% 위)
3. 제안값을 `art.xlsx`에 → `npm run data`
4. 게임 [ART] 패널 "기준점 보기"로 눈으로 확인 · 조금씩 고침 (`[바로 PR]`)

## 5. 폴백 (그림이 없거나 못 읽을 때)
- 몸 파츠 (body · head 3 · arm · leg) 중 하나라도 없음 → **개미 전체를 도형으로** (반쪽만 그림이면 더 어색해서)
- 무기 그림 없음 → 그 슬롯만 맨주먹
- `art_config.enabled` FALSE이거나 [ART]에서 끔 → 도형 (= M2 화면)

## 6. 지금 값 (M3 좌표 맞춤 — 아트 #15 납품본)
- pivot · socket · grip = `npm run art:pivots`를 `art/game/` 납품본에 돌린 값 (여백 2 ~ 4px — 규격 §2 안). [가정] 아님
  - 머리 3종(normal · hit · down)은 **같은 캔버스(153×162)**라서 head_normal 값을 셋 다 씀 — 그림마다 따로 재면 투명 영역이 달라 표정을 바꿀 때 머리가 4 ~ 6px 움직임
  - 무기 grip = 아래 끝에서 손잡이 길이 10% 위 (§4 맞추는 순서 2) — 8종 모두 높이 194px라 grip_y 0.887로 같음
- 무기 한글 이름 = `art/game/weapons/README.md` (몽둥이 · 드릴 · 도리깨 · 망치 · 철퇴 · 나무망치 · 곡괭이 · 렌치)
- [가정] 그대로 (폰 확인 뒤 맞춤): draw_h · anchor · angle = M1 도형 개미 비율 (팔 0.36 · 다리 0.22 · 몸통 0.34 · 머리 0.6 · 팔 자리 0.475 / 0.339 · 좌우 ±0.181)
- 무기 scale 0.5 = 팔(0.36)보다 조금 길게. 납품본 무기 높이 194px ÷ 완성 개미 384px ≈ 0.505라 아트 의도와도 맞음
- `draw_scale` 1.5 · `weapon_scale` 1.3 = 대표 폰 확인 (H-22)
- `head_scale` 1.3 = 머리만 따로 (목 기준) — 표정이 안 보인다는 폰 확인 (H-22). 390pt 폰에서 머리 높이 약 45 → 58pt (목업 머리의 약 80%)
- `hit_face_ms` 900 = 착지 짓눌림 0.26초 + 건물이 개미를 깔고 남는 0.6초 동안 피격 표정이 보이게 (전에는 600)
- `draw_scale_max` 2.5 = 아트 인게임 목업의 개미(화면 높이 약 15%) ÷ 지금 개미(0.07 × 0.84 ≈ 5.9%)
- 기본 장착: 1 망치 · 2 드릴 · 3 철퇴 · 4 렌치 — 실루엣이 서로 다른 4개 (목업은 망치)

## 7. 건물 · 배경 · 파괴 이펙트 (M6 — H-42)
**원칙: view만.** core는 건물의 **밑면 y만** 쓴다 (치는 곳 · 깔리는 곳). 그림 크기 · 모양은 결과(measure)에 영향 없음

| 그림 | 규격 (납품본 — F-04 · F-05 · F-06) | 게임에서 | 시트 |
|---|---|---|---|
| 건물 `building_<이름>.png` × 6 | 폭 720 · 높이 682 ~ 775 · 여백 3px · 밑면이 평평 (밑면 폭 94 ~ 96%) | 폭 = 건물 폭 (`width_ratio` × `draw_w`) · 세로는 비율대로 · **그림 밑면 = core 밑면** · 기준점 x = 가운데 | `building_art` (art_id · file · pivot_y · draw_w · tint · debris_file) |
| 하늘 `sky.png` | 1440×3120 (9:19.5 = 화면 비율) · 불투명 | 전체 화면 한 장 (HUD · 띠가 위에) — 도형 하늘 · 구름 숨김 | art_config `sky_file` |
| 띠 `ground_strip.png` | 1440×312 (4.6:1 = 띠 비율) · 좌우 이어짐 · 위 24% = 풀 · 덤불 (투명 포함) | 풀 윗선 = 지면 (groundY). 한 장을 두 번 잘라 **덤불 = 건물 · 개미 뒤 · 땅 = 일개미 층** · 띠 아래 빈 곳 = 그림 맨 아래 흙색 | `strip_file` · `strip_ground_ratio` · `strip_burrow_x` |
| 충격 별 `impact.png` | 256 정사각 · 가운데 = 맞는 점 | 지금 도형 별 자리 (M3-D) | `impact_file` |
| 링 `shock_ring.png` | 512 · 가운데 | 마지막 일격에 별과 같이 퍼짐 | `ring_file` · fx `final_ring.*` |
| 먼지 `dust.png` | 256 · 가운데 | 파괴 때 퍼지며 사라짐 | `dust_file` · fx `destroy_dust.*` |
| 파편 `debris_<이름>.png` × 6 · 공용 `debris.png` | 폭 256 · 가운데 · 건물당 큰 조각 하나 | 잔해 조각 (일개미가 주워 감) · M3-D 큰 조각 — 회전 · 크기 · 좌우 뒤집기로 반복 | `building_art.debris_file` (빈칸 = 공용) · fx `debris_img.*` |

**건물 8행 ↔ 그림 6장** (H-42 Q1 — 그림 높이 순 · 7 · 8 = 같은 그림 + 색 바꿈 `tint`)
| stage | building_id | 이름 (= 그림) | art_id | 그림 높이 (폭 360일 때) |
|---|---|---|---|---|
| 1 | bld_hut | 주택 | house | 341px |
| 2 | bld_house | 빵집 | bakery | 351 |
| 3 | bld_villa | 장난감 공장 | factory | 352 |
| 4 | bld_shop | 사무실 | office | 366 |
| 5 | bld_school | 아파트 | apartment | 368 |
| 6 | bld_apt | 시청 | townhall | 387 |
| 7 | bld_hospital | 사무실 (밤) | office_b (`#b8c4ff` [가정]) | 366 |
| 8 | bld_tower | 시청 (노을) | townhall_b (`#ffc8a8` [가정]) | 387 |

**재는 법** — `npm run art:pivots`
- 건물: `pivot_y` = 마지막 불투명 행 아래 ÷ 높이
- 띠: `strip_ground_ratio` = 위에서 처음으로 폭 95% 이상 불투명한 줄 (75/312 = 0.24) · `strip_burrow_x` = 풀선 아래 어두운 덩어리 가운데 (1219 ~ 1335px → 0.887)
- 7 · 8 색 (`tint`)과 fx 키 값은 [가정] — C PR 화면 컷 · 폰 확인 뒤 맞춤

**폴백**
- 건물 그림 없음 · `art_id` 빈칸 → 그 건물만 도형
- 하늘 · 띠 없음 → 각각 도형
- 링 · 먼지 없음 → 그 연출 없음
- 파편: 건물별 없음 → 공용 → 그것도 없으면 도형 조각
- `env_enabled` FALSE · [ART] 끔 → 도형 화면 (M6 C부터 기본 = 켬)
