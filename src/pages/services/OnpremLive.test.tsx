// 「온프레 실시간」 덮어 그리기: 상세 카드 3상태 · 온프레 없는 서비스엔 카드 없음 · 트래픽 비율 덮어쓰기 · 목록 배지
import { render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import type { Me, ServiceDetail, ServiceEnvironment } from '@/lib/api/types';
import { applyLiveTraffic, liveStatus, liveTrafficOn } from '@/lib/onprem-live';
import { KpiTiles } from '@/pages/dashboard/KpiTiles';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import type { OnpremTopologyView } from './OnpremLive';
import ServiceDetailPage from './ServiceDetailPage';
import ServicesPage from './ServicesPage';

// 토폴로지(React Flow)는 jsdom 에서 그릴 수 없다. 대시보드가 받은 비율 · 주석만 글자로 보인다
vi.mock('@/pages/dashboard/ServiceDashboard', () => ({
  ServiceDashboard: ({
    service,
    observed,
    onprem,
  }: {
    service: ServiceDetail;
    observed?: { name: string; weight: number; note: string };
    onprem?: OnpremTopologyView;
  }) => (
    <div data-testid="dashboard">
      {service.environments.map((link) => (
        <span key={link.serviceEnvironmentId} data-testid={`weight-${link.environment.kind}`}>
          {link.trafficWeight}
        </span>
      ))}
      {observed && <span data-testid="observed">{`${observed.name} ${observed.weight}`}</span>}
      {observed && <span data-testid="note">{observed.note}</span>}
      {onprem?.line && (
        <span data-testid="line" data-tone={onprem.line.tone}>
          {onprem.line.text}
        </span>
      )}
      {onprem &&
        [...onprem.alerts].map(([id, alert]) => (
          <span key={id} data-testid={`alert-${id}`} data-tone={alert.tone}>
            {alert.label}
          </span>
        ))}
      {onprem && <span data-testid="caption">{onprem.caption}</span>}
    </div>
  ),
}));

const API = 'http://api.test/api/v1';
const AT = '2026-11-08T00:00:00Z';
const ok = <T,>(data: T) => HttpResponse.json({ success: true, data });
const page = <T,>(items: T[]) => ({ items, total: items.length, page: 0, size: 100 });

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

function link(id: string, kind: string, serving: boolean): ServiceEnvironment {
  return {
    serviceEnvironmentId: `link-${id}`,
    environment: { id, name: id, kind },
    role: serving ? 'SERVING' : 'STANDBY',
    trafficWeight: serving ? 100 : 0,
    url: `https://svc-${id}.echoport.uk`,
    currentDeployment: null,
    versionStatus: serving ? null : 'IN_SYNC',
    lastSyncError: null,
    activeRequestId: null,
    queuedRequestId: null,
    simulated: false,
    teardownError: null,
    lastSyncSeconds: null,
  };
}

function service(environments: ServiceEnvironment[]): ServiceDetail {
  return {
    id: 's1',
    name: 'demo-onprem',
    description: null,
    repoUrl: 'https://github.com/team-echo/demo-onprem',
    private: false,
    healthCheckPath: '/healthz',
    healthCheckTimeoutSeconds: 300,
    containerPort: 8080,
    url: 'https://demo-onprem.echoport.uk',
    status: 'ACTIVE',
    deleteError: null,
    simulated: false,
    createdAt: AT,
    updatedAt: AT,
    environments,
    activeMigrationPlanId: null,
  };
}

const ONPREM = service([link('onprem', 'onprem', true), link('aws-tokyo', 'aws', false)]);
const AWS_ONLY = service([link('aws-tokyo', 'aws', true)]);

type Watcher = { state: string; hb?: boolean; repl?: boolean };

/** 감시자 /state 와 손님 /api/info 를 정한다. 부른 호스트 · 경로를 돌려준다 */
function serve(detail: ServiceDetail, watcher: Watcher, guest: string) {
  const probes: string[] = [];
  server.use(
    http.get(`${API}/me`, () => ok(me)),
    http.get(`${API}/orgs/o1/services`, () => ok(page([detail]))),
    http.get(`${API}/orgs/o1/services/s1`, () => ok(detail)),
    http.get(`${API}/orgs/o1/services/s1/deploy-requests`, () => ok(page([]))),
    http.get('*/onprem-probe', ({ request }) => {
      const url = new URL(request.url);
      const path = url.searchParams.get('path');
      probes.push(`${url.searchParams.get('host')}${path}`);
      const body =
        path === '/state'
          ? {
              state: watcher.state,
              epoch: 26,
              armed: true,
              promoted_at: '2026-11-08T02:49:23.758+00:00',
              normal_since: watcher.state === 'NORMAL' ? '2026-11-08T02:50:05.140+00:00' : null,
              signals: { hb: watcher.hb ?? true, repl: watcher.repl ?? true },
            }
          : { environment: guest };
      return HttpResponse.json({ ok: true, status: 200, ms: 40, body, error: null });
    }),
  );
  return probes;
}

const renderDetail = (query = '') =>
  renderRoute(<ServiceDetailPage />, {
    path: '/o/:slug/services/:serviceId',
    url: `/o/echo-demo/services/s1${query}`,
  });

/** 「환경 상태」 카드는 없다. 모든 표시는 토폴로지(노드 라벨 · 갈래 비율 · 상태 줄)에서만 */
function expectNoCard() {
  expect(screen.queryByTestId('onprem-live')).not.toBeInTheDocument();
  expect(screen.queryByTestId('onprem-live-summary')).not.toBeInTheDocument();
  expect(screen.queryByText('Environment status')).not.toBeInTheDocument();
}

describe('온프레 실시간(서비스 상세 · 토폴로지 안에서만)', () => {
  it('NORMAL + 온프레 응답이면 평소 그대로: 노드 표시 · 상태 줄 없음, 비율은 온프레 100', async () => {
    const probes = serve(ONPREM, { state: 'NORMAL' }, 'onprem');
    renderDetail();

    await waitFor(() =>
      expect(screen.getByTestId('caption')).toHaveTextContent('Live observation (laptop watcher)'),
    );
    await waitFor(() => expect(probes.length).toBeGreaterThan(1));
    expectNoCard();
    expect(screen.queryByTestId('line')).not.toBeInTheDocument();
    expect(screen.queryByTestId('alert-onprem')).not.toBeInTheDocument();
    expect(screen.queryByTestId('alert-aws-tokyo')).not.toBeInTheDocument();
    expect(await screen.findByTestId('weight-onprem')).toHaveTextContent('100');
    expect(screen.getByTestId('weight-aws')).toHaveTextContent('0');
    expect(screen.queryByTestId('note')).not.toBeInTheDocument();
    // 기본 호스트를 부른다
    expect(probes).toContain('watch-laptopdr-nwjs7inr.echoport.uk/state');
    expect(probes).toContain('demo-laptop-nwjs7inr.echoport.uk/api/info');
  });

  it('PROMOTED 면 온프레 노드 🔴 장애 · AWS 노드 대체 서비스 중 · 갈래 AWS 100 / 온프레 0 · 상태 줄', async () => {
    serve(ONPREM, { state: 'PROMOTED', hb: false }, 'aws');
    renderDetail();

    await waitFor(() =>
      expect(screen.getByTestId('line')).toHaveTextContent(
        'On-premises outage detected — traffic switched to AWS Tokyo',
      ),
    );
    expect(screen.getByTestId('line')).toHaveAttribute('data-tone', 'danger');
    expect(screen.getByTestId('alert-onprem')).toHaveTextContent('🔴 Outage (connection lost)');
    expect(screen.getByTestId('alert-onprem')).toHaveAttribute('data-tone', 'danger');
    expect(screen.getByTestId('alert-aws-tokyo')).toHaveTextContent('🟢 Serving instead');
    expectNoCard();
    await waitFor(() => expect(screen.getByTestId('weight-aws')).toHaveTextContent('100'));
    expect(screen.getByTestId('weight-onprem')).toHaveTextContent('0');
    expect(screen.getByTestId('observed')).toHaveTextContent('aws-tokyo 100');
    expect(screen.getByTestId('note')).toHaveTextContent(
      'Live observation (laptop watcher). Console registered value: onprem 100',
    );
  });

  it('FROZEN(복귀 중)이면 온프레 노드 🟡 복구 중 · 상태 줄. 손님이 아직 aws 로 답하면 갈래는 AWS 100', async () => {
    serve(ONPREM, { state: 'FROZEN' }, 'aws');
    renderDetail();

    await waitFor(() =>
      expect(screen.getByTestId('line')).toHaveTextContent(
        'On-premises recovered — moving traffic back to on-premises',
      ),
    );
    expect(screen.getByTestId('line')).toHaveAttribute('data-tone', 'warning');
    expect(screen.getByTestId('alert-onprem')).toHaveTextContent('🟡 Recovering');
    expect(screen.getByTestId('alert-onprem')).toHaveAttribute('data-tone', 'warning');
    expectNoCard();
    await waitFor(() => expect(screen.getByTestId('weight-aws')).toHaveTextContent('100'));
    expect(screen.getByTestId('weight-onprem')).toHaveTextContent('0');
  });

  it('복구 뒤 손님이 온프레로 답하면 갈래가 다시 온프레 100 이다(FROZEN + onprem 응답)', async () => {
    serve(ONPREM, { state: 'FROZEN' }, 'onprem');
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('alert-onprem')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('weight-onprem')).toHaveTextContent('100'));
    expect(screen.getByTestId('weight-aws')).toHaveTextContent('0');
    expect(screen.queryByTestId('alert-aws-tokyo')).not.toBeInTheDocument();
  });

  it('?watcher= · ?guest= 쿼리가 있으면 그 호스트를 부른다', async () => {
    const probes = serve(ONPREM, { state: 'NORMAL' }, 'onprem');
    renderDetail('?watcher=watch.example.uk&guest=https://guest.example.uk/');

    await waitFor(() => expect(probes).toContain('watch.example.uk/state'));
    expect(probes).toContain('guest.example.uk/api/info');
    expect(probes.some((item) => item.startsWith('demo-laptop'))).toBe(false);
  });

  it('온프레 환경이 없는 서비스에는 카드가 없고 감시자를 부르지 않는다', async () => {
    const probes = serve(AWS_ONLY, { state: 'PROMOTED' }, 'aws');
    renderDetail();

    expect(await screen.findByTestId('dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('onprem-live')).not.toBeInTheDocument();
    expect(screen.queryByTestId('caption')).not.toBeInTheDocument();
    expect(screen.queryByTestId('line')).not.toBeInTheDocument();
    expect(screen.getByTestId('weight-aws')).toHaveTextContent('100');
    expect(probes).toEqual([]);
  });
});

describe('온프레 실시간(서비스 목록 배지)', () => {
  const renderList = () =>
    renderRoute(<ServicesPage />, { path: '/o/:slug/services', url: '/o/echo-demo/services' });

  it('PROMOTED 면 실행 환경 칸 옆에 「오프라인 → AWS 대체 중」 배지가 붙는다', async () => {
    serve(ONPREM, { state: 'PROMOTED' }, 'aws');
    renderList();
    expect(await screen.findByTestId('onprem-live-badge')).toHaveTextContent(
      'Offline → AWS standing in',
    );
  });

  it('복귀 중이면 「복귀 중」 배지다', async () => {
    serve(ONPREM, { state: 'FAILBACK' }, 'onprem');
    renderList();
    expect(await screen.findByTestId('onprem-live-badge')).toHaveTextContent('Returning');
  });

  it('NORMAL 이면 배지가 없다', async () => {
    const probes = serve(ONPREM, { state: 'NORMAL' }, 'onprem');
    renderList();
    await screen.findByText('demo-onprem');
    await waitFor(() => expect(probes.length).toBeGreaterThan(1));
    expect(screen.queryByTestId('onprem-live-badge')).not.toBeInTheDocument();
  });
});

describe('온프레 실시간(순수 함수 · KPI 칸)', () => {
  it('상태 판정: PROMOTED=offline, NORMAL·PROMOTED 외=returning, NORMAL+aws 응답=offline', () => {
    expect(liveStatus('NORMAL', 'onprem')).toBe('onprem');
    expect(liveStatus('PROMOTED', 'aws')).toBe('offline');
    expect(liveStatus('FROZEN', 'aws')).toBe('returning');
    expect(liveStatus('NORMAL', 'aws')).toBe('offline');
    expect(liveStatus(null, null)).toBeNull();
    expect(liveTrafficOn('PROMOTED', null)).toBe('aws');
    expect(liveTrafficOn('NORMAL', 'onprem')).toBe('onprem');
  });

  it('applyLiveTraffic 는 비율만 바꾸고 역할 · 연결 수는 그대로다. 바꿀 게 없으면 같은 참조다', () => {
    const next = applyLiveTraffic(ONPREM, 'aws');
    expect(next.environments.map((item) => [item.role, item.trafficWeight])).toEqual([
      ['SERVING', 0],
      ['STANDBY', 100],
    ]);
    expect(applyLiveTraffic(ONPREM, 'onprem')).toBe(ONPREM);
    expect(applyLiveTraffic(ONPREM, null)).toBe(ONPREM);
  });

  it('KPI 「지금 트래픽(관측)」 칸은 관측 환경 · 비율을 보인다', () => {
    const first = ONPREM.environments[0];
    if (!first) throw new Error('연결이 없다');
    const serving = { service: ONPREM, link: first };
    render(<KpiTiles serving={serving} observed={{ name: 'aws-tokyo', weight: 100 }} />);
    expect(screen.getByText('Traffic now (observed)')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('aws-tokyo')).toBeInTheDocument();
    expect(screen.queryByText('Traffic on primary')).not.toBeInTheDocument();
  });
});
