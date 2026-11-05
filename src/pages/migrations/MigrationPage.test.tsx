import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import type { Me, MigrationPlan } from '@/lib/api/types';
import { AT, cutoverResult, migrationPlan, step } from '@/test/migration-fixtures';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import MigrationPage from './MigrationPage';

const API = 'http://api.test/api/v1';
const ok = <T,>(data: T, status = 200) => HttpResponse.json({ success: true, data }, { status });

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

function serve(plan: MigrationPlan) {
  const calls: string[] = [];
  server.use(
    http.get(`${API}/me`, () => ok(me)),
    http.get(`${API}/orgs/o1/environments`, () => ok({ items: [], total: 0, page: 0, size: 100 })),
    http.get(`${API}/orgs/o1/migration-plans/:id`, () => ok(plan)),
    http.get(`${API}/orgs/o1/migration-plans/:id/logs`, () =>
      ok({ simulated: true, items: [], nextCursor: null, hasMore: false }),
    ),
    http.post(`${API}/orgs/o1/migration-plans/:id/abort`, () => {
      calls.push('abort');
      return ok({ ...plan, abortRequestedAt: AT }, 202);
    }),
  );
  return calls;
}

function renderPage() {
  return renderRoute(<MigrationPage />, {
    path: '/o/:slug/migrations/:planId',
    url: '/o/echo-demo/migrations/plan-1234abcd',
  });
}

afterEach(() => window.sessionStorage.clear());

describe('MigrationPage', () => {
  it('끝난 이전은 Result 숫자 표를 바로 연다', async () => {
    serve(migrationPlan({ status: 'SUCCEEDED', finishedAt: '2026-11-05T03:00:25Z' }));
    renderPage();

    expect(await screen.findByText('Zero failed requests while traffic moved')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Result' })).toHaveAttribute('aria-selected', 'true');
  });

  it('요청 없이 헬스 체크로 통과하면 실패 0건이라고 말하지 않는다', async () => {
    serve(
      migrationPlan({
        status: 'SUCCEEDED',
        finishedAt: '2026-11-05T03:00:25Z',
        steps: [step(1, 'SHIFT', 10, 'PASSED', { requestCount: 0, lowTraffic: true })],
      }),
    );
    renderPage();

    expect(
      await screen.findByText('Too few requests to judge, so stages passed on health checks.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Zero failed requests while traffic moved')).not.toBeInTheDocument();
  });

  it('요청이 1건뿐인 저트래픽 이전도 실패 0건이라고 내세우지 않는다', async () => {
    serve(
      migrationPlan({
        status: 'SUCCEEDED',
        finishedAt: '2026-11-05T03:00:25Z',
        steps: [step(1, 'SHIFT', 100, 'PASSED', { requestCount: 1, lowTraffic: true })],
      }),
    );
    renderPage();

    expect(
      await screen.findByText('Too few requests to judge, so stages passed on health checks.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Zero failed requests while traffic moved')).not.toBeInTheDocument();
  });

  it('Result 는 인프라 스크립트가 잰 쓰기 정지와 누락·중복을 보인다', async () => {
    serve(
      migrationPlan({
        status: 'SUCCEEDED',
        finishedAt: '2026-11-05T03:00:25Z',
        result: cutoverResult(),
      }),
    );
    renderPage();

    expect(await screen.findByText('5.556 s')).toBeInTheDocument();
    expect(screen.getByText('0 · 0')).toBeInTheDocument();
    expect(screen.getByText('169 rows compared')).toBeInTheDocument();
    expect(screen.getByText('DB cutover · measured by infra script')).toBeInTheDocument();
  });

  it('Roll back 은 확인을 거친 뒤 중단 API 를 부른다', async () => {
    const calls = serve(migrationPlan());
    renderPage();

    await screen.findByText('Traffic weight');
    await userEvent.click(screen.getByRole('button', { name: 'Roll back' }));
    expect(calls).toEqual([]);
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Roll back' }),
    );

    await expect.poll(() => calls).toEqual(['abort']);
  });

  it('출발 환경이 아직 재난 반경 안이면 복귀를 막는다', async () => {
    serve(
      migrationPlan({
        status: 'SUCCEEDED',
        finishedAt: '2026-11-05T03:00:25Z',
        failback: { allowed: false, reason: 'DISASTER_ACTIVE', disasterId: 'd1' },
      }),
    );
    renderPage();

    expect(await screen.findByRole('button', { name: 'Start failback' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('제목은 서버 mode 를 따른다: 앞선 복귀를 되짚어도 PLANNED 면 Failback 이 아니다', async () => {
    serve(migrationPlan({ status: 'ROLLED_BACK', mode: 'PLANNED' }));
    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Migration plan-123 rolled back' }),
    ).toBeInTheDocument();
  });

  it('mode 가 FAILBACK 이면 제목이 Failback 이다', async () => {
    serve(migrationPlan({ status: 'ROLLED_BACK', mode: 'FAILBACK' }));
    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Failback plan-123 rolled back' }),
    ).toBeInTheDocument();
  });

  it('복귀가 데이터 확인에서 지표를 못 받으면 DB 쓰기 전환을 안내한다', async () => {
    const failed = step(3, 'DATA_SYNC_CHECK', null, 'FAILED');
    serve(
      migrationPlan({
        status: 'ROLLED_BACK',
        mode: 'FAILBACK',
        errorCode: 'METRICS_UNAVAILABLE',
        steps: [
          { ...failed, result: { ...failed.result, failureCode: 'METRICS_UNAVAILABLE' } },
        ] as MigrationPlan['steps'],
      }),
    );
    renderPage();

    expect(
      (await screen.findAllByText(/A failback needs the DB cutover first/)).length,
    ).toBeGreaterThan(0);
  });
});
