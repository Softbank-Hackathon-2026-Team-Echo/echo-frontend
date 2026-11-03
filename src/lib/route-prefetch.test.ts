import { describe, expect, it, vi } from 'vitest';
import { prefetchRoute, registerPrefetchRoutes } from './route-prefetch';

describe('prefetchRoute', () => {
  it('경로에 걸리는 화면의 lazy 를 한 번만 부르고, 다른 화면은 부르지 않는다', async () => {
    const services = vi.fn(() => Promise.resolve({}));
    const migrations = vi.fn(() => Promise.resolve({}));
    registerPrefetchRoutes([
      {
        path: '/o/:slug',
        children: [
          { path: 'services', children: [{ index: true, lazy: services }] },
          { path: 'migrations', children: [{ index: true, lazy: migrations }] },
        ],
      },
    ]);

    prefetchRoute('/o/acme/services');
    prefetchRoute('/o/acme/services');

    expect(services).toHaveBeenCalledTimes(1);
    expect(migrations).not.toHaveBeenCalled();
  });

  it('미리 받기가 실패해도 오류를 던지지 않는다', () => {
    registerPrefetchRoutes([
      { path: '/broken', lazy: () => Promise.reject(new Error('chunk load failed')) },
    ]);
    expect(() => prefetchRoute('/broken')).not.toThrow();
  });
});
