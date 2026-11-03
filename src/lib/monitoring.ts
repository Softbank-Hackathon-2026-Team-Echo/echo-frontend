// 오류 추적(Sentry). DSN 이 있을 때만 켜고, SDK 는 첫 화면이 그려진 뒤 따로 불러온다(첫 화면 번들에 넣지 않는다).
// SDK 를 불러오기 전에 난 오류는 모아 두었다가 켜진 뒤 보낸다
import { isApiError } from './api/errors';
import { routePattern } from './route-pattern';

type Sentry = typeof import('./sentry-sdk');
type Context = { tags?: Record<string, string>; extra?: Record<string, unknown> };

const DSN = import.meta.env.VITE_SENTRY_DSN;
// 화면 전환 추적은 일부만 표본으로 남긴다(무료 플랜 한도)
const TRACES_SAMPLE_RATE = 0.2;

let sentry: Sentry | undefined;
const pending: Array<(sdk: Sentry) => void> = [];

function withSentry(task: (sdk: Sentry) => void) {
  if (!DSN) return;
  if (sentry) task(sentry);
  else pending.push(task);
}

export async function initMonitoring(): Promise<void> {
  if (!DSN || sentry) return;
  const sdk = await import('./sentry-sdk');
  sdk.init({
    dsn: DSN,
    release: import.meta.env.VITE_SENTRY_RELEASE,
    environment: import.meta.env.MODE,
    // 자동 수집하는 사용자 정보(IP 등) · 쿠키 · 헤더 · 본문 · 주소 쿼리는 보내지 않는다. 사용자는 GitHub 아이디만 직접 붙인다
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    integrations: [
      sdk.browserTracingIntegration({
        // 화면 로드 · 이동 이름을 경로 패턴으로 묶어 Web Vitals(LCP · INP · CLS)를 화면별로 본다
        beforeStartSpan: (options) => ({
          ...options,
          name: routePattern(location.pathname),
          attributes: { ...options.attributes, 'sentry.source': 'route' },
        }),
        // 느린 클릭(INP)이 어떤 스크립트 때문인지 보려고 긴 애니메이션 프레임도 남긴다
        enableLongAnimationFrame: true,
      }),
    ],
    tracesSampleRate: TRACES_SAMPLE_RATE,
    // API 요청에 추적 헤더(sentry-trace · baggage)를 붙이지 않는다. echo-was CORS 허용 헤더에 없어 요청이 막힌다
    tracePropagationTargets: [],
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1,
  });
  sentry = sdk;
  for (const task of pending.splice(0)) task(sdk);
  // 오류가 난 세션만 녹화하고, 글자 · 입력칸 · 이미지는 전부 가린다
  const { replayIntegration } = await import('./sentry-replay');
  sdk.addIntegration(
    replayIntegration({ maskAllText: true, maskAllInputs: true, blockAllMedia: true }),
  );
}

/**
 * 보낼 만한 오류인지. 401 · 403 · 404 · 409 · 422 같은 4xx 는 화면이 이미 처리하는 예상된 응답이라 보내지 않는다
 */
export function isReportable(error: unknown): boolean {
  if (!isApiError(error)) return true;
  return error.status >= 500 || error.status === 0 || error.code === 'UNEXPECTED_RESPONSE';
}

/** 오류 하나를 보낸다. API 오류면 requestId(X-Request-ID)를 태그로 붙여 echo-was 로그와 맞춰 본다 */
export function reportError(error: unknown, context: Context = {}): void {
  if (!isReportable(error)) return;
  withSentry((sdk) => {
    sdk.withScope((scope) => {
      if (isApiError(error)) {
        scope.setTags({
          'api.status': String(error.status),
          'api.code': error.code,
          ...(error.requestId ? { 'api.request_id': error.requestId } : {}),
        });
        scope.setFingerprint(['api', String(error.status), error.code]);
      }
      if (context.tags) scope.setTags(context.tags);
      if (context.extra) scope.setExtras(context.extra);
      sdk.captureException(error);
    });
  });
}

/** 로그인한 사람(GitHub 아이디)과 지금 조직을 붙인다. 로그아웃이면 null */
export function setMonitoringUser(user: { githubLogin: string } | null, orgSlug?: string): void {
  withSentry((sdk) => {
    sdk.setUser(user ? { username: user.githubLogin } : null);
    sdk.setTag('org', orgSlug ?? 'none');
  });
}
