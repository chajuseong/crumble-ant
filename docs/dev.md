# 와르르 개미 — 개발 기준 문서 (단일 기준)

> 문서 버전: v0.1 (2026-11-04) — 뼈대 (M0 저장소 세팅). 마일스톤 요청서가 올 때마다 채운다

## 0. 개발 규칙
- `CLAUDE.md` "반드시 지킬 규칙" · "Unity 이식 원칙" 그대로
- 기획 정본 = 기획서 Artifact (지금 v0.3 — https://claude.ai/artifact/7mVinfNzvJsdpBkU972TxZ). 이 문서는 기획서를 **구현 기준**으로 옮긴 것

## 1. 범위
- 지금 범위: M0 저장소 세팅 — 빈 뼈대만 (게임 코드 없음)
- 다음: 첫 마일스톤 요청서 (기획서 §3 코어 루프 · §4 전투 규칙 · §6 레이아웃 · §7 운반 연출)
- 범위 밖 (보류): 요청서가 정할 때까지

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
| 파일 · 시트 | Column명 | 데이터 타입 | 설명 | 예시 데이터 |
|---|---|---|---|---|
| `config.xlsx` › game_config (키-값) | key / type / value | string / 타입 이름 / 값 | 게임 수치. 점(.) 키는 묶음 → `src/data/game_config.json` | `battle.jump_height` / `float` / (요청서에서) |
| `ui_strings.xlsx` › ui_strings (키-값) | key / type / value | string / `string` / string | 화면 문구 → `src/data/ui_strings.json` | `hud.stage` / `string` / (요청서에서) |

- 지금 두 시트 모두 비어 있음 (JSON = `{}`)
- 건물 · 스테이지 표 시트는 첫 요청서에서 (기획서 §9 "건물 정보" — 체력 · 낙하 속도 · 무게)

## 4. core → view 이벤트 목록 (이식 계약 — 새 이벤트는 여기 한 줄)
| 이벤트 | 인자 | 언제 |
|---|---|---|

## 5. 연출 목록 (새 연출은 여기 한 줄)
| 이름 | 트리거 이벤트 | 시간 | 느낌 | 데이터 키 |
|---|---|---|---|---|

## 6. 디버그 패널
| # | 기능 |
|---|---|

## 7. 마일스톤 · 완료 조건
| M | 이름 | 완료 조건 | 머지 커밋 (완료 기록) |
|---|---|---|---|
| M0 | 저장소 세팅 | 세로 720×1280 빈 장면 · `npm test` · `build` · `smoke` ✅ · `data` · `data:check` ✅ · CI ✅ | |
