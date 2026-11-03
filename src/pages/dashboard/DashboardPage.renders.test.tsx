// 성능 기준선(#45): 대시보드가 다시 불러오기 한 번에 칸들을 몇 번 다시 그리는지 잰다.
// 실시간 채널 전까지 대시보드는 폴링으로 갱신되므로, 같은 응답이 다시 와도 다시 그리는 칸이 적을수록 좋다.
// 숫자는 docs/perf.md 기준선과 함께 보고, React Compiler 적용 전후를 비교한다
import { QueryClient } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { Profiler } from 'react';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { EnvironmentSummary, Me, ServiceDetail, ServiceEnvironment } from '@/lib/api/types';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import DashboardPage from './DashboardPage';

const { counts, bump, counted } = vi.hoisted(() => {
  const counts = new Map<string, number>();
  const bump = (name: string) => counts.set(name, (counts.get(name) ?? 0) + 1);
  // 원래 컴포넌트를 그대로 그리면서 몇 번 불렸는지만 센다
  // biome-ignore lint/suspicious/noExplicitAny: 칸마다 props 모양이 달라 공통 타입이 없다
  const counted = (name: string, Component: (props: any) => unknown) => (props: object) => {
    bump(name);
    return Component(props);
  };
  return { counts, bump, counted };
});

// 칸 컴포넌트가 몇 번 불렸는지 센다. 토폴로지(React Flow + elk 워커)는 jsdom 에서 그릴 수 없어 세기만 한다
vi.mock('./Topology', () => ({
  Topology: () => {
    bump('Topology');
    return null;
  },
}));
vi.mock('./KpiTiles', async (importOriginal) => {
  const original = await importOriginal<typeof import('./KpiTiles')>();
  return { ...original, KpiTiles: counted('KpiTiles', original.KpiTiles) };
});
vi.mock('./LiveEvents', async (importOriginal) => {
  const original = await importOriginal<typeof import('./LiveEvents')>();
  return { ...original, LiveEvents: counted('LiveEvents', original.LiveEvents) };
});
vi.mock('./EnvironmentsPanel', async (importOriginal) => {
  const original = await importOriginal<typeof import('./EnvironmentsPanel')>();
  return {
    ...original,
    EnvironmentsPanel: counted('EnvironmentsPanel', original.EnvironmentsPanel),
  };
});
vi.mock('./StatusPill', async (importOriginal) => {
  const original = await importOriginal<typeof import('./StatusPill')>();
  return { ...original, StatusPill: counted('StatusPill', original.StatusPill) };
});

const API = 'http://api.test/api/v1';
const AT = '2026-11-03T00:00:00Z';
const ok = <T,>(data: T) => HttpResponse.json({ success: true, data });

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

function environment(id: string, kind: string, location: string): EnvironmentSummary {
  return {
    id,
    name: id,
    kind,
    location,
    config: {},
    secretRef: null,
    connectionStatus: 'CONNECTED',
    connectionCheckedAt: AT,
    connectionError: null,
    createdAt: AT,
    updatedAt: AT,
  };
}

// 데모 구성: 도쿄 · 서울 · 후쿠오카, 서비스 2개(도쿄가 받고 둘은 예비)
const environments = [
  environment('aws-tokyo', 'aws', 'ap-northeast-1'),
  environment('gcp-seoul', 'gcp', 'asia-northeast3'),
  environment('onprem-fukuoka', 'onprem', 'fukuoka'),
];

function link(env: EnvironmentSummary, serving: boolean): ServiceEnvironment {
  return {
    serviceEnvironmentId: `link-${env.id}`,
    environment: { id: env.id, name: env.name, kind: env.kind },
    role: serving ? 'SERVING' : 'STANDBY',
    trafficWeight: serving ? 100 : 0,
    url: `https://svc-${env.id}.echoport.uk`,
    currentDeployment: {
      id: `d-${env.id}`,
      commitSha: 'a'.repeat(40),
      imageDigest: `sha256:${'a'.repeat(64)}`,
      finishedAt: AT,
    },
    versionStatus: serving ? null : 'IN_SYNC',
    lastSyncError: null,
    activeRequestId: null,
    queuedRequestId: null,
    simulated: true,
    teardownError: null,
    lastSyncSeconds: serving ? null : 4.2,
  };
}

function service(id: string): ServiceDetail {
  return {
    id,
    name: id,
    description: null,
    repoUrl: `https://github.com/team-echo/${id}`,
    private: false,
    healthCheckPath: '/healthz',
    healthCheckTimeoutSeconds: 300,
    containerPort: 8080,
    url: `https://${id}.echoport.uk`,
    status: 'ACTIVE',
    deleteError: null,
    simulated: true,
    createdAt: AT,
    updatedAt: AT,
    environments: environments.map((env, index) => link(env, index === 0)),
    activeMigrationPlanId: null,
  };
}

const services = [service('shop-api'), service('shop-web')];

function serve() {
  server.use(
    http.get(`${API}/me`, () => ok(me)),
    http.get(`${API}/orgs/o1/environments`, () =>
      ok({ items: environments, total: environments.length, page: 0, size: 100 }),
    ),
    http.get(`${API}/orgs/o1/services`, () =>
      ok({ items: services, total: services.length, page: 0, size: 100 }),
    ),
    http.get(`${API}/orgs/o1/services/:id`, ({ params }) =>
      ok(services.find((item) => item.id === params.id)),
    ),
    http.get(`${API}/orgs/o1/services/:id/migration-plans`, () =>
      ok({ items: [], total: 0, page: 0, size: 20 }),
    ),
  );
}

const results: string[] = [];
afterAll(() => {
  // 기준선을 docs/perf.md 에 옮겨 적을 수 있게 남긴다
  console.warn(`\n[dashboard renders per refetch]\n${results.join('\n')}`);
});

describe('DashboardPage 다시 그리기 기준선', () => {
  it('같은 응답으로 다시 불러와도 칸마다 몇 번 다시 그리는지 잰다', async () => {
    serve();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let commits = 0;
    let renderMs = 0;
    renderRoute(
      <Profiler
        id="dashboard"
        onRender={(_id, _phase, actualDuration) => {
          commits += 1;
          renderMs += actualDuration;
        }}
      >
        <DashboardPage />
      </Profiler>,
      { path: '/o/:slug', url: '/o/echo-demo', queryClient: client },
    );
    await screen.findAllByText('Environments');
    await waitFor(() => expect(client.isFetching()).toBe(0));

    // 폴링 한 번과 같다: 조직 쿼리를 전부 다시 불러오고, 응답은 그대로다
    counts.clear();
    commits = 0;
    renderMs = 0;
    await act(() => client.invalidateQueries());
    await waitFor(() => expect(client.isFetching()).toBe(0));

    const row = (name: string) => `${name.padEnd(18)} ${counts.get(name) ?? 0}`;
    results.push(
      `commits            ${commits}`,
      `render ms (jsdom)  ${renderMs.toFixed(1)}`,
      ...['Topology', 'KpiTiles', 'LiveEvents', 'EnvironmentsPanel', 'StatusPill'].map(row),
    );
    // 기준선 측정용이다. 값이 아니라 측정이 돌아가는지만 확인한다
    expect(commits).toBeGreaterThan(0);
  });
});
