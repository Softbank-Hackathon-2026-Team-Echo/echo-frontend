---
name: write-pr
description: Use when 이 프로젝트(echo-frontend)에서 작업 브랜치의 변경사항을 PR 본문으로 정리할 때 — "PR 본문 작성", "PR 초안", "PR 문서 만들어줘" 등. .github/PULL_REQUEST_TEMPLATE.md 구조를 따라 docs/PR.md 로 간결하게 작성하고(노션 태스크 링크, 작업 요약의 화면 흐름, 화면 확인 결과, 남은 목업 포함), 변경에 맞춰 README.md·CLAUDE.md 를 동기화한다. 실제 GitHub PR 은 만들지 않는다.
allowed-tools: "Bash, Read, Grep, Glob, Write, Edit"
---

# PR 본문 작성 스킬 (echo-frontend)

작업 브랜치의 `main` 대비 변경사항을 분석해, 이 프로젝트의 PR 템플릿 구조에 맞춰 `docs/PR.md` 로 **핵심만 간결하게** 작성하고, 변경에 맞춰 README.md·CLAUDE.md 를 동기화한다.

> 실제 GitHub PR(`gh pr create`)은 생성하지 않는다. 본문 문서와 문서 동기화 커밋만 만든다 — 푸시·PR 생성은 사용자가 직접 한다.

---

## 작업 절차

### Step 1: 상태 확인

```bash
git rev-parse --show-toplevel   # git 레포 아니면 중단
git branch --show-current
git status --short
git diff main...HEAD --stat
```

- git 레포가 아니면 중단.
- 현재 브랜치가 `main` 이면 중단하고 새 브랜치 생성 여부를 사용자에게 확인.
- `main` 대비 변경(diff/커밋)이 없으면 중단하고 보고.
- 커밋하지 않은 변경이 있으면 보고하고, PR 본문에 넣을지 사용자에게 묻는다.

### Step 2: 변경 내용 분석

```bash
git log main..HEAD --oneline
git diff main...HEAD --stat
```

- 커밋 메시지와 변경 파일로 **무엇을·왜** 바꿨는지 파악한다.
- 핵심이 불명확하면 주요 파일의 diff(`git diff main...HEAD -- <file>`)를 읽어 보강한다.
- **화면 흐름**을 그릴 수 있도록, 바뀐 화면(라우트·화면 ID)과 그 화면이 쓰는 쿼리 훅·API 를 식별한다.
- 아래도 함께 모은다.
  - 바뀐 화면 목록(경로·화면 ID) — 스크린샷이 필요한 곳
  - 새로 쓰거나 바꾼 API(✅ 있는 것 / 🆕 `(가칭)` 요청 초안) — `docs/api-contract.md` 변경 여부
  - 남아 있는 목업(`grep -rn "MOCK:" src/mocks`)과 새 `simulated` 표시
  - 디자인 토큰 변경(`src/styles/tokens.css`, `index.css` `@theme`)

### Step 3: 템플릿 구조 읽기

```bash
cat .github/PULL_REQUEST_TEMPLATE.md
```

- **항상 현재 템플릿을 읽어** 섹션 제목·순서를 그대로 따른다(템플릿이 바뀌어도 동기화 유지). 섹션을 임의로 추가·삭제하지 않는다.
- 현재 템플릿: 맨 위 `노션 태스크:` 줄 + 섹션 `🎯 목적` / `📝 작업 요약` / `✅ 체크리스트` / `📌 기타`.
- `노션 태스크:` 링크는 **직접 찾아 채운다**(사용자에게 묻지 않는다). 작업 SPEC(`specs/*.md`) → 관련 GitHub 이슈 본문 첫 줄 `노션 태스크:` 순서로 찾는다.
  ```bash
  gh issue view <번호> -R Softbank-Hackathon-2026-Team-Echo/echo-frontend --json body --jq .body | head -1
  ```
  이슈가 여러 개면 이슈마다 한 줄씩 적는다. 맞는 태스크가 정말 없으면 가장 가까운 태스크에 "(후속 수정)"을 붙인다.
- 이슈를 닫을지: 이슈 완료 기준을 이 PR 이 모두 채우면 `Closes #N`, 일부만이면 `Refs: #N` 과 남은 것을 적는다.

### Step 4: 검증 결과 모으기

PR 본문에는 실제로 돌린 결과만 적는다. 돌리지 않았으면 "안 돌림"이라고 적는다.

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

- 화면을 바꿨으면 **스크린샷을 직접 찍어 넣는다**(사용자에게 맡기지 않는다).
  1. `.env.local` 의 `VITE_USE_MOCKS=true` 로 `pnpm dev` 를 띄우고 내장 브라우저로 바뀐 화면을 연다(라이트 기본, 필요하면 dark·projector·960px).
  2. React Query devtools 버튼은 JS 로 숨긴다: `document.querySelectorAll('[class*=tsqd]').forEach(e => e.style.display = 'none')`.
  3. 이미지는 `pr-assets` 브랜치(orphan, main 에 합치지 않음)의 `pr-<번호>/` 에 올린다. 작업 트리를 건드리지 않게 별도 worktree 를 쓴다.
     ```bash
     git fetch origin pr-assets && git worktree add <임시 경로> pr-assets
     # <임시 경로>/pr-<번호>/*.jpg 복사 → commit → git -C <임시 경로> push → git worktree remove <임시 경로>
     ```
  4. 본문에는 `https://github.com/Softbank-Hackathon-2026-Team-Echo/echo-frontend/blob/pr-assets/pr-<번호>/<파일>?raw=true` 로 링크한다. PR 번호를 모르면 PR 을 만든 뒤 본문을 고친다(`gh pr edit <번호> --body-file`).
- 화면 변화가 없으면 "스크린샷: 화면 변화 없음" 한 줄.

### Step 5: `docs/PR.md` 작성

- `docs/` 가 없으면 생성. 파일은 `docs/PR.md` 고정, 있으면 덮어쓴다.
- 맨 위에 PR 제목(70자 이내, 한국어) 1줄, 그 아래 템플릿 섹션을 채운다.
- 📝 작업 요약 안에는 **화면 흐름(ASCII 다이어그램)**을 하위 항목으로 넣는다.
- ✅ 체크리스트는 **리뷰어가 중점적으로 봐줬으면 하는 부분**만 `- [ ]` 체크 항목으로 적는다.
- 템플릿의 `<!-- 주석 -->` 가이드 문구는 결과물에 남기지 않는다.

````markdown
# {PR 제목 (70자 이내, 한국어)}

노션 태스크: {노션 태스크 링크}

## 🎯 목적

{이 PR 이 왜 필요한지 1~2문장}

## 📝 작업 요약

- {핵심 변경 1}
- {핵심 변경 2}

### 화면 흐름

```text
[사용자가 하는 일을 일상 언어로 한 문장]
   ↳ pages/settings/EnvironmentsPage
              │
              ▼
[화면이 데이터를 가져온다]
   ↳ useEnvironments()  (API: GET /orgs/{orgId}/environments)
              │
       ┌─ 불러오는 중 ─▶ [Skeleton 5줄]
       ├─ 목록 없음 ──▶ [EmptyState]
       └─ 목록 있음 ──▶ [환경 표 + 접속 상태 배지]
                         ↳ StatusBadge
```

## ✅ 체크리스트

- [ ] {리뷰어가 중점적으로 봐줬으면 하는 부분·논의점 1}
- [ ] {봐줬으면 하는 부분 2}

## 📌 기타

{완료 기준(SPEC 의 AC) 확인 결과 · 검증 명령 결과 · 스크린샷 · 남은 목업 · API 요청(🆕) 현황. 해당 없는 항목은 적지 않는다}
````

> `화면 흐름` 은 PR 템플릿의 별도 섹션이 아니라 **📝 작업 요약 안의 하위 항목**이다(Step 3 의 "템플릿 섹션 임의 추가 금지"와 충돌하지 않음).

### Step 6: 문서 동기화 (README.md / CLAUDE.md / 규칙 문서)

현재 문서를 읽고, 이번 변경에 맞춰 갱신이 필요한지 판단해 **있는 내용만 최소로** 반영한다. 없는 섹션을 새로 만들거나 기존 내용을 왜곡하지 않는다.

**README.md 갱신 대상**

| 변경 유형 | 반영 위치 |
|---|---|
| 실행 방법·스크립트 변경 | 시작하기 / 자주 쓰는 명령 |
| 새 환경변수 | 환경변수 |
| 배포 설정 변경 | Cloudflare Pages |
| 의존성 변경 | 기술 스택 |

**CLAUDE.md 갱신 대상**

| 변경 유형 | 반영 위치 |
|---|---|
| 폴더 구조가 목표 구조와 달라짐 | 구조 |
| 새 명령·스크립트 | 도구 |
| 새 패턴·공통 규칙(오류 처리·권한·실시간) | 핵심 원칙 |
| 이번 작업에서 정한 것 | 결정 기록 표(날짜·결정·이유 한 줄) |

**규칙 문서 갱신 대상**

| 변경 유형 | 반영 위치 |
|---|---|
| 새 화면·메뉴·경로, 새 상태 값 | `.claude/rules/ui-terms.md` §3·§4 |
| 새 토큰·클래스 매핑 | `.claude/rules/design-tokens.md` §3 |
| 쓰는 API 가 바뀜, 🆕 요청이 확정됨 | `docs/api-contract.md` (`(가칭)`·🆕 정리) |

**갱신 불필요**: 내부 리팩토링만 / 테스트 코드만 변경 / 이미 문서에 반영됨 → 건너뛴다.

**커밋** — 문서가 실제로 바뀐 경우에만 커밋한다. 커밋 메시지는 [git-conventions.md](../../rules/git-conventions.md) 를 따른다(`docs: ...`, AI 서명 없음).

```bash
# 바뀐 문서만 스테이징 — docs/PR.md 는 커밋하지 않는다
git add README.md CLAUDE.md .claude/rules docs/api-contract.md
git commit -m "docs: README·CLAUDE.md 동기화"
```

- **`docs/PR.md` 는 커밋하지 않는다.** 코드 변경은 이미 커밋돼 있어야 한다.
- 바뀐 문서가 하나도 없으면 커밋을 **생략**한다(빈 커밋 금지).

---

## 작성 규칙

- **간결성 최우선.** 각 섹션은 핵심만. 장황한 설명·중복·인사말 금지.
- 🎯 목적: 1~2문장. 배경/이유 중심(무엇을 했는지가 아니라 왜).
- 📝 작업 요약: bullet 3~7개. 커밋 단위가 아니라 **의미 단위**로 묶는다. 화면은 화면 ID 와 경로를 같이 적는다(`SET 환경 탭 /o/:slug/settings/environments`).
- ✅ 체크리스트: `- [ ]` 체크 항목 1~5개. **리뷰어가 중점적으로 봐줬으면 하는 부분·논의점만** 적는다. 없으면 `- [ ] 특이사항 없음` 한 줄.
- 📌 기타: 작업에 SPEC 이 있으면 완료 기준(AC)별 통과 여부와 근거 명령을 짧게 적는다. 화면을 바꿨으면 스크린샷 자리, 목업이 남았으면 목록, 🆕 API 요청이 있으면 이슈 링크.
- 언어는 한국어. 용어는 [ui-terms.md](../../rules/ui-terms.md) 를 따른다.

### 화면 흐름 규칙

- 코드 블록(```text)으로 감싸 고정폭 정렬을 보장한다.
- 각 단계는 **두 줄 한 쌍**으로 적는다.
  - 1줄: `[사용자 동작 또는 화면 반응을 일상 언어로 한 문장]` — **컴포넌트·훅 이름을 1줄에 넣지 않는다.**
  - 2줄: `   ↳ 페이지·컴포넌트·훅 이름` — 그 단계를 맡는 것. 여러 개면 줄을 나눠 `↳` 로 각각 나열한다.
- 흐름은 `──▶`·`│`·`▼`, 분기는 `┌─ {조건} ─▶` / `├─` / `└─ {조건} ──▶` 처럼 **한국어 라벨**을 단다. 로딩·빈 목록·오류·권한 없음 분기를 빠뜨리지 않는다.
- API 호출·실시간 이벤트는 `(API: GET /orgs/{orgId}/…)`, `(이벤트: deploy_request.updated)` 처럼 괄호 라벨로 표기한다.
- 내부 도우미 함수는 넣지 않고 **흐름의 표지가 되는 페이지·공용 컴포넌트·쿼리 훅만** 적는다.
- 설정·문서만 바뀌어 흐름 변화가 없으면 다이어그램 대신 **"흐름 변화 없음"** 한 줄만 적는다.

## 완료 보고

```
✅ PR 본문 작성 완료 — docs/PR.md
   문서 동기화 — README.md: {수정됨/변경 없음} · CLAUDE.md: {수정됨/변경 없음} · 규칙 문서: {수정됨/변경 없음}

## 핵심 작업 사항
- {기술적으로 중요한 변경 1}
- {변경 2}
```

핵심 작업 사항은 중요한 변경만 1~5줄 bullet 으로 요약한다.
