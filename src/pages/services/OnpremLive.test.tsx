// 「온프레 실시간」 덮어 그리기: 상세 카드 3상태 · 온프레 없는 서비스엔 카드 없음 · 트래픽 비율 덮어쓰기 · 목록 배지
import { render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import type { Me, ServiceDetail, ServiceEnvironment } from '@/lib/api/types';
import { applyLiveTraffic, liveStatus, liveTrafficOn } from '@/lib/onprem-live';
import { KpiTiles } from '@/pages/dashboard/KpiTiles';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import ServiceDetailPage from './ServiceDetailPage';
import ServicesPage from './ServicesPage';

// 토폴로지(React Flow)는 jsdom 에서 그릴 수 없다. 대시보드가 받은 비율 · 주석만 글자로 보인다
vi.mock('@/pages/dashboard/ServiceDashboard', () => ({
  ServiceDashboard: ({
    service,
    observed,
  }: {
    service: ServiceDetail;
    observed?: { name: string; weight: number; note: string };
  }) => (
    <div data-testid="dashboard">
      {service.environments.map((link) => (
        <span key={link.serviceEnvironmentId} data-testid={`weight-${link.environment.kind}`}>
          {link.trafficWeight}
        </span>
      ))}
      {observed && <span data-testid="observed">{`${observed.name} ${observed.weight}`}</span>}
      {observed && <span data-testid="note">{observed.note}</span>}
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

describe('온프레 실시간(서비스 상세)', () => {
  it('NORMAL + 온프레 응답이면 🟢 카드이고 비율은 콘솔 등록값(온프레 100) 그대로다', async () => {
    const probes = serve(ONPREM, { state: 'NORMAL' }, 'onprem');
    renderDetail();

    await waitFor(() =>
      expect(screen.getByTestId('onprem-live-status')).toHaveTextContent('🟢 On-prem is serving'),
    );
    expect(screen.getByTestId('onprem-live-env')).toHaveTextContent('On-prem');
    expect(screen.getByTestId('onprem-live-traffic')).toHaveTextContent('On-prem 100%');
    expect(screen.getByTestId('onprem-live-watcher')).toHaveTextContent(
      'Watcher NORMAL · epoch 26 · heartbeat OK · replication OK',
    );
    expect(screen.getByTestId('watch-strip').querySelector('[data-kind="onprem"]')).not.toBeNull();
    expect(await screen.findByTestId('weight-onprem')).toHaveTextContent('100');
    expect(screen.getByTestId('weight-aws')).toHaveTextContent('0');
    expect(screen.queryByTestId('note')).not.toBeInTheDocument();
    // 기본 호스트를 부른다
    expect(probes).toContain('watch-laptopdr-nwjs7inr.echoport.uk/state');
    expect(probes).toContain('demo-laptop-nwjs7inr.echoport.uk/api/info');
  });

  it('PROMOTED 면 🔴 오프라인 카드이고 비율을 AWS 100 / 온프레 0 으로 덮고 주석을 단다', async () => {
    serve(ONPREM, { state: 'PROMOTED', hb: false }, 'aws');
    renderDetail();

    await waitFor(() =>
      expect(screen.getByTestId('onprem-live-status')).toHaveTextContent(
        '🔴 On-prem offline — AWS is serving instead',
      ),
    );
    await waitFor(() => expect(screen.getByTestId('weight-aws')).toHaveTextContent('100'));
    expect(screen.getByTestId('weight-onprem')).toHaveTextContent('0');
    expect(screen.getByTestId('onprem-live-traffic')).toHaveTextContent(
      'AWS 100% · On-prem 0% (offline)',
    );
    expect(screen.getByTestId('onprem-live-watcher')).toHaveTextContent('heartbeat down');
    expect(screen.getByTestId('observed')).toHaveTextContent('aws-tokyo 100');
    expect(screen.getByTestId('note')).toHaveTextContent(
      'Live observation (laptop watcher). Console registered value: onprem 100',
    );
  });

  it('FROZEN(복귀 중)이면 🟡 카드다. 손님이 아직 aws 로 답하면 비율은 AWS 100 이다', async () => {
    serve(ONPREM, { state: 'FROZEN' }, 'aws');
    renderDetail();

    await waitFor(() =>
      expect(screen.getByTestId('onprem-live-status')).toHaveTextContent(
        '🟡 Returning — moving back to on-prem',
      ),
    );
    await waitFor(() => expect(screen.getByTestId('weight-aws')).toHaveTextContent('100'));
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
