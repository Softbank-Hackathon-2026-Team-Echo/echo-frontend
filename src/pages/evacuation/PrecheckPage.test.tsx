import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import type { Me, PrecheckDetail } from '@/lib/api/types';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import PrecheckPage from './PrecheckPage';

const API = 'http://api.test/api/v1';
const AT = '2026-11-05T04:42:00Z';
const ok = <T,>(data: T, status = 200) => HttpResponse.json({ success: true, data }, { status });

const me = (role: 'VIEWER' | 'DEVELOPER'): Me => ({
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
});

const detail = (extra: Partial<PrecheckDetail> = {}): PrecheckDetail => ({
  id: 'run1',
  serviceId: 's1',
  sourceEnvironmentId: 'e1',
  targetEnvironmentId: 'e2',
  status: 'SUCCEEDED',
  failureCode: null,
  simulated: false,
  aiReviewed: false,
  requestedByUserId: 'u1',
  createdAt: AT,
  claimedAt: AT,
  startedAt: AT,
  finishedAt: AT,
  deadlineAt: AT,
  leaseUntil: null,
  inputHash: 'sha256:abc',
  sandboxId: null,
  steps: [
    { name: 'INPUT_LOAD', firstAt: AT, lastAt: AT, level: 'INFO' },
    { name: 'CONFIG_DIFF', firstAt: AT, lastAt: AT, level: 'INFO' },
  ],
  model: null,
  configDiff: [
    {
      key: 'region',
      source: 'ap-northeast-1',
      target: 'asia-northeast3',
      origin: 'RULE',
      severity: 'INFO',
    },
  ],
  featureGaps: [],
  findings: [
    {
      control: 'config-diff',
      environmentId: 'e2',
      result: 'WARN',
      title: 'Target config differs',
      reason: '1 warning',
      origin: 'RULE',
      suggestedFix: 'Add STRIPE_KEY on the target.',
    },
  ],
  patches: [],
  blockedAttempts: [],
  ...extra,
});

function serve({
  role = 'DEVELOPER',
  run = detail(),
  create,
}: {
  role?: 'VIEWER' | 'DEVELOPER';
  run?: PrecheckDetail;
  create?: () => Response;
} = {}) {
  const calls: string[] = [];
  const environment = (id: string, name: string) => ({ id, name, kind: 'aws' });
  server.use(
    http.get(`${API}/me`, () => ok(me(role))),
    http.get(`${API}/orgs/o1/environments`, () =>
      ok({
        items: [environment('e1', 'aws-tokyo'), environment('e2', 'gcp-seoul')],
        total: 2,
        page: 0,
        size: 100,
      }),
    ),
    http.get(`${API}/orgs/o1/services/s1`, () => ok({ id: 's1', name: 'demo', environments: [] })),
    http.post(`${API}/orgs/o1/prechecks`, () => {
      calls.push('create');
      return create ? create() : ok(run, 201);
    }),
    http.get(`${API}/orgs/o1/prechecks/:id`, () => ok(run)),
    http.get(`${API}/orgs/o1/prechecks/:id/logs`, () =>
      ok({
        items: [
          { seq: 1, at: AT, step: 'INPUT_LOAD', level: 'INFO', message: 'loaded', data: null },
        ],
        nextAfter: 1,
      }),
    ),
    http.post(`${API}/orgs/o1/prechecks/:id/cancel`, () => {
      calls.push('cancel');
      return ok({ ...run, status: 'CANCELLED' });
    }),
  );
  return calls;
}

function renderPage(query = 'service=s1&target=e2&run=run1') {
  return renderRoute(<PrecheckPage />, {
    path: '/o/:slug/evacuation/pre-check',
    url: `/o/echo-demo/evacuation/pre-check?${query}`,
  });
}

describe('PrecheckPage', () => {
  it('끝난 점검은 서버 결과를 보이고 simulated 를 달지 않는다', async () => {
    serve();
    renderPage();

    expect(await screen.findByText('Target config differs')).toBeInTheDocument();
    expect(screen.getByText('Add STRIPE_KEY on the target.')).toBeInTheDocument();
    expect(screen.getByText('No AI review · rule comparison only')).toBeInTheDocument();
    expect(screen.getByText('Input loaded')).toBeInTheDocument();
    expect(screen.queryByText('simulated')).not.toBeInTheDocument();
  });

  it('러너의 가짜 모드면 simulated 를 단다', async () => {
    serve({ run: detail({ simulated: true }) });
    renderPage();

    expect(await screen.findByText('simulated')).toBeInTheDocument();
  });

  it('주소에 점검이 없으면 만들고 그 점검을 본다', async () => {
    const calls = serve();
    renderPage('service=s1&target=e2');

    expect(await screen.findByText('Target config differs')).toBeInTheDocument();
    expect(calls).toEqual(['create']);
  });

  it('이미 열린 점검이 있으면 409 의 id 로 이어서 본다', async () => {
    serve({
      create: () =>
        HttpResponse.json(
          {
            success: false,
            code: 'PRECHECK_IN_PROGRESS',
            message: 'open',
            details: [{ field: 'runId', reason: 'PRECHECK_IN_PROGRESS', value: 'run1' }],
          },
          { status: 409 },
        ),
    });
    renderPage('service=s1&target=e2');

    expect(await screen.findByText('Target config differs')).toBeInTheDocument();
  });

  it('뷰어는 점검을 만들지 않는다', async () => {
    const calls = serve({ role: 'VIEWER' });
    renderPage('service=s1&target=e2');

    expect(await screen.findByText('Pre-check has not started')).toBeInTheDocument();
    expect(calls).toEqual([]);
  });

  it('대기 중이면 러너를 기다린다고 말하고 멈출 수 있다', async () => {
    const calls = serve({
      run: detail({ status: 'QUEUED', steps: [], findings: [], configDiff: [] }),
    });
    renderPage();

    expect((await screen.findAllByText('Waiting for a runner')).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
    await waitFor(() => expect(calls).toEqual(['cancel']));
  });

  it('시간 초과면 이유와 다시 실행을 보인다', async () => {
    serve({ run: detail({ status: 'TIMED_OUT', failureCode: 'LEASE_EXPIRED' }) });
    renderPage();

    expect(await screen.findByText(/The runner stopped responding/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run again' })).toBeInTheDocument();
  });

  it('막힌 패치는 이유를 보이고 제안된 패치는 승인을 막아 둔다', async () => {
    const patch = {
      id: 'p',
      patchHash: 'h',
      files: ['k8s/hpa.yaml'],
      diff: '-a\n+b\n',
      reason: 'scale',
      touchesProtectedFiles: false,
      checks: [],
    };
    serve({
      run: detail({
        patches: [
          {
            ...patch,
            status: 'BLOCKED',
            blockReason: 'CHECK_NOT_PASSED',
            verification: { passed: 9, total: 12 },
          },
          { ...patch, id: 'p2', status: 'PROPOSED', verification: { passed: 12, total: 12 } },
        ],
      }),
    });
    renderPage();

    await userEvent.click(await screen.findByRole('tab', { name: 'Patches (2)' }));
    expect(await screen.findByText('A verification check did not pass')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve patch' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});
