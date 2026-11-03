import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import type { DeployRequestSummary, Me, MemberRole, ServiceDetail } from '@/lib/api/types';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import ServiceDetailPage from './ServiceDetailPage';

const API = 'http://api.test/api/v1';
const AT = '2026-11-03T00:00:00Z';
const ok = <T,>(data: T) => HttpResponse.json({ success: true, data });

function me(role: MemberRole): Me {
  return {
    user: { id: 'u1', githubLogin: 'echoport', name: null, avatarUrl: null },
    organizations: [
      {
        id: 'o1',
        slug: 'echo-demo',
        name: 'Echo Demo',
        personal: false,
        role,
        allowSelfApproval: false,
        createdAt: AT,
      },
    ],
  };
}

const service: ServiceDetail = {
  id: 's1',
  name: 'shop-api',
  description: null,
  repoUrl: 'https://github.com/team-echo/shop-api',
  private: false,
  healthCheckPath: '/healthz',
  healthCheckTimeoutSeconds: 300,
  containerPort: 8080,
  url: 'https://shop-api-k3x9q2m7.echoport.uk',
  status: 'ACTIVE',
  deleteError: null,
  simulated: true,
  createdAt: AT,
  updatedAt: AT,
  environments: [],
  activeMigrationPlanId: null,
};

function request(id: string, commit: string, extra: Partial<DeployRequestSummary>) {
  return {
    id,
    serviceId: 's1',
    environment: { id: 'e1', name: 'aws-tokyo-prod', kind: 'aws' },
    serviceEnvironmentId: 'se1',
    trigger: 'MANUAL',
    sourceRequestId: null,
    rollbackOfRequestId: null,
    ref: { type: 'COMMIT', value: commit.repeat(40) },
    commitSha: commit.repeat(40),
    status: 'SUCCEEDED',
    cancelReason: null,
    errorCode: null,
    revertStatus: null,
    stageTimes: {
      queuedAt: AT,
      buildingAt: null,
      deployingAt: null,
      verifyingAt: null,
      finishedAt: AT,
    },
    simulated: true,
    isCurrent: false,
    rollbackable: false,
    ...extra,
  } satisfies DeployRequestSummary;
}

function serve(role: MemberRole, onRollback?: (id: string) => void) {
  server.use(
    http.get(`${API}/me`, () => ok(me(role))),
    http.get(`${API}/orgs/o1/services/s1`, () => ok(service)),
    http.get(`${API}/orgs/o1/services/s1/deploy-requests`, () =>
      ok({
        items: [
          request('r2', 'b', { isCurrent: true }),
          request('r1', 'a', { rollbackable: true }),
        ],
        total: 2,
        page: 0,
        size: 20,
      }),
    ),
    http.post(`${API}/orgs/o1/deploy-requests/:id/rollback`, ({ params }) => {
      onRollback?.(String(params.id));
      return HttpResponse.json(
        {
          success: true,
          data: { ...request('r3', 'a', { trigger: 'ROLLBACK' }), status: 'QUEUED' },
        },
        { status: 202 },
      );
    }),
  );
}

function renderPage() {
  return renderRoute(<ServiceDetailPage />, {
    path: '/o/:slug/services/:serviceId',
    url: '/o/echo-demo/services/s1',
  });
}

describe('ServiceDetailPage 배포 이력', () => {
  it('rollbackable 인 행에만 Roll back 버튼이 있고, 현재 배포에는 Current 표시가 붙는다', async () => {
    serve('DEVELOPER');
    renderPage();

    const rows = await screen.findAllByRole('row');
    const current = rows.find((row) => row.textContent?.includes('bbbbbbb'));
    const older = rows.find((row) => row.textContent?.includes('aaaaaaa'));
    if (!current || !older) throw new Error('이력 행이 없다');

    expect(within(current).getByText('Current')).toBeInTheDocument();
    expect(within(current).queryByRole('button', { name: /roll back/i })).not.toBeInTheDocument();
    expect(within(older).getByRole('button', { name: /roll back/i })).toBeInTheDocument();
  });

  it('Roll back 을 누르면 그 요청으로 되돌리기를 부른다', async () => {
    const called: string[] = [];
    serve('DEVELOPER', (id) => called.push(id));
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /roll back/i }));

    await expect.poll(() => called).toEqual(['r1']);
  });

  it('뷰어에게는 Roll back 버튼이 비활성이다', async () => {
    serve('VIEWER');
    renderPage();

    expect(await screen.findByRole('button', { name: /roll back/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});
