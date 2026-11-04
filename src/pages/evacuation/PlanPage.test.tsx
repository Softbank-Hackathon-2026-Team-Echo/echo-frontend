import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import type { Me, MigrationPlan, ServiceDetail } from '@/lib/api/types';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import PlanPage from './PlanPage';

const API = 'http://api.test/api/v1';
const AT = '2026-11-04T03:00:00Z';
const ok = <T,>(data: T, status = 200) => HttpResponse.json({ success: true, data }, { status });

function me(allowSelfApproval: boolean): Me {
  return {
    user: { id: 'u1', githubLogin: 'echoport', name: null, avatarUrl: null },
    organizations: [
      {
        id: 'o1',
        slug: 'echo-demo',
        name: 'Echo Demo',
        personal: false,
        role: 'DEVELOPER',
        allowSelfApproval,
        createdAt: AT,
      },
    ],
  };
}

const link = (simulated: boolean) => ({
  serviceEnvironmentId: 'se2',
  environment: { id: 'e2', name: 'gcp-seoul', kind: 'gcp' },
  role: 'STANDBY' as const,
  trafficWeight: 0,
  url: 'https://shop-api-gcp.echoport.uk',
  currentDeployment: null,
  versionStatus: null,
  lastSyncError: null,
  activeRequestId: null,
  queuedRequestId: null,
  simulated,
  teardownError: null,
  lastSyncSeconds: null,
});

const service = (activeMigrationPlanId: string | null, targetSimulated = true) =>
  ({
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
    environments: [link(targetSimulated)],
    activeMigrationPlanId,
  }) satisfies ServiceDetail;

const step = (
  index: number,
  kind: 'PREFLIGHT' | 'SHIFT' | 'DATA_SYNC_CHECK',
  target: number | null,
) => ({
  index,
  kind,
  sourceWeight: target === null ? null : 100 - target,
  targetWeight: target,
  requiredRequests: kind === 'SHIFT' ? 20 : null,
  maxWaitSeconds: kind === 'SHIFT' ? 30 : null,
  expectedSeconds: kind === 'SHIFT' ? 7 : 2,
  result: {
    status: 'PENDING' as const,
    startedAt: null,
    finishedAt: null,
    metrics: null,
    failureCode: null,
  },
});

const plan: MigrationPlan = {
  id: 'plan-1234abcd',
  serviceId: 's1',
  sourceEnvironmentId: 'e1',
  targetEnvironmentId: 'e2',
  sourceServiceEnvironmentId: 'se1',
  targetServiceEnvironmentId: 'se2',
  status: 'PENDING_APPROVAL',
  mode: 'PLANNED',
  currentStep: 0,
  expectedSeconds: 25,
  createdBy: { id: 'u1', login: 'echoport' },
  approvedBy: null,
  selfApproved: false,
  errorCode: null,
  rollbackStatus: null,
  simulated: true,
  createdAt: AT,
  approvedAt: null,
  startedAt: null,
  finishedAt: null,
  expiresAt: '2026-11-05T03:00:00Z',
  rollbackConditions: {
    maxErrorRatePercent: 1,
    maxP95Ms: 800,
    maxReplicationLagSeconds: 1,
    healthCheck: true,
    p95Advisory: true,
  },
  maxWaitSeconds: 30,
  progress: null,
  steps: [
    step(0, 'PREFLIGHT', null),
    step(1, 'SHIFT', 10),
    step(2, 'SHIFT', 50),
    step(3, 'DATA_SYNC_CHECK', null),
    step(4, 'SHIFT', 100),
  ],
  rejectedBy: null,
  cancelledBy: null,
  abortedBy: null,
  abortRequestedAt: null,
  errorMessage: null,
};

function serve({
  allowSelfApproval,
  active,
  stale = false,
  targetSimulated = true,
}: {
  allowSelfApproval: boolean;
  active: string | null;
  stale?: boolean;
  targetSimulated?: boolean;
}) {
  const calls: { path: string; body?: unknown }[] = [];
  server.use(
    http.get(`${API}/me`, () => ok(me(allowSelfApproval))),
    http.get(`${API}/orgs/o1/services/s1`, () => ok(service(active, targetSimulated))),
    http.get(`${API}/orgs/o1/environments`, () => ok({ items: [], total: 0, page: 0, size: 100 })),
    http.get(`${API}/orgs/o1/migration-plans/:id`, () => ok(plan)),
    http.post(`${API}/orgs/o1/migration-plans/:id/approve`, () => {
      calls.push({ path: 'approve' });
      if (stale) {
        return HttpResponse.json(
          {
            success: false,
            code: 'PLAN_STALE',
            message: 'plan is stale',
            details: [{ field: 'connections', reason: 'CHANGED' }],
          },
          { status: 409 },
        );
      }
      return ok({ ...plan, status: 'APPROVED' }, 202);
    }),
    http.post(`${API}/orgs/o1/services/s1/migration-plans`, async ({ request }) => {
      calls.push({ path: 'create', body: await request.json() });
      return HttpResponse.json(
        {
          success: false,
          code: 'TARGET_NOT_READY',
          message: 'target not ready',
          details: [{ field: 'targetEnvironmentId', reason: 'NO_DEPLOYMENT' }],
        },
        { status: 409 },
      );
    }),
  );
  return calls;
}

function renderPage() {
  return renderRoute(<PlanPage />, {
    path: '/o/:slug/evacuation/plan',
    url: '/o/echo-demo/evacuation/plan?service=s1&target=e2',
  });
}

afterEach(() => window.sessionStorage.clear());

describe('PlanPage', () => {
  it('본인 승인이 꺼진 조직에서는 내가 만든 계획을 승인할 수 없다', async () => {
    serve({ allowSelfApproval: false, active: plan.id });
    renderPage();

    expect(await screen.findByRole('button', { name: 'Approve plan' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByText('Off · another developer approves')).toBeInTheDocument();
  });

  it('본인 승인이 켜져 있으면 승인 API 를 부른다', async () => {
    const calls = serve({ allowSelfApproval: true, active: plan.id });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Approve plan' }));

    await expect.poll(() => calls.map((call) => call.path)).toEqual(['approve']);
  });

  it('계획이 없으면 롤백 조건을 정해 만들고, 409 이유를 폼 아래에 보여 준다', async () => {
    const calls = serve({ allowSelfApproval: false, active: null });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Create plan' }));

    expect(
      await screen.findByText(/The target has no deployment of this service yet/),
    ).toBeInTheDocument();
    expect(calls[0]?.body).toMatchObject({
      targetEnvironmentId: 'e2',
      requiredRequests: [20, 50, 50],
      maxWaitSeconds: 30,
      rollbackConditions: { maxErrorRatePercent: 1, maxP95Ms: 800, maxReplicationLagSeconds: 1 },
    });
  });

  it('도착 환경이 실제 실행기면 실패 주입을 고를 수 없고 이유를 보여 준다', async () => {
    serve({ allowSelfApproval: false, active: null, targetSimulated: false });
    renderPage();

    expect(await screen.findByLabelText('Inject a failure (demo)')).toBeDisabled();
    expect(screen.getByText(/runs on real executors/)).toBeInTheDocument();
  });

  it('AI 사전 점검 없이 바로 오면 그 단계를 완료로 그리지 않는다', async () => {
    serve({ allowSelfApproval: false, active: null });
    renderPage();

    expect(await screen.findByText('skipped')).toBeInTheDocument();
  });

  it('도착 환경이 가짜 실행기면 실패 주입을 고를 수 있다', async () => {
    serve({ allowSelfApproval: false, active: null });
    renderPage();

    expect(await screen.findByLabelText('Inject a failure (demo)')).toBeEnabled();
  });

  it('승인이 PLAN_STALE 이면 무엇이 바뀌었는지 보여 준다', async () => {
    serve({ allowSelfApproval: true, active: plan.id, stale: true });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Approve plan' }));

    expect(await screen.findByText('A deployment or traffic weight changed')).toBeInTheDocument();
  });

  it('도착 환경이 재난 반경 안이면 계획을 만들 수 없다', async () => {
    window.sessionStorage.setItem(
      'echoport.disasters.o1',
      JSON.stringify([
        {
          id: 'd1',
          type: 'EARTHQUAKE',
          source: 'SIMULATED',
          magnitude: 7.2,
          epicenter: { lat: 35.2, lng: 139.4 },
          epicenterLabel: 'near Tokyo',
          radiusKm: 302,
          status: 'ACTIVE',
          affectedEnvironmentIds: ['e2'],
          safeEnvironmentIds: ['e1'],
          startedAt: AT,
          endedAt: null,
          simulated: true,
        },
      ]),
    );
    const calls = serve({ allowSelfApproval: false, active: null });
    renderPage();

    const create = await screen.findByRole('button', { name: 'Create plan' });
    expect(create).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(create);
    expect(calls).toEqual([]);
  });
});
