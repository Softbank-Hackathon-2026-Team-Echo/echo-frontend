// DB 정합성 표시: 진행 중 「DB 맞추는 중」 상태 줄, 끝난 뒤 토폴로지 「DB 쓰기 담당」 배지 · 「DB 일치」 캡션
import { QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { type Node, type NodeProps, ReactFlowProvider } from '@xyflow/react';
import { HttpResponse, http } from 'msw';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type {
  EnvironmentSummary,
  Me,
  MigrationPlan,
  ServiceDetail,
  ServiceEnvironment,
} from '@/lib/api/types';
import { dbConsistency, dbPhaseLine } from '@/lib/migration-metrics';
import { migrationPlan, step } from '@/test/migration-fixtures';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import { ServiceDashboard } from './ServiceDashboard';
import { StatusPill } from './StatusPill';
import { EnvironmentNode } from './Topology';

const { topologyProps } = vi.hoisted(() => {
  // Topology 모듈이 불러올 때 elk 워커를 만든다. jsdom 에는 Worker 가 없어 빈 것으로 둔다(배치는 계산하지 않는다)
  if (typeof globalThis.Worker === 'undefined') {
    globalThis.Worker = class {
      postMessage() {}
      terminate() {}
      addEventListener() {}
      removeEventListener() {}
    } as unknown as typeof Worker;
  }
  return { topologyProps: [] as Record<string, unknown>[] };
});

// 토폴로지 캔버스(React Flow + elk 워커)는 jsdom 에서 그릴 수 없어 넘긴 값만 본다. 노드 배지는 아래에서 노드만 그려 본다
vi.mock('./Topology', async (importOriginal) => {
  const original = await importOriginal<typeof import('./Topology')>();
  return {
    ...original,
    Topology: (props: Record<string, unknown>) => {
      topologyProps.push(props);
      return null;
    },
  };
});

const API = 'http://api.test/api/v1';
const AT = '2026-11-08T03:00:00Z';
const ok = <T,>(data: T) => HttpResponse.json({ success: true, data });

const RESULT = {
  writePauseMs: 10_500,
  missingRows: 0,
  duplicateRows: 0,
  rowsTotal: 4627,
  kind: 'ROLLBACK',
  measuredBy: 'INFRA_SCRIPT',
  pausedAt: AT,
  resumedAt: AT,
  drainMs: null,
  catchupMs: null,
  switchMs: null,
} as NonNullable<MigrationPlan['result']>;

function succeeded(result: MigrationPlan['result']): MigrationPlan {
  return migrationPlan({
    id: 'plan-421c3073',
    status: 'SUCCEEDED',
    mode: 'FAILBACK',
    sourceEnvironmentId: 'gcp-seoul',
    targetEnvironmentId: 'aws-tokyo',
    finishedAt: AT,
    result,
  });
}

describe('dbConsistency', () => {
  it('누락 · 중복 0 이면 일치(초록) · 도착 환경이 쓰기 담당', () => {
    const view = dbConsistency(succeeded(RESULT));
    expect(view).toEqual({
      writerEnvironmentId: 'aws-tokyo',
      clean: true,
      text: 'DB in sync · 4627 ledger rows compared · missing 0 · duplicate 0 · writes paused 10.5s',
    });
  });

  it('누락 1 · 중복 0 이면 불일치(빨강)', () => {
    const view = dbConsistency(succeeded({ ...RESULT, missingRows: 1 }));
    expect(view?.clean).toBe(false);
    expect(view?.text).toBe(
      'DB mismatch · 4627 ledger rows compared · missing 1 · duplicate 0 · writes paused 10.5s',
    );
  });

  it('결과가 없거나 성공하지 않은 계획이면 없다', () => {
    expect(dbConsistency(succeeded(null))).toBeNull();
    expect(dbConsistency(succeeded({ ...RESULT, measuredBy: null, missingRows: null }))).toBeNull();
    expect(dbConsistency({ ...succeeded(RESULT), status: 'ROLLED_BACK' })).toBeNull();
  });
});

describe('dbPhaseLine', () => {
  const running = (kind: 'DB_CUTOVER' | 'DATA_SYNC_CHECK', lag: number | null = null) =>
    migrationPlan({
      steps: [
        step(0, 'PREFLIGHT', null, 'PASSED'),
        step(1, kind, null, 'RUNNING', lag === null ? null : { replicationLagSeconds: lag }),
      ],
    });

  it('DB_CUTOVER 진행 중이면 「DB 맞추는 중」', () => {
    expect(dbPhaseLine(running('DB_CUTOVER'))).toEqual({
      kind: 'cutover',
      text: 'Syncing DB — writes paused, target DB catching up and ledgers being compared',
    });
  });

  it('DATA_SYNC_CHECK 진행 중이면 복제 지연을 붙인다', () => {
    expect(dbPhaseLine(running('DATA_SYNC_CHECK', 0.4))?.text).toBe(
      'Checking DB replication · lag 0.4s',
    );
    expect(dbPhaseLine(running('DATA_SYNC_CHECK'))?.text).toBe('Checking DB replication');
  });

  it('비율 단계 진행 중이거나 끝난 계획이면 없다', () => {
    expect(dbPhaseLine(migrationPlan({ steps: [step(1, 'SHIFT', 10, 'RUNNING')] }))).toBeNull();
    expect(dbPhaseLine({ ...running('DB_CUTOVER'), status: 'SUCCEEDED' })).toBeNull();
  });
});

describe('StatusPill', () => {
  it('이전 중 DB 단계면 「이전 진행 중」 대신 DB 한 줄을 스피너와 보인다', () => {
    render(
      <StatusPill
        migrating={{ name: 'aws-tokyo', weight: 100 }}
        disaster={undefined}
        names={new Map()}
        dbPhase={{ kind: 'cutover', text: 'Syncing DB — writes paused' }}
      />,
    );
    const line = screen.getByTestId('db-phase-line');
    expect(line).toHaveTextContent('Syncing DB — writes paused');
    expect(line.querySelector('svg')).toHaveClass('motion-safe:animate-spin');
    expect(screen.queryByText(/Evacuating to/)).toBeNull();
  });
});

const environments: EnvironmentSummary[] = ['aws-tokyo', 'gcp-seoul'].map((id) => ({
  id,
  name: id,
  kind: id.split('-')[0] as string,
  location: null,
  coordinates: null,
  config: {},
  secretRef: null,
  connectionStatus: 'CONNECTED',
  connectionCheckedAt: AT,
  connectionError: null,
  createdAt: AT,
  updatedAt: AT,
}));

describe('EnvironmentNode', () => {
  type EnvNode = NodeProps<Node<ComponentProps<typeof EnvironmentNode>['data'], 'environment'>>;
  const nodeProps = (dbWriter: boolean) =>
    ({
      id: 'aws-tokyo',
      type: 'environment',
      data: {
        environment: environments[0] as EnvironmentSummary,
        links: [],
        atRisk: false,
        receiving: false,
        dbWriter,
      },
    }) as unknown as EnvNode;

  it('쓰기 담당 환경에만 「DB 쓰기 담당」 배지', () => {
    const { rerender } = render(
      <ReactFlowProvider>
        <EnvironmentNode {...nodeProps(true)} />
      </ReactFlowProvider>,
    );
    expect(screen.getByTestId('topology-db-writer')).toHaveTextContent('DB writer');
    rerender(
      <ReactFlowProvider>
        <EnvironmentNode {...nodeProps(false)} />
      </ReactFlowProvider>,
    );
    expect(screen.queryByTestId('topology-db-writer')).toBeNull();
  });
});

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
const organization = me.organizations[0] as Me['organizations'][number];

function link(env: EnvironmentSummary, serving: boolean): ServiceEnvironment {
  return {
    serviceEnvironmentId: `link-${env.id}`,
    environment: { id: env.id, name: env.name, kind: env.kind },
    role: serving ? 'SERVING' : 'STANDBY',
    trafficWeight: serving ? 100 : 0,
    url: `https://svc-${env.id}.echoport.uk`,
    currentDeployment: null,
    versionStatus: serving ? null : 'IN_SYNC',
    lastSyncError: null,
    activeRequestId: null,
    queuedRequestId: null,
    simulated: true,
    teardownError: null,
    lastSyncSeconds: null,
  };
}

const service: ServiceDetail = {
  id: 'demo',
  name: 'demo',
  description: null,
  repoUrl: 'https://github.com/team-echo/demo',
  private: false,
  healthCheckPath: '/healthz',
  healthCheckTimeoutSeconds: 300,
  containerPort: 8080,
  url: 'https://demo.echoport.uk',
  status: 'ACTIVE',
  deleteError: null,
  simulated: true,
  createdAt: AT,
  updatedAt: AT,
  environments: environments.map((env, index) => link(env, index === 0)),
  activeMigrationPlanId: null,
};

function serve(plan: MigrationPlan | null) {
  server.use(
    http.get(`${API}/me`, () => ok(me)),
    http.get(`${API}/orgs/o1/disasters`, () => ok({ items: [], total: 0, page: 0, size: 50 })),
    http.get(`${API}/orgs/o1/audit-logs`, () => ok({ items: [], total: 0, page: 0, size: 3 })),
    http.get(`${API}/orgs/o1/environments`, () =>
      ok({ items: environments, total: environments.length, page: 0, size: 100 }),
    ),
    http.get(`${API}/orgs/o1/services/:id/metrics`, () =>
      ok({
        range: '15m',
        step: '10s',
        asOf: AT,
        metricsStatus: 'OK',
        metricsErrorCode: null,
        series: [],
        summary: null,
        simulated: false,
      }),
    ),
    http.get(`${API}/orgs/o1/services/:id/migration-plans`, () =>
      ok({ items: plan ? [plan] : [], total: plan ? 1 : 0, page: 0, size: 20 }),
    ),
    http.get(`${API}/orgs/o1/migration-plans/:id`, () => ok(plan)),
  );
}

function renderDashboard(plan: MigrationPlan | null) {
  topologyProps.length = 0;
  serve(plan);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  renderRoute(<ServiceDashboard organization={organization} service={service} />, {
    path: '/o/:slug',
    url: '/o/echo-demo',
    queryClient: client,
  });
  return client;
}

describe('ServiceDashboard DB 정합성', () => {
  it('최근 성공 계획의 결과가 0/0 이면 도착 환경 배지 + 초록 「DB 일치」 캡션', async () => {
    renderDashboard(succeeded(RESULT));
    const caption = await screen.findByTestId('db-consistency-caption');
    expect(caption).toHaveTextContent(
      'DB in sync · 4627 ledger rows compared · missing 0 · duplicate 0 · writes paused 10.5s',
    );
    expect(caption).toHaveClass('text-success-fg');
    await waitFor(() => expect(topologyProps.at(-1)?.dbWriterId).toBe('aws-tokyo'));
  });

  it('누락 1 · 중복 0 이면 빨강 「DB 불일치」', async () => {
    renderDashboard(succeeded({ ...RESULT, missingRows: 1 }));
    const caption = await screen.findByTestId('db-consistency-caption');
    expect(caption).toHaveTextContent('DB mismatch');
    expect(caption).toHaveClass('text-danger-fg');
  });

  it('결과가 없으면 배지 · 캡션 모두 없다', async () => {
    const client = renderDashboard(succeeded(null));
    await screen.findAllByText('Environments');
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(screen.queryByTestId('db-consistency-caption')).toBeNull();
    expect(topologyProps.at(-1)?.dbWriterId).toBeUndefined();
  });
});
