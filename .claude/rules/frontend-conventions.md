# 프론트엔드 코드 컨벤션

- **적용 대상**: echo-frontend의 `src/` 아래 모든 코드와 테스트
- **스택 기준**: React 19, TypeScript strict, react-router, TanStack Query v5, Tailwind v4, shadcn/ui, MSW, Vitest
- **전제**: 이름은 [ui-terms.md](ui-terms.md), 스타일은 [design-tokens.md](design-tokens.md), API 모양은 [docs/api-contract.md](../../docs/api-contract.md)를 먼저 따른다. 이 문서는 그 위의 코드 규칙이다

> **핵심 철학**
>
> 1. **화면은 데이터를 어디서 오는지 모른다.** 화면 → 쿼리 훅 → fetch 래퍼 → 서버 한 방향이다.
> 2. **같은 규칙은 한 곳에서만.** 오류 처리·상태 문구·권한·쿼리 키는 각각 파일 하나에 모은다.
> 3. **서버가 진실이다.** 서버 상태를 화면에서 복사해 쌓지 않고, 바뀌면 다시 불러온다.
> 4. **모르는 값에 죽지 않는다.** 새 enum 값·빈 칸(`null`)이 와도 화면이 그려진다.

---

## 1. 이름

| 대상 | 규칙 | 예 |
|---|---|---|
| 컴포넌트 파일·이름 | `PascalCase.tsx`, 파일 하나에 export 컴포넌트 하나 | `EnvironmentTable.tsx` |
| 훅 | `useXxx.ts` | `useRole.ts`, `useEnvironments.ts` |
| 그 밖의 파일 | `kebab-case.ts` | `query-keys.ts`, `api-error.ts` |
| shadcn 생성 파일 | CLI가 만든 이름 그대로(`components/ui/button.tsx`) | |
| 타입 | `PascalCase`, `I`·`T` 접두어 없음. API 타입은 `schema.d.ts`에서 별칭으로 꺼낸다 | `type Environment = components['schemas']['EnvironmentResponse']` |
| 불리언 | `is`·`has`·`can`·`should` 접두어 | `canDeploy`, `isSimulated` |
| 이벤트 처리 | prop은 `onXxx`, 구현은 `handleXxx` | `onDeploy` / `handleDeploy` |
| 상수 | 모듈 최상위 고정 값은 `UPPER_SNAKE` | `POLL_INTERVAL_MS` |
| 테스트 | 대상 옆 `*.test.ts(x)` | `client.test.ts` |

- `default export`는 라우트가 지연 로딩하는 페이지 컴포넌트만 쓴다. 나머지는 named export.
- 경로 별칭은 `@/`(= `src/`) 하나. `../../..` 세 단계 이상 올라가지 않는다.

## 2. 폴더

- 한 화면에서만 쓰는 컴포넌트·훅은 `pages/{화면}/` 안에 둔다. **두 화면 이상에서 쓰게 되면** `components/`·`hooks/`로 옮긴다.
- `components/ui/`는 shadcn 원본에 가깝게 둔다. 고쳤으면 그 줄 위에 이유를 한 줄 주석으로 남긴다(CLI로 다시 받을 때 알아보려고).
- `lib/api/`는 화면을 모른다(React 컴포넌트를 import하지 않는다). 쿼리 훅만 React를 쓴다.
- `mocks/`는 앱 코드에서 import하지 않는다. `main.tsx`가 `VITE_USE_MOCKS`를 보고 동적으로 불러온다(운영 빌드에 목업이 들어가지 않게).

## 3. 컴포넌트

- 함수 컴포넌트와 훅만 쓴다. props 타입은 컴포넌트 바로 위 `type XxxProps`.
- 한 파일이 200줄을 넘거나 역할이 둘이면 나눈다.
- 로딩·빈 목록·오류 세 상태를 모든 데이터 화면에 둔다. 로딩은 실제 모양과 같은 `Skeleton`, 빈 목록은 `EmptyState`(무엇이 없고 다음에 무엇을 하면 되는지), 오류는 §5 공통 처리.
- 아이콘은 `lucide-react`만. 아이콘만 있는 버튼에는 `aria-label`을 단다.
- 키보드로 모든 동작을 할 수 있어야 한다. 클릭 가능한 `div`를 만들지 않고 `button`·`a`를 쓴다. 포커스 링(`focus` 토큰)을 지우지 않는다.

## 4. 데이터 (API 계층)

### 4.1 fetch 래퍼 (`lib/api/client.ts`)
- 주소는 `${VITE_API_BASE_URL}/api/v1/…`. 모든 요청 `credentials: 'include'`.
- 성공 봉투 `{success: true, data}` → `data`만 돌려준다. 실패 봉투 또는 2xx가 아닌 응답 → `ApiError(status, code, message, details, requestId)`를 던진다. 봉투가 아닌 응답(프록시 오류 HTML 등)도 `ApiError`로 감싼다(`code: 'UNEXPECTED_RESPONSE'`).
- 401이면 `/login?next={현재 경로}`로 이동한다. `/me` 확인 중의 401도 같다.
- 타입 있는 호출은 openapi-fetch 클라이언트를 이 래퍼 위에 얹어 쓴다(래퍼의 봉투 풀기·오류 변환을 그대로 탄다).

### 4.2 쿼리 훅
- 리소스마다 `lib/api/{resource}.ts`에 `useXxx`(조회)·`useXxxMutation`(변경)을 둔다. 화면은 `useQuery`를 직접 부르지 않는다.
- 쿼리 키는 `lib/api/query-keys.ts` 팩토리로만 만든다. 조직 리소스는 `['org', orgId, …]`로 시작한다.

```ts
export const queryKeys = {
  me: () => ['me'] as const,
  environments: (orgId: string) => ['org', orgId, 'environments'] as const,
  environment: (orgId: string, id: string) => ['org', orgId, 'environments', id] as const,
};
```

- 기본값(`query-client.ts`): `staleTime` 10초, 4xx는 재시도하지 않음, 5xx·네트워크 오류는 2번까지.
- 변경이 성공하면 관련 키를 `invalidateQueries`로 무효화한다. 응답으로 캐시를 직접 고치는 낙관적 업데이트는 꼭 필요할 때만 쓰고 이유를 주석으로 남긴다.

### 4.3 상태를 바꾸는 버튼
- 요청 중에는 버튼을 비활성하고 스피너를 보여 준다(두 번 눌러 배포가 두 번 생기지 않게).
- 되돌릴 수 없는 일(삭제·이전 실행·쓰기 전환)은 확인 다이얼로그를 거친다. 삭제는 대상 이름을 입력해야 활성화된다.

### 4.4 모르는 값과 `null`
- enum은 `switch`의 `default`나 매핑 표의 기본값으로 처리한다. TypeScript `never` 검사로 컴파일 시점에 빠진 값을 잡되, 실행 중 모르는 값은 중립 표시로 넘긴다.
- 서버 칸은 항상 있고 값이 없으면 `null`이다. 화면은 `null`을 `—`로 보여 주고, 없는 값을 지어내지 않는다.

## 5. 오류 처리

[docs/api-contract.md](../../docs/api-contract.md) 1-2장을 `lib/api/errors.ts` 한 곳에서 구현한다. 화면마다 상태 코드를 다시 판단하지 않는다.

| HTTP | 처리 | 구현 위치 |
|---|---|---|
| 401 | 로그인 이동 | fetch 래퍼 |
| 403 | 화면 유지 + 토스트 "You don't have permission (Developer or above)" | 전역 `onError`(mutation) |
| 404 | 그 영역 빈 상태. 조직이 없으면 "Back to organizations" | 화면 오류 경계 |
| 409 | 해당 쿼리 다시 불러오기 + 이유 코드 문구 | 전역 `onError` + 코드별 문구 표 |
| 422 | `details[].field`로 폼 칸 아래 오류 | 폼 도우미 `applyFieldErrors` |
| 502·503 | "External service (GitHub, etc.) is not responding" + Retry | 화면 오류 경계 |

- 오류 토스트에는 `requestId`와 "Copy" 버튼을 함께 둔다.
- 서버 `message`는 개발용 문장일 수 있다. 화면 문구는 `code`로 고르고, 모르는 코드만 서버 `message`를 보여 준다.
- `catch`로 오류를 삼키지 않는다. 처리하지 않을 오류는 다시 던진다.

## 6. 실시간

- 연결은 조직마다 하나(`GET /orgs/{orgId}/events`, `EventSource`, 쿠키 인증). AppShell이 한 번만 붙인다.
- 이벤트를 받으면 계약 3장 표대로 `invalidateQueries`만 부른다. 이벤트 내용으로 화면 상태를 쌓지 않는다. 예외는 `migration.metrics`(값을 싣는다)뿐이고, 이 값은 그 화면의 state에만 둔다.
- `resync`를 받으면 그 조직 키 전체를 무효화한다.
- 실시간이 생기기 전에는 배포 진행·이전 실행 화면만 `refetchInterval: 2000`으로 폴링하고, 끝 상태(`SUCCEEDED`·`FAILED`·`CANCELLED`)가 되면 멈춘다.

## 7. 권한

- `useRole()`은 `/me`에서 현재 조직의 `role`을 읽는다. 역할 순서 비교는 `hasRole(role, min)` 한 함수로 한다.
- 권한이 필요한 버튼은 `<RoleButton requires="DEVELOPER">`로만 만든다. 권한이 없으면 **숨기지 않고** 비활성 + 툴팁 "Requires Developer" / "Requires Admin".
- 프론트 권한 검사는 안내용이다. 실제 거부는 서버가 하고(403 + 감사 기록), 프론트는 그 403도 §5대로 처리한다.

## 8. 목업

- MSW 핸들러와 데이터는 `src/mocks/`에만 둔다. 파일 맨 위에 `// MOCK:` 주석을 단다.
- 목업 응답은 실서버와 같은 봉투(`{success, data}`)·같은 칸 이름·같은 오류 모양이다. 계약 문서 예시 값을 쓰고, 실제 토큰·비밀번호·내부 주소를 넣지 않는다.
- `VITE_USE_MOCKS=true`이면 상단 바에 `Mock data` 배지를 보여 준다. 서버가 준 `simulated: true`는 별개로 값 옆에 `simulated` 배지를 단다.
- 서버 API가 열리면 그 핸들러를 지운다. 남은 목업 목록은 PR 본문 📌 기타에 적는다.

## 9. API가 모자랄 때 (echo-was에 요청)

프론트가 echo-was 코드를 고치지 않는다. 필요한 칸·엔드포인트·이벤트가 없으면:

1. [docs/api-contract.md](../../docs/api-contract.md) 4장에 `(가칭)` 🆕 항목으로 모양을 적는다.
2. 화면은 그 모양대로 목업을 만들어 먼저 진행한다.
3. echo-was에 이슈 초안을 쓴다. 사람이 확인한 뒤 올린다. 이미 같은 이슈가 있는지 먼저 찾는다(`gh issue list -R Softbank-Hackathon-2026-Team-Echo/echo-was`).

```text
제목: [요청] {한 줄} (가칭)

## 상황
어느 화면(ID)에서 왜 필요한지 3줄 이내

## 요청 모양 (가칭)
메서드·경로·칸·타입·예시 JSON. 이름은 API 담당이 정한다

## 완료 기준
어떻게 되면 프론트가 붙일 수 있는지

## 그동안 프론트는
목업으로 진행 중인 것

Refs: docs/api-contract.md §4-x
```

4. 서버가 정하면 계약 문서에서 `(가칭)`과 🆕를 떼고 실제 이름으로 바꾼다. 목업·타입·[ui-terms.md](ui-terms.md)도 같은 PR에서 맞춘다.

## 10. 테스트

| 규칙 | 내용 |
|---|---|
| 도구 | Vitest + Testing Library(`@testing-library/react`, `user-event`), jsdom. API는 MSW `setupServer`로 가로챈다 |
| 위치 | 대상 파일 옆 `*.test.ts(x)` |
| 이름 | `describe('대상')` + `it('상황이면 결과다')` (한국어 허용) |
| 무엇을 | 동작을 시험한다: 봉투 풀기·오류 변환·401 이동, 권한 비활성, 오류 문구, 모르는 enum 표시. 스냅샷 테스트는 쓰지 않는다 |
| 찾는 법 | `getByRole`·`getByLabelText` 먼저. `data-testid`는 마지막 수단 |
| 격리 | 테스트마다 새 `QueryClient`(`retry: false`). 실제 네트워크를 부르지 않는다 |

## 11. 주석

- 주석은 "왜"와 "외부 계약"(서버가 요구하는 모양, 브라우저 제약)에만 단다. 코드가 하는 일을 다시 설명하지 않는다.
- 주석에 규칙 문서 위치(`frontend-conventions §4`)를 적지 않는다.
- TODO 형식: `// TODO(김도영, YYYY-MM-DD): 문제 + 해결 방향`.

## 12. 린터 · 타입

- Biome 하나로 린트·포맷·import 정렬을 한다. 설정은 `biome.json` 한 곳. 경고도 0개로 유지한다.
- TypeScript `strict`, `noUncheckedIndexedAccess`. `any`·`as unknown as`·`@ts-ignore`를 쓰지 않는다. 꼭 필요하면 `@ts-expect-error` + 이유.
- `console.log`를 커밋하지 않는다(개발 중 디버그는 지우고 커밋).

## 13. 새 코드 체크리스트

1. 이름이 [ui-terms.md](ui-terms.md)·API 필드와 같은가?
2. 색·간격·글자가 토큰 클래스뿐인가? 임의 값·기본 팔레트가 없는가?
3. 화면이 `lib/api/` 훅으로만 데이터를 받는가? 쿼리 키가 팩토리에서 오는가?
4. 로딩·빈 목록·오류 세 상태가 있는가? 모르는 enum·`null`에 깨지지 않는가?
5. 권한 버튼이 `RoleButton`인가? 상태를 바꾸는 버튼이 요청 중 비활성인가?
6. 목업에 `// MOCK:`이 있고, 가짜 값에 배지가 붙는가?
7. 라이트·다크·projector에서 화면을 봤는가? 1024px 미만에서 사이드바가 접히는가?
8. `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과하는가?
