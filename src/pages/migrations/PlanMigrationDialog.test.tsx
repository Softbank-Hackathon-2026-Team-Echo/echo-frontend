import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { EnvironmentSummary, ServiceDetail } from '@/lib/api/types';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import { PlanMigrationDialog, targetState } from './PlanMigrationDialog';

const API = 'http://api.test/api/v1';
const ok = <T,>(data: T) => HttpResponse.json({ success: true, data });
const environment = (id: string, name: string, connectionStatus = 'CONNECTED') => ({
  id,
  name,
  kind: id === 'aws' ? 'aws' : 'gcp',
  connectionStatus,
});
const link = (id: string, extra: object) => ({
  serviceEnvironmentId: `se-${id}`,
  environment: { id, name: id, kind: 'aws' },
  role: 'STANDBY',
  trafficWeight: 0,
  versionStatus: 'IN_SYNC',
  currentDeployment: { commitSha: 'a'.repeat(40) },
  ...extra,
});
const service = (id: string, name: string, environments: unknown[]) => ({
  id,
  name,
  environments,
});

function serve(environments: unknown[], services: ReturnType<typeof service>[]) {
  server.use(
    http.get(`${API}/orgs/o1/environments`, () => ok({ items: environments })),
    http.get(`${API}/orgs/o1/services`, () => ok({ items: services })),
    ...services.map((item) => http.get(`${API}/orgs/o1/services/${item.id}`, () => ok(item))),
  );
}

function renderDialog(serviceIds: string[]) {
  return renderRoute(
    <PlanMigrationDialog
      onClose={vi.fn()}
      orgId="o1"
      orgSlug="echo-demo"
      serviceIds={serviceIds}
    />,
    { path: '/o/:slug/migrations', url: '/o/echo-demo/migrations' },
  );
}

async function choose(label: string, option: RegExp) {
  await userEvent.click(await screen.findByRole('combobox', { name: label }));
  await userEvent.click(await screen.findByRole('option', { name: option }));
}

describe('targetState', () => {
  const asService = (environments: unknown[]) => ({ environments }) as unknown as ServiceDetail;
  const gcp = environment('gcp', 'gcp-seoul') as unknown as EnvironmentSummary;

  it('같은 버전이 떠 있으면 준비됨이다', () => {
    expect(targetState(asService([link('gcp', {})]), gcp)).toBe('ready');
  });

  it('연결이 없거나 현재 배포가 없으면 배포부터 해야 한다', () => {
    expect(targetState(asService([]), gcp)).toBe('not-deployed');
    expect(targetState(asService([link('gcp', { currentDeployment: null })]), gcp)).toBe(
      'not-deployed',
    );
  });

  it('버전이 다르면 동기화가 필요하다', () => {
    expect(targetState(asService([link('gcp', { versionStatus: 'OUT_OF_SYNC' })]), gcp)).toBe(
      'out-of-sync',
    );
  });

  it('접속 실패 환경은 고를 수 없다', () => {
    const failed = environment('gcp', 'gcp-seoul', 'FAILED') as unknown as EnvironmentSummary;
    expect(targetState(asService([link('gcp', {})]), failed)).toBe('unreachable');
  });
});

describe('PlanMigrationDialog', () => {
  beforeAll(() => {
    // Radix Select 가 쓰는데 jsdom 에 없다
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.scrollIntoView = () => {};
  });

  const serving = link('aws', { role: 'SERVING', trafficWeight: 100 });

  it('예비가 준비됐으면 사전 점검과 계획으로 갈 수 있고 전체 이동을 알린다', async () => {
    serve(
      [environment('aws', 'aws-tokyo'), environment('gcp', 'gcp-seoul')],
      [service('s1', 'demo', [serving, link('gcp', {})]), service('s2', 'shop', [serving])],
    );
    renderDialog(['s1', 's2']);

    await choose('Service', /demo/);
    await choose('Target environment', /gcp-seoul.*Ready/);

    expect(screen.getByRole('link', { name: 'Skip to plan' })).toHaveAttribute(
      'href',
      '/o/echo-demo/evacuation/plan?service=s1&target=gcp',
    );
    expect(screen.getByRole('button', { name: 'Run AI pre-check' })).toBeEnabled();
    expect(screen.getByRole('note')).toHaveTextContent('every service moves together');
  });

  it('도착에 배포가 없으면 먼저 배포하게 한다', async () => {
    serve(
      [environment('aws', 'aws-tokyo'), environment('gcp', 'gcp-seoul')],
      [service('s2', 'shop', [serving])],
    );
    renderDialog(['s2']);

    await choose('Service', /shop/);
    await choose('Target environment', /gcp-seoul.*Not deployed/);

    expect(screen.getByRole('button', { name: 'Deploy to gcp-seoul first' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Skip to plan' })).not.toBeInTheDocument();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('트래픽을 다 받는 환경이 없는 서비스는 고를 수 없다', async () => {
    serve([environment('aws', 'aws-tokyo')], [service('s3', 'new-app', [])]);
    renderDialog(['s3']);

    await userEvent.click(await screen.findByRole('combobox', { name: 'Service' }));
    expect(await screen.findByRole('option', { name: /new-app/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});
