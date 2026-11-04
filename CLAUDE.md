# 와르르 개미 — 웹 프로토 저장소

방치형 게임 「와르르 개미」의 **재미 검증용 웹 프로토**. 팔 4개 · 다리 2개 개미가 점프해서 위에서 떨어지는 건물을 부순다.
TypeScript + Vite + Phaser 3 + Vitest, 세로 720×1560 (G-03). 출시 코드가 아니며 결과가 좋으면 Unity로 본 개발한다.

## 먼저 읽을 것

| 문서 | 용도 |
|---|---|
| 기획서 원본 (Artifact) | https://claude.ai/artifact/7mVinfNzvJsdpBkU972TxZ — 지금 v0.4. Artifact read로 읽는다 (저장소에 사본 없음) |
| `docs/dev.md` | **개발 기준 문서 (단일 기준)** — 규칙 · 데이터 구조 · 마일스톤 · 완료 조건 |
| `docs/decisions.md` | 맨 위 **★ 지금 상태** (지금 할 일 · 결정 대기 — DD가 실행마다 갱신) · 결정 기록 |
| `docs/dd.md` | **DD(보조디렉터 AI)** 위임 규칙 · 📮 개발 지시함 (이슈 #3) 주고받기 |
| `docs/handoff.md` | 완료 보고서 · 검수 · 수정 요청 · Git 방식 |
| `docs/art.md` | 아트 규격 · 파츠 조립 · 좌표 맞추는 법 (게임은 `art/game/`만 읽음) |
| `docs/lessons.md` | 반복 실수 기록 · 재발 방지 (DD가 직접) |
| `docs/00_index.md` | 전체 문서 목록 · 버전 |

문서와 코드가 다르면 **문서를 따른다**. 문서가 틀렸다고 판단되면 고치지 말고 질문으로 남긴다.
`docs/reference/`는 외부 · 다른 세션 자료 보관함(**정본 아님**) · `docs/reference/plans/` = 결정된 DD 기획안 보관

## 누가 어디를 고치나

| 작업 | 고치는 곳 | 고치지 않는 곳 |
|---|---|---|
| **기개발** (Claude Code — 기획 + 개발) | 아래 기획 · 개발 칸 전부 | `docs/decisions.md` 결정 기록 · `docs/lessons.md` (DD) · `art/` |
| **DD** (Claude Code — 검수 + 기획안) | `docs/decisions.md` · `docs/lessons.md` · PR 검수 댓글 · 지시함 `[DD→개발]` · 위임 범위 머지 · 기획안 (저장소 밖 Claude Docs) | 그 외 문서 · 데이터 · 코드 (자기 기획안을 자기가 검수하지 않게) |
| 기획 작업 | `docs/` · `design/` · `src/data/` (`npm run data`로만) · `tools/` · `CLAUDE.md` · `.github/` | `src/` (data 제외) |
| 개발 작업 | `src/` (data 제외 · 테스트 포함) · `scripts/` · 설정 파일 | `docs/` · `design/` · `src/data/` · `tools/` · `CLAUDE.md` · `.github/` |
| 로컬 (대표 PC — 대표 직접 지시만) | `src/` · `scripts/` · 설정 · `[local]` PR | 문서 · 데이터 |
| **아트** (ChatGPT → 대표 → PR) | `art/` 만 (원본 = `art/production/` · 게임용 = `art/game/`) | 그 외 |

- **자기가 낸 계획 · 질문 · PR은 스스로 승인 · 머지하지 않는다** — 승인 · 머지는 DD 또는 대표
- `src/data/*.json`은 직접 편집 금지 — 원본 `design/tables/*.xlsx` → `npm run data` · 시트와 JSON은 같은 커밋

## 반드시 지킬 규칙

1. 마일스톤은 **하나씩**. 범위 밖 기능은 만들지 않는다
2. `src/core/`에는 **Phaser · DOM · window 참조 금지** (Node에서 테스트, Unity 이식 대상) — `src/tests/core_rules.test.ts`가 검사
3. 수치 · 문구는 **`src/data/*.json`에서 읽는다**. 하드코딩 금지 (예외: 안 바뀌는 그림 모양 상수 · 디버그 라벨)
4. 연출은 **뷰 전용**. 연출 코드가 core 결과를 바꾸면 안 된다
5. 완료 조건은 **직접 확인**하고, 따라 할 수 있는 확인 방법과 함께 보고한다
6. 데이터 수치를 새로 만들지 않는다 — 측정해서 제안만 한다

## Unity 이식 원칙 (잼병 원정대에서 가져옴)
1. 규칙 · 판정 · 수치 · 순서 = core만. view는 core 값을 그리기만 — view가 따로 세거나 고르지 않는다
2. 폰 보고 다시 맞출 값 (연출 시간 · 거리 · 세기 · 확률) = 데이터에 이름 붙여. 안 바뀌는 모양 상수만 view 코드 위쪽 한 곳
3. core 결정성 (JS ↔ C# 같은 결과): 정수화 시점 명시 (floor · round) · 정렬은 같은 값이면 id 등 두 번째 기준 · Map · Set · 객체 키 순서에 기대지 않음 · Date.now · Math.random 금지 (시드 난수만) · 문턱 비교 전 반올림 · localeCompare 정렬 금지
4. core → view 이벤트 = 이식 계약 — 새 이벤트는 `docs/dev.md` 이벤트 목록에 한 줄
5. 새 연출 (CSS 포함) = `docs/dev.md` 연출 목록 표에 한 줄 (이름 · 트리거 · 시간 · 느낌 · 데이터 키)
6. 프로토라서 줄이거나 미룬 결정 = `docs/decisions.md`에 [프로토만] 표시
7. 아트 원본 (PSD · 큰 PNG · SVG) = `art/production` 보관

## 반복 실수 — 하지 않는 것 (상세 `docs/lessons.md` · 출처: 잼병 원정대 L-01 ~ L-12)
1. 같은 일을 두 창이 하지 않는다 — 지시함 처리 = 기개발만 · 결정 기록 · 결정 ID = DD만 · 지시함은 이슈 #3 하나
2. 승인 · 결정 전에 **같은 대상의 이전 결정을 검색** — 부딪히면 이전 결정을 따르고 묻는다
3. 문구를 바꿀 때 **앞뒤 문장 · 같은 뜻을 쓰는 다른 곳까지** 함께 고친다
4. 화면 확인은 **실제 플레이 순서**로 한 번은 끝까지
5. 어두운 배경 위 표시는 **받침 · 테두리로 대비**
6. 같은 파일을 고치는 PR이 여럿이면 **머지 순서를 먼저**
7. 변경 파일에 `node_modules` · `dist` · `logs` · `ci-smoke`가 있는 PR은 머지하지 않는다
8. 머지 뒤 `merged: true` · 해시를 다시 확인하고 기록한다

## Git 작업 방식

```
작업 시작 전: git pull
개발: 브랜치 m{번호}-{이름}   기획: plan/{주제}   로컬: local/{주제}   아트: art/{주제}
→ 커밋 · push → main으로 PR → CI ✅ + 검수 → 머지 (완료 기록 = 머지 커밋 해시)
```
- 커밋 머리말: `[M1]` 개발 (마일스톤 번호) · `[docs]` 문서 · `[data]` 데이터 (시트 + JSON 함께) · `[tools]` 도구 · `[art]` 아트
- 문서만 바뀐 PR은 CI가 돌지 않는다 · PR 기준 브랜치만 바꾸면 CI가 안 돎 → main 합쳐 push
- 큰 기능 = **꺼진 채 먼저** (요청서 · 키 꺼짐 → core 결과 그대로 → 화면 → 값 켬)

## 명령어

| 명령 | 용도 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm test` | Vitest 1회 |
| `npm run typecheck` | 타입 검사 |
| `npm run build` | 배포 빌드 → `dist/` |
| `npm run data` | `design/tables/*.xlsx` → `src/data/*.json` + 검증 |
| `npm run data:check` | JSON 검증만 |
| `npm run smoke` | 배포 빌드 화면 확인 (먼저 `npm run build`. 로컬에 Chrome이 없으면 `SMOKE_CHROME=<브라우저 경로>`) |

## DD 체계 (상세 `docs/dd.md`)

```
대표 ──"DD 돌려"──→ DD: 위임 범위는 처리, 나머지는 "대표 결정 대기"로 보고
DD ──[DD→개발]──→ 📮 개발 지시함 (이슈 #3) ←──[개발→DD]── 기개발
대표 ──"진행해"──→ 기개발: 지시함에서 처리 안 한 지시 처리
```
- **기개발이 "진행해"를 받으면**: `git pull` → 이 파일 → `docs/decisions.md` ★ → 이슈 #3에서 답 없는 `[DD→개발]`을 오래된 것부터 → 결과 · PR 번호를 `[개발→DD]` 댓글로. `[계획 먼저]`는 DD 승인 전 구현 안 함 · `[바로 PR]`은 계획 없이 PR
- **DD 추천대로**: "DD 돌려"에서 대표가 고르지 않은 추천 = 추천대로 (기록 · 보고에 "추천대로 정한 것") — 아트 · `[local]` 머지 · 되돌릴 수 없는 일은 대표 지시만

## 대표에게 알리는 방식
- 응답은 한국어. 대표 행동이 필요하면 끝에 **"▶ 디렉터가 할 일"** — 번호 · 종류 (`[Merge 결정]` `[결정]` `[기개발에 전달]` `[확인]`) · 붙여넣을 문구는 **코드 블록** · 대표가 하는 말은 "DD 돌려" · "진행해" · "PR #N 머지해" 위주로 짧게
- DD로 실행했으면 끝에 **DD 보고** (처리한 것 · 추천대로 정한 것 · 다음 · 대표 결정 대기)
- 확인 양식의 괄호에는 추천과 선택지를 글로 채움 (예: `(좋음 / 무거움 / 가벼움)`)

## 지금 (요약 — 정본 `docs/decisions.md` ★)
- 완료: M0 저장소 세팅 (`d57359f`) · M1 코어 루프 (`ff3175d`) · M2 타격감 (`d563925`) · M3 B 파츠 조립 (`d127828`)
- 진행: CA-001 (PR #22) → M3 아트 좌표 (PR #23) → **M3-C 공격 · 점프 모션** (계획) → **M4 강화** A `plan/m4-upgrades-data` · B `m4-upgrades`
