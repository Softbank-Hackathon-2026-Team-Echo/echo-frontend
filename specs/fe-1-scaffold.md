# 프론트 1: 골격 (스택 · 토큰 · API 계층 · 목업 · 앱 껍데기) SPEC

- 상태: Done (feat/scaffold)
- 작성일: 2026-11-02 · 김도영
- GitHub 이슈: (GitHub Projects 이슈 링크)
- 노션 태스크: (노션 태스크 링크)
- 저장소: `echo-frontend` · 브랜치 `feat/scaffold` — 규칙 문서(`docs/agent-rules`)를 합친 `main`에서 만든다. 단계마다 커밋한다.
- 원본: 김도영의 첫 작업 지시서(`claude-code-prompt.md`, 11/2)를 이 레포 규칙 문서와 맞춰 옮겼다. 다른 점은 §7.

## 1. 목표

EchoPort 웹 프론트의 골격을 만든다. 이 작업이 끝나면:

- 목업 모드(`VITE_USE_MOCKS=true`)로 로그인 화면 → 조직 첫 화면 → 설정의 환경 표까지 브라우저에서 돌아간다.
- 실서버 모드로 바꾸면 화면 코드를 고치지 않고 echo-was(`/me`, 환경 목록)에 붙는다.
- 이후 화면(S01·SVC·E01·M01·SEC·AUD)은 이 골격 위에 페이지 폴더 하나씩 더하면 된다.

배경: EchoPort는 AWS·GCP·온프레 사이에서 서비스를 무중단으로 옮기는 멀티 클라우드 관리 플랫폼이다(SoftBank Hackathon 2026 본선, 주제 "Beyond Lock-In"). 백엔드는 echo-was(FastAPI), 배포는 Cloudflare Pages(`https://app.echoport.uk`, API `https://api.echoport.uk`).

## 2. 범위

### 포함
- Vite + React + TypeScript strict 프로젝트, 도구(Biome·Vitest), 스크립트
- 디자인 토큰 → Tailwind 테마 연결, 테마 3개 전환
- API 계층(fetch 래퍼·오류·쿼리 기본값·쿼리 키·타입 생성)
- MSW 목업 2개(`/me`, 환경 목록)
- 라우팅: `/login`, `/`, `/o/:slug/*` 앱 껍데기, 환경 표, 404
- 역할 표시(`useRole`, `RoleButton`)
- Cloudflare Pages 준비(README)
- 테스트: fetch 래퍼, 로그인 오류 문구

### 제외
- S01 대시보드·서비스·대피·이전·보안·감사 화면 내용(메뉴와 빈 페이지만)
- 실시간(SSE) 연결 — 계약 3장이 서버에 생긴 뒤
- 환경 등록·수정·삭제 폼, 멤버 탭
- 실제 Cloudflare 연결·도메인 설정(사람이 한다)

## 3. 할 일 (순서대로, 단계마다 커밋)

### 3.1 스택 — `chore: 프로젝트 골격과 도구 설정`
- pnpm, Node 22(`.nvmrc`, `package.json`의 `engines`·`packageManager`).
- Vite + React + TypeScript(`strict`, `noUncheckedIndexedAccess`), 경로 별칭 `@/` = `src/`.
- 의존성: `react-router`, `@tanstack/react-query`(+ `@tanstack/react-query-devtools`, 개발 모드만), `tailwindcss` v4(`@tailwindcss/vite`), shadcn/ui, `lucide-react`, `msw`, `openapi-fetch`, `openapi-typescript`(dev), `@fontsource-variable/inter`, `@fontsource-variable/geist-mono`.
- shadcn/ui 컴포넌트: button, input, card, badge, dialog, sheet, tabs, table, dropdown-menu, tooltip, sonner, skeleton, avatar, separator. `components.json`의 CSS 경로는 `src/styles/index.css`(design-tokens §1).
- Biome(`biome.json`), Vitest + Testing Library + jsdom(`src/test/setup.ts`).
- 스크립트: `dev` · `build`(`tsc -b && vite build`) · `test`(`vitest run --passWithNoTests`) · `lint`(`biome check .`) · `typecheck`(`tsc -b --noEmit` 또는 `tsc --noEmit -p tsconfig.app.json`) · `gen:api`.
- `.env.example`: `VITE_API_BASE_URL=http://localhost:8000`, `VITE_USE_MOCKS=true`.

### 3.2 CLAUDE.md 맞추기 — `docs: CLAUDE.md 구조를 골격에 맞춤`
- CLAUDE.md·규칙 문서는 이미 있다. 실제 폴더·명령이 CLAUDE.md "구조"·"도구"와 다르면 고친다.

### 3.3 디자인 토큰 — `feat: 디자인 토큰을 Tailwind 테마에 연결`
- `src/styles/index.css`: `tokens.css` → `shadcn-theme.css` → `tailwindcss` 순서로 불러오고, `@theme inline`에 [design-tokens.md](../.claude/rules/design-tokens.md) §3 표 전부를 연결한다.
  - 색: `canvas`·`surface`·`raised`·`subtle`·`inverse`·`overlay`, `fg*`, `line*`, `brand*`, `focus`, `success|warning|danger|migrating|ai-{fg,bg,solid}`, `aws`·`gcp`·`onprem`, `chart-1~6`, `globe-*`
  - 간격(Tailwind 기본 눈금, `--spacing` = `--ep-space-4`), 레이아웃, 화면 너비(`compact` 1024 · `wide` 1280), 반경, 그림자, 글꼴
  - 글자 스타일 `text-h1 … text-mono`: 크기·행간·굵기·자간을 함께(`--text-h1--line-height` 등)
  - Tailwind 기본 색·글자 크기·반경·그림자·글꼴은 `initial`로 지운다(design-tokens §5)
- shadcn 컴포넌트의 `text-sm` 등 기본 글자 크기·`bg-black`·`text-white`를 토큰 클래스로 바꾸고, 버튼·입력칸을 32px로 낮춘다
- `@custom-variant dark`를 `[data-theme=dark]` 기준으로.
- `useTheme()`: `light | dark | projector`, `<html data-theme>` 변경, `localStorage` 읽기·쓰기는 try/catch.
- 개발용 확인 페이지 `/dev/tokens`(개발 모드만): 색·글자 스타일·간격을 한눈에 보고 테마를 바꿔 본다.

### 3.4 API 계층 — `feat: API 클라이언트와 쿼리 기본값`
[frontend-conventions.md](../.claude/rules/frontend-conventions.md) §4·§5대로 `src/lib/api/`에 만든다.
- `client.ts`: fetch 래퍼(`credentials: 'include'`, 봉투 풀기, `ApiError` throw, `X-Request-ID`, 401 → `/login?next=현재경로`). openapi-fetch 는 `schema.d.ts`가 생긴 뒤에 더한다(CLAUDE.md 결정 기록).
- `errors.ts`: `ApiError`, 상태 코드별 공통 처리, 로그인 실패 코드 문구(계약 1-3장, 영어 화면 문구로).
- `query-client.ts`: `staleTime` 10초, 4xx 재시도 없음.
- `query-keys.ts`: `me`, `environments(orgId)`, `environment(orgId, id)`.
- `gen:api`: `openapi-typescript ${OPENAPI_URL:-./openapi.json} -o src/lib/api/schema.d.ts`. echo-was OpenAPI를 아직 못 받으면 `/me`·환경 타입을 계약 모양대로 손으로 쓰고 TODO를 단다.
- `me.ts`·`environments.ts`: `useMe()`, `useCurrentOrg()`(slug → org), `useEnvironments(orgId)`.

### 3.5 MSW — `feat: MSW 목업 추가`
- `VITE_USE_MOCKS=true`일 때만 `main.tsx`가 `src/mocks/browser.ts`를 동적 import해 워커를 켠다. `public/mockServiceWorker.js` 포함.
- `GET /api/v1/me`: 개인 조직 `echoport`(personal, ADMIN) + 데모 조직 `echo-demo`(DEVELOPER).
- `GET /api/v1/orgs/:orgId/environments`: `aws-tokyo-prod`(CONNECTED) · `gcp-seoul-standby`(CONNECTED) · `onprem-fukuoka`(UNCHECKED). `clusterInfo.simulated: true`. 응답은 `Page` 봉투 `{items, total, page, size}`.
- 모양은 echo-was `docs/api/auth.md`·`environments.md`와 계약 문서를 따른다. 모든 파일에 `// MOCK:`.
- 목업 모드면 상단 바에 `Mock data` 배지.

### 3.6 라우팅·화면 — `feat: 로그인과 앱 껍데기`
- `/login`: 가운데 카드 — 로고, "Sign in to EchoPort", "Continue with GitHub"(→ `${VITE_API_BASE_URL}/api/v1/auth/github/login?next=…`로 **페이지 이동**), 안내 문구. `?error=` 코드 5개별 문구(OAUTH_DENIED · OAUTH_STATE_MISMATCH · GITHUB_UNAVAILABLE · LOGIN_NOT_ALLOWED · LOGIN_NOT_CONFIGURED), 모르는 코드는 일반 문구.
- `/`: `/me`를 불러 첫 조직(`personal` 먼저)의 `/o/:slug`로 이동. 조직이 없으면 빈 상태.
- `/o/:slug/*` 앱 껍데기(AppShell):
  - 왼쪽 사이드바 `w-sidebar`(220px), `compact` 미만은 `w-sidebar-collapsed`(64px, 아이콘 + 툴팁). 메뉴 Dashboard · Services · Evacuation · Migrations · Security · Audit log · Settings([ui-terms.md](../.claude/rules/ui-terms.md) §3 경로). 아래에 사용자(아바타 + GitHub 아이디 + 역할).
  - 상단 바 `h-topbar`(48px): 브레드크럼, 조직 선택 드롭다운(`/me`의 organizations, 고르면 같은 하위 경로로 이동), "Simulate disaster" 버튼(지금은 비활성 + 툴팁 "Coming soon"), 알림 아이콘, 테마 전환, 로그아웃(`POST /api/v1/auth/logout` 뒤 `/login`).
  - 각 메뉴는 제목만 있는 빈 페이지.
  - slug에 맞는 조직이 없으면 빈 상태 + "Back to organizations".
- `/o/:slug/settings/environments`: 환경 표(이름 · 종류/위치 · 클러스터 · 접속 상태 배지, `simulated` 회색 배지). 로딩은 Skeleton 5줄, 빈 목록은 EmptyState.
- 404 페이지.

### 3.7 역할 표시 — `feat: 역할에 따른 버튼 비활성`
- `useRole()`: `/me`의 현재 조직 `role`. `hasRole(role, min)`.
- `RoleButton`: `requires="DEVELOPER" | "ADMIN"`. 권한이 없으면 비활성 + 툴팁 "Requires Developer" / "Requires Admin". 숨기지 않는다.

### 3.8 Cloudflare Pages 준비 — `docs: Cloudflare Pages 배포 설정 정리`
- `pnpm build` → `dist`. SPA라 `404.html`을 만들지 않는다(Pages가 없는 경로에 `index.html`을 준다).
- README에 Pages 설정값: Framework preset React (Vite), Build command `pnpm build`, Output `dist`, 환경변수 `NODE_VERSION=22`, `VITE_API_BASE_URL`(Production `https://api.echoport.uk`), Preview에만 `VITE_USE_MOCKS=true`.
- README에 시작하기(`pnpm install`, `.env.local`, `pnpm dev`)와 자주 쓰는 명령.

### 3.9 확인 — `test: API 클라이언트와 로그인 오류 문구 테스트`
- 테스트: fetch 래퍼(봉투 풀기 · 실패 봉투 → `ApiError` 칸 · `X-Request-ID` · 봉투 아닌 응답 · 401 이동), 로그인 화면 오류 문구(코드 5개 + 모르는 코드).
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` 통과.
- `pnpm dev`(목업 모드)로 `/login`·앱 껍데기·환경 표를 라이트·다크·projector, 1024px 미만에서 확인.
- 끝나면 `write-pr` 스킬로 `docs/PR.md`를 쓴다. GitHub PR은 만들지 않는다.

## 4. 완료 기준

| # | 기준 | 확인 방법 |
|---|---|---|
| AC1 | 네 명령(`lint`·`typecheck`·`test`·`build`)이 통과한다 | 명령 출력 |
| AC2 | 목업 모드에서 `/` → `/o/echoport` → Settings › Environments로 환경 3개가 배지와 함께 보인다 | 브라우저 |
| AC3 | `/login?error=OAUTH_DENIED` 등 5개 코드가 각각의 문구를 보여 준다 | 테스트 + 브라우저 |
| AC4 | API가 401을 주면 `/login?next=<원래 경로>`로 간다 | 테스트 |
| AC5 | 색·간격·글자에 hex·임의 값·기본 팔레트가 없다 | `grep -rnE "#[0-9a-fA-F]{3,8}\b\|\[[0-9]+px\]" src --include=*.tsx` 결과가 비어 있음(`styles/`·`components/ui/` 제외) |
| AC6 | 테마 3개 전환이 새로고침 뒤에도 유지되고, 저장소가 막혀도 라이트로 뜬다 | 브라우저 |
| AC7 | 1024px 미만에서 사이드바가 64px 아이콘만 남는다 | 브라우저 |
| AC8 | 운영 빌드(`VITE_USE_MOCKS` 없음)에 MSW 코드가 들어가지 않는다 | `grep -r "msw" dist` 결과 없음 |

## 5. 끝나고 보고할 것

- 만든 것, 남은 것(제외 범위·TODO), 사람이 해야 할 일(Cloudflare Pages 프로젝트 연결·환경변수, `app.echoport.uk` 도메인, echo-was CORS 허용 Origin·쿠키 도메인 확인)을 짧게.

## 6. 열린 질문

1. echo-was OpenAPI 주소(`OPENAPI_URL`)를 어디서 받는가 — 배포된 `https://api.echoport.uk/openapi.json`이 열려 있는가, 개발 중에는 로컬 echo-was를 띄우는가
2. ~~로컬 개발 때 쿠키 세션~~ → 결정(11/2): 프록시 없이 `localhost:5173` → `localhost:8000` 직접 호출. 5173은 echo-was #12로 허용 목록에 요청했다. Safari에서 로컬 쿠키가 안 붙으면 echo-was 로컬 `.env`에 `SESSION_COOKIE_SECURE=false`
3. 경로 이름(`/o/:slug/evacuation` 등)은 가칭 — 노션 IA와 맞출 것

## 7. 원본 지시서와 다른 점

| 원본 | 이 SPEC | 이유 |
|---|---|---|
| 2단계 "CLAUDE.md 작성" | 이미 있는 CLAUDE.md를 골격에 맞추기 | 규칙 문서를 먼저 만들었다(`docs/agent-rules`) |
| Tailwind 색 `text-primary` | `text-fg` | shadcn `primary`(브랜드색)와 이름이 겹친다(CLAUDE.md 결정 기록) |
| 커밋 메시지 예 `feat:`, `chore:` | 같음 + 한국어 설명 | echo-was git 규칙과 같게 |
| (없음) | `/dev/tokens` 확인 페이지, `Mock data` 배지, 테마 전환 버튼 | 토큰 확인 · 목업 표시 규칙 · 테마 수동 확인용 |
| (없음) | 버튼·입력칸 32px | 노션 IA v2 조밀한 밀도 |
| openapi-fetch 클라이언트 | 생성 타입이 생긴 뒤로 미룸 | OpenAPI 가 아직 열리지 않았다 |
| 환경 표 클러스터 칸 | 행마다 상세 호출 | 목록 응답에 `clusterInfo`가 없다 |
