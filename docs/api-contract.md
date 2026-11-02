# FE-BE API 계약 (프론트 기준) v0.1

- 작성: 2026-11-02 · 김도영 (프론트)
- 원본: 이미 있는 API는 echo-was `docs/api/`(environments · services · deploy-requests · auth · organizations)가 원본이다. 이 문서는 내용을 다시 쓰지 않고 **화면 → API 연결표**와 **아직 없는 API 요청 초안**만 다룬다.
- 화면 ID는 [화면 목록 (프론트 IA)](https://app.notion.com/p/40b8bee9ada48175a888e1e9beb60279)과 Figma 「Wire Frame」 페이지를 따른다.
- 표기: ✅ 지금 있음 · 🆕 새로 요청 · 🔁 있지만 화면에 맞춰 보탤 것

## 1. 공통 규칙

### 1-1. 이미 정해진 것 (echo-was 문서 기준)

| 항목 | 규칙 | 프론트 처리 |
|---|---|---|
| 주소 | `https://api.echoport.uk/api/v1/…`, 조직 리소스는 `/orgs/{orgId}/…` | `orgId`는 URL 경로(`/o/{slug}/…`)에서 고르고, `/me`의 `organizations`에서 id를 찾는다 |
| 응답 봉투 | 성공 `{success: true, data}` · 실패 `{success: false, code, message, details}` | fetch 래퍼가 `data`만 꺼내고, 실패는 `ApiError(code, details)`로 던진다 |
| 필드 | camelCase. 칸은 항상 있고 값이 없으면 `null` | 타입은 openapi-typescript로 자동 생성 |
| 목록 | `Page` = `{items, total, page(0부터), size(1~100, 기본 20)}` | 표 아래 페이지 이동 |
| 요청 추적 | 응답 헤더 `X-Request-ID` | 오류 토스트에 함께 보여 주고 "복사" 버튼 |
| 로그인 | `GET /auth/github/login?next=…`로 **페이지 이동**, 실패하면 `/login?error=<코드>`로 돌아온다 | 로그인 화면이 `error` 코드별 문구를 보여 준다 (1-3) |
| 세션 | httpOnly 쿠키 `__Host-echo_session`(7일). 프론트에 토큰을 저장하지 않는다 | 모든 요청 `credentials: 'include'`. 프론트(app.echoport.uk)와 API(api.echoport.uk)는 같은 사이트 |
| 역할 | VIEWER < DEVELOPER < ADMIN. 되돌릴 수 있는 일은 개발자, 삭제·사람 관리는 어드민 | 버튼은 숨기지 않고 비활성 + "Developer 이상" 툴팁. 403이 오면 같은 문구로 토스트 |
| 다른 조직 | 404 (`ORGANIZATION_NOT_FOUND` 등) | 빈 상태 + "조직 목록으로" |
| 가짜 값 | `simulated: true` (환경 `clusterInfo`, 서비스, 배포 요청) | 값 옆에 회색 `simulated` 배지. 심사 규칙(목업은 목업이라고 밝힘) |

### 1-2. 상태 코드별 프론트 처리

| HTTP | 처리 |
|---|---|
| 401 | `/login?next=현재경로`로 이동 |
| 403 | 화면은 그대로, "권한 없음 (Developer 이상)" 토스트. 서버가 거부를 감사 로그에 남긴다 |
| 404 | 해당 영역 빈 상태 |
| 409 | 최신 상태를 다시 불러오고 이유 코드를 안내 (예: `ENVIRONMENT_IN_USE`, `SERVICE_DELETING`, `LAST_ADMIN`) |
| 422 | 폼 칸 아래 오류. `details[].field`로 칸을 찾는다 |
| 502·503 | "외부 서비스(GitHub 등) 응답 없음" + 재시도 버튼 |

### 1-3. 로그인 실패 코드 문구

| 코드 | 문구 |
|---|---|
| `OAUTH_DENIED` | GitHub에서 로그인을 취소했어요. |
| `OAUTH_STATE_MISMATCH` | 로그인 시간이 지났어요. 다시 시도해 주세요. |
| `GITHUB_UNAVAILABLE` | GitHub가 응답하지 않아요. 잠시 뒤 다시 시도해 주세요. |
| `LOGIN_NOT_ALLOWED` | 이 계정은 로그인이 허용되지 않았어요. |
| `LOGIN_NOT_CONFIGURED` | 로그인 설정이 아직 없어요. 운영팀에 알려 주세요. |

## 2. 화면별 API

| 화면 | 쓰는 API | 상태 |
|---|---|---|
| L00 앱 첫 진입 로딩 | `GET /me` → 조직 목록 · `GET /orgs/{orgId}/environments` · 실시간 연결(3장) | ✅ / 🆕(실시간) |
| L01-b 로그인 | `GET /auth/github/login?next=` (페이지 이동) | ✅ |
| 앱 껍데기 (상단 조직 선택·사용자) | `GET /me` · `POST /auth/logout` · `POST /orgs` | ✅ |
| O01~O03 온보딩 | 환경 등록과 같은 API + 서비스 등록·배포 API + 재난 시뮬레이션(4-3) | ✅ / 🆕 |
| SET 환경 탭 | `GET /environment-kinds`(종류별 입력칸) · `GET·POST·PATCH·DELETE /orgs/{orgId}/environments…` · `POST …/connection-check` | ✅ / 🔁 좌표(4-1) · 🔁 목록 클러스터 요약(아래) |
| SET 멤버 탭 | `GET·PATCH·DELETE …/members` · `GET·POST·DELETE …/invitations` · `GET·POST·DELETE …/agent-tokens` | ✅ |
| SVC 서비스 목록 | `GET /orgs/{orgId}/services` | ✅ / 🔁 목록 요약(아래) |
| SVC 서비스 상세 | `GET …/services/{id}` (환경별 연결: `role`·`trafficWeight`·`versionStatus`·`url`) · `GET …/services/{id}/deploy-requests` | ✅ |
| SVC 서비스 등록 | `POST …/services` (`REPO_NOT_ACCESSIBLE`이면 `details[].value`의 GitHub App 설치 주소 안내) | ✅ |
| SVC 배포 | `POST …/services/{id}/deploy-requests` `{environmentId, branch \| commitSha}` | ✅ |
| SVC 배포 진행 | `GET /orgs/{orgId}/deploy-requests/{id}` (`status`·`stageTimes`·`build.reused`·`errorCode`·`revertStatus`) | ✅ (실시간 전까지 2초 폴링) |
| SVC 배포 로그 | 배포 로그 줄 | 🆕 (API 서버 4 예정) |
| S01 대시보드 | 환경 목록 · 서비스 상세 · 지표(4-2) · 진행 중 재난(4-3) · 최근 이벤트·활동(4-8) | ✅ / 🆕 |
| S01-D 재난 시뮬레이션 · S01-R 휴대폰 리모컨 | 재난 만들기·미리보기(4-3) | 🆕 |
| E01-1 대피처 고르기 | 대피 후보·점수(4-4) | 🆕 |
| E01-2 AI 사전 점검 | 샌드박스 실행·단계·로그·패치·승인(4-5) | 🆕 |
| E01-3 계획 승인 | 이전 계획·승인(4-6) · 보안 비교(4-7) | 🆕 |
| M01 이전 목록 · M02 이전 실행 (계획·긴급·복귀, Live·Result) | 이전 실행·단계·트래픽·쓰기 전환·측정 결과(4-6) | 🆕 |
| SEC 보안 (Matrix · Compare · 근거 드로어) | 매트릭스·finding·비교(4-7) | 🆕 |
| AUD 감사 로그 | 감사 로그 조회(4-8) | 🆕 (지금은 거부 기록만 저장, 조회는 API 서버 7) |

🔁 서비스 목록 요약: 목록 표에 "어디서 서비스 중인지 · 버전"을 보여 주므로, `ServiceSummary`에 `servingEnvironment {id, name, kind}`와 `currentCommitSha`가 있으면 상세를 서비스마다 부르지 않아도 된다. 없으면 프론트가 상세를 따로 부른다(서비스 수가 적어서 데모에는 문제없음).

🔁 환경 목록 클러스터 요약: 환경 표의 "클러스터" 칸(버전 · 노드 수 · `simulated`)은 지금 행마다 상세를 불러 채운다. 목록은 어댑터를 부르지 않는다는 원칙(장애 환경이 있어도 목록이 뜬다)은 지키되, 마지막 접속 확인 때 읽은 `clusterInfo`를 저장해 목록에 실어 주면 상세 호출을 없앨 수 있다. 환경 수가 적어 데모에는 문제없다.

## 3. 실시간

- **채널 하나**: `GET /api/v1/orgs/{orgId}/events` (SSE, 쿠키 인증, 뷰어 이상).
- **알림형 이벤트**: 이벤트에는 "무엇이 바뀌었는지"만 싣는다. 프론트는 받으면 해당 REST를 다시 부른다(TanStack Query `invalidateQueries`). 응답 모양을 REST와 SSE에 두 번 정의하지 않기 위해서다.
- **값을 싣는 예외**: 1초마다 바뀌는 숫자(이전 중 트래픽 비율·성공률·지연·복제 지연)만 값을 싣는다.
- **봉투**

```text
id: 1042
event: deploy_request.updated
data: {"seq": 1042, "ts": "2026-11-07T03:05:40Z", "orgId": "…", "resource": {"type": "deploy_request", "id": "…"}, "data": null}
```

- **재연결**: 브라우저가 `Last-Event-ID`로 다시 붙는다. 서버가 놓친 구간을 못 주면 `resync` 이벤트 → 프론트가 화면의 쿼리를 전부 다시 부른다. 15초마다 `heartbeat`.

| 이벤트 | 다시 부를 것 / 실을 값 |
|---|---|
| `environment.updated` | 환경 목록·상세 (접속 상태 변화) |
| `service.updated` | 서비스 목록·상세 (연결 역할·트래픽·동기화) |
| `deploy_request.updated` | 배포 요청 상세·목록 |
| `disaster.started` · `disaster.updated` · `disaster.ended` | 진행 중 재난, 환경 위험 표시 |
| `evacuation.updated` | 대피 후보 |
| `precheck.updated` | 사전 점검 상세 (단계·로그·패치) |
| `migration.updated` | 이전 상세 (단계·상태) |
| `migration.metrics` | **값을 싣는다**: `{migrationId, trafficWeights: {sourceEnvId: 30, targetEnvId: 70}, successRate, p95Ms, replicationLagMs, failedRequests}` 1초마다 |
| `security.updated` | 매트릭스·finding |
| `audit.created` | 감사 로그·최근 활동 |

- 실시간이 생기기 전에는 배포 진행·이전 실행 화면만 2초 폴링한다.

## 4. 새 API 요청 초안 (🆕)

> 화면에 필요한 칸 모양을 제안한다. 경로·이름·구조는 API 서버(지민)가 정하고, 정해지면 이 문서를 고친다.

### 4-1. 환경 좌표 (🔁 환경 응답에 보탬)

재난 영향은 "진원지 + 반경 안의 환경"(거리 방식, 11/2 결정)이라 환경마다 좌표가 필요하다. 영향 판정은 서버가 하므로 좌표도 서버가 가진다.

- 환경 응답에 `coordinates: {lat, lng} | null` 추가.
- 클라우드는 서버가 리전 → 좌표 표를 가진다(예: `ap-northeast-1` → 도쿄). 온프레는 등록할 때 `location`(도시)을 표에서 고르거나 좌표를 직접 받는다.

### 4-2. 대시보드 지표 (F17)

`GET /orgs/{orgId}/services/{id}/metrics?range=15m&step=10s`

```json
{"range": "15m", "step": "10s",
 "series": [{"environmentId": "…", "points": [{"t": "…", "rps": 10.2, "successRate": 0.9998, "p95Ms": 182}]}],
 "summary": {"successRate": 0.9998, "p95Ms": 182, "replicationLagMs": 120, "errorBudgetLeft": 0.72},
 "simulated": false}
```

KPI 타일 5개(성공률·p95·복제 지연·트래픽 비율·에러 버짓)와 스파크라인, A/B 요청 그래프가 이 하나로 그려진다.

### 4-3. 재난 (2차 P1)

| 동작 | 제안 |
|---|---|
| 영향 미리보기 | `POST /orgs/{orgId}/disasters/preview` `{type: EARTHQUAKE \| TYPHOON, epicenter: {lat, lng}, magnitude}` → `{radiusKm, affected: [envId], safe: [envId]}` (저장 안 함. 다이얼로그에서 진원지를 옮길 때마다 부름) |
| 재난 발생 | `POST /orgs/{orgId}/disasters` (같은 본문, 개발자 이상, `simulated: true`) → `Disaster` |
| 진행 중 목록 | `GET /orgs/{orgId}/disasters?status=ACTIVE` |
| 종료 | `POST /orgs/{orgId}/disasters/{id}/end` (복귀 잠금이 풀린다) |

```json
{"id": "…", "type": "EARTHQUAKE", "magnitude": 7.2, "epicenter": {"lat": 35.2, "lng": 139.4},
 "radiusKm": 300, "status": "ACTIVE", "affectedEnvironmentIds": ["…"], "safeEnvironmentIds": ["…", "…"],
 "startedAt": "…", "endedAt": null, "simulated": true}
```

휴대폰 리모컨(S01-R)도 같은 `POST /disasters`를 부른다.

### 4-4. 대피 후보 (F10·2차)

`GET /orgs/{orgId}/services/{id}/evacuation-candidates?disasterId=`

```json
{"source": {"environmentId": "…", "distanceKm": 60, "inRadius": true},
 "candidates": [{"environmentId": "…", "score": 82, "recommended": true,
   "scores": {"safety": 86, "capacity": 86, "cost": 58, "failbackTime": 58, "dataResidency": 86},
   "reasons": ["outside radius (1,160 km)", "warm standby, in sync"]}],
 "excluded": [{"environmentId": "…", "reason": "INSIDE_RADIUS"}]}
```

### 4-5. AI 사전 점검 (F11·F14~F16)

| 동작 | 제안 |
|---|---|
| 점검 시작 | `POST /orgs/{orgId}/prechecks` `{serviceId, targetEnvironmentId}` → `Precheck` |
| 점검 상세 | `GET /orgs/{orgId}/prechecks/{id}` → `{status, sandboxId, steps[{name, status, startedAt, finishedAt}], featureGaps[{source, target, gap, action}], configDiff[], patches[{id, file, diff, reason, verification: {passed, total}, status}], blockedAttempts[{action, target, at}]}` |
| 로그 | `GET …/prechecks/{id}/logs?after=` |
| 패치 승인·거절 | `POST …/prechecks/{id}/patches/{patchId}/approve` · `…/reject` (개발자 이상, 사람만) |

`blockedAttempts`는 "에이전트가 운영을 바꾸려다 막힌 기록"(F16 데모 장면)이다.

### 4-6. 이전 계획·실행·결과·복귀 (F6~F10, F17)

| 동작 | 제안 |
|---|---|
| 계획 만들기 | `POST /orgs/{orgId}/migrations` `{serviceId, targetEnvironmentId, mode: PLANNED \| EMERGENCY \| FAILBACK, precheckId?, disasterId?}` → `Migration(status = PLANNED)` |
| 승인 | `POST …/migrations/{id}/approve` (개발자 이상). 보안 비교에 불일치가 있으면 409 `SECURITY_MISMATCH` + 이유 |
| 실행 중단·롤백 | `POST …/migrations/{id}/abort` · `…/rollback` |
| 상세 | `GET …/migrations/{id}` |
| 목록 | `GET /orgs/{orgId}/migrations` (M01) |

```json
{"id": "…", "mode": "PLANNED", "status": "RUNNING",
 "source": {"environmentId": "…"}, "target": {"environmentId": "…"},
 "steps": [{"name": "PRECHECK", "status": "DONE", "startedAt": "…", "finishedAt": "…"},
           {"name": "SHIFT_TRAFFIC", "status": "RUNNING", "detail": {"weights": [1, 10, 50, 100], "current": 70}}],
 "writerCutover": {"status": "RUNNING", "steps": ["PAUSE_WRITES", "FENCE", "CONFIRM_LSN", "PROMOTE"], "current": "CONFIRM_LSN", "lsn": "0/3A1F2C8"},
 "rollbackConditions": [{"metric": "errorRate", "op": ">", "value": 0.01, "forSeconds": 30}],
 "result": null, "failback": {"allowed": false, "reason": "DISASTER_ACTIVE", "disasterId": "…"},
 "approvedBy": {"githubLogin": "echoport"}, "simulated": true}
```

- `result` (끝나면): `{totalSeconds, failedRequests, totalRequests, writePauseMs, missingRows, duplicateRows, maxReplicationLagMs, rtoSeconds, rpoSeconds, stageTimes[]}` — 완료 카드와 결과 표가 같은 값을 쓴다.
- `failback.allowed = false`이면 복귀 버튼 비활성 + 이유 표시(재난 미종료 지역 복귀 금지, 11/2 결정).
- 실행 중 숫자는 3장 `migration.metrics`로 받는다.

### 4-7. 보안 (F12·F13)

| 동작 | 제안 |
|---|---|
| 매트릭스 | `GET /orgs/{orgId}/security/matrix` → `rows[{environmentId, cells{iam, encryption, auditLog, policy}: {result: PASS \| WARN \| FAIL \| NA, findingCount}}]` (빈칸 0, NFR-09) |
| finding 목록 | `GET /orgs/{orgId}/security/findings?environmentId&control` → `{id, environmentId, control, severity, title, source(SCC \| PROWLER \| KUBESCAPE …), evidence(원본 JSON), normalized, suggestedFix, checkedAt}` |
| 이전 전후 비교 | `GET /orgs/{orgId}/security/compare?source=&target=` → 통제마다 양쪽 값과 `blocksMigration` |

### 4-8. 감사 로그 (F5)

`GET /orgs/{orgId}/audit-logs?actorType=USER|AGENT|SYSTEM&q=&page&size`

```json
{"id": "…", "at": "…", "actor": {"type": "AGENT", "githubLogin": null, "agentTokenName": "echoport-agent"},
 "action": "PATCH_PROPOSED", "target": {"type": "precheck", "id": "…", "label": "patch #3 on gcp-seoul"},
 "result": "SUCCEEDED | DENIED | FAILED", "reason": null, "requestId": "…"}
```

대시보드 "최근 활동"도 이 API를 `size=3`으로 부른다. 지금 저장하는 거부 기록(`DENIED`) 외에 배포·승인·역할 변경·에이전트 행동도 같은 표에 남겨야 한다(NFR-08).

## 5. 열린 질문

1. 실시간 채널을 조직 하나로 둘지, 이전·배포 단위로 나눌지 (제안: 조직 하나)
2. 서비스 목록 요약 칸(`servingEnvironment`, `currentCommitSha`)을 보탤지
3. 환경 좌표: 리전 표를 서버에 둘지, 온프레 좌표는 어떻게 받을지
4. 재난 미리보기를 서버 계산으로 할지 (제안: 서버. 판정과 같은 식을 써야 화면 원과 실제 판정이 같다)
5. 이전 계획의 자기 승인 허용 여부 (echo-was#6 열린 항목)
6. 배포 로그 줄 API의 형태와 시점 (API 서버 4)
7. 데모 계정: 시연용 데모 조직 역할 구성(어드민·개발자·뷰어)을 `demo_seed`에 맞출지

## 6. 바뀐 기록

- v0.1 (11/2): 첫 초안. 공통 규칙·화면별 API·실시간·새 API 요청 초안.
