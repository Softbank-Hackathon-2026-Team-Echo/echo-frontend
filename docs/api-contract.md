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
| SET 멤버 탭 | `GET·PATCH·DELETE …/members` · `GET·POST·DELETE …/invitations` · `GET·POST·DELETE …/agent-tokens` · `PATCH …/settings {allowSelfApproval}` | ✅ (11/3 연결) |
| SVC 서비스 목록 | `GET /orgs/{orgId}/services` | ✅ / 🔁 목록 요약(아래) |
| SVC 서비스 상세 | `GET …/services/{id}` (환경별 연결: `role`·`trafficWeight`·`versionStatus`·`url`) · `GET …/services/{id}/deploy-requests` | ✅ |
| SVC 서비스 등록 | `POST …/services` (`REPO_NOT_ACCESSIBLE`이면 `details[].value`의 GitHub App 설치 주소 안내) | ✅ |
| SVC 배포 | `POST …/services/{id}/deploy-requests` `{environmentId, branch \| commitSha}` | ✅ |
| SVC 배포 진행 | `GET /orgs/{orgId}/deploy-requests/{id}` (`status`·`stageTimes`·`build.reused`·`errorCode`·`revertStatus`) | ✅ (실시간 전까지 2초 폴링) |
| SVC 배포 이력 · 되돌리기 · 로그 | 이력 `rollbackable`·`isCurrent` · `POST /orgs/{orgId}/deploy-requests/{id}/rollback` · `GET …/deploy-requests/{id}/logs?source=DEPLOY_JOB\|BUILD\|RUNTIME&cursor&limit` | ✅ (11/3 운영) |
| S01 대시보드 | 환경 목록 · 서비스 상세 · 지표(4-2) · 진행 중 재난(4-3) · 최근 이벤트·활동(4-8) | ✅ |
| S01-D 재난 시뮬레이션 · S01-R 휴대폰 리모컨 | 재난 만들기·미리보기(4-3) | ✅ |
| E01-1 대피처 고르기 | 대피 후보·점수(4-4) | 🆕 |
| E01-2 AI 사전 점검 | 실행·단계·로그·패치·패치 승인(4-5) ✅ | ✅ |
| E01-3 계획 승인 | 이전 계획·승인(4-6) · 보안 비교(4-7) | ✅ |
| M01 이전 목록 · M02 이전 실행 (계획·긴급·복귀, Live·Result) | 이전 실행·단계·트래픽·쓰기 전환·측정 결과(4-6) | 🆕 |
| SEC 보안 (Matrix · Compare · 근거 드로어) | 매트릭스 · finding · 비교 (4-7) | ✅ |
| AUD 감사 로그 | 감사 로그 조회(4-8) | ✅ |

🔁 서비스 목록 요약: 목록 표에 "어디서 서비스 중인지 · 버전"을 보여 주므로, `ServiceSummary`에 `servingEnvironment {id, name, kind}`와 `currentCommitSha`가 있으면 상세를 서비스마다 부르지 않아도 된다. 없으면 프론트가 상세를 따로 부른다(서비스 수가 적어서 데모에는 문제없음).

> 11/2 프론트 구현 메모: 서비스 목록·대시보드 환경 카드는 지금 서비스마다 상세를 불러 채운다. 재난(4-3)·환경 좌표(4-1)는 API 가 생기기 전까지 프론트가 브라우저 안에서 시뮬레이션한다(`src/lib/api/disasters.ts`, `src/lib/geo.ts`). 서버 API 가 생기면 같은 모양으로 바꾼다.

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

✅ 운영에 열렸다(echo-was #68). 환경 목록 · 단건 응답에 `coordinates: {lat, lng} | null` 이 있다. 화면은 서버 값을 먼저 쓰고, `null` 이면 `lib/geo.ts` 의 이름 표로 찾는다. 서비스 상세 · 배포 요청의 `environment` 참조에는 없어서 환경 `id` 로 합친다.

### 4-2. 대시보드 지표 (F17)

✅ 운영에 열렸다(echo-was #81 · #82, 원본은 echo-was `docs/api/metrics.md`).

`GET /orgs/{orgId}/services/{id}/metrics?range=15m&step=10s`

```json
{"range": "15m", "step": "10s", "asOf": "…",
 "metricsStatus": "OK", "metricsErrorCode": null,
 "series": [{"environmentId": "…", "environmentName": "aws-tokyo", "cloudProvider": "aws",
             "points": [{"t": "…", "rps": 10.2, "successRate": 0.9998, "p95Ms": 182}]}],
 "summary": {"successRate": 0.9998, "p95Ms": 182, "replicationLagMs": 120, "errorBudgetLeft": 0.72, "sloTarget": 0.999},
 "simulated": false}
```

- `metricsStatus` 가 `UNAVAILABLE` · `NOT_CONFIGURED` 여도 200 이고 `series: []`, summary 칸은 `null` 이다. 화면은 값을 비우고 이유만 적는다.
- 대기 환경은 평소 `points: []` 가 정상이다. 앱 경로 요청이 없으면 `rps: 0` 이고 성공률 · p95 는 `null` 이다.
- KPI 4칸(성공률 · p95 · 복제 지연 · 에러 버짓)과 평소 요청 그래프가 이 응답을 쓴다. 이전 중 A·B 그래프는 지금처럼 서버가 적용한 비율선이다. 10초마다 다시 부른다(서버 캐시 5초).

### 4-3. 재난 (2차 P1)

✅ 운영에 열렸다(echo-was #70, 원본은 echo-was `docs/api/disasters.md`). 재난은 늘 시뮬레이션이지만, 기준을 넘으면 서버가 피해 서비스의 `EMERGENCY` 이전 계획을 만들고 자기 승인이 켜진 조직에서는 **실제 이전이 바로 시작된다**. 화면은 이 경우 확인을 받는다.

| 동작 | 경로 |
|---|---|
| 미리보기 | `GET …/disasters/preview?type&lat&lng&magnitude` → `{radiusKm, meetsThreshold, affected[], safe[], unknown[]}` (저장 안 함) |
| 만들기 | `POST …/disasters` `{type, epicenter{lat, lng}, magnitude}` → 201 `Disaster` (개발자, 사람만) |
| 조회 | `GET …/disasters?status=ACTIVE\|ENDED&page&size` · `GET …/disasters/{id}` |
| 종료 | `POST …/disasters/{id}/end` → `ENDED`. 복귀 잠금이 풀린다 |

- `Disaster`: `{id, type, source, simulated, magnitude, epicenter, radiusKm, meetsThreshold, status, affectedEnvironmentIds[], safeEnvironmentIds[], unknownEnvironmentIds[], createdBy, endedBy, startedAt, endedAt, plans[{serviceId, planId, outcome, reason, targetEnvironmentId, planStatus}]}`.
- 건너뛴 서비스는 만들기 응답의 `plans` 에만 있어서 화면은 그 순간 토스트로 알린다. `epicenterLabel` 은 서버에 없어 좌표로 만든다.
- 지진 M7.0 이상, 태풍은 늘 기준을 넘는다. 기준 미달은 저장만 하고 복귀 · 도착을 막지 않는다. M7.2 반경은 302km 다.
- 계획 요약 · 상세에 `disasterId`, 상세에 `failback {allowed, reason, disasterId}` 가 있다. 복귀 버튼은 `failback.allowed` 를 따른다. 끝나지 않은 재난의 피해 환경으로 계획을 만들면 409 `DISASTER_ACTIVE` 다.
- 실시간 채널이 없어 진행 중인 재난은 5초마다 다시 부른다.

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

✅ 운영에 열렸다(echo-was #69, 원본은 echo-was `docs/api/prechecks.md`). 결과는 러너(echo-ai-agent)가 돌아야 생긴다.

| 동작 | 경로 |
|---|---|
| 점검 시작 | `POST /orgs/{orgId}/prechecks` `{serviceId, targetEnvironmentId}` → 201 `PrecheckDetail`(`QUEUED`). 열린 실행이 있으면 409 `PRECHECK_IN_PROGRESS` + `details[{field: "runId", value}]` 라 그 id 로 이어서 본다 |
| 점검 상세 | `GET …/prechecks/{id}` → `{status, failureCode, simulated, aiReviewed, sandboxId, steps[{name, firstAt, lastAt, level}], model, configDiff[], featureGaps[], findings[], patches[], blockedAttempts[]}` |
| 로그 | `GET …/prechecks/{id}/logs?after&size` → `{items[{seq, at, step, level, message}], nextAfter}` |
| 취소 | `POST …/prechecks/{id}/cancel` |

- 목록 API 가 없다. 화면은 주소의 `run` 으로 점검을 찾고, 끝낸 점검에서 계획으로 갈 때 `precheck` 를 넘긴다.
- `simulated` 는 결과 값을 지어냈는지(러너 가짜 모드), `aiReviewed` 는 모델을 썼는지다. 따로 보인다.
- 끝나지 않은 동안 2초마다 다시 부른다.
- 패치 승인·거절은 `POST …/prechecks/{id}/patches/{patchId}/approve`·`reject` 본문 `{patchHash, reason?}` 이다(echo-was #79). 서버 반영 스위치가 꺼져 있으면 승인해도 반영 대기다. `blockedAttempts` 는 "에이전트가 운영을 바꾸려다 막힌 기록"(F16)이고 늘 `confirmed: false` 다.

### 4-5-2. 클라우드 비용 · AI 데이터 레지던시 ✅

- 비용: `GET /orgs/{orgId}/costs`(echo-was `docs/api/costs.md`). `environments[]`·`shared[]` 는 목록가 추정, `billing[]` 은 어제까지 청구다. AWS 청구는 계정 전체라 환경 값으로 쓰지 않는다
- 레지던시: 사전 점검 상세 `processing` 과 `GET /orgs/{orgId}/ai/residency?days=7`(echo-was `docs/api/ai-residency.md`). `processing: null` 은 "기록 없음"이고 밖으로 안 나갔다는 뜻이 아니다

### 4-5-1. 앱 환경 변수 (F1)

✅ 운영에 열렸다(echo-was #62, 원본은 echo-was `docs/api/variables.md`). 경로 머리 `/orgs/{orgId}/services/{serviceId}/environments/{environmentId}/variables`. `GET` → `{items[{key, version, secretRef, updatedAt, updatedBy, appliedVersion, pendingRedeploy}], simulated}`, `PUT …/{key}` `{value}`(개발자), `DELETE …/{key}`(어드민).

쓰기 전용이라 값은 어떤 응답에도 없다. 연결은 그 환경의 첫 배포 때 생기므로 화면은 서비스 상세의 연결된 환경만 보인다. 앱은 다시 배포해야 바뀐다.

### 4-6. 이전 계획·실행·결과·복귀 (F6~F10, F17)

> 11/3: E01-3 은 운영 API 서버 8(`POST /services/{id}/migration-plans` · `GET/approve/reject/cancel/abort/logs`)에 붙였다. 서버 단계는 고정(PREFLIGHT · SHIFT 10/50/100 · DATA_SYNC_CHECK)이고 쓰기 전환 단계는 아직 없다. 건수 기준 판정(API 서버 8-1, echo-was #22)도 붙였다: 만들기 `requiredRequests`[10%·50%·100%] · `maxWaitSeconds`(`observeSeconds` 는 없어졌다), 실행 중 `progress`(건수·5xx·남은 초)를 1초마다, 데모 실패 주입 `simulate{reason, failAtStep}`, 승인 409 `PLAN_STALE` 의 `details[].field` 로 바뀐 항목 표시. 11/4: 복귀 표시는 서버가 만들 때 판정한 응답 `mode`(`PLANNED` · `FAILBACK` · `EMERGENCY`, echo-was `specs/api-8-3-plan-mode.md`)를 쓴다. 복귀의 복귀는 `PLANNED` 다. 데모 실패 주입은 실제 실행기에서 서버가 거절하므로 도착 연결의 `simulated: false` 면 고르지 못한다.

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

- `result`: DB 컷오버 결과(✅ API 서버 16, echo-was #63). `{writePauseMs, missingRows, duplicateRows, rowsTotal, kind, measuredBy, pausedAt, resumedAt, drainMs, catchupMs, switchMs}`. `kind` 는 이전이 `CUTOVER`, 복귀가 `ROLLBACK`이고 `measuredBy` 는 값이 있으면 `INFRA_SCRIPT`다. 끝나지 않은 계획은 `null`, 끝났지만 값이 없으면 칸이 전부 `null`(`measuredBy` 로 구분), 롤링 배포 중에는 칸 자체가 없을 수 있다. 결과는 사람이 스크립트를 돌린 뒤 생기고 서버 캐시가 5초라, 성공한 계획에 값이 없으면 끝난 뒤 10분 동안 5초마다 다시 부른다. 총 시간·실패 요청·복제 지연은 단계 지표로 계산하고 `rpoSeconds` 는 아직 없다.
- `failback.allowed = false`이면 복귀 버튼 비활성 + 이유 표시(재난 미종료 지역 복귀 금지, 11/2 결정).
- 실행 중 숫자는 3장 `migration.metrics`로 받는다.

> 11/3 M02 Result 에 필요한 칸 (가칭, 데이터 이전 엔진 · API 서버 8 에 요청 후보): 계획 상세 `result` 에 `writePauseSeconds`(쓰기 정지 시간) · `missingRows` · `duplicateRows` · `rowsCompared` · `rpoSeconds` · `failedRequests`. 근거는 echo-infra #18 PoC 측정 항목(쓰기 정지 ≈0.30s, 누락·중복 0, 복귀 ≈0.46s, 복제 지연 ≈0.1s, 로컬 값). 지금 프론트는 실패 요청을 단계 지표(오류율 × 요청 수)로 계산하고 나머지는 `—` 로 둔다.

### 4-7. 보안 (F12·F13)

| 동작 | 제안 |
|---|---|
| 매트릭스 ✅ | `GET /orgs/{orgId}/security/matrix` → `{policyVersion, phase, checkedAt, rows[{environmentId, environmentName, environmentKind, services[], cells{iam, encryption, auditLog, policy}: {result: PASS \| WARN \| FAIL \| NA \| UNKNOWN, findingCount, hasException, mode, checkedAt, expiresAt, controls[{controlId, title, result, isMandatory, reasons[], findingIds[], mode, checkedAt, expiresAt, serviceId}]}}]}` (빈칸 0, NFR-09. 미수집은 `UNKNOWN`) |
| finding 목록 ✅ | `GET /orgs/{orgId}/security/findings?environmentId&serviceId&controlId&findingId&includeExpired&page&size` → 페이지 `{id, controlId, result, reason, source(TRIVY_IMAGE \| GITLEAKS \| TLS_PROBE …), origin(RULE \| HUMAN \| AI), mode, environmentId, serviceId, collectedAt, expiresAt, evidenceRef, items[], totalItems}` |
| 이전 전후 비교 ✅ | `GET /orgs/{orgId}/security/compare?source=&target=&serviceId=` → `{policyVersion, phase, checkedAt, simulated, serviceId, source, target, summary{blocking, worseOnTarget, same, better}, rows[{control, source: cell, target: cell, blocksMigration, blockingControlIds[], change: WORSE \| SAME \| BETTER}]}`. 칸은 매트릭스 칸과 같다. E01-3 은 `serviceId` 를 넣어 게이트 판정과 맞춘다 |

> 11/6: `compare` 가 운영에 열렸다(echo-was #84). `blocksMigration` 은 필수 통제가 FAIL · UNKNOWN 이고 예외가 없으면 true 라 시뮬레이션의 "FAIL 일 때만" 보다 엄격하다. `lib/api/security.ts` 의 시뮬레이션은 지웠다.
>
> 11/5: 매트릭스 · finding 은 운영 API 를 부른다(echo-was #59). finding 은 `controlId`(`C-IMG-1`)로 오므로 칸과는 매트릭스의 `controls[].findingIds` 로 잇고, 칸을 열 때 `findingId` 로 그 칸의 증거만 부른다. 서버 `findingCount` 는 판정에 쓴 증거 수라, 칸 글자의 건수는 WARN · FAIL 통제 수로 센다.
>
> 11/4: 김형래 제안(슬랙)대로 맞추고 `UNKNOWN` 을 더했다. 서버(echo-was #28)가 생기기 전까지 `lib/api/security.ts` 가 같은 모양으로 시뮬레이션하고 화면에 항상 `simulated` 배지를 단다. 이전 차단은 서버 판정이 기준이고 버튼 비활성은 안내일 뿐이다.

> 11/5: 기한부 예외(echo-was #64) `GET /orgs/{orgId}/security/exceptions` 를 SEC Exceptions 탭에 보인다. 만들기 · 승인 · 철회 화면은 없다. 게이트가 막으면 승인 409 `SECURITY_GATE_BLOCKED` + `details[{field: 통제 ID, reason: 사유}]` 이고 E01-3 에 통제별로 보인다. 일꾼 시작에서 막히면 계획이 `FAILED`(`SECURITY_GATE_BLOCKED`) 다.

### 4-8. 감사 로그 (F5)

✅ 운영에 열렸다(echo-was #66, 원본은 echo-was `docs/api/audit-logs.md`).

`GET /orgs/{orgId}/audit-logs?actorType&result&action&targetType&targetId&from&to&q&includeReads&page&size` → 최신순 페이지 `{id, at, actor{type, userId, githubLogin, agentTokenId, agentTokenName, component}, action, route, path, target{type, id, label}, result: SUCCEEDED | DENIED | FAILED, reason, details, requestId}`.

`action` 은 문자열로 읽는다(옛 거부 줄은 `POST /api/…` 그대로). 대시보드 "최근 활동"은 `includeReads=false&size=3` 이다. 내보내기 API 는 없다.

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
