# 프론트 4: 과거 재난 조회 재생 SPEC

- 상태: 레이아웃 구현. 서버 조회 계약 대기(echo-was #122). 연동은 끝나지 않았다
- 작성일: 2026-11-07 · 김도영
- 근거: [echo-frontend#100](https://github.com/Softbank-Hackathon-2026-Team-Echo/echo-frontend/issues/100)

## 1. 범위

과거 재난 목록 → 사건 선택 → 상세 · 지도 → 그 시점 이전 단계 · 가중치 재생을 `/o/:slug/history` 한 화면에서 보인다. 조회 전용이다.

## 2. 지금 동작

- 운영 화면은 사건을 보이지 않고 "아직 연결되지 않음" 을 보인다. 빈 목록(0건)과 다른 상태다.
- 샘플 사건은 운영 번들에 넣지 않는다. 임시 데이터는 `src/test/disaster-history-fixture.ts` 이고 테스트와 개발 서버의 `/dev/disaster-history` 만 쓴다. `?state=pending` 이면 대기 화면이다.
- 실제 LIVE 수신은 기존 `GET …/disasters/feed` 로 읽는다. 조회 실패는 꺼짐이 아니라 확인 불가다.
- 자동 이전 상태는 서버 값이 없어 확인 불가로 둔다.

## 3. 안전 경계

- 화면은 재난 생성 · 대피 · 계획 · 복귀 · 기록 재전송 훅을 불러오지 않는다. 재생은 화면 state 의 단계 번호만 바꾼다.
- 지도는 `HistoryMap` 을 따로 두어 누를 곳이 없다. 진원지를 고르는 `DisasterMap` 과 바탕(`map-base.ts`)만 나눠 쓴다.
- 반경은 서버 값만 그린다. `radiusForMagnitude` 를 쓰지 않는다. 없으면 원을 숨기고 이유를 보인다.
- 가중치는 기록된 값만 보인다. 단계 사이를 보간하지 않는다.

## 4. 임시 모양

`src/lib/disaster-history.ts` 의 타입과 `lib/status.ts` 의 값 이름(`USGS_ARCHIVE`, `DEMO`, `SAFETY_FAILED` …)은 화면을 만들기 위한 임시 이름이다. 서버 계약이 아니다. 계약이 나오면 생성 타입으로 바꾼다.

## 5. 연동 때 할 일

1. `pnpm gen:api` 뒤 `lib/api/` 에 조회 훅을 두고 쿼리 키를 `['org', orgId, …, mode]` 로 묶는다.
2. 페이지가 `contract-pending` 대신 훅 상태를 넘긴다. 선택 사건과 필터를 주소에 둔다.
3. 조직 A/B · 늦은 응답 · 재생 mode 누출 · 권한을 시험한다. 진입 · 선택 · 재생 · 조직 전환에서 쓰기 요청 0건을 다시 시험한다.
4. 지도 범위 밖 사건은 지금 안내만 한다. 서버 데이터 범위를 보고 지도 범위를 정한다.
