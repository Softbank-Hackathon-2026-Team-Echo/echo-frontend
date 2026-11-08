# 독립 검토 승인 화면 검증 — 2026-11-08

WAS 후보 계약의 reviewEvidence를 기존 패치 카드에서 확인하고 사용자가 본 evidenceHash를 승인 요청에 포함한다. 구서버는 기존 `{patchHash}`만 전송한다.

- 최신 main007ee08(#127)을 충돌 없이 정상 merge한 후보. 동료 브랜치/운영 화면 직접 변경 없음.
- **424 PASS / 실패·skip0**. 검토 사유/지문/검증 범위 표시, 승인 JSON의 reviewEvidenceHash, 구버전 요청 호환, 기존 진단·승인·재배포·이관 화면 회귀 포함.
- lint/typecheck, ko·ja 번역(1,577문구), Vite 빌드·104청크 번들 예산 통과. Node22.23.4 사용, lock 변경 없음.
- 최초 Node22.12 개발 도구 실행 실패와 새 시험의 권한 조회 대기 누락은 해결했다. 실제 브라우저/운영 재배포 종단 인수로 확대하지 않는다.
- WAS 선택 응답 타입은 로컬 additive 확장이고 서버 확정 배포 뒤 gen:api로 대체한다. 새 서버→러너→화면 소비가 준비된 뒤 별도로 AI_PATCH_REVIEW_REQUIRED를 켠다. 기본 OFF·미병합·미배포.
