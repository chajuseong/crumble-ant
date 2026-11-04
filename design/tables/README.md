# 데이터 원본 시트 (`design/tables/`)

와르르 개미 프로토의 **수치 · 문구 원본**입니다. `src/data/*.json`은 직접 고치지 말고, 여기 시트를 고친 뒤 변환합니다.

## 작업 순서

1. 시트 수정 → 저장 (.xlsx 그대로)
2. `npm run data` — 이 폴더의 **모든 .xlsx** → `src/data/*.json` + 검증
3. 오류가 나오면 시트를 고쳐 다시 실행 / 통과하면 `npm test`
4. 시트(`design/tables/*.xlsx`)와 만들어진 JSON(`src/data/*.json`)은 **같은 커밋** (`[data]`) — CI가 둘이 다르면 실패시킴

## 파일 ↔ 시트 ↔ JSON

| 파일 | 내용 | 시트 | → JSON |
|---|---|---|---|
| `buildings.xlsx` | 건물 표 | buildings | `src/data/buildings.json` |
| `stages.xlsx` | 스테이지 표 (building_id → buildings) | stages | `src/data/stages.json` |
| `config.xlsx` | 게임 수치 (키-값) | game_config | `src/data/game_config.json` |
| `ui_strings.xlsx` | 화면 문구 (키-값) | ui_strings | `src/data/ui_strings.json` |
| `fx.xlsx` | 타격 연출 수치 (키-값 · M2) | fx_config | `src/data/fx_config.json` |

- 키 · 타입 · 설명은 `docs/dev.md` §3. 값은 M1 기준 PR #2 임시값 (밸런싱 아님)
- `stages.building_id`는 `buildings.building_id`를 가리킴 — 없는 ID면 `npm run data`가 실패
- 파일마다 맨 앞에 `README` 시트 (변환 제외)
- 새 시트는 `tools/build_data.mjs`의 `SHEETS`에 한 줄 + `tools/validate_data.mjs`에 검사 — 목록에 없는 시트가 있으면 `npm run data`가 실패함
- **시트 이름은 폴더 전체에서 하나** — 두 파일에 같은 이름이 있으면 실패

## 시트 규칙

- **키-값 시트** (game_config · ui_strings): 1행 머리글 `key` / `type` / `value` (/ `#설명`), 2행부터 데이터. 점(.)이 들어간 key는 묶음 (예: `battle.jump_height` → `{ "battle": { "jump_height": … } }`)
- **표 시트** (나중에 건물 · 스테이지 등): 1행 = 컬럼 키(영문), 2행 = 타입, 3행 = 설명, 데이터는 4행부터
- **타입**: `int` · `float` · `bool`(TRUE/FALSE) · `string` · `int[]`(쉼표 `1,2,4`) · `float[]` · `string[]`(`|` 구분). 끝에 `?` = 비워둘 수 있음 (비우면 null)
- `#`으로 시작하는 열 = 메모 (변환 제외) · A열 값이 `#`으로 시작하는 행 = 주석 행 · `_`로 시작하는 시트 = 작업용 (변환 제외)
- 키 이름: 영문 소문자 · 숫자 · `_` (점 묶음의 각 조각마다) — `npm run data:check`가 검사
