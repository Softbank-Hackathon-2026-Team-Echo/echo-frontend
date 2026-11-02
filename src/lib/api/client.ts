import createClient from 'openapi-fetch';
import { ApiError } from './errors';
import type { paths } from './schema';
import type { ApiEnvelope } from './types';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export function apiUrl(path: string): string {
  return `${API_BASE_URL}/api/v1${path}`;
}

/** 페이지 이동. 테스트가 바꿔 끼울 수 있게 객체로 둔다(jsdom 은 location.assign 을 가로챌 수 없다) */
export const browserNavigation = {
  assign(url: string) {
    window.location.assign(url);
  },
};

/** 지금 화면으로 돌아오도록 로그인 화면으로 보낸다. 로그인 화면에서는 다시 보내지 않는다 */
export function redirectToLogin() {
  const { pathname, search, hash } = window.location;
  if (pathname === '/login') return;
  const next = encodeURIComponent(`${pathname}${search}${hash}`);
  browserNavigation.assign(`/login?next=${next}`);
}

function isEnvelope(body: unknown): body is ApiEnvelope<unknown> {
  return typeof body === 'object' && body !== null && 'success' in body;
}

/** 응답 본문을 봉투 규칙으로 해석한다. 성공이면 data, 아니면 ApiError 를 던진다 */
function readEnvelope<T>(response: Response, body: unknown): T {
  const requestId = response.headers.get('X-Request-ID');
  if (response.status === 401) redirectToLogin();
  if (response.status === 204) return undefined as T;

  if (!isEnvelope(body)) {
    // 프록시 오류 페이지처럼 봉투가 아닌 응답
    throw new ApiError({
      status: response.status,
      code: 'UNEXPECTED_RESPONSE',
      message: `Unexpected response (${response.status})`,
      requestId,
    });
  }
  if (!response.ok || !body.success) {
    throw new ApiError({
      status: response.status,
      code: body.code ?? 'UNKNOWN_ERROR',
      message: body.message ?? `Request failed (${response.status})`,
      details: body.details ?? undefined,
      requestId,
    });
  }
  return body.data as T;
}

function networkError(cause: unknown) {
  return new ApiError({
    status: 0,
    // 목업 모드에서 응답이 없으면 MSW 워커가 이 탭을 놓친 것이다(탭을 오래 숨겨 둔 뒤 등)
    code: import.meta.env.VITE_USE_MOCKS === 'true' ? 'MOCK_UNAVAILABLE' : 'NETWORK_ERROR',
    message: cause instanceof Error ? cause.message : 'Network error',
  });
}

/**
 * 타입 있는 echo-was 클라이언트. 경로·매개변수·본문 타입은 `pnpm gen:api` 로 만든 schema.d.ts 에서 온다.
 * 호출은 항상 unwrap() 으로 감싸 봉투를 풀고 오류를 ApiError 로 바꾼다.
 */
export const api = createClient<paths>({
  baseUrl: API_BASE_URL,
  credentials: 'include',
  headers: { Accept: 'application/json' },
});

type Unwrapped<D> = D extends { data?: infer T } ? Exclude<T, null | undefined> : undefined;

export async function unwrap<D>(
  request: Promise<{ data?: D; error?: unknown; response: Response }>,
): Promise<Unwrapped<D>> {
  let result: Awaited<typeof request>;
  try {
    result = await request;
  } catch (cause) {
    throw networkError(cause);
  }
  const body = result.response.ok ? result.data : result.error;
  return readEnvelope<Unwrapped<D>>(result.response, body);
}

/**
 * 스키마에 없는 경로(계약 4장 🆕 요청 초안)를 부를 때만 쓴다. 나머지는 api + unwrap 을 쓴다.
 * 세션 쿠키를 싣고, 성공 봉투에서 data 만 꺼내고, 실패는 ApiError 로 던진다. 401 이면 로그인 화면으로 보낸다.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(apiUrl(path), { ...init, headers, credentials: 'include' });
  } catch (cause) {
    throw networkError(cause);
  }

  let body: unknown;
  if (response.status !== 204) {
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
  }
  return readEnvelope<T>(response, body);
}
