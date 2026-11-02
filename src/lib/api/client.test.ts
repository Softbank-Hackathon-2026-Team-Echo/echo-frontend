import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw-server';
import { apiFetch, browserNavigation } from './client';
import { ApiError } from './errors';

const ME_URL = 'http://api.test/api/v1/me';

describe('apiFetch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('성공 봉투면 data 만 돌려준다', async () => {
    server.use(http.get(ME_URL, () => HttpResponse.json({ success: true, data: { id: 'u1' } })));

    await expect(apiFetch('/me')).resolves.toEqual({ id: 'u1' });
  });

  it('세션 쿠키를 싣는다 (credentials: include)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    server.use(http.get(ME_URL, () => HttpResponse.json({ success: true, data: null })));

    await apiFetch('/me');

    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({ credentials: 'include' });
  });

  it('실패 봉투면 ApiError 에 상태·코드·details·요청 ID 를 담아 던진다', async () => {
    server.use(
      http.post('http://api.test/api/v1/orgs/o1/environments', () =>
        HttpResponse.json(
          {
            success: false,
            code: 'VALIDATION_FAILED',
            message: 'invalid',
            details: [{ field: 'name', reason: 'TOO_LONG' }],
          },
          { status: 422, headers: { 'X-Request-ID': 'req-123' } },
        ),
      ),
    );

    const error = await apiFetch('/orgs/o1/environments', { method: 'POST', body: '{}' }).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 422,
      code: 'VALIDATION_FAILED',
      details: [{ field: 'name', reason: 'TOO_LONG' }],
      requestId: 'req-123',
    });
  });

  it('봉투가 아닌 응답은 UNEXPECTED_RESPONSE 로 감싼다', async () => {
    server.use(
      http.get(ME_URL, () => new HttpResponse('<html>Bad gateway</html>', { status: 502 })),
    );

    await expect(apiFetch('/me')).rejects.toMatchObject({
      status: 502,
      code: 'UNEXPECTED_RESPONSE',
    });
  });

  it('네트워크 오류는 상태 0 의 ApiError 다', async () => {
    server.use(http.get(ME_URL, () => HttpResponse.error()));

    await expect(apiFetch('/me')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('204 면 undefined 를 돌려준다', async () => {
    server.use(
      http.post(
        'http://api.test/api/v1/auth/logout',
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    await expect(apiFetch('/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
  });

  it('401 이면 지금 경로를 next 로 달고 로그인 화면으로 보낸다', async () => {
    const assign = vi.spyOn(browserNavigation, 'assign').mockImplementation(() => {});
    window.history.pushState({}, '', '/o/echoport/services?tab=all');
    server.use(
      http.get(ME_URL, () =>
        HttpResponse.json(
          { success: false, code: 'UNAUTHENTICATED', message: 'login required' },
          { status: 401 },
        ),
      ),
    );

    await expect(apiFetch('/me')).rejects.toMatchObject({ status: 401 });
    expect(assign).toHaveBeenCalledWith(
      `/login?next=${encodeURIComponent('/o/echoport/services?tab=all')}`,
    );
  });

  it('로그인 화면에서 받은 401 은 다시 이동하지 않는다', async () => {
    const assign = vi.spyOn(browserNavigation, 'assign').mockImplementation(() => {});
    window.history.pushState({}, '', '/login');
    server.use(
      http.get(ME_URL, () =>
        HttpResponse.json({ success: false, code: 'UNAUTHENTICATED' }, { status: 401 }),
      ),
    );

    await expect(apiFetch('/me')).rejects.toBeInstanceOf(ApiError);
    expect(assign).not.toHaveBeenCalled();
  });
});
