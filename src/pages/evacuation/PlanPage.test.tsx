import { screen, waitFor } from '@testing-library/react';
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
  result: null,
  disasterId: null,
  failback: { allowed: true, reason: null, disasterId: null },
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

const compareQueries: URLSearchParams[] = [];
const compareCell = {
  result: 'PASS' as const,
  findingCount: 0,
  hasException: false,
  gateStatus: 'PASS' as const,
  exception: null,
  mode: 'REAL' as const,
  checkedAt: null,
  expiresAt: null,
  controls: [],
};
const compare = (blocked: boolean) => ({
  policyVersion: 'sec-rules-2026.11.06',
  phase: 'PREPARATION',
  checkedAt: '2026-11-06T00:00:00Z',
  simulated: false,
  serviceId: 's1',
  source: { environmentId: 'e1', environmentName: 'a', environmentKind: 'aws', services: [] },
  target: { environmentId: 'e2', environmentName: 'b', environmentKind: 'gcp', services: [] },
  summary: { blocking: blocked ? 1 : 0, worseOnTarget: 0, same: 1, better: 0 },
  rows: [
    {
      control: 'auditLog',
      source: compareCell,
      target: compareCell,
      blocksMigration: blocked,
      blockingControlIds: blocked ? ['C-AUD-1'] : [],
      change: 'SAME',
    },
  ],
});

function serve({
  allowSelfApproval,
  active,
  stale = false,
  targetSimulated = true,
  blocked = false,
  promoteWarning = null,
}: {
  allowSelfApproval: boolean;
  active: string | null;
  stale?: boolean;
  targetSimulated?: boolean;
  blocked?: boolean;
  promoteWarning?: string | null;
}) {
  const calls: { path: string; body?: unknown }[] = [];
  server.use(
    http.get(`${API}/me`, () => ok(me(allowSelfApproval))),
    http.get(`${API}/orgs/o1/services/s1`, () => ok(service(active, targetSimulated))),
    http.get(`${API}/orgs/o1/services`, () => ok({ items: [], total: 0, page: 0, size: 100 })),
    http.get(`${API}/orgs/o1/disasters`, () => ok({ items: [], total: 0, page: 0, size: 50 })),
    http.get(`${API}/orgs/o1/environments`, () => ok({ items: [], total: 0, page: 0, size: 100 })),
    http.get(`${API}/orgs/o1/migration-plans/:id`, () => ok({ ...plan, promoteWarning })),
    http.get(`${API}/orgs/o1/security/compare`, ({ request }) => {
      compareQueries.push(new URL(request.url).searchParams);
      return ok(compare(blocked));
    }),
    http.post(`${API}/orgs/o1/migration-plans/:id/approve`, async ({ request }) => {
      const text = await request.text();
      calls.push({ path: 'approve', body: text ? JSON.parse(text) : undefined });
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

function serveDisaster(meetsThreshold: boolean) {
  server.use(
    http.get(`${API}/orgs/o1/disasters`, () =>
      ok({
        items: [
          {
            id: 'd1',
            type: 'EARTHQUAKE',
            source: 'SIMULATED',
            simulated: true,
            magnitude: 7.2,
            epicenter: { lat: 35.2, lng: 139.4 },
            radiusKm: 302,
            meetsThreshold,
            status: 'ACTIVE',
            affectedEnvironmentIds: ['e2'],
            safeEnvironmentIds: ['e1'],
            unknownEnvironmentIds: [],
            createdBy: { id: 'u1', login: 'echoport' },
            endedBy: null,
            startedAt: AT,
            endedAt: null,
            plans: [],
          },
        ],
        total: 1,
        page: 0,
        size: 50,
      }),
    ),
  );
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
      requiredRequests: [7, 10, 20, 30, 30, 30],
      maxWaitSeconds: 30,
      rollbackConditions: { maxErrorRatePercent: 1, maxP95Ms: 800, maxReplicationLagSeconds: 1 },
    });
  });

  it('6칸 값을 비율 순서대로 보내고 데이터 확인은 50% 뒤에 보인다', async () => {
    const calls = serve({ allowSelfApproval: false, active: null });
    renderPage();
    await screen.findByRole('button', { name: 'Create plan' });
    const weights = [5, 10, 25, 50, 75, 100];
    for (const [index, weight] of weights.entries()) {
      const input = screen.getByLabelText(`${weight}% · requests`);
      await userEvent.clear(input);
      await userEvent.type(input, String(index + 11));
    }
    const titles = screen.getAllByText(/^(Pre-check|Shift traffic →|Data sync check)/);
    expect(titles.map((node) => node.textContent?.replace(/ on .*/, ''))).toEqual([
      'Pre-check',
      'Shift traffic → 5%',
      'Shift traffic → 10%',
      'Shift traffic → 25%',
      'Shift traffic → 50%',
      'Data sync check',
      'Shift traffic → 75%',
      'Shift traffic → 100%',
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Create plan' }));
    await expect
      .poll(() => calls[0]?.body)
      .toMatchObject({
        requiredRequests: [11, 12, 13, 14, 15, 16],
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

  it('서버 비교가 막으면 승인을 잠그고 서비스 기준으로 부른다', async () => {
    serve({ allowSelfApproval: true, active: plan.id, blocked: true });
    renderPage();

    expect(
      await screen.findByText('Approval locked: 1 security mismatch (Audit log).'),
    ).toBeInTheDocument();
    expect(compareQueries.at(-1)?.get('serviceId')).toBe('s1');
  });

  it('승인이 PLAN_STALE 이면 무엇이 바뀌었는지 보여 준다', async () => {
    serve({ allowSelfApproval: true, active: plan.id, stale: true });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Approve plan' }));

    expect(await screen.findByText('A deployment or traffic weight changed')).toBeInTheDocument();
  });

  it('복귀 버튼에서 오면 제목이 복귀 계획이다', async () => {
    serve({ allowSelfApproval: false, active: null });
    renderRoute(<PlanPage />, {
      path: '/o/:slug/evacuation/plan',
      url: '/o/echo-demo/evacuation/plan?service=s1&target=e2&failback=1',
    });

    expect(await screen.findByRole('heading', { name: 'Plan the failback' })).toBeInTheDocument();
  });

  it('보안 게이트가 승인을 막으면 통제와 사유를 보여 준다', async () => {
    serve({ allowSelfApproval: true, active: plan.id });
    server.use(
      http.post(`${API}/orgs/o1/migration-plans/:id/approve`, () =>
        HttpResponse.json(
          {
            success: false,
            code: 'SECURITY_GATE_BLOCKED',
            message: 'blocked',
            details: [{ field: 'C-AI-1', reason: 'PRECHECK_MISSING' }],
          },
          { status: 409 },
        ),
      ),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Approve plan' }));

    expect(
      (await screen.findAllByText('The security gate blocked this migration.')).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('C-AI-1')).toBeInTheDocument();
    expect(screen.getByText(/AI pre-check has not run/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Run AI pre-check on/ })).toHaveAttribute(
      'href',
      expect.stringContaining('/evacuation/pre-check?service='),
    );
  });

  it('도착 환경이 재난 반경 안이면 계획을 만들 수 없다', async () => {
    const calls = serve({ allowSelfApproval: false, active: null });
    serveDisaster(true);
    renderPage();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Create plan' })).toHaveAttribute(
        'aria-disabled',
        'true',
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Create plan' }));
    expect(calls).toEqual([]);
  });

  it('기준 미달 재난은 계획을 막지 않는다', async () => {
    serve({ allowSelfApproval: false, active: null });
    serveDisaster(false);
    renderPage();

    const create = await screen.findByRole('button', { name: 'Create plan' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(create).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('DB 쓰기 담당도 옮기기는 기본으로 켜져 있어 그대로 만들면 includeCutover true 를 보낸다(시연 결정)', async () => {
    const calls = serve({ allowSelfApproval: false, active: null });
    renderPage();

    expect(await screen.findByLabelText<HTMLInputElement>(/Also move the DB writer/)).toBeChecked();
    expect(screen.getByText('DB writer cutover')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Create plan' }));

    await expect.poll(() => calls[0]?.body).toMatchObject({ includeCutover: true });
  });

  it('복귀 계획 초안도 DB 쓰기 담당 옮기기가 기본으로 켜져 있다', async () => {
    const calls = serve({ allowSelfApproval: false, active: null });
    renderRoute(<PlanPage />, {
      path: '/o/:slug/evacuation/plan',
      url: '/o/echo-demo/evacuation/plan?service=s1&target=e2&failback=1',
    });

    expect(await screen.findByRole('heading', { name: 'Plan the failback' })).toBeInTheDocument();
    expect(screen.getByLabelText<HTMLInputElement>(/Also move the DB writer/)).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Create plan' }));

    await expect.poll(() => calls[0]?.body).toMatchObject({ includeCutover: true });
  });

  it('끄면 includeCutover false 로 만들고 DB 쓰기 전환 단계가 빠진다', async () => {
    const calls = serve({ allowSelfApproval: false, active: null });
    renderPage();

    await userEvent.click(await screen.findByLabelText(/Also move the DB writer/));
    expect(screen.queryByText('DB writer cutover')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Create plan' }));

    await expect.poll(() => calls[0]?.body).toMatchObject({ includeCutover: false });
  });

  it('승격 경고가 있으면 동의 전에는 승인을 잠그고, 동의하면 acknowledgePromote 를 보낸다', async () => {
    const calls = serve({
      allowSelfApproval: true,
      active: plan.id,
      promoteWarning: 'Promotion cannot be undone.',
    });
    renderPage();

    expect(await screen.findByText('Promotion cannot be undone.')).toBeInTheDocument();
    const approve = screen.getByRole('button', { name: 'Approve plan' });
    expect(approve).toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(screen.getByLabelText(/I understand the promotion cannot be undone/));
    await userEvent.click(screen.getByRole('button', { name: 'Approve plan' }));

    await expect
      .poll(() => calls)
      .toEqual([{ path: 'approve', body: { acknowledgePromote: true } }]);
  });

  it('승격 경고가 없으면 지금처럼 본문 없이 승인한다', async () => {
    const calls = serve({ allowSelfApproval: true, active: plan.id });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Approve plan' }));

    await expect.poll(() => calls).toEqual([{ path: 'approve', body: undefined }]);
    expect(screen.queryByText('This plan promotes the target database')).not.toBeInTheDocument();
  });

  it('승인이 422 PROMOTE_ACK_REQUIRED 면 동의가 필요하다고 알려 준다', async () => {
    serve({ allowSelfApproval: true, active: plan.id });
    server.use(
      http.post(`${API}/orgs/o1/migration-plans/:id/approve`, () =>
        HttpResponse.json(
          {
            success: false,
            code: 'PROMOTE_ACK_REQUIRED',
            message: 'acknowledgePromote is required',
            details: [],
          },
          { status: 422 },
        ),
      ),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Approve plan' }));

    expect(
      await screen.findByText(
        'This plan promotes the target database. Tick the acknowledgement above and approve again.',
      ),
    ).toBeInTheDocument();
  });

  it('취소 후 새 계획을 만들면 이전 계획의 승격 동의를 쓰지 않고 다시 동의를 받는다', async () => {
    serve({ allowSelfApproval: true, active: plan.id, promoteWarning: 'First promotion warning.' });
    let cancelled = false;
    const second = { ...plan, id: 'plan-second', promoteWarning: 'Second promotion warning.' };
    const approvals: { id: unknown; body: unknown }[] = [];
    server.use(
      http.get(`${API}/orgs/o1/services`, () => ok({ items: [], total: 0, page: 0, size: 100 })),
      http.get(`${API}/orgs/o1/services/s1`, () => ok(service(cancelled ? null : plan.id))),
      http.get(`${API}/orgs/o1/migration-plans/:id`, ({ params }) =>
        ok(
          params.id === second.id
            ? second
            : {
                ...plan,
                status: cancelled ? 'CANCELLED' : 'PENDING_APPROVAL',
                promoteWarning: 'First promotion warning.',
              },
        ),
      ),
      http.post(`${API}/orgs/o1/migration-plans/:id/cancel`, () => {
        cancelled = true;
        return ok({ ...plan, status: 'CANCELLED' });
      }),
      http.post(`${API}/orgs/o1/services/s1/migration-plans`, () => ok(second, 201)),
      http.post(`${API}/orgs/o1/migration-plans/:id/approve`, async ({ params, request }) => {
        const text = await request.text();
        approvals.push({ id: params.id, body: text ? JSON.parse(text) : undefined });
        return ok({ ...second, status: 'APPROVED' }, 202);
      }),
    );
    renderRoute(<PlanPage />, {
      path: '/o/:slug/*',
      url: `/o/echo-demo/evacuation/plan?service=s1&target=e2&plan=${plan.id}`,
    });

    // 첫 계획에 동의한 뒤 취소하고, 컷오버를 포함한 새 계획을 만든다
    await userEvent.click(
      await screen.findByLabelText(/I understand the promotion cannot be undone/),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel this plan' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Create a new plan' }));
    // DB 쓰기 담당 옮기기는 기본으로 켜져 있다
    expect(await screen.findByLabelText(/Also move the DB writer/)).toBeChecked();
    await userEvent.click(await screen.findByRole('button', { name: 'Create plan' }));

    // 새 계획의 고지에는 아직 동의하지 않았으므로 체크가 꺼져 있고 승인이 잠긴다
    expect(await screen.findByText('Second promotion warning.')).toBeInTheDocument();
    const checkbox = screen.getByLabelText<HTMLInputElement>(
      /I understand the promotion cannot be undone/,
    );
    expect(checkbox.checked).toBe(false);
    expect(screen.getByRole('button', { name: 'Approve plan' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Approve plan' }));
    expect(approvals).toEqual([]);

    // 새 계획에 다시 동의해야 그 계획 id 로 동의 본문이 나간다
    await userEvent.click(checkbox);
    await userEvent.click(screen.getByRole('button', { name: 'Approve plan' }));
    await expect
      .poll(() => approvals)
      .toEqual([{ id: 'plan-second', body: { acknowledgePromote: true } }]);
  });
});
