# 와르르 개미 (crumble-ant)

> 팔 4개 개미가 하늘에서 떨어지는 건물을 점프해서 와르르 부수는 방치형 게임.

지금 저장소는 **웹 프로토타입** 단계입니다 — 코어 루프(건물 낙하 → 자동 점프 → 팔 4슬롯 타격 → 파괴 / 착지 피격)를 확인한 뒤 Unity 본 개발로 넘어갑니다.

## 실행 방법

필요: Node.js 22 이상

```bash
npm install
```

```bash
npm run dev
```

브라우저에서 http://localhost:5173 을 엽니다. 세로 9:19.5 프레임이라 폰이나 브라우저 개발자 도구의 모바일 화면으로 보면 가장 정확합니다.

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm test` | 단위 테스트 |
| `npm run check` | 타입 검사 + 테스트 (PR 전 필수) |
| `npm run build` | 배포 빌드 → `dist/` |

> 실행 코드는 웹 프로토 PR(코어 루프)에서 들어옵니다. 그 PR이 머지되기 전에는 위 명령이 동작하지 않습니다.

## 문서

| 문서 | 내용 |
|---|---|
| [`docs/spec.md`](docs/spec.md) | 기획서 사본 (원본 = Artifact, 회차 표기) |
| [`CLAUDE.md`](CLAUDE.md) | 역할 분담 · 작업 규칙 · 반복 실수 |
| [`docs/lessons.md`](docs/lessons.md) | 반복 실수 기록 (DD 관리) |
