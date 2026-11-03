# 프론트 성능 측정

React Compiler · 화면 밖 작업 멈추기 · 화면 미리 받기 같은 최적화의 전후를 같은 방법으로 비교하려고 둔다(#45).
값을 바꾸는 PR 은 이 문서의 표에 새 줄을 더한다(지우지 않는다).

## 1. 무엇을 어떻게 재나

| 지표 | 도구 | 어디서 보나 |
|---|---|---|
| LCP · INP · CLS (실사용자) | Sentry 브라우저 추적, 표본 20%. 화면 이름은 경로 패턴(`/o/:slug/migrations/:id`)으로 묶는다(`lib/route-pattern.ts`) | Sentry → Insights → Web Vitals(또는 Performance), 화면(transaction)별 |
| 느린 클릭 원인 | Sentry 긴 애니메이션 프레임(`enableLongAnimationFrame`) | 같은 화면의 span 목록 |
| 다시 불러오기 1번에 다시 그리는 칸 | `src/pages/dashboard/DashboardPage.renders.test.tsx` (React `Profiler` + 칸별 호출 수) | `pnpm exec vitest run src/pages/dashboard/DashboardPage.renders.test.tsx --silent=false` 출력 |
| 번들 크기(gzip) | `node scripts/check-bundle.mjs` (CI 예산) | CI 로그 · 로컬 빌드 뒤 |

- 렌더 측정은 jsdom 에서 데모 구성(환경 3 · 서비스 2, 같은 응답)으로 조직 쿼리를 전부 다시 불러온다. 대시보드는 실시간 채널 전까지 폴링으로 갱신되므로 "같은 응답인데 다시 그리는 칸"이 줄어야 한다. 렌더 ms 는 jsdom 값이라 비교용으로만 쓴다.
- 토폴로지(React Flow + elk 워커)는 jsdom 에서 그릴 수 없어 호출 수만 센다.
- 운영 Web Vitals 는 데이터가 적다(11/3 기준 환경 1 · 서비스 0). 데모 앱이 세 환경에 올라오면 이전 실행 화면까지 다시 잰다.

## 2. 기준선 (11/3, 최적화 전)

### 다시 불러오기 1번(같은 응답)

| 측정 | 값 |
|---|---|
| 대시보드 커밋 | 1 |
| Topology | 1 |
| KpiTiles | 1 |
| LiveEvents | 1 |
| EnvironmentsPanel | 2 (넓은 화면 칸 + 반분할 상황 칸) |
| StatusPill | 1 |

응답이 같아도 모든 칸이 한 번씩 다시 그려진다. 칸 컴포넌트는 `memo` 가 없고 대시보드가 매번 새 `Map` · 객체를 만들어 넘긴다.

### 번들 (gzip)

| 청크 | 크기 | 예산 |
|---|---|---|
| 첫 화면 `index` | 118.6KB | 150KB |
| 대시보드 화면 | 64.2KB | 120KB |
| elk 워커 | 432.8KB | 450KB |
| Sentry SDK · 리플레이(DSN 있을 때, 첫 화면 뒤) | 34KB · 39KB | 120KB |

### 운영 Web Vitals

수집 시작 11/3(#41 · #45). 값은 Sentry 에서 화면별로 확인하고, 데모 앱으로 이전을 돌린 뒤 이 표에 적는다.

| 화면 | LCP | INP | CLS | 표본 |
|---|---|---|---|---|
| `/o/:slug` | — | — | — | — |
| `/o/:slug/migrations/:id` | — | — | — | — |

## 3. 변경 기록

| 날짜 | 변경 | PR | 결과 |
|---|---|---|---|
| 11/3 | 기준선 | #45 | 위 2절 |
| 11/3 | `/assets/*` 캐시 4시간 + 재검증 → 1년 immutable (#42) | #47 | 운영 확인: `max-age=14400, must-revalidate` → `max-age=31536000, immutable`. 재방문 때 4시간이 지나도 빌드 파일 재검증 요청(304)이 없다 |
| 11/3 | 메뉴 마우스 올림 · 포커스 · 터치 때 화면 청크 미리 받기 (#43) | #48 | 운영 확인: Services 메뉴에 마우스만 올려도(이동 전) `ServicesPage` 청크를 받음, 올리기 전 0건. 첫 화면 +0.1KB |
| 11/3 | 지구본 화면 밖이면 그리기 멈춤 · 토폴로지는 화면에 들어올 때 만듦 (#44) | #49 | 바꾸기 전: 소개 화면을 내려 지구본이 화면 밖이어도 2초에 240번 다시 그림(120Hz 화면). 바꾼 뒤 값은 미리보기에서 잰다 |
