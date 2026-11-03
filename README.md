# echo-frontend

Team Echo 멀티 클라우드 관리 플랫폼 **EchoPort**의 웹 프론트(대시보드·화면)다. AWS·GCP·온프레 사이에서 서비스를 무중단으로 옮기는 과정을 보여 주고 조작한다. 백엔드는 [echo-was](https://github.com/Softbank-Hackathon-2026-Team-Echo/echo-was)다.

- 운영 주소: `https://app.echoport.uk` (API `https://api.echoport.uk`)
- 규칙·구조·결정 기록: [CLAUDE.md](CLAUDE.md), API 계약: [docs/api-contract.md](docs/api-contract.md)

## 기술 스택

Vite · React 19 · TypeScript(strict) · react-router · TanStack Query · Tailwind CSS v4 · shadcn/ui(Radix) · lucide-react · Biome · Vitest + Testing Library(+ MSW, 테스트에서만). Node 22, pnpm 9.

## 시작하기

```bash
nvm use            # Node 22 (.nvmrc)
pnpm install
cp .env.example .env.local
pnpm dev           # http://localhost:5173
```

### 환경변수

| 이름 | 예 | 설명 |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000` | echo-was 주소(끝 `/` 없이) |

- 앱에는 목업이 없다(11/3). 화면은 echo-was 가 있어야 뜬다. 운영 API(`api.echoport.uk`)는 `https://app.echoport.uk` 출처만 받으므로 로컬에서는 쓸 수 없다.
- 로컬은 echo-was를 [README](https://github.com/Softbank-Hackathon-2026-Team-Echo/echo-was/blob/main/README.md)대로 띄우고, echo-was `.env`의 `FRONTEND_BASE_URL`·`FRONTEND_ALLOWED_ORIGINS`에 `http://localhost:5173`을 넣는다. 프록시 없이 직접 부른다(쿠키 인증 + CORS). Safari에서 로컬 로그인 쿠키가 붙지 않으면 echo-was 로컬 `.env`에 `SESSION_COOKIE_SECURE=false`.
- 개발 모드에서 `/dev/tokens`로 디자인 토큰·테마 3개(light·dark·projector)를 확인할 수 있다.

## 자주 쓰는 명령

| 명령 | 하는 일 |
|---|---|
| `pnpm dev` | 개발 서버 (포트 5173 고정) |
| `pnpm build` | 타입 검사 + 운영 빌드 → `dist` |
| `pnpm lint` / `pnpm format` | Biome 검사 / 자동 수정 |
| `pnpm typecheck` | TypeScript 검사 |
| `pnpm test` | Vitest 한 번 실행 (`pnpm test:watch`는 감시 모드) |
| `pnpm gen:api` | echo-was OpenAPI → `src/lib/api/schema.d.ts` (`OPENAPI_URL=http://localhost:8000/openapi.json pnpm gen:api`, 없으면 로컬 `openapi.json`) |

## Cloudflare Pages

`app.echoport.uk`은 Cloudflare Pages로 배포한다. SPA라 `404.html`을 만들지 않는다(Pages가 없는 경로에 `index.html`을 준다).

| 설정 | 값 |
|---|---|
| Framework preset | React (Vite) |
| Build command | `pnpm build` |
| Build output directory | `dist` |
| 환경변수 (공통) | `NODE_VERSION=22` |
| 환경변수 (Production) | `VITE_API_BASE_URL=https://api.echoport.uk` |
| 환경변수 (Preview) | 없음(11/3 목업 제거). PR 미리보기 주소(`*.pages.dev`)는 API 허용 출처가 아니라 로그인 화면까지만 열린다. 화면 확인은 머지 뒤 `app.echoport.uk` 에서 한다 |
| Custom domain | `app.echoport.uk` (echoport.uk DNS가 같은 Cloudflare 계정에 있어 레코드·인증서가 자동으로 붙는다) |
