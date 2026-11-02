# echo-frontend

Team Echo 멀티 클라우드 관리 플랫폼 **EchoPort**의 웹 프론트(대시보드·화면)다. AWS·GCP·온프레 사이에서 서비스를 무중단으로 옮기는 과정을 보여 주고 조작한다. 백엔드는 [echo-was](https://github.com/Softbank-Hackathon-2026-Team-Echo/echo-was)다.

- 운영 주소: `https://app.echoport.uk` (API `https://api.echoport.uk`)
- 규칙·구조·결정 기록: [CLAUDE.md](CLAUDE.md), API 계약: [docs/api-contract.md](docs/api-contract.md)

## 기술 스택

Vite · React 19 · TypeScript(strict) · react-router · TanStack Query · Tailwind CSS v4 · shadcn/ui(Radix) · lucide-react · MSW · Biome · Vitest + Testing Library. Node 22, pnpm 9.

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
| `VITE_USE_MOCKS` | `true` | `true`면 MSW 목업으로 동작하고 상단 바에 `Mock data` 배지가 뜬다 |

- 목업 모드(`VITE_USE_MOCKS=true`)에서는 echo-was 없이 `/` → `/o/echoport` → Settings › Environments까지 볼 수 있다. 조직은 `echoport`(Admin)·`echo-demo`(Developer) 두 개다.
- 실서버 모드는 echo-was를 [README](https://github.com/Softbank-Hackathon-2026-Team-Echo/echo-was/blob/main/README.md)대로 띄우고, echo-was `.env`의 `FRONTEND_BASE_URL`·`FRONTEND_ALLOWED_ORIGINS`에 `http://localhost:5173`을 넣는다. 프록시 없이 직접 부른다(쿠키 인증 + CORS). Safari에서 로컬 로그인 쿠키가 붙지 않으면 echo-was 로컬 `.env`에 `SESSION_COOKIE_SECURE=false`.
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
| 환경변수 (Preview) | `VITE_USE_MOCKS=true` — PR 미리보기 주소(`*.pages.dev`)는 API와 같은 사이트가 아니라 로그인 쿠키가 붙지 않으므로 목업으로만 본다 |
| Custom domain | `app.echoport.uk` (echoport.uk DNS가 같은 Cloudflare 계정에 있어 레코드·인증서가 자동으로 붙는다) |
