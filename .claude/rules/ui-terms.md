# 화면 용어 사전

- **적용 대상**: echo-frontend의 화면 문구, TypeScript 타입·변수 이름, 상태 배지
- **원본**: 도메인 용어·식별자·enum 값의 단일 출처는 echo-was `.claude/rules/term-dictionary.md`다. 이 문서는 그것을 **다시 정의하지 않고**, 프론트에서 쓰는 이름과 화면에 보이는 영어 표기만 정한다
- **우선순위**: echo-was 용어 사전 > [docs/api-contract.md](../../docs/api-contract.md) > 이 문서
- **함께 보기**: 색은 [design-tokens.md](design-tokens.md) §4

> **핵심**: 서버가 정한 영문 용어를 그대로 쓴다. 화면 문구만 사람이 읽기 좋게 바꾸고, 코드 이름은 API 필드 이름을 따른다.

---

## 1. 표기 규칙

- **API 필드·타입**: 서버 응답 그대로 camelCase(`connectionStatus`, `trafficWeight`). 프론트에서 이름을 바꾸지 않는다. 타입은 `pnpm gen:api`로 만든 `schema.d.ts`에서 꺼내 쓰고, 생성 전에는 계약 문서 모양대로 손으로 쓴 뒤 `// TODO(김도영, 날짜): gen:api로 교체`를 단다.
- **enum 값**: 서버 값 그대로 `UPPER_SNAKE`(`CONNECTED`, `IN_PROGRESS`)이고, 화면에는 §4 표의 문구로 바꿔 보여 준다. 값을 문자열로 비교하지 않고 매핑 표 한 곳을 거친다.
- **환경 종류**: `aws` · `gcp` · `onprem`(소문자, 서버 값). 화면 표기는 `AWS` · `GCP` · `On-prem`.
- **화면 문구**: 영어, 문장은 sentence case(`Simulate disaster`, `Sign in to EchoPort`). 고유명사(GitHub, AWS)와 제품명(EchoPort)만 대문자로 시작한다.
- **ID 표시**: 커밋 SHA는 앞 7자, digest는 `sha256:` 뒤 12자를 `font-mono`로 보여 주고, 전체 값은 툴팁·복사 버튼으로 준다.

## 2. 핵심 용어

| 우리말 | 화면 표기 | 코드 이름 | 메모 |
|---|---|---|---|
| 조직 | Organization | `Organization`, `orgId`, `slug` | URL은 `/o/{slug}`, API는 `/orgs/{orgId}`. slug는 바뀌지 않는다 |
| 개인 조직 | Personal | `organization.personal` | 첫 진입 때 먼저 고른다 |
| 멤버 · 역할 | Member · Role | `role: 'VIEWER' \| 'DEVELOPER' \| 'ADMIN'` | 화면 표기 Viewer · Developer · Admin |
| 환경 | Environment | `Environment`, `environmentId` | 클러스터 하나. 다른 화면·API는 `id`로만 가리키고 `name`은 표시용 |
| 환경 종류 | Provider | `kind` | `aws` · `gcp` · `onprem`. 점 색은 `aws`·`gcp`·`onprem` 토큰 |
| 위치 | Location | `location`(응답), `coordinates` 🆕 | aws·gcp는 리전, 온프레는 location |
| 접속 상태 | Connection | `connectionStatus` | §4 |
| 클러스터 정보 | Cluster | `clusterInfo` (`serverVersion`, `nodeCount`, `simulated`) | |
| 서비스 | Service | `Service`, `serviceId` | 사용자 앱 하나. 여러 환경에 동시에 있다. Kubernetes Service와 다르다 |
| 서비스-환경 연결 | (표의 한 줄) | `ServiceEnvironment` | 화면에서는 "서비스가 이 환경에 있음"으로 보여 주고 따로 이름을 붙이지 않는다 |
| 서비스 중 · 예비 | Serving · Standby | `role: 'SERVING' \| 'STANDBY' \| 'NONE'` | 조직 역할(`role`)과 이름이 같으니 변수명은 `envRole`·`memberRole`로 나눈다 |
| 트래픽 비율 | Traffic | `trafficWeight` | 0~100. 화면은 `70%` |
| 버전 상태 | Version | `versionStatus` | `IN_SYNC` → In sync, `OUT_OF_SYNC` → Out of sync |
| 배포 요청 | Deploy | `DeployRequest`, `deployRequestId` | 원터치 배포 한 번. 화면의 "Deploy" 버튼과 진행 화면 |
| 배포 기록 | Release | `Deployment` | 연결에 이미지를 올린 기록. 배포 요청과 섞지 않는다 |
| 되돌리기 | Rollback | `rollbackOfId` | 사용자가 예전 배포로 되돌리기 |
| 자동 원복 결과 | Auto revert | `revertStatus` | 실패한 새 버전을 거둔 결과. Rollback과 다르다 |
| 빌드 재사용 | Build reused | `build.reused` | 진행 화면 배지 |
| 가짜 값 | simulated | `simulated: true` | 회색 소문자 배지 `simulated` |
| 재난 | Disaster | `Disaster` (`EARTHQUAKE` · `TYPHOON`) | 화면 표기 Earthquake · Typhoon. 재난은 항상 `simulated` 이고, 기준을 넘으면 그 재난이 시작한 이전은 실제다 |
| 대피 후보 🆕 | Evacuation | `EvacuationCandidate` | 메뉴 이름 Evacuation |
| AI 사전 점검 | AI pre-check | `PrecheckDetail` | 패치 = Patch, 막힌 시도 = Blocked attempt |
| 이전 | Migration | `MigrationPlan.mode` (`PLANNED` · `EMERGENCY` · `FAILBACK`) | 화면 표기 Planned · Emergency · Failback. 서버가 판정한다 |
| 쓰기 전환 🆕 | Writer cutover | `writerCutover` | 단계 Pause writes · Fence · Confirm LSN · Promote |
| 보안 매트릭스 🆕 | Security | `SecurityMatrixRow`, `SecurityFinding` | 결과 PASS · WARN · FAIL · N/A · Unknown |
| 감사 로그 | Audit log | `AuditLog` | 행위자 User · Agent · System |
| 에이전트 토큰 | Agent token | `AgentToken` | |

🆕 = 계약 문서 4장의 요청 초안이다. 서버가 이름을 정하면 이 표와 계약 문서를 같이 고친다.

## 3. 메뉴와 화면

| 메뉴 | 경로 | 화면 ID |
|---|---|---|
| Dashboard | `/o/:slug` (+ 상단 바 Simulate disaster → S01-D 다이얼로그) | S01 |
| Services | `/o/:slug/services` · `/o/:slug/services/:serviceId` · `/o/:slug/services/:serviceId/deploys/:deployRequestId` | SVC 목록 · 상세 · 배포 진행 |
| Evacuation | `/o/:slug/evacuation` | E01-1 ~ E01-3 |
| Migrations | `/o/:slug/migrations` | M01 · M02 |
| Security | `/o/:slug/security` | SEC |
| Audit log | `/o/:slug/audit` | AUD |
| Settings | `/o/:slug/settings/{environments,members}` | SET |
| — | `/login` | L01-b |
| — | `/o/:slug/remote` (사이드바 없음, 휴대폰 시연 리모컨) | S01-R |
| — | `/o/:slug/onboarding` (사이드바 없음, Skip setup → 대시보드) | O01 ~ O03 |

경로는 fe-1에서 정하는 가칭이다. 바꾸면 이 표를 같은 PR에서 고친다.

## 4. 상태 → 화면 문구 · 색

모르는 값이 오면 원래 값을 그대로 쓰고 중립 색으로 보여 준다(화면이 깨지지 않게).

| 필드 | 값 → 문구 · 색 |
|---|---|
| `connectionStatus` | `UNCHECKED` → Not checked · 중립 / `CONNECTED` → Connected · success (`clusterInfoError` 가 있으면 클러스터 칸은 정보만 못 읽었다는 문구) / `FAILED` → Failed · danger (툴팁에 `clusterInfoError`) |
| 배포 요청 `trigger` | `MANUAL` → Manual / `STANDBY_SYNC` → Standby sync / `ROLLBACK` → Rollback (`rollbackOfRequestId` 가 대상) |
| 배포 요청 `cancelReason` | `SUPERSEDED` → 새 배포에 밀림 / `SERVICE_DELETED` → 서비스 삭제 / `BASE_CHANGED` → 되돌리기 시작 전에 다른 버전이 올라감 |
| 배포 요청 `status` | `QUEUED` → Queued · 중립 / `BUILDING` → Building · migrating / `DEPLOYING` → Deploying · migrating / `VERIFYING` → Verifying · migrating / `SUCCEEDED` → Succeeded · success / `FAILED` → Failed · danger / `CANCELLED` → Cancelled · 중립 |
| `versionStatus` | `IN_SYNC` → In sync · success / `OUT_OF_SYNC` → Out of sync · warning |
| `role`(연결) | `SERVING` → Serving · success / `STANDBY` → Standby · 중립 / `NONE` → — |
| 보안 `result` 🆕 | `PASS` · success / `WARN` · warning / `FAIL` · danger / `NA` → N/A · 중립 / `UNKNOWN` → Unknown · 중립 (미수집) |
| 이전 계획 `status` | `PENDING_APPROVAL` → Waiting for approval · warning / `APPROVED` → Approved · migrating / `RUNNING` → Migrating · migrating / `ROLLING_BACK` → Rolling back · warning / `SUCCEEDED` · success / `ROLLED_BACK` → Rolled back · warning / `FAILED` · danger / `REJECTED` · `CANCELLED` · `EXPIRED` · `STALE` → 중립 |
| 초대 `status` | `PENDING` → 대기(목록에 보임) / `ACCEPTED` · `EXPIRED` · `REVOKED` → 목록에서 뺀다 |
| 에이전트 토큰 | `revokedAt` 있음 → Revoked · 중립 / `expiresAt` 지남 → Expired · 중립 / 그 밖 → Active · success |
| 감사 `result` | `SUCCEEDED` → Succeeded · success / `DENIED` → Denied · danger / `FAILED` → Failed · danger |
| 사전 점검 `status` | `QUEUED` → Waiting for a runner · 중립 / `CLAIMED` · `RUNNING` → Running · ai / `SUCCEEDED` · success / `FAILED` · `TIMED_OUT` → danger / `CANCELLED` · 중립 |
| AI 관련 전부 | ai 색 |

## 5. 혼동 주의

| 단어 | 이 레포에서 | 헷갈리는 것 |
|---|---|---|
| Role | 조직 역할(VIEWER·DEVELOPER·ADMIN) | 연결 역할(SERVING·STANDBY). 변수명을 `memberRole`·`envRole`로 나눈다 |
| Deploy | 배포 요청(`DeployRequest`) | 배포 기록(`Deployment`) |
| Rollback | 사용자 되돌리기 | 자동 원복(`revertStatus`) |
| Environment | 배포 대상 클러스터 | 실행 단계(dev·prod)와 `.env`. 빌드 설정을 말할 때는 "실행 모드"라고 쓴다 |
| Service | 사용자 앱 | Kubernetes Service, 코드의 `*Service` |
| Session | 로그인 세션(쿠키) | 브라우저 `sessionStorage`. 우리는 세션을 저장소에 두지 않는다 |
| Simulated | `simulated`: 서버가 준 가짜 값, 또는 API 가 없어 브라우저가 흉내 낸 값(재난·대피 후보) | 앱 목업(MSW)은 11/3 에 지웠다. 테스트의 MSW 와 섞지 않는다 |
