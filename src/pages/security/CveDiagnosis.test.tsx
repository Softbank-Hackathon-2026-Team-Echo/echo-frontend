import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrecheckDetail, SecurityFinding } from '@/lib/api/types';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import { CveDiagnosis } from './CveDiagnosis';

const API = 'http://api.test/api/v1';
const ok = <T,>(data: T, status = 200) => HttpResponse.json({ success: true, data }, { status });
const finding = {
  id: 'f1',
  serviceId: 's1',
  mode: 'SIMULATED',
  remediation: { kind: 'DEPENDENCY_BUMP' },
} as SecurityFinding;
const patch = {
  id: 'p1',
  status: 'PROPOSED',
  origin: 'RULE',
  files: ['uv.lock'],
  reason: 'Verified dependency bump',
  blockReason: null,
  diff: '@@ -1 +1 @@\n-old\n+new',
  patchHash: 'h1',
  verification: { passed: 6, total: 6 },
  apply: null,
};
const run = (extra: object = {}) =>
  ({
    id: 'run1',
    kind: 'CHANGE_PROPOSAL',
    status: 'SUCCEEDED',
    simulated: false,
    failureCode: null,
    steps: [],
    patches: [patch],
    diagnosis: {
      result: 'DIAGNOSED',
      category: 'DEPENDENCY',
      cause: 'Dependency update',
      fixable: true,
      unfixableReason: null,
      evidence: [{ source: 'ADVISORY', text: 'SIM-PYTHON' }],
    },
    ...extra,
  }) as unknown as PrecheckDetail;
function serve(detail: PrecheckDetail) {
  const calls = { created: 0, approved: 0 };
  server.use(
    http.post(`${API}/orgs/o1/security/findings/f1/diagnosis`, () => {
      calls.created++;
      return ok(detail, 201);
    }),
    http.get(`${API}/orgs/o1/prechecks/run1`, () => ok(detail)),
    http.post(`${API}/orgs/o1/prechecks/run1/patches/p1/approve`, () => {
      calls.approved++;
      return ok({});
    }),
    http.get(`${API}/orgs/o1/services/s1`, () => ok({ id: 's1', name: 'demo', environments: [] })),
  );
  return calls;
}
const render = () =>
  renderRoute(<CveDiagnosis finding={finding} />, { path: '/o/:slug', url: '/o/echo-demo' });
async function start() {
  await userEvent.click(await screen.findByRole('button', { name: 'Create dependency fix' }));
}

describe('CveDiagnosis', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    server.use(
      http.get(`${API}/me`, () =>
        ok({
          user: { id: 'u1', githubLogin: 'echoport' },
          organizations: [{ id: 'o1', slug: 'echo-demo', name: 'Echo', role: 'DEVELOPER' }],
        }),
      ),
    );
  });
  it('explicitly starts a real run, distinguishes synthetic advisory, and reuses approval', async () => {
    const calls = serve(run());
    render();
    await screen.findByRole('button', { name: 'Create dependency fix' });
    expect(calls.created).toBe(0);
    await start();
    expect(await screen.findByText('Dependency update')).toBeInTheDocument();
    expect(screen.getByText('SIM-PYTHON')).toBeInTheDocument();
    expect(screen.getByText(/Synthetic advisory/)).toBeInTheDocument();
    expect(screen.getByText(/Functional compatibility has not been tested/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Approve patch' }));
    await waitFor(() => expect(calls.approved).toBe(1));
  });
  it('shows unfixable reason without a patch or approval', async () => {
    serve(
      run({
        patches: [],
        diagnosis: {
          result: 'DIAGNOSED',
          cause: 'Cannot update',
          unfixableReason: 'Pinned dependency conflict',
          evidence: [],
        },
      }),
    );
    render();
    await start();
    expect(await screen.findByText('Pinned dependency conflict')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve patch' })).toBeNull();
  });
  it('keeps the finding and shows the redeployment on the same screen', async () => {
    serve(
      run({
        patches: [
          {
            ...patch,
            status: 'APPROVED',
            apply: {
              runId: 'a1',
              status: 'SUCCEEDED',
              finishedAt: '2026-11-07T10:00:00Z',
              redeployRequestId: 'd2',
            },
          },
        ],
      }),
    );
    server.use(
      http.get(`${API}/orgs/o1/deploy-requests/d2`, () =>
        ok({
          id: 'd2',
          status: 'QUEUED',
          steps: [],
          environment: { id: 'e1', name: 'GCP' },
          ref: { type: 'COMMIT', value: 'c'.repeat(40) },
          commitSha: 'c'.repeat(40),
          image: null,
          stageTimes: {},
          createdAt: '2026-11-07T10:00:00Z',
        }),
      ),
      http.get(`${API}/orgs/o1/deploy-requests/d2/logs`, () => ok({ items: [], nextCursor: null })),
    );
    render();
    await start();
    expect(await screen.findByText('Dependency update')).toBeInTheDocument();
    expect(await screen.findByText('Redeploy with the fix')).toBeInTheDocument();
  });
});
