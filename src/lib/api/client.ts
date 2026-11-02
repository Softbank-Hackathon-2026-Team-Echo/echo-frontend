import { ApiError } from './errors';
import type { ApiEnvelope } from './types';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export function apiUrl(path: string): string {
  return `${API_BASE_URL}/api/v1${path}`;
}

/** 지금 화면으로 돌아오도록 로그인 화면으로 보낸다. 로그인 화면에서는 다시 보내지 않는다 */
export function redirectToLogin() {
  const { pathname, search, hash } = window.location;
  if (pathname === '/login') return;
  const next = encodeURIComponent(`${pathname}${search}${hash}`);
  window.location.assign(`/login?next=${next}`);
}

function isEnvelope(body: unknown): body is ApiEnvelope<unknown> {
  return typeof body === 'object' && body !== null && 'success' in body;
}

/**
 * echo-was 를 부르는 유일한 통로. 세션 쿠키를 싣고, 성공 봉투에서 data 만 꺼내고,
 * 실패는 ApiError 로 던진다. 401 이면 로그인 화면으로 보낸다.
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
    throw new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: cause instanceof Error ? cause.message : 'Network error',
    });
  }

  const requestId = response.headers.get('X-Request-ID');

  if (response.status === 401) redirectToLogin();
  if (response.status === 204) return undefined as T;

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }

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
      details: body.details,
      requestId,
    });
  }

  return body.data as T;
}
