# 디자인 토큰 사용 규칙

- **적용 대상**: echo-frontend의 모든 스타일(컴포넌트·페이지·shadcn/ui 생성 파일)
- **원본**: Figma 「Team Echo 본선」 파일의 변수 컬렉션 `EchoPort / Color · Size · Type` → [src/styles/tokens.css](../../src/styles/tokens.css)
- **우선순위**: Figma 변수 > `tokens.css` > 이 문서. 셋이 다르면 Figma를 다시 뽑아 `tokens.css`를 바꾸고, 이 문서를 같은 PR에서 고친다

> **핵심**: 화면의 모든 색·간격·글자·반경·그림자는 `--ep-*` 토큰에서 온다. 코드에 값을 직접 쓰지 않는다.

---

## 1. 파일과 불러오는 순서

| 순서 | 파일 | 하는 일 | 고치는 법 |
|---|---|---|---|
| 1 | `src/styles/tokens.css` | `--ep-*` 변수 정의. `:root`(라이트) · `[data-theme='dark']` · `[data-theme='projector']` | **손으로 고치지 않는다.** Figma에서 다시 뽑는다 |
| 2 | `src/styles/shadcn-theme.css` | shadcn/ui 변수(`--background`, `--primary` …)를 `--ep-*`에 연결 | 새 shadcn 변수가 필요할 때만 한 줄 더한다 |
| 3 | `src/styles/index.css` | `@import "tailwindcss"`, `@theme inline`으로 Tailwind 클래스 ↔ 토큰 연결, `dark` 변형, 기본 글꼴 | 아래 §3 표와 같게 유지한다 |

- shadcn CLI가 `index.css`의 테마 변수를 oklch 값으로 덮어쓰지 않게 한다. `components.json`의 `tailwind.css`는 `src/styles/index.css`를 가리키고, `add`로 컴포넌트를 받은 뒤 `git diff`로 CSS 변경이 없는지 본다.
- 글꼴은 Inter(본문)와 Geist Mono(코드·해시·숫자)다. `@fontsource-variable`로 넣고 외부 CDN을 부르지 않는다.

## 2. 테마 3개

| `data-theme` | 언제 | 비고 |
|---|---|---|
| (없음) / `light` | 기본 | `:root` 값 |
| `dark` | 사용자가 고른 경우 | 색만 바뀐다. 차트 3~6·일부 status solid는 라이트 값을 그대로 쓴다 |
| `projector` | 시연 화면(빔 프로젝터) | 라이트보다 대비가 높고 **글자 크기 단계가 커진다**. 레이아웃이 넘치지 않는지 이 모드로도 확인한다 |

- 바꾸는 곳은 `useTheme` 훅 하나다. `<html data-theme>`를 바꾸고 선택을 `localStorage`에 남긴다(읽기·쓰기는 try/catch, 실패해도 라이트로 동작).
- Tailwind `dark:` 변형은 `[data-theme=dark]` 기준으로 정의한다(`@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *))`). 토큰이 이미 테마를 따라가므로 `dark:`는 거의 쓰지 않는다. 쓸 일이 생기면 토큰이 빠진 것인지 먼저 의심한다.

## 3. Tailwind 클래스 ↔ 토큰

### 색

Tailwind v4는 색 이름 하나를 `bg-`·`text-`·`border-`에 같이 쓴다. shadcn 이름(`primary`·`muted` …)이 먼저 자리를 잡고 있으므로 EchoPort 이름은 겹치지 않게 짓는다.

| 클래스 이름 | 토큰 | 용도 |
|---|---|---|
| `canvas` · `surface` · `raised` · `subtle` · `inverse` · `overlay` | `--ep-color-bg-*` | 페이지 바탕 · 카드·사이드바 · 팝오버·메뉴 · 옅은 면 · 반전 면 · 다이얼로그 뒤 |
| `fg` · `fg-secondary` · `fg-muted` · `fg-inverse` · `fg-on-brand` | `--ep-color-text-*` | 본문 · 보조 · 흐린 글자 · 반전 면 위 · 브랜드 면 위 |
| `line` · `line-strong` | `--ep-color-border-*` | 기본 테두리·구분선 · 입력칸 테두리 |
| `brand` · `brand-hover` · `brand-subtle` · `brand-on-subtle` | `--ep-color-brand-*` | 주 버튼 · hover · 선택된 메뉴 바탕 · 그 위 글자 |
| `focus` | `--ep-color-focus-ring` | 포커스 링 |
| `success-*` · `warning-*` · `danger-*` · `migrating-*` · `ai-*` (`-fg` · `-bg` · `-solid`) | `--ep-color-status-*` | §4 상태 표현 |
| `aws` · `gcp` · `onprem` | `--ep-color-provider-*` | 환경 종류 점·태그 |
| `chart-1` ~ `chart-6` | `--ep-color-chart-*` | 차트 시리즈 (순서 고정) |
| `globe-*` | `--ep-color-globe-*` | 지구본 그림 전용 |

shadcn 이름(`background` · `foreground` · `card` · `popover` · `primary` · `secondary` · `muted` · `accent` · `destructive` · `border` · `input` · `ring` · `sidebar-*`)은 `shadcn-theme.css`가 위 토큰에 연결해 둔다. shadcn 컴포넌트 안에서는 shadcn 이름을, 우리 컴포넌트에서는 위 EchoPort 이름을 쓴다. 같은 화면에 두 이름이 섞여도 값은 같다.

### 크기·모양

| 종류 | 클래스 | 토큰 | 규칙 |
|---|---|---|---|
| 간격 | `p-4` · `gap-2` · `mt-6` … | `--ep-space-*` (`--spacing` = `--ep-space-4`) | Tailwind 기본 눈금(1 = 4px). 토큰 값만 쓴다: `0.5`(2) · `1`(4) · `1.5`(6) · `2`(8) · `2.5`(10) · `3`(12) · `4`(16) · `5`(20) · `6`(24) · `8`(32) · `10`(40) · `12`(48) · `16`(64) · `20`(80). 그 밖(`p-7` 등)은 쓰지 않는다. 요소 크기(`w-48`, `size-7`, `h-40`)는 간격이 아니라서 4px 눈금 안에서 자유롭게 쓴다 |
| 레이아웃 | `w-sidebar` · `w-sidebar-collapsed` · `h-topbar` · `max-w-content` · `px-gutter` · `px-gutter-compact` | `--ep-layout-*` | 사이드바 220 / 64, 상단 바 48, 본문 최대 1280, 여백 24 / 16 |
| 컨트롤 높이 | 버튼·입력칸 `h-8`(32), 작은 버튼 `h-7`, 큰 버튼 `h-9` | — | 조밀한 밀도(노션 IA v2). shadcn 기본보다 한 단계 낮췄다 |
| 화면 너비 | `max-compact:`(1024 미만) · `compact:`(1024 이상) · `wide:`(1280 이상) | `--ep-layout-bp-*` | 미디어 쿼리는 변수를 못 읽어서 `@theme`에 같은 숫자를 적는다. 토큰이 바뀌면 같이 고친다. shadcn이 쓰는 `sm:` 등 기본 너비는 남겨 둔다 |
| 반경 | `rounded-xs` ~ `rounded-2xl` · `rounded-full` | `--ep-radius-*` (4 · 6 · 8 · 12 · 16 · 24 · 999) | 버튼·입력칸 `md`, 카드 `lg`, 다이얼로그 `xl` |
| 그림자 | `shadow-xs` ~ `shadow-xl` | `--ep-shadow-*` | 카드 `xs`~`sm`, 메뉴·팝오버 `md`, 다이얼로그 `lg`~`xl` |
| 글꼴 | `font-sans` · `font-mono` | `--ep-font-*` | 커밋 SHA·digest·ID·로그·숫자 표는 `font-mono` |

### 글자 스타일

`text-{스타일}` 하나로 크기·행간·굵기·자간을 함께 건다. `font-semibold`·`leading-*`·`tracking-*`를 따로 붙이지 않는다.

| 클래스 | 용도 | 기본 (projector) |
|---|---|---|
| `text-h1` | 페이지 제목 | 26/34 600 (30/38) |
| `text-h2` | 섹션 제목 | 20/28 600 (24/32) |
| `text-h3` | 카드 제목 | 16/24 600 (18/26) |
| `text-title` | 표 머리·작은 제목 | 14/20 600 (16/22) |
| `text-body` · `text-body-medium` | 본문 · 강조 본문 | 13/20 400·500 (15/22) |
| `text-small` | 보조 설명 | 12/18 (14/20) |
| `text-caption` | 캡션·시각 | 11/16 (13/18) |
| `text-label` | 버튼·폼 라벨·배지 | 12/16 500 (13/18) |
| `text-overline` | 대문자 오버라인 (`uppercase` 함께) | 10/14 600 +8% (12/16) |
| `text-metric-xl` · `text-metric` | KPI 큰 숫자 · 작은 숫자 (`tabular-nums` 함께) | 24/32 · 18/24 600 (30/38 · 22/28) |
| `text-mono` | 코드·로그 줄 (`font-mono` 함께) | 11/16 (13/18) |
| `text-display` · `text-headline` · `text-stat` · `text-lead` · `text-lead-sm` | **L01 소개 화면 전용.** 히어로 제목 · 섹션 제목 · 큰 숫자 · 리드 문단 | 60/68 · 44/56 · 64/72 600 · 17/28 · 15/24 (projector 같음). Figma 텍스트 스타일 값이고 아직 변수가 아니다. 앱 화면에서는 쓰지 않는다 |

## 4. 의미 색 쓰는 법

| 의미 | 클래스 묶음 | 쓰는 곳 |
|---|---|---|
| 성공·정상 | `success` | 접속됨, 배포 성공, 보안 PASS, 동기화됨 |
| 주의 | `warning` | 동기화 안 됨, 보안 WARN, 재난 반경 근처 |
| 위험·실패 | `danger` | 실패, 보안 FAIL, 재난 반경 안, 삭제 버튼 |
| 이전 중 | `migrating` | 트래픽 전환·쓰기 전환 진행, 배포 진행 중 |
| AI | `ai` | AI 사전 점검·패치 제안·에이전트 행동 |
| 중립 | `subtle` 바탕 + `fg-muted` 글자 | 대기·확인 전·모르는 값·`simulated` 배지 |

- 배지·알림은 `-bg` 바탕 + `-fg` 글자, 점·진행 막대·차트 강조는 `-solid`를 쓴다.
- 색만으로 상태를 전하지 않는다. 배지에는 항상 글자가 있고, 아이콘이 있으면 같이 둔다.
- 브랜드색은 주 버튼과 선택 상태에만 쓴다. 상태 표현에 브랜드색을 쓰지 않는다(이전 중은 `migrating`).
- 상태 → 색 매핑은 [ui-terms.md](ui-terms.md) §4 표와 `StatusBadge` 한 곳에서만 정한다.

## 5. 금지

| 금지 | 대신 |
|---|---|
| `#4a47e0`, `rgb(…)`, `style={{ color: … }}` 에 값 | 토큰 클래스. 꼭 인라인이 필요하면 `var(--ep-…)` |
| `p-[13px]`, `text-[15px]`, `rounded-[10px]` 같은 임의 값 | 토큰에 있는 단계. 없으면 사람에게 묻는다 |
| Tailwind 기본 팔레트(`bg-blue-500`, `text-gray-600`) | §3 색 이름 |
| `font-bold text-lg leading-7` 조합 | `text-h3` 같은 글자 스타일 하나 |
| `tokens.css` 직접 수정 | Figma 변수 수정 → 다시 뽑기 |

`index.css`의 `@theme`에서 Tailwind 기본 색·글자 크기·반경·그림자·글꼴을 `initial`로 지웠다. 금지한 클래스(`bg-blue-500`, `text-sm`)는 아예 만들어지지 않는다. 간격은 기본 눈금을 쓰므로 지우지 않았고, 토큰에 없는 단계는 리뷰로 막는다.

## 6. 토큰이 바뀌었을 때

1. Figma에서 `tokens.css`를 다시 뽑아 덮어쓴다(머리 주석의 날짜도 바뀐다).
2. 새 토큰이 생겼으면 `index.css` `@theme`와 이 문서 §3에 같이 더한다. 지워진 토큰은 `grep -r "ep-<이름>" src`로 쓰는 곳을 찾는다.
3. 라이트·다크·projector에서 화면을 한 번씩 본다.
4. 커밋 type은 `style:`(값만 바뀜) 또는 `feat:`(새 토큰을 쓰는 화면이 생김).
