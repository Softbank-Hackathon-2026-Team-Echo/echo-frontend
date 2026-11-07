import { QueryClient } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '@/lib/api/query-keys';
import type { DeployRequestDetail } from '@/lib/api/types';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import DeployProgressPage from './DeployProgressPage';

const API = 'http://api.test/api/v1';
const AT = '2026-11-07T10:20:00Z';
const followKey = queryKeys.deployRequest('o1', 'r2');
const ok = (data: unknown) => HttpResponse.json({ success: true, data });

function detail(id: string, status: DeployRequestDetail['status']): DeployRequestDetail {
  return {
    id,
    serviceId: 's1',
    environment: { id: 'e1', name: 'aws-tokyo', kind: 'aws' },
    serviceEnvironmentId: 'se1',
    trigger: 'MANUAL',
    sourceRequestId: null,
    ref: { type: 'COMMIT', value: id === 'r1' ? 'aaaaaaa1234567' : 'bbbbbbb1234567' },
    commitSha: id === 'r1' ? 'aaaaaaa1234567' : 'bbbbbbb1234567',
    status,
    cancelReason: null,
    errorCode: status === 'FAILED' ? 'BUILD_FAILED' : null,
    errorMessage: null,
    revertStatus: null,
    stageTimes: {
      queuedAt: AT,
      buildingAt: AT,
      deployingAt: status === 'DEPLOYING' ? AT : null,
      verifyingAt: null,
      finishedAt: status === 'FAILED' ? AT : null,
    },
    simulated: false,
    isCurrent: false,
    rollbackable: false,
    rollbackOfRequestId: null,
    repoUrl: 'https://github.com/example/demo',
    supersededById: null,
    build: null,
    deploymentId: null,
    urls: { main: 'https://demo.example.test', environment: 'https://aws.example.test' },
    diagnosis: id === 'r1' ? { runId: 'run1', status: 'SUCCEEDED' } : null,
  };
}

function fixture(initialError: boolean, errorKind: '503' | 'network') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  let offline = initialError;
  let status: DeployRequestDetail['status'] = 'BUILDING';
  const gets: string[] = [];
  const posts: string[] = [];
  const onRequest = ({ request }: { request: Request }) => {
    if (request.method === 'POST') posts.push(request.url);
  };
  server.events.on('request:start', onRequest);
  server.use(
    http.get(`${API}/me`, () =>
      ok({
        user: { id: 'u1', githubLogin: 'tester' },
        organizations: [{ id: 'o1', slug: 'echo-demo', name: 'Echo', role: 'DEVELOPER' }],
      }),
    ),
    http.get(`${API}/orgs/o1/services/s1`, () => ok({ id: 's1', name: 'demo', environments: [] })),
    http.get(`${API}/orgs/o1/environments`, () => ok({ items: [], total: 0, page: 0, size: 100 })),
    http.get(`${API}/orgs/o1/services/s1/deploy-requests`, () =>
      ok({ items: [], total: 0, page: 0, size: 20 }),
    ),
    http.get(`${API}/orgs/o1/deploy-requests/r1`, () => ok(detail('r1', 'FAILED'))),
    http.get(`${API}/orgs/o1/prechecks/run1`, () =>
      ok({
        id: 'run1',
        kind: 'CHANGE_PROPOSAL',
        status: 'SUCCEEDED',
        simulated: false,
        failureCode: null,
        steps: [],
        diagnosis: {
          result: 'DIAGNOSED',
          category: 'CODE',
          cause: 'ORIGINAL_FAILURE_EVIDENCE',
          fixable: true,
          unfixableReason: null,
          evidence: [],
        },
        patches: [
          {
            id: 'p1',
            status: 'APPLIED',
            origin: 'AI',
            files: ['index.html'],
            reason: 'APPROVAL_HISTORY',
            diff: '-a(\n+a()',
            patchHash: 'h1',
            verification: { passed: 1, total: 1 },
            blockReason: null,
            apply: {
              runId: 'a1',
              status: 'SUCCEEDED',
              finishedAt: AT,
              failureCode: null,
              branch: 'fix/a1',
              appliedCommitSha: 'bbbbbbb1234567',
              simulated: false,
              pullRequestUrl: null,
              redeployRequestId: 'r2',
              redeployRejectedCode: null,
            },
          },
        ],
      }),
    ),
    http.get(`${API}/orgs/o1/deploy-requests/r2`, ({ request }) => {
      gets.push(request.url);
      if (!offline) return ok(detail('r2', status));
      return errorKind === 'network'
        ? HttpResponse.error()
        : HttpResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'offline', details: [] } },
            { status: 503 },
          );
    }),
    http.get(`${API}/orgs/o1/deploy-requests/:id/logs`, ({ params }) =>
      ok({
        items: [{ at: AT, level: 'INFO', message: `LOG_FOR_${params.id}` }],
        hasMore: false,
        nextCursor: null,
        simulated: false,
      }),
    ),
  );
  const view = renderRoute(<DeployProgressPage />, {
    path: '/o/:slug/services/:serviceId/deploys/:deployRequestId',
    url: '/o/echo-demo/services/s1/deploys/r1',
    queryClient: client,
  });
  return {
    client,
    gets,
    posts,
    disconnect: () => {
      offline = true;
    },
    recover: () => {
      offline = false;
      status = 'DEPLOYING';
    },
    cleanup: () => {
      view.unmount();
      client.clear();
      server.events.removeListener('request:start', onRequest);
      vi.useRealTimers();
    },
  };
}

function expectOriginPreserved() {
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('aaaaaaa');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Failed');
  expect(screen.getByText('ORIGINAL_FAILURE_EVIDENCE')).toBeInTheDocument();
  expect(screen.getByText('APPROVAL_HISTORY')).toBeInTheDocument();
  expect(screen.getByText('LOG_FOR_r1')).toBeVisible();
}

beforeEach(() => {
  vi.stubGlobal('scrollTo', () => {});
  Element.prototype.scrollIntoView = () => {};
});

describe('RedeployFollow GET 오류와 복구', () => {
  it.each(['503', 'network'] as const)(
    '첫 GET %s 오류는 오류·GET 재시도 후 같은 후속 단계/로그로 복구한다',
    async (kind) => {
      const f = fixture(true, kind);
      try {
        const region = await screen.findByRole('region', { name: 'Redeploy with the fix' });
        await waitFor(() => expect(f.client.getQueryState(followKey)?.status).toBe('error'));
        expect(within(region).getByText("Couldn't load this")).toBeVisible();
        expect(region.querySelector('[data-slot="skeleton"]')).toBeNull();
        const retry = within(region).getByRole('button', { name: 'Retry' });
        expect(retry).toBeEnabled();
        expectOriginPreserved();
        const beforeRetry = f.gets.length;
        f.recover();
        await userEvent.click(retry);
        await within(region).findByText('bbbbbbb');
        expect(within(region).getByRole('heading', { level: 2 })).toHaveTextContent('Deploying');
        expect(await within(region).findByText('LOG_FOR_r2')).toBeVisible();
        expect(within(region).queryByText("Couldn't load this")).not.toBeInTheDocument();
        expect(f.gets.length).toBeGreaterThan(beforeRetry);
        expect(new Set(f.gets)).toEqual(new Set([`${API}/orgs/o1/deploy-requests/r2`]));
        expect(f.posts).toEqual([]);
        expectOriginPreserved();
      } finally {
        f.cleanup();
      }
    },
  );

  it.each(['503', 'network'] as const)(
    'cached BUILDING 뒤 %s 오류는 시각 고정·stale 구분 후 GET만으로 복구한다',
    async (kind) => {
      const f = fixture(false, kind);
      try {
        const region = await screen.findByRole('region', { name: 'Redeploy with the fix' });
        await within(region).findByText('LOG_FOR_r2');
        const confirmedAt = f.client.getQueryState(followKey)?.dataUpdatedAt;
        expect(confirmedAt).toBeGreaterThan(0);
        f.disconnect();
        await act(async () => {
          await f.client.invalidateQueries({ queryKey: followKey });
        });
        await waitFor(() => expect(f.client.getQueryState(followKey)?.status).toBe('error'));
        expect(within(region).getByRole('alert')).toHaveTextContent(
          'Status check delayed. Showing the last confirmed state.',
        );
        const heading = within(region).getByRole('heading', { level: 2 });
        expect(heading).toHaveTextContent('Building');
        expect(heading).not.toHaveTextContent(/Failed|Cancelled/);
        expect(f.client.getQueryData<DeployRequestDetail>(followKey)?.status).toBe('BUILDING');
        const lastChecked = region.querySelector('time');
        expect(lastChecked).toHaveAttribute('dateTime', new Date(confirmedAt ?? 0).toISOString());
        expect(lastChecked).toBeVisible();
        expect(within(region).getByTitle('Elapsed at last confirmation')).toBeVisible();
        expect(within(region).getByText('LOG_FOR_r2')).not.toBeVisible();
        // 스테퍼의 Live는 단계명이다. 로그 헤더의 Live는 현재 수신으로 오인하지 않게 숨긴다.
        expect(
          within(region)
            .getAllByText('Live')
            .filter((el) => el.closest('header')),
        ).toHaveLength(1);
        expect(
          within(region)
            .getAllByText('Live')
            .find((el) => el.closest('header')),
        ).not.toBeVisible();
        const frozenHeading = heading.textContent;
        const frozenSteps = region.querySelector('ol')?.textContent;
        vi.useFakeTimers();
        await act(async () => {
          await vi.advanceTimersByTimeAsync(5_000);
        });
        expect(heading.textContent).toBe(frozenHeading);
        expect(region.querySelector('ol')?.textContent).toBe(frozenSteps);
        vi.useRealTimers();
        expectOriginPreserved();
        const beforeRetry = f.gets.length;
        f.recover();
        await userEvent.click(within(region).getByRole('button', { name: 'Retry' }));
        await waitFor(() => expect(heading).toHaveTextContent('Deploying'));
        expect(within(region).getByText('LOG_FOR_r2')).toBeVisible();
        expect(within(region).queryByRole('alert')).not.toBeInTheDocument();
        expect(within(region).queryByTitle('Elapsed at last confirmation')).not.toBeInTheDocument();
        expect(region.querySelector('time')).toBeNull();
        expect(f.gets.length).toBeGreaterThan(beforeRetry);
        expect(new Set(f.gets)).toEqual(new Set([`${API}/orgs/o1/deploy-requests/r2`]));
        expect(f.posts).toEqual([]);
        expectOriginPreserved();
      } finally {
        f.cleanup();
      }
    },
  );
});

describe('RedeployFollow 캐시 뒤 GET 오류 표시 (리뷰 반영)', () => {
  async function cachedThenError(kind: '503' | 'network') {
    const f = fixture(false, kind);
    const region = await screen.findByRole('region', { name: 'Redeploy with the fix' });
    await within(region).findByText('LOG_FOR_r2');
    f.disconnect();
    await act(async () => {
      await f.client.invalidateQueries({ queryKey: followKey });
    });
    await waitFor(() => expect(f.client.getQueryState(followKey)?.status).toBe('error'));
    return { f, region };
  }

  it.each(['503', 'network'] as const)(
    '캐시가 있으면 %s 오류에 ErrorState 대신 경고와 작은 다시 시도 버튼만 보인다',
    async (kind) => {
      const { f, region } = await cachedThenError(kind);
      try {
        expect(within(region).getByRole('alert')).toHaveTextContent(
          'Status check delayed. Showing the last confirmed state.',
        );
        expect(within(region).queryByText("Couldn't load this")).not.toBeInTheDocument();
        expect(region.querySelector('.border-dashed')).toBeNull();
        const retry = within(region).getByRole('button', { name: 'Retry' });
        expect(retry).toBeVisible();
        const beforeRetry = f.gets.length;
        f.recover();
        await userEvent.click(retry);
        await waitFor(() => expect(f.gets.length).toBeGreaterThan(beforeRetry));
        await waitFor(() =>
          expect(within(region).getByRole('heading', { level: 2 })).toHaveTextContent('Deploying'),
        );
        expect(within(region).queryByRole('alert')).not.toBeInTheDocument();
        expect(f.posts).toEqual([]);
      } finally {
        f.cleanup();
      }
    },
  );

  it('조회 오류 동안 단계 스피너를 멈추고 확인 지연으로 그리며, 회복하면 다시 돈다', async () => {
    const f = fixture(false, '503');
    try {
      const region = await screen.findByRole('region', { name: 'Redeploy with the fix' });
      await within(region).findByText('LOG_FOR_r2');
      const stepper = region.querySelector('ol');
      expect(stepper?.querySelector('.animate-spin')).not.toBeNull();
      f.disconnect();
      await act(async () => {
        await f.client.invalidateQueries({ queryKey: followKey });
      });
      await waitFor(() => expect(f.client.getQueryState(followKey)?.status).toBe('error'));
      expect(region.querySelector('.animate-spin')).toBeNull();
      expect(
        within(region.querySelector('ol') as HTMLElement).getByRole('img', {
          name: 'Check delayed',
        }),
      ).toBeInTheDocument();
      expect(within(region).queryByText('Building the image…')).not.toBeInTheDocument();
      f.recover();
      await userEvent.click(within(region).getByRole('button', { name: 'Retry' }));
      await waitFor(() =>
        expect(within(region).getByRole('heading', { level: 2 })).toHaveTextContent('Deploying'),
      );
      expect(region.querySelector('ol')?.querySelector('.animate-spin')).not.toBeNull();
      expect(within(region).queryByRole('img', { name: 'Check delayed' })).not.toBeInTheDocument();
      expect(f.posts).toEqual([]);
    } finally {
      f.cleanup();
    }
  });
});
