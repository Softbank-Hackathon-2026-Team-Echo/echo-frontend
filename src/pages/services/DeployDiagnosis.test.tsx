import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeployRequestDetail, PrecheckDetail } from '@/lib/api/types';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import { DeployDiagnosis } from './DeployDiagnosis';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigate,
}));

const toastError = vi.hoisted(() => vi.fn());
vi.mock('sonner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('sonner')>();
  return { ...actual, toast: Object.assign(actual.toast, { error: toastError }) };
});

const API = 'http://api.test/api/v1';
const ok = <T,>(data: T, status = 200) => HttpResponse.json({ success: true, data }, { status });

const failed = {
  id: 'r1',
  status: 'FAILED',
  errorCode: 'BUILD_FAILED',
  errorMessage: 'build failed',
  failure: null,
  diagnosis: null,
} as DeployRequestDetail;

const patch = {
  id: 'p1',
  status: 'PROPOSED',
  origin: 'AI',
  files: ['index.html'],
  reason: 'Close the parenthesis',
  blockReason: null,
  diff: '@@ -1 +1 @@\n-a(\n+a()',
  patchHash: 'h1',
  verification: { passed: 1, total: 1 },
  apply: null,
};

const run = (extra: object) =>
  ({
    id: 'run1',
    status: 'SUCCEEDED',
    simulated: true,
    failureCode: null,
    steps: [],
    patches: [patch],
    diagnosis: {
      result: 'DIAGNOSED',
      category: 'CODE',
      cause: 'A parenthesis is missing',
      fixable: true,
      unfixableReason: null,
      evidence: [{ source: 'FILE', path: 'index.html', line: 12, text: 'a(' }],
    },
    ...extra,
  }) as unknown as PrecheckDetail;

function serve(detail: PrecheckDetail) {
  const calls = { created: 0, approved: 0 };
  server.use(
    http.post(`${API}/orgs/o1/deploy-requests/r1/diagnosis`, () => {
      calls.created += 1;
      return ok(detail, 201);
    }),
    http.get(`${API}/orgs/o1/prechecks/run1`, () => ok(detail)),
    http.post(`${API}/orgs/o1/prechecks/run1/patches/p1/approve`, () => {
      calls.approved += 1;
      return ok({});
    }),
  );
  return calls;
}

describe('DeployDiagnosis', () => {
  const actions = { run: vi.fn() };
  const deployLink = (id: string) => `/o/echo-demo/services/s1/deploys/${id}`;
  const renderDiagnosis = (request: DeployRequestDetail = failed) =>
    renderRoute(
      <DeployDiagnosis orgId="o1" request={request} actions={actions} deployLink={deployLink} />,
      { path: '/o/:slug', url: '/o/echo-demo' },
    );

  beforeEach(() => {
    actions.run.mockClear();
    navigate.mockClear();
    toastError.mockClear();
    server.use(
      http.get(`${API}/me`, () =>
        ok({
          user: { id: 'u1', githubLogin: 'echoport', name: null, avatarUrl: null },
          organizations: [
            { id: 'o1', slug: 'echo-demo', name: 'Echo', personal: false, role: 'DEVELOPER' },
          ],
        }),
      ),
    );
  });

  async function start() {
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Diagnose with AI' })).not.toHaveAttribute(
        'aria-disabled',
        'true',
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Diagnose with AI' }));
  }

  it('누를 때만 진단을 만들고 원인 · 근거 · 패치 · simulated 를 보인다', async () => {
    const calls = serve(run({}));
    renderDiagnosis();

    expect(calls.created).toBe(0);
    await start();

    expect(await screen.findByText('A parenthesis is missing')).toBeInTheDocument();
    expect(calls.created).toBe(1);
    expect(screen.getByText(/Code error/)).toBeInTheDocument();
    expect(screen.getByText('index.html:12')).toBeInTheDocument();
    expect(screen.getByText('simulated')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve patch' })).toBeInTheDocument();
  });

  it('이미 진단이 있으면 버튼 없이 그 실행을 보인다', async () => {
    const calls = serve(run({}));
    renderDiagnosis({ ...failed, diagnosis: { runId: 'run1', status: 'SUCCEEDED' } });

    expect(await screen.findByText('A parenthesis is missing')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Diagnose with AI' })).toBeNull();
    expect(calls.created).toBe(0);
  });

  it('진행 중이면 기다리는 문구를 보인다', async () => {
    serve(run({ status: 'RUNNING', diagnosis: null, patches: [] }));
    renderDiagnosis({ ...failed, diagnosis: { runId: 'run1', status: 'RUNNING' } });

    expect(await screen.findByRole('status')).toHaveTextContent('Waiting for the AI agent');
  });

  it('근거가 부족하면 지어내지 않고 규칙이 고른 고치기 버튼을 둔다', async () => {
    serve(
      run({
        patches: [],
        diagnosis: {
          result: 'INSUFFICIENT_EVIDENCE',
          category: null,
          cause: null,
          fixable: false,
          unfixableReason: null,
          evidence: [],
        },
      }),
    );
    renderDiagnosis({ ...failed, diagnosis: { runId: 'run1', status: 'SUCCEEDED' } });

    expect(
      await screen.findByText('There is not enough evidence to name a cause.'),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Open the build log' })).not.toHaveAttribute(
        'aria-disabled',
        'true',
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Open the build log' }));
    expect(actions.run).toHaveBeenCalledWith('OPEN_BUILD_LOG');
  });

  it('진단을 시작하지 못하면 규칙 힌트를 simulated 로 보인다', async () => {
    server.use(
      http.post(`${API}/orgs/o1/deploy-requests/r1/diagnosis`, () =>
        HttpResponse.json(
          { success: false, error: { code: 'PRECHECK_IN_PROGRESS', message: 'busy' } },
          { status: 409 },
        ),
      ),
    );
    renderDiagnosis();
    await start();

    expect(await screen.findByText(/Rule-based hint/)).toBeInTheDocument();
    expect(screen.getByText('simulated')).toBeInTheDocument();
  });

  it('진단 실행이 실패해도 규칙 힌트로 이어진다', async () => {
    serve(run({ status: 'FAILED', diagnosis: null, patches: [] }));
    renderDiagnosis({ ...failed, diagnosis: { runId: 'run1', status: 'FAILED' } });

    expect(await screen.findByText('The diagnosis stopped.')).toBeInTheDocument();
    expect(screen.getByText(/Rule-based hint/)).toBeInTheDocument();
  });

  it('패치 승인을 보내고, 만들어진 재배포로 가는 링크를 보인다', async () => {
    const calls = serve(run({}));
    renderDiagnosis({ ...failed, diagnosis: { runId: 'run1', status: 'SUCCEEDED' } });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Approve patch' })).not.toHaveAttribute(
        'aria-disabled',
        'true',
      ),
    );
    serve(
      run({
        patches: [
          {
            ...patch,
            status: 'APPLIED',
            apply: {
              finishedAt: '2026-11-07T00:00:00Z',
              failureCode: null,
              branch: null,
              appliedCommitSha: null,
              simulated: true,
              pullRequestUrl: null,
              redeployRequestId: 'r2',
              redeployRejectedCode: null,
            },
          },
        ],
      }),
    );
    server.use(
      http.post(`${API}/orgs/o1/prechecks/run1/patches/p1/approve`, () => {
        calls.approved += 1;
        return ok({});
      }),
      http.get(`${API}/orgs/o1/deploy-requests/r2`, () =>
        ok({ id: 'r2', status: 'SUCCEEDED', commitSha: '7cd47f470e6150f5' }),
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Approve patch' }));

    expect(await screen.findByRole('link', { name: 'Open the redeploy' })).toHaveAttribute(
      'href',
      '/o/echo-demo/services/s1/deploys/r2',
    );
    expect(await screen.findByText('Succeeded')).toBeInTheDocument();
    expect(screen.getByText('7cd47f4')).toBeInTheDocument();
    expect(calls.approved).toBe(1);
    // 승인 응답에 id 가 없어도 점검 상세에서 찾아 새 배포 상세로 옮긴다
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/o/echo-demo/services/s1/deploys/r2'),
    );
  });

  const approveButton = async () => {
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Approve patch' })).not.toHaveAttribute(
        'aria-disabled',
        'true',
      ),
    );
    return screen.getByRole('button', { name: 'Approve patch' });
  };

  it('승인을 누르면 곧바로 버튼을 막고 반영 진행 줄을 보인 뒤, 응답의 새 배포 상세로 옮긴다', async () => {
    serve(run({}));
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post(`${API}/orgs/o1/prechecks/run1/patches/p1/approve`, async () => {
        await gate;
        return ok({
          ...patch,
          status: 'APPROVED',
          approval: {
            decision: 'APPROVE',
            decidedByUserId: 'u1',
            decidedAt: '2026-11-08T01:00:00Z',
            reason: null,
          },
          apply: { status: 'SUCCEEDED', redeployRequestId: 'r9' },
        });
      }),
    );
    renderDiagnosis({ ...failed, diagnosis: { runId: 'run1', status: 'SUCCEEDED' } });

    await userEvent.click(await approveButton());

    // 응답 전: 비활성 · 스피너(aria-busy) · 상태 줄
    expect(await screen.findByText(/Approved — applying the fix/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve patch' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Approve patch' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(navigate).not.toHaveBeenCalled();

    release();
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/o/echo-demo/services/s1/deploys/r9'),
    );
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
  });

  it('응답에 id 가 없으면 서비스 배포 목록에서 승인 뒤 생긴 배포를 찾아 옮긴다', async () => {
    serve(run({}));
    server.use(
      http.post(`${API}/orgs/o1/prechecks/run1/patches/p1/approve`, () =>
        ok({
          ...patch,
          status: 'APPROVED',
          approval: {
            decision: 'APPROVE',
            decidedByUserId: 'u1',
            decidedAt: '2026-11-08T01:00:00Z',
            reason: null,
          },
          apply: null,
        }),
      ),
      http.get(`${API}/orgs/o1/services/s1/deploy-requests`, () =>
        ok({
          items: [
            { id: 'r1', status: 'FAILED', stageTimes: { queuedAt: '2026-11-08T00:50:00Z' } },
            { id: 'r5', status: 'BUILDING', stageTimes: { queuedAt: '2026-11-08T01:00:58Z' } },
          ],
          page: 0,
          size: 20,
          total: 2,
        }),
      ),
    );
    renderDiagnosis({
      ...failed,
      serviceId: 's1',
      diagnosis: { runId: 'run1', status: 'SUCCEEDED' },
    });

    await userEvent.click(await approveButton());
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/o/echo-demo/services/s1/deploys/r5'),
    );
  });

  it('승인이 실패하면(PATCH_STALE) 코드 · 메시지를 토스트로 보이고 옮기지 않는다', async () => {
    serve(run({}));
    server.use(
      http.post(`${API}/orgs/o1/prechecks/run1/patches/p1/approve`, () =>
        HttpResponse.json(
          { success: false, code: 'PATCH_STALE', message: 'patch hash does not match' },
          { status: 409 },
        ),
      ),
    );
    renderDiagnosis({ ...failed, diagnosis: { runId: 'run1', status: 'SUCCEEDED' } });

    await userEvent.click(await approveButton());

    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    const [, options] = toastError.mock.calls[0] as [string, { description?: string }];
    expect(options.description).toContain('PATCH_STALE · patch hash does not match');
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.queryByText(/Approved — applying the fix/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Approve patch' })).toBeEnabled();
  });

  it('재배포가 거절되면 코드를 보인다', async () => {
    serve(
      run({
        patches: [
          {
            ...patch,
            status: 'APPLIED',
            apply: {
              finishedAt: '2026-11-07T00:00:00Z',
              failureCode: null,
              branch: null,
              appliedCommitSha: null,
              simulated: false,
              pullRequestUrl: null,
              redeployRequestId: null,
              redeployRejectedCode: 'DEPLOY_IN_PROGRESS',
            },
          },
        ],
      }),
    );
    renderDiagnosis({ ...failed, diagnosis: { runId: 'run1', status: 'SUCCEEDED' } });

    expect(await screen.findByText('DEPLOY_IN_PROGRESS')).toBeInTheDocument();
  });
  it('반영이 끝난 뒤 재배포가 늦게 이어져도 기다렸다가 상태를 보인다', async () => {
    const applied = (redeployRequestId: string | null) =>
      run({
        kind: 'CHANGE_PROPOSAL',
        patches: [
          {
            ...patch,
            status: 'APPLIED',
            apply: {
              status: 'SUCCEEDED',
              finishedAt: new Date().toISOString(),
              failureCode: null,
              branch: 'echoport/fix-a1',
              appliedCommitSha: 'd387b612',
              simulated: false,
              pullRequestUrl: null,
              redeployRequestId,
              redeployRejectedCode: null,
            },
          },
        ],
      });
    let calls = 0;
    server.use(
      http.get(`${API}/orgs/o1/prechecks/run1`, () => {
        calls += 1;
        return ok(applied(calls >= 2 ? 'r2' : null));
      }),
      http.get(`${API}/orgs/o1/deploy-requests/r2`, () =>
        ok({ id: 'r2', status: 'BUILDING', commitSha: 'd387b612d83f97c0' }),
      ),
    );
    renderDiagnosis({ ...failed, diagnosis: { runId: 'run1', status: 'SUCCEEDED' } });

    expect(
      await screen.findByText(
        'Sandbox check passed. Committing the fix and starting the redeploy…',
      ),
    ).toBeInTheDocument();
    expect(await screen.findByText('Building', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  it('재배포가 오래 이어지지 않으면 다시 확인 버튼을 준다', async () => {
    server.use(
      http.get(`${API}/orgs/o1/prechecks/run1`, () =>
        ok(
          run({
            kind: 'CHANGE_PROPOSAL',
            patches: [
              {
                ...patch,
                status: 'APPLIED',
                apply: {
                  status: 'SUCCEEDED',
                  finishedAt: '2026-11-07T00:00:00Z',
                  failureCode: null,
                  branch: null,
                  appliedCommitSha: null,
                  simulated: false,
                  pullRequestUrl: null,
                  redeployRequestId: null,
                  redeployRejectedCode: null,
                },
              },
            ],
          }),
        ),
      ),
    );
    renderDiagnosis({ ...failed, diagnosis: { runId: 'run1', status: 'SUCCEEDED' } });
    expect(await screen.findByText('The redeploy has not started yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument();
  });
});
