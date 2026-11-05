// 성능(#45): 이전이 도는 동안 M02 가 1초에 몇 번 다시 그리는지 잰다.
// 계획 폴링(1초)과 경과 시간(1초)이 따로 돌아서 커밋 수가 곧 실행 중 화면의 부담이다. 숫자는 docs/perf.md 표와 함께 본다
import { QueryClient } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { Profiler } from 'react';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { Me } from '@/lib/api/types';
import { AT, migrationPlan } from '@/test/migration-fixtures';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import MigrationPage from './MigrationPage';

const { counts, bump } = vi.hoisted(() => {
  const counts = new Map<string, number>();
  const bump = (name: string) => counts.set(name, (counts.get(name) ?? 0) + 1);
  return { counts, bump };
});

vi.mock('./LiveTab', async (importOriginal) => {
  const original = await importOriginal<typeof import('./LiveTab')>();
  return {
    ...original,
    LiveTab: (props: Parameters<typeof original.LiveTab>[0]) => {
      bump('LiveTab');
      return original.LiveTab(props);
    },
  };
});
vi.mock('@/components/TrafficChart', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/components/TrafficChart')>();
  return {
    ...original,
    TrafficChart: (props: Parameters<typeof original.TrafficChart>[0]) => {
      bump('TrafficChart');
      return original.TrafficChart(props);
    },
  };
});

const API = 'http://api.test/api/v1';
const ok = <T,>(data: T) => HttpResponse.json({ success: true, data });
const WINDOW_MS = 3_000;

const me: Me = {
  user: { id: 'u1', githubLogin: 'echoport', name: null, avatarUrl: null },
  organizations: [
    {
      id: 'o1',
      slug: 'echo-demo',
      name: 'Echo Demo',
      personal: false,
      role: 'DEVELOPER',
      allowSelfApproval: false,
      createdAt: AT,
    },
  ],
};

const results: string[] = [];
afterAll(() => {
  console.warn(`\n[migration renders in ${WINDOW_MS / 1000}s]\n${results.join('\n')}`);
});

describe('MigrationPage 다시 그리기', () => {
  it('실행 중 같은 응답이 오는 동안 몇 번 다시 그리는지 잰다', async () => {
    const plan = migrationPlan({ status: 'RUNNING', finishedAt: null });
    server.use(
      http.get(`${API}/me`, () => ok(me)),
      http.get(`${API}/orgs/o1/environments`, () =>
        ok({ items: [], total: 0, page: 0, size: 100 }),
      ),
      http.get(`${API}/orgs/o1/migration-plans/:id`, () => ok(plan)),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let commits = 0;
    renderRoute(
      <Profiler id="migration" onRender={() => (commits += 1)}>
        <MigrationPage />
      </Profiler>,
      {
        path: '/o/:slug/migrations/:planId',
        url: '/o/echo-demo/migrations/plan-1234abcd',
        queryClient: client,
      },
    );
    await screen.findByText('Traffic · A vs B');

    counts.clear();
    commits = 0;
    // act 안에서는 갱신이 끝까지 모였다가 한 번에 그려져서 실제 횟수를 못 잰다
    const reactGlobal = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    reactGlobal.IS_REACT_ACT_ENVIRONMENT = false;
    await new Promise((resolve) => setTimeout(resolve, WINDOW_MS));
    reactGlobal.IS_REACT_ACT_ENVIRONMENT = true;

    results.push(
      `commits       ${commits}`,
      `LiveTab       ${counts.get('LiveTab') ?? 0}`,
      `TrafficChart  ${counts.get('TrafficChart') ?? 0}`,
    );
    expect(commits).toBeGreaterThan(0);
  }, 10_000);
});
