# Echo Web (echo-frontend)

Team Echo 멀티 클라우드 관리 플랫폼 **EchoPort**의 웹 프론트다. AWS·GCP·온프레 클러스터를 환경으로 등록하고, 서비스를 배포하고, 재난이 나면 다른 환경으로 무중단 이전하는 과정을 한 화면에서 보여 주고 조작한다. 지금은 규칙 문서와 디자인 토큰, API 계약만 있다. 골격은 [specs/fe-1-scaffold.md](specs/fe-1-scaffold.md)에서 만든다.

- **스택**: Vite, React, TypeScript(strict), react-router, TanStack Query, Tailwind CSS v4, shadcn/ui, lucide-react, MSW, openapi-typescript + openapi-fetch, Biome, Vitest + Testing Library. Node 22, pnpm
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

골격 작업(fe-1) 기준의 목표 구조다. 실제와 달라지면 `write-pr` 스킬이 이 절을 맞춘다.

```text
src/
├─ main.tsx              # 진입점. VITE_USE_MOCKS=true면 MSW 워커를 먼저 켠 뒤 렌더
├─ router.tsx            # 라우트 표 (/login, /, /o/:slug/*, 404)
├─ styles/               # tokens.css → shadcn-theme.css → index.css(Tailwind @theme 연결) 순서
├─ components/
│  ├─ ui/                # shadcn/ui 생성 파일. 직접 고치되 고친 이유를 주석으로 남긴다
│  └─ *.tsx              # 두 화면 이상에서 쓰는 앱 컴포넌트 (RoleButton, StatusBadge, SimulatedBadge, EmptyState …)
├─ layouts/              # AppShell(사이드바 + 상단 바)
├─ pages/                # 화면 단위 폴더. 한 화면에서만 쓰는 컴포넌트는 그 폴더 안에
├─ hooks/                # useTheme, useRole, useCurrentOrg …
├─ lib/
│  ├─ api/               # client(fetch 래퍼) · errors(ApiError) · query-client · query-keys · schema.d.ts(생성) · 리소스별 쿼리 훅
│  └─ utils.ts           # cn() 등
├─ mocks/                # MSW 핸들러와 목업 데이터만
└─ test/                 # Vitest 설정, 테스트 도우미
specs/                   # 태스크 명세
docs/                    # api-contract.md, PR.md(커밋 안 함)
```

- 데이터 흐름은 `pages/` → `lib/api/`의 쿼리 훅 → fetch 래퍼 → echo-was 한 방향이다. 화면은 `fetch`를 직접 부르지 않는다.
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

### 권한·목업
- 역할은 VIEWER < DEVELOPER < ADMIN. 권한이 없는 버튼은 **숨기지 않고** 비활성 + 툴팁("Requires Developer")으로 보여 준다. `RoleButton`의 `requires`로만 처리한다.
- 서버가 준 가짜 값(`simulated: true`)은 값 옆에 회색 `simulated` 배지를 단다. 프론트 목업(MSW)으로 보는 화면은 상단 바에 `Mock data` 배지를 단다. 심사 규칙상 목업을 숨기지 않는다.
- 목업은 `src/mocks/`에만 두고 `VITE_USE_MOCKS=true`일 때만 켠다. 목업 데이터 모양은 계약 문서를 그대로 따른다.

### 언어
- **UI 문구는 영어**, 코드 주석과 문서·커밋 설명·PR은 **한국어**(이 문서처럼 한다체). 식별자는 영어.

---

## 도구

- **패키지·실행**: `pnpm`(Node 22, `.nvmrc`). `npm`·`yarn`을 쓰지 않고 lock 파일은 `pnpm-lock.yaml` 하나만 커밋한다.
- **명령**: 개발 서버 `pnpm dev` / 빌드 `pnpm build` / 린트·포맷 검사 `pnpm lint` / 타입 `pnpm typecheck` / 테스트 `pnpm test`(한 번 실행, 감시 모드 아님) / API 타입 생성 `pnpm gen:api`(`OPENAPI_URL`, 없으면 로컬 `openapi.json`).
- **환경변수**: `.env.example`을 `.env.local`로 복사한다. `VITE_API_BASE_URL`(API 주소), `VITE_USE_MOCKS`(`true`면 MSW).
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
| 11/2 | UI 키트는 shadcn/ui + Tailwind v4, 목업은 MSW | 예선(일반 CSS·UI 키트 없음·자체 목업)과 달리, 본선은 화면 수가 많고 Figma 토큰이 shadcn 변수로 연결돼 나온다 |
| ~~11/2~~ | ~~Tailwind 간격 클래스 숫자 = px(`p-16` = 16px)~~ → 11/2 번복 | |
| 11/2 | 간격은 Tailwind 기본 눈금(1 = 4px, `--spacing` = `--ep-space-4`)을 쓰고 토큰에 있는 값만 쓴다(`p-4` = 16px, `p-1.5` = 6px) | shadcn 컴포넌트가 기본 눈금(`h-9`, `px-4`)으로 짜여 있어 px 눈금이면 전부 고쳐야 한다. 토큰 간격은 모두 2px 단위라 기본 눈금 0.5 단계로 정확히 맞는다 |
| 11/2 | 컨트롤 높이 32px(버튼 기본 `h-8`, 입력칸 `h-8`). shadcn 기본보다 한 단계 낮춤 | 노션 IA 와이어프레임 v2의 조밀한 밀도(본문 13px · 컨트롤 32px) |
| 11/2 | 로컬 개발은 Vite 프록시 없이 `localhost:5173` → `localhost:8000`을 직접 부른다 | echo-was가 CORS·Origin 허용 목록을 이미 지원하고, 5173은 echo-was #12로 요청했다. 운영(`app` → `api`)과 같은 구조라 CORS 문제를 개발 때 잡는다 |
| 11/2 | 글자색은 `text-fg`·`text-fg-secondary`·`text-fg-muted` | Tailwind v4는 색 이름 하나가 `bg-`·`text-`에 같이 쓰여서, shadcn의 `primary`(브랜드색)와 토큰의 `text-primary`(글자색)가 부딪힌다. shadcn 이름을 그대로 두고 글자색 이름을 바꿨다 |
