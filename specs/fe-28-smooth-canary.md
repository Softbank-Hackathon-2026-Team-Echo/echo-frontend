# 프론트 28 — 이전 비율 6단계 반영 + 비율 막대·숫자 부드럽게

- GitHub 이슈: https://github.com/Softbank-Hackathon-2026-Team-Echo/echo-frontend/issues/109 (Project #4)
- 서버 짝: https://github.com/Softbank-Hackathon-2026-Team-Echo/echo-was/issues/133 (SPEC `specs/api-24-canary-steps.md`, 이 파일 옆에 사본)
- 기준: echo-frontend main `83f93f7a053de5bb890cd9c5e1596b9c4a296b11`
- 상태: Confirmed (지민 결정 A1a)

## 서버가 바꾸는 것 (요약)

- 단계: `0 PREFLIGHT · 1 SHIFT 5 · 2 SHIFT 10 · 3 SHIFT 25 · 4 SHIFT 50 · 5 DATA_SYNC_CHECK · 6 SHIFT 75 · 7 SHIFT 100 · (8 DB_CUTOVER)`.
- 계획 만들기 요청 `requiredRequests` 6개(5·10·25·50·75·100% 순). 기본 `[10, 10, 20, 30, 30, 30]`.
- 단계 응답에 `minObserveSeconds`(비율 단계만, 기본 4) 추가. 비율 단계 예상 = 여유 2 + max(minObserve, min(최대 대기, ceil(N ÷ (50 × 비율/100)))).
- 실패 주입 사유별 허용 단계: ERROR_RATE·HEALTH·TRAFFIC·LOW_TRAFFIC = 1,2,3,4,6,7 / TARGET_NOT_RECEIVING = 1,2 / DATA_LAG = 5 / DB 전환 사유 = 8.
- 서버는 옛 요청(3개)도 받지만, 이 PR은 새 요청(6개)만 보낸다. 서버 배포 뒤에 병합한다.

## 바꿀 것

1. `src/lib/migration-stages.ts` `draftSteps`·주석·`planStages`: 새 단계 순서와 예상 시간(minObserve 4 반영). DB 전환은 index 8.
2. `src/pages/evacuation/PlanDraft.tsx`: 필요 건수 입력 6칸(라벨 5%·10%·25%·50%·75%·100%), 기본값 상수 갱신. 그리드는 3열 2줄.
3. `src/pages/evacuation/FailureInjection.tsx`: `REASONS`의 steps와 `STEP_LABELS`를 새 번호로(1 · 5%, 2 · 10%, 3 · 25%, 4 · 50%, 5 · 데이터 확인, 6 · 75%, 7 · 100%). DB 전환 사유를 이 화면에서 고르는 곳이 있으면 8.
4. 비율 막대·숫자 애니메이션: `src/pages/migrations/LiveTab.tsx`의 Traffic weight 막대(`flexGrow`)와 % 숫자, `src/pages/dashboard/LiveMigrationPanel.tsx`·`MigrationStatusCard.tsx`·`Topology.tsx`에 비율 막대·연결선 비율이 있으면 같은 방식. 막대는 CSS transition(약 700ms, ease-out), 숫자는 같은 시간 동안 정수로 따라 올라가게(작은 공용 훅 하나). `prefers-reduced-motion: reduce`면 바로 바뀐다. 0%인 쪽 요소를 지우지 말고 폭 0으로 두어 줄어드는 움직임이 보이게 한다.
5. 그래프(`weightTimeline`)는 서버 단계 시작 시각의 계단 모양 그대로 둔다(실측이 아닌 보간을 그리지 않는다).
6. `src/lib/api/schema.d.ts`·`types.ts`: 서버 SPEC대로 `minObserveSeconds` 추가(선택 칸). `gen:api`가 운영 서버를 읽는다면 손으로 맞추고 PR 본문에 "서버 배포 뒤 gen:api 재생성으로 확인"을 적는다.
7. 시험(`*.test.ts(x)`, `src/test/migration-fixtures.ts`): 새 단계·6칸 요청·실패 주입 표·reduced-motion 즉시 반영·옛 5단계 계획 렌더 그대로.
8. 번역 키(ko/ja)가 있는 문구는 같이 추가.

## 범위 밖

- `src/pages/evacuation/PlanPage.tsx`, `src/lib/api/migrations.ts`(도영 님 열린 PR #108이 고치는 파일). 꼭 필요하면 고치지 말고 보고.
- 서버 코드, 진입점, 새 그래프 종류.

## 완료 기준

1. 계획 만들기 화면에 6개 비율 단계 + 데이터 확인(50% 뒤)이 보이고, 6칸 값이 `requiredRequests` 6개로 나간다(MSW 요청 본문 시험).
2. 실패 주입 단계 목록이 서버 표와 같다.
3. 진행 중 비율 막대·숫자가 부드럽게 바뀌고(transition 스타일·중간값 시험, fake timer), reduced-motion이면 바로 바뀐다.
4. 옛 5단계 계획(현재 fixture)이 그대로 보인다.
5. `pnpm lint`·`pnpm typecheck`·`pnpm test`·`pnpm build` 통과(저장소 실제 스크립트 이름을 따른다).

## 변경 이력

2026-11-07 20:10 지민 결정 C1a: 최소 관찰 기본 3초, 필요 건수 기본 [7,10,20,30,30,30]. 근거 이슈 #109 댓글 6706019275
