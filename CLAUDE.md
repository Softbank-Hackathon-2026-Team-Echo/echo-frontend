# Echo Web (echo-frontend)

Team Echo 멀티 클라우드 관리 플랫폼 **EchoPort**의 웹 프론트다. AWS·GCP·온프레 클러스터를 환경으로 등록하고, 서비스를 배포하고, 재난이 나면 다른 환경으로 무중단 이전하는 과정을 한 화면에서 보여 주고 조작한다. 지금은 규칙 문서와 디자인 토큰, API 계약만 있다. 골격은 [specs/fe-1-scaffold.md](specs/fe-1-scaffold.md)에서 만든다.

- **스택**: Vite, React, TypeScript(strict), react-router, TanStack Query, Tailwind CSS v4, shadcn/ui, lucide-react, openapi-typescript + openapi-fetch, Biome, Vitest + Testing Library(+ MSW 는 테스트의 HTTP 가로채기만). Node 22, pnpm
- **백엔드**: echo-was(FastAPI). 이미 있는 API의 원본은 echo-was `docs/api/*.md`이고, 화면 → API 연결표와 새 API 요청 초안은 [docs/api-contract.md](docs/api-contract.md)에 둔다
- **배포**: Cloudflare Pages. 운영 주소 `https://app.echoport.uk`, API `https://api.echoport.uk`
- **원장**: 본선 필수 기능 정리 `final_features_v6.md`(F1~F17). 기능 번호는 이 원장을 따른다. 화면 ID(L00·S01·E01-1 …)는 노션 「화면 목록 (프론트 IA)」과 Figma 「Wire Frame」 페이지를 따른다
- **담당**: 김도영(`kimdoyoung1110`) 1명. 할 일은 GitHub Projects의 이슈로 관리한다

---

## 규칙 문서 (반드시 따른다)

작업 전 아래 문서를 우선한다. **충돌 시 우선순위: API 계약·용어 > 디자인 토큰 > 코드 규칙 > 일반 관례.**

| 문서 | 언제 본다 |
|---|---|
| [docs/api-contract.md](docs/api-contract.md) | API를 부르거나 응답 모양·오류 처리·실시간 이벤트를 다룰 때. **프론트 쪽 API 계약의 단일 출처** |
| [.claude/rules/ui-terms.md](.claude/rules/ui-terms.md) | 화면 문구·타입 이름·상태 배지를 정할 때. 도메인 용어의 원본은 echo-was 용어 사전이고, 이 문서는 프론트에서 쓰는 이름과 화면 표기만 다룬다 |
| [.claude/rules/design-tokens.md](.claude/rules/design-tokens.md) | 색·간격·글자·반경·그림자를 쓸 때. Tailwind 클래스와 `--ep-*` 토큰 연결표, 테마 3개 |
| [.claude/rules/frontend-conventions.md](.claude/rules/frontend-conventions.md) | 컴포넌트·폴더·API 호출·상태·권한·목업·테스트 코드를 작성할 때 |
| [.claude/rules/git-conventions.md](.claude/rules/git-conventions.md) | 커밋 메시지·브랜치명을 정할 때. echo-was와 같은 규칙 |

## 설계 문서

| 문서 | 언제 본다 |
|---|---|
| [specs/](specs/) | 태스크마다 명세 하나(`fe-{번호}-{설명}.md`). 구현 전에 읽고, 구현이 달라지면 같은 PR에서 고친다 |
| [src/styles/tokens.css](src/styles/tokens.css) | Figma 변수에서 뽑은 디자인 토큰. **손으로 고치지 않는다**(Figma에서 다시 뽑는다) |
| [src/styles/shadcn-theme.css](src/styles/shadcn-theme.css) | shadcn/ui 변수 이름 → `--ep-*` 토큰 연결 |

---

## 구조

실제와 달라지면 `write-pr` 스킬이 이 절을 맞춘다.

```text
src/
├─ main.tsx              # 진입점. 테마 적용 → 예전 목업 서비스 워커가 남았으면 지움 → 렌더
├─ App.tsx               # QueryClient · Tooltip · Toaster · Router 공급자
├─ router.tsx            # 라우트 표 (/login, /, /o/:slug/*, /dev/tokens(개발만), 404). 메뉴 경로는 ui-terms §3
├─ styles/               # tokens.css → shadcn-theme.css → index.css(Tailwind @theme 연결) 순서
├─ components/
│  ├─ ui/                # shadcn/ui 생성 파일. 토큰 글자 스타일·32px 밀도로 고쳤다
│  ├─ disaster/          # 재난 시뮬레이션 다이얼로그(S01-D) · 지도(DisasterMap, d3-geo + world-atlas 50m 지연 로드)
│  └─ *.tsx              # 두 화면 이상에서 쓰는 앱 컴포넌트 (Panel, RoleButton, StatusBadge, SimulatedBadge, ProviderLabel, FormField, ConfirmDeleteDialog, ExternalLink, EmptyState, ErrorState, ScreenErrorBoundary, Logo …)
├─ layouts/AppShell.tsx  # 사이드바(워드마크 · Operate/Resilience/Govern 묶음 · 사용자 메뉴=테마·로그아웃) + 상단 바(브레드크럼 · Org 선택 · Simulate disaster · 알림)
├─ pages/                # 화면 단위 폴더 (login/, root/, dashboard/, services/, evacuation/, migrations/, settings/, dev/). 한 화면에서만 쓰는 컴포넌트는 그 폴더 안에
├─ hooks/                # useTheme(테마 3개, localStorage), useRole(현재 조직 역할), useNow(경과 시간)
├─ lib/
│  ├─ api/               # client(api = openapi-fetch + unwrap, 스키마 밖 경로는 apiFetch) · errors · notify · form-errors(422 → 칸 오류)
│  │                     #   query-client · query-keys · schema.d.ts(gen:api 생성) · types(스키마 별칭)
│  │                     #   me · environments · services(서비스·배포 요청) · disasters(🆕 API 전까지 브라우저 시뮬레이션) · auth
│  │                     #   events(실시간 채널 → 쿼리 무효화) · evacuation(🆕 대피 후보 규칙 점수, API 전까지 브라우저 계산)
│  ├─ roles.ts           # hasRole · 역할 표기
│  ├─ status.ts          # 서버 상태 값 → 화면 문구·색 (StatusBadge 와 짝)
│  ├─ geo.ts             # 리전·도시 → 좌표(계약 4-1 🆕 전까지), 거리 계산
│  ├─ format.ts          # 상대 시각·경과 시간
│  └─ utils.ts           # cn() (커스텀 글자 스타일을 아는 tailwind-merge)
├─ assets/               # 로고 SVG · geo/east-asia-50m.json(재난 지도 해안선, scripts/trim-atlas.mjs 로 만든다)
└─ test/                 # setup(MSW 서버·ResizeObserver) · msw-server · render(renderRoute)
scripts/                # gen-api.mjs(API 타입) · trim-atlas.mjs(지도 데이터)
specs/                   # 태스크 명세
docs/                    # api-contract.md, PR.md(커밋 안 함)
.claude/launch.json      # 브라우저 미리보기용 개발 서버 설정
```

- 데이터 흐름은 `pages/` → `lib/api/`의 쿼리 훅 → `api`(openapi-fetch) + `unwrap` → echo-was 한 방향이다. 화면은 `fetch`를 직접 부르지 않는다. API 가 바뀌면 `OPENAPI_URL=https://api.echoport.uk/openapi.json pnpm gen:api` 로 타입을 다시 만든다.
- 서버 상태는 TanStack Query만 가진다. 화면 상태(열린 다이얼로그·선택한 탭)만 컴포넌트 state에 둔다. 전역 상태 라이브러리는 쓰지 않는다.
- 조직은 URL(`/o/{slug}/…`)로 정한다. `orgId`는 `/me`의 `organizations`에서 slug로 찾는다.

---

## 핵심 원칙 (요약)

코드를 쓰기 전 위 문서를 보되, 자주 어기는 핵심만 추린다.

### 하드 규칙
- **비밀값을 커밋하지 않는다.** `.env`, `.env.local`, 토큰, 데모 계정 비밀번호. 커밋했다면 바로 사람에게 알린다(기록에서 지워도 키는 폐기해야 한다).
- **`main`에 직접 push하지 않는다.** 모든 변경은 브랜치 → PR.
- **echo-was 코드를 고치지 않는다.** 화면에 필요한 API·칸이 없으면 [docs/api-contract.md](docs/api-contract.md) 4장에 `(가칭)`으로 적고 echo-was에 이슈를 연다(frontend-conventions §9).
- **검증하지 않은 작업을 완료라고 보고하지 않는다.** 실행한 명령과 실제 결과를 적고, 건너뛴 단계는 건너뛰었다고 적는다.

### 디자인
- 색·간격·글자·반경·그림자는 `--ep-*` 토큰에 연결된 Tailwind 클래스로만 쓴다. hex·rgb 값, `p-[13px]` 같은 임의 값, Tailwind 기본 팔레트(`bg-blue-500`)를 쓰지 않는다.
- 테마는 `<html data-theme>`의 `light`·`dark`·`projector` 3개다. 시연 화면은 `projector`다.
- 토큰에 없는 값이 필요하면 만들지 말고 사람에게 묻는다(Figma 변수부터 추가한다).

### API
- 모든 요청은 `credentials: 'include'`(세션 쿠키). 토큰을 브라우저 저장소에 두지 않는다.
- 응답 봉투 `{success, data}`는 fetch 래퍼 한 곳에서 풀고, 실패는 `ApiError(status, code, message, details, requestId)`로 던진다. `requestId`는 `X-Request-ID` 헤더다.
- 상태 코드별 처리(401 로그인 이동, 403 토스트, 404 빈 상태, 409 다시 불러오기, 422 칸 오류, 502·503 재시도)는 계약 1-2장 표 그대로, 공통 코드 한 곳에서 한다.
- 쿼리 키는 조직부터 시작한다: `['org', orgId, 'environments', …]`. 조직을 바꾸면 그 조직 키만 무효화하면 된다.
- 서버 enum에 모르는 값이 와도 화면이 깨지지 않는다(중립 배지 + 원래 값 표시).
- 실시간 이벤트는 "다시 불러와" 신호로만 쓰고 `invalidateQueries`를 부른다. 값을 싣는 예외는 `migration.metrics`뿐이다. 실시간이 생기기 전에는 배포 진행·이전 실행 화면만 2초 폴링한다.

### 권한·시뮬레이션
- 역할은 VIEWER < DEVELOPER < ADMIN. 권한이 없는 버튼은 **숨기지 않고** 비활성 + 툴팁("Requires Developer")으로 보여 준다. `RoleButton`의 `requires`로만 처리한다.
- 서버가 준 가짜 값(`simulated: true`)은 값 옆에 회색 `simulated` 배지를 단다. 심사 규칙상 가짜 값을 숨기지 않는다.
- 앱에는 목업 응답이 없다(11/3). 화면은 운영 API 만 부른다. API 가 아직 없는 기능(재난·대피 후보)만 `lib/api/` 안에서 브라우저 시뮬레이션으로 만들고, 응답 모양은 계약 문서 그대로, 화면에는 항상 `simulated` 배지를 단다.

### 언어
- **UI 문구는 영어**, 코드 주석과 문서·커밋 설명·PR은 **한국어**(이 문서처럼 한다체). 식별자는 영어.

---

## 도구

- **패키지·실행**: `pnpm`(Node 22, `.nvmrc`). `npm`·`yarn`을 쓰지 않고 lock 파일은 `pnpm-lock.yaml` 하나만 커밋한다.
- **명령**: 개발 서버 `pnpm dev`(5173 고정) / 빌드 `pnpm build` / 린트·포맷 검사 `pnpm lint`(고치기 `pnpm format`) / 타입 `pnpm typecheck` / 테스트 `pnpm test`(한 번 실행, 감시는 `pnpm test:watch`) / API 타입 생성 `pnpm gen:api`(`OPENAPI_URL`, 없으면 로컬 `openapi.json`).
- **환경변수**: `.env.example`을 `.env.local`로 복사한다. `VITE_API_BASE_URL`(API 주소) 하나. 운영 API 는 `https://app.echoport.uk` 출처만 받으므로, 로컬 화면 확인은 echo-was 를 로컬로 띄우거나 운영 배포 뒤 `app.echoport.uk` 에서 한다.
- **품질 게이트**: Claude Code PreToolUse 훅(`.claude/settings.json`)이 `git add`·`git commit` 전에 `pnpm lint`·`pnpm typecheck`·`pnpm test`, `git push` 전에 `pnpm lint`를 돌려 실패하면 막는다(180초 제한). `package.json`이 없으면 건너뛴다.
- **화면 확인**: 화면을 바꿨으면 `pnpm dev`로 띄워 브라우저에서 라이트·다크·projector를 확인한다. 테스트 통과만으로 화면이 맞다고 보고하지 않는다.
- **PR 본문**: `write-pr` 스킬(`.claude/skills/write-pr/`)이 `.github/PULL_REQUEST_TEMPLATE.md` 구조로 `docs/PR.md`(gitignore)를 쓴다. GitHub PR은 사람이 만든다.

---

## 결정 기록

에이전트가 "왜 이렇게 했는지" 찾는 곳이다. 할 일 추적은 GitHub Projects가 하고, 여기는 결정과 이유만 한 줄씩 적는다. 번복은 지우지 않고 ~~취소선~~ 뒤에 새 줄을 쓴다.

| 날짜 | 결정 | 이유 |
|---|---|---|
| 11/2 | 규칙 문서 구조를 echo-was와 같게(`CLAUDE.md` + `.claude/rules/` + 훅 + `write-pr` + `specs/`) | 팀 레포끼리 같은 위치에서 같은 규칙을 찾게 |
| 11/2 | `AGENTS.md`를 두지 않는다 | 프론트는 1명이 Claude Code만 쓴다. 다른 에이전트 도구를 쓰게 되면 echo-was처럼 "CLAUDE.md를 따른다" 안내 파일만 더한다 |
| 11/2 | 예선 `BOARD.md`·작업 로그를 두지 않는다 | 팀 결정과 할 일은 레포별 GitHub Projects가 추적한다 |
| 11/2 | UI 키트는 shadcn/ui + Tailwind v4, 목업은 MSW(11/3 앱 목업 제거) | 예선(일반 CSS·UI 키트 없음·자체 목업)과 달리, 본선은 화면 수가 많고 Figma 토큰이 shadcn 변수로 연결돼 나온다 |
| ~~11/2~~ | ~~Tailwind 간격 클래스 숫자 = px(`p-16` = 16px)~~ → 11/2 번복 | |
| 11/2 | 간격은 Tailwind 기본 눈금(1 = 4px, `--spacing` = `--ep-space-4`)을 쓰고 토큰에 있는 값만 쓴다(`p-4` = 16px, `p-1.5` = 6px) | shadcn 컴포넌트가 기본 눈금(`h-9`, `px-4`)으로 짜여 있어 px 눈금이면 전부 고쳐야 한다. 토큰 간격은 모두 2px 단위라 기본 눈금 0.5 단계로 정확히 맞는다 |
| 11/2 | 컨트롤 높이 32px(버튼 기본 `h-8`, 입력칸 `h-8`). shadcn 기본보다 한 단계 낮춤 | 노션 IA 와이어프레임 v2의 조밀한 밀도(본문 13px · 컨트롤 32px) |
| 11/2 | 로컬 개발은 Vite 프록시 없이 `localhost:5173` → `localhost:8000`을 직접 부른다 | echo-was가 CORS·Origin 허용 목록을 이미 지원하고, 5173은 echo-was #12로 요청했다. 운영(`app` → `api`)과 같은 구조라 CORS 문제를 개발 때 잡는다 |
| 11/2 | 글자색은 `text-fg`·`text-fg-secondary`·`text-fg-muted` | Tailwind v4는 색 이름 하나가 `bg-`·`text-`에 같이 쓰여서, shadcn의 `primary`(브랜드색)와 토큰의 `text-primary`(글자색)가 부딪힌다. shadcn 이름을 그대로 두고 글자색 이름을 바꿨다 |
| 11/2 | 버전: Vite 8 · React 19 · React Router 8 · Tailwind 4 · TypeScript 5.9 | TypeScript 7 은 openapi-typescript 가 아직 받지 않는다(peer `^5`) |
| 11/2 | 권한·준비 안 된 버튼은 `disabled` 대신 `aria-disabled` + 누름 무시 | `disabled` 버튼은 호버·포커스를 받지 못해 "Requires Developer" 툴팁이 뜨지 않는다 |
| 11/2 | 환경 표의 클러스터 칸은 행마다 상세(`GET …/environments/{id}`)를 불러 채운다 | 목록 응답(`EnvironmentSummary`)에 `clusterInfo`가 없다. 환경 수가 적어 데모에 문제없고, 목록 요약 칸은 echo-was에 요청 후보(계약 §2) |
| 11/2 | openapi-fetch 는 `schema.d.ts`가 생긴 뒤 더한다. 그전에는 fetch 래퍼 + 손으로 쓴 타입 | 생성 타입 없이 openapi-fetch 를 쓰면 타입 이점이 없다 |
| 11/2 | 운영 OpenAPI 로 `schema.d.ts`를 만들고 `api` + `unwrap` 으로 부른다. 화면 타입은 `types.ts` 별칭만 쓴다 | 운영 API 가 열렸다. 스키마가 바뀌면 타입 오류로 바로 드러난다 |
| 11/2 | 재난(4-3)·좌표(4-1)는 API 가 생기기 전까지 브라우저 안에서 시뮬레이션한다(`lib/api/disasters.ts`, sessionStorage). 운영에서도 동작하고 항상 `simulated` 배지 | 재난은 원래 시뮬레이션이라 목업이라고 밝히면 심사 규칙에 맞고, MSW 를 끈 운영에서도 시연할 수 있다 |
| 11/2 | 규모 → 반경은 `50·e^(0.9·(M−5.2))` km (M7.2 ≈ 300km), 가칭 | 계약 예시에 맞춘 임시 식. 규모별 반경 근거는 노션 IA 열린 질문 7 |
| ~~11/2~~ | ~~되돌리기 API(API 서버 4) 전까지 배포 이력의 "Redeploy" 는 그 커밋으로 새 배포 요청을 만든다~~ → 11/3 번복 | 같은 결과(예전 커밋으로 새 배포)를 지금 API 로 낼 수 있다. 되돌리기 API 가 생기면 `rollback_of_id` 를 남기는 쪽으로 바꾼다 |
| 11/2 | 환경 카드의 Hot/Warm 은 예비 + 버전 일치를 Warm 으로만 보이고, 복제 지연은 `—` | 복제 지연·Hot 상태는 아직 API 에 없다(인프라·API 서버 8) |
| 11/2 | 테마 기본값은 light(시스템 설정을 따르지 않음) | 시연 화면이 사용자 OS 설정에 따라 바뀌지 않게 |
| 11/2 | 화면 배치는 Figma 「Wire Frame」 v2(조밀한 밀도)를 따른다: 묶음 사이드바, S01 벤토, SVC 목록+오른쪽 패널, 가로 스테퍼, SET 탭+등록 시트, 지도 재난 다이얼로그 | 노션 IA v2 와 와이어프레임이 화면 구성의 기준이다. 디자인(색·모양)은 토큰을 따른다 |
| 11/2 | 재난은 전역 배너 대신 대시보드 제목 옆 칩 + Active disaster 칸 + 사이드바 Dashboard 숫자로 알린다 | 와이어프레임 v2 배치. 다른 화면을 가리지 않는다 |
| 11/2 | 지표가 없는 KPI(성공률·p95·복제 지연·에러 버짓)·요청 그래프·최근 활동은 값을 지어내지 않고 비워 둔다 | 지표(4-2)·감사 로그(4-8) API 가 아직 없다. 가짜 숫자는 심사 규칙상 목업 표시가 필요하고 실데이터로 오해될 수 있다 |
| 11/2 | ~~토폴로지는 지역 묶음 + 노드 카드로 먼저 그리고, 연결선·확대는 React Flow 로 옮길 때~~ | 데이터 모양부터 확정하고 라이브러리는 다음 작업에서 |
| 11/2 | ~~재난 지도는 해안선 없는 격자 지도(정거원통)로 진원지를 찍는다~~ | 지도 데이터·라이브러리 없이 영향 반경 시연이 된다. 실제 지도는 다음 작업 |
| 11/3 | 토폴로지는 React Flow + elkjs(layered, 지역 묶음 = 부모 노드). 배치용 선(프록시 → 모든 환경)은 그리지 않는다 | ADR 11/2. 서비스가 없는 환경도 프록시 오른쪽에 놓인다. 캔버스 너비가 바뀌면 다시 맞춘다 |
| 11/3 | 재난 지도는 d3-geo 메르카토르 + world-atlas `countries-50m`(다이얼로그를 처음 열 때 지연 로드), 반경은 `geoCircle` | ADR 11/2. 110m 은 일본·한국 확대에 거칠고, 50m 은 gzip 240KB 라 첫 화면 번들에서 뺀다 |
| 11/3 | 화면마다 Error Boundary(`ScreenErrorBoundary`, 경로가 바뀌면 초기화) + 라우트 `errorElement` | 한 화면 오류가 사이드바·상단 바까지 지우지 않게 |
| 11/3 | 실시간(계약 3장)은 EventSource 하나 → 이벤트별 `invalidateQueries`, `resync` 면 조직 쿼리 전부. 서버 채널 전까지 붙지 않는다(`EVENTS_API_READY`) | 응답 모양을 REST 에만 둔다. 운영에서 없는 경로에 재연결을 반복하지 않게 |
| 11/3 | 대피 후보(4-4)는 API 전까지 브라우저에서 규칙 점수로 계산한다(안전 .35 · 용량 .25 · 비용 .1 · 복귀 .15 · 데이터 위치 .15, 가칭) | 응답 모양은 계약 초안 그대로. 점수 근거를 화면 오른쪽에 보여 심사 질문에 답한다 |
| 11/3 | 로고·파비콘은 Figma 「Logo」 Direction B SVG 를 그대로 쓴다(워드마크의 두 번째 O = 마크) | Figma 설명: 글자를 다시 치지 말고 인스턴스를 그대로 쓴다 |
| 11/3 | 앱의 MSW 목업(`src/mocks`, 워커, `Mock data` 배지, `VITE_USE_MOCKS`)을 지운다. MSW 는 테스트의 HTTP 가로채기에만 쓴다 | 운영 API 가 열려 목업이 실제와 어긋나는 위험이 더 크다. 예전 워커가 남은 브라우저는 `main.tsx` 가 계속 지운다 |
| 11/3 | 배포 이력 되돌리기는 서버의 `rollbackable` 행에만 버튼을 달고 `POST …/deploy-requests/{id}/rollback` 을 부른다. 현재 배포는 `isCurrent` | API 서버 4 가 운영에 열렸다. 되돌릴 수 있는지는 서버가 판단한다(성공 · 현재 아님 · 연결 살아 있음 · 서비스 ACTIVE) |
| 11/3 | 지진 이전 기준은 규모 M7.0 이상(`EVACUATION_MIN_MAGNITUDE`, 가칭). 기준 미만이면 위험 표시만 하고 이전을 권하지 않는다. 태풍은 기준 없음 | 11/2 2부: 규칙으로 판단, "7 또는 8" 중 미정. 숫자가 정해지면 상수 하나만 바꾼다 |
| 11/3 | 재난 출처는 `SIMULATED`(버튼)뿐이고 실제 지진 피드(P2P地震情報) 자리를 다이얼로그에 둔다 | 11/2 2부: 시간이 되면 실제 API 를 붙인다 |
| 11/3 | elkjs 는 웹 워커(`elk-api` + `elk-worker`)로, 재난 지도 데이터는 일본·한국 둘레만 잘라 둔다 | 대시보드 청크 516KB → 64KB, 지도 243KB → 35KB(gzip). 쓰지 않는 recharts·motion·NumberFlow 는 쓸 때 다시 넣는다 |
| 11/3 | SET 멤버 표의 "Last active" 는 "Joined"(가입 시각)로 바꾼다. 에이전트 토큰 원문은 발급 다이얼로그 state 에만 두고 닫으면 버린다 | 멤버 응답에 마지막 접속 시각이 없다(값을 지어내지 않는다). 원문은 서버가 한 번만 준다 |
| 11/3 | 조직 설정 `allowSelfApproval` 을 멤버 탭에 둔다(어드민만 바꿈) | E01-3 계획 승인에서 만든 사람이 스스로 승인할 수 있는지가 이 값에 달렸다. 데모를 한 사람이 진행할 때 켠다 |
| 11/3 | E01-3 단계는 Figma(Warm-up · DB writer cutover …)가 아니라 API 서버 8 의 고정 단계(사전 확인 → 90/10 → 50/50 → 데이터 동기화 확인 → 0/100)를 그린다. 승인 = 실행 시작 | Figma 메모 1: 단계·예상 시간·롤백 조건이 실행 로그와 같아야 한다. 쓰기 전환 단계는 데이터 파트 결정 후 서버 단계로 들어오면 그린다 |
| 11/3 | 본인이 만든 계획은 조직 설정 `allowSelfApproval` 이 꺼져 있으면 승인·거절 버튼을 비활성 + 이유 툴팁으로 둔다(취소는 가능) | 서버가 403 `SELF_APPROVAL_FORBIDDEN` 으로 막는 규칙을 버튼에서 먼저 보여 준다 |
| 11/3 | AI 사전 점검(4-5)·보안 비교(4-7)는 API 전까지 브라우저 시뮬레이션(`lib/api/prechecks.ts`, `SecurityComparison`). 보안 FAIL 이 있으면 승인을 잠그지만 지금 값에는 FAIL 이 없다 | AI 에이전트·보안 파트 API 가 아직 없다. 데모 증거(F14~F16: 샌드박스 id · 검증 실패 1건 차단 · 통과 1건 사람 승인 · 운영 변경 시도 거부)를 화면에 먼저 둔다 |
| 11/3 | M02 A·B 그래프는 서버가 단계마다 적용한 트래픽 비율로 그린 계단선이다(SVG, recharts 없이). 오류율은 단계 판정 값 | 초 단위 요청·성공률 시계열 API 가 없다. 지어낸 곡선 대신 실제 비율로 두 선이 50% 에서 교차한다(F7). 건수 판정(echo-frontend #6)·`migration.metrics` 가 생기면 그 값으로 바꾼다 |
| 11/3 | M02 "Abort"·"Roll back" 은 확인 다이얼로그가 붙은 Roll back 하나다(`POST …/abort`) | 서버 중단은 곧 출발 100% 로 되돌리기다. 버튼 둘이 같은 일을 하면 시연 중 헷갈린다 |
| 11/3 | M02 Result 의 쓰기 정지 시간·누락/중복 행·RPO 는 `—` + 측정 출처로 둔다. 실패 요청·총 시간·최대 복제 지연은 단계 지표로 채운다 | 데이터 이전 엔진(인프라 #7)이 아직 서버에 값을 주지 않는다. PoC 숫자(로컬)를 운영 결과처럼 보이게 쓰지 않는다 |
| 11/3 | 복귀(Start failback)는 출발·도착을 바꾼 새 계획(E01-3)으로 보낸다. 출발 환경이 진행 중 재난 반경 안이면 버튼을 막는다 | API 서버 8: 되돌아가기는 바꾼 새 계획이다. ADR 11/2: 재난이 끝나지 않은 지역으로는 복귀하지 않는다 |
| 11/3 | 대시보드 완료 카드는 30분 안에 성공한 이전이 있으면 한 번 뜬다(탭마다 닫은 것을 기억). "View full result" 를 눌러야 M02 Result 로 간다 | IA 11/2: 자동으로 넘어가지 않는다. 쓰기 정지 시간·RPO 는 API 전까지 `—` |
| 11/3 | 대시보드 "Requests · A vs B" 는 실행 중인 이전이 있으면 그 A·B 비율선을 그린다. 실행 중 계획이 있으면 서비스별 계획 목록을 2초마다 다시 부른다 | 반분할 시연에서 대시보드만 보고 있어도 이전과 완료가 보이게 |
