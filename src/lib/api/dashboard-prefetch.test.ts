import { QueryClient } from '@tanstack/react-query';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw-server';
import { prefetchDashboard } from './dashboard-prefetch';
import { queryKeys } from './query-keys';

const API = 'http://api.test/api/v1';
const ok = <T>(data: T) => HttpResponse.json({ success: true, data });
const page = <T>(items: T[]) => ok({ items, total: items.length, page: 0, size: 100 });

function serve() {
  const calls: string[] = [];
  const track = (name: string) => calls.push(name);
  server.use(
    http.get(`${API}/me`, () => {
      track('me');
      return ok({ user: {}, organizations: [{ id: 'o1', slug: 'echo-demo' }] });
    }),
    http.get(`${API}/orgs/o1/environments`, () => {
      track('environments');
      return page([]);
    }),
    http.get(`${API}/orgs/o1/audit-logs`, () => {
      track('audit');
      return page([]);
    }),
    http.get(`${API}/orgs/o1/services`, () => {
      track('services');
      return page([{ id: 's1' }]);
    }),
    http.get(`${API}/orgs/o1/services/s1`, () => {
      track('service');
      return ok({ id: 's1' });
    }),
  );
  return calls;
}

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('prefetchDashboard', () => {
  it('조직을 찾아 첫 화면 데이터를 캐시에 넣는다', async () => {
    const calls = serve();
    const queryClient = client();
    await prefetchDashboard(queryClient, 'echo-demo');

    expect([...calls].sort()).toEqual(['audit', 'environments', 'me', 'service', 'services']);
    expect(queryClient.getQueryData(queryKeys.service('o1', 's1'))).toEqual({ id: 's1' });
  });

  it('내 조직이 아니면 /me 뒤에 더 부르지 않는다', async () => {
    const calls = serve();
    await prefetchDashboard(client(), 'other');

    expect(calls).toEqual(['me']);
  });

  it('요청이 실패해도 오류를 던지지 않는다', async () => {
    server.use(http.get(`${API}/me`, () => HttpResponse.error()));

    await expect(prefetchDashboard(client(), 'echo-demo')).resolves.toBeUndefined();
  });
});
