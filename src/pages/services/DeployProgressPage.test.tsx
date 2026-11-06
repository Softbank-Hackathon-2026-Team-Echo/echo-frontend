import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import type { DeployRequestDetail, DeployRequestSummary, Me } from '@/lib/api/types';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import DeployProgressPage, {
  hadPreviousVersion,
  stageDuration,
  stageStates,
  standbyStep,
} from './DeployProgressPage';

const times = {
  queuedAt: '2026-11-02T00:00:00Z',
  buildingAt: null,
  deployingAt: null,
  verifyingAt: null,
  finishedAt: null,
};

describe('stageStates', () => {
  it('빌드 중이면 큐는 끝나고 빌드가 진행 중이다', () => {
    expect(
      stageStates({
        status: 'BUILDING',
        stageTimes: { ...times, buildingAt: '2026-11-02T00:00:02Z' },
      }),
    ).toEqual(['done', 'current', 'pending', 'pending']);
  });

  it('배포 단계에서 실패하면 그 단계가 실패로 표시된다', () => {
    expect(
      stageStates({
        status: 'FAILED',
        stageTimes: {
          ...times,
          buildingAt: '2026-11-02T00:00:02Z',
          deployingAt: '2026-11-02T00:00:05Z',
          finishedAt: '2026-11-02T00:00:06Z',
        },
      }),
    ).toEqual(['done', 'done', 'failed', 'pending']);
  });

  it('성공하면 모든 단계가 끝났다', () => {
    expect(stageStates({ status: 'SUCCEEDED', stageTimes: times })).toEqual([
      'done',
      'done',
      'done',
      'done',
    ]);
  });
});

describe('standbyStep', () => {
  const link = (id: string, sha: string | null) => ({
    serviceEnvironmentId: id,
    environment: { id: `env-${id}`, name: `env-${id}`, kind: 'gcp' },
    currentDeployment: sha ? { id: 'd', commitSha: sha, imageDigest: 'x', finishedAt: null } : null,
  });
  const sync = (id: string, status: DeployRequestSummary['status'], name = 'gcp-seoul') => ({
    id,
    status,
    environment: { id: `env-${id}`, name, kind: 'gcp' },
  });
  const base = { status: 'SUCCEEDED', trigger: 'MANUAL', serviceEnvironmentId: 'serving' } as const;
  // 예비가 지금 다른 커밋이어도 판정은 따라가기 요청으로 한다 (echo-frontend #59)
  const service = { environments: [link('serving', 'new'), link('standby', 'old')] as never };

  it('따라가기가 모두 성공했으면 지금 예비 버전과 달라도 동기화됨이다', () => {
    const result = standbyStep(base, service, [
      sync('s1', 'SUCCEEDED'),
      sync('s2', 'SUCCEEDED', 'onprem'),
    ]);
    expect(result).toEqual({ state: 'done', detail: '2 standby in sync' });
  });

  it('따라가기가 없으면 건너뛴다', () => {
    expect(standbyStep(base, service, [])).toEqual({
      state: 'skipped',
      detail: 'no standby followed',
    });
  });

  it('따라가기가 진행 중이면 그 요청을 가리킨다', () => {
    const result = standbyStep(base, service, [
      sync('s1', 'SUCCEEDED'),
      sync('s2', 'VERIFYING', 'onprem'),
    ]);
    expect(result).toEqual({
      state: 'current',
      detail: 'syncing onprem',
      syncingRequestId: 's2',
    });
  });

  it('따라가기가 실패하면 실패 표시와 그 요청 링크를 준다', () => {
    const result = standbyStep(base, service, [sync('s1', 'SUCCEEDED'), sync('s2', 'FAILED')]);
    expect(result).toEqual({
      state: 'failed',
      detail: '1 of 2 standby failed',
      syncingRequestId: 's2',
    });
  });

  it('아직 불러오지 못했으면 값을 지어내지 않는다', () => {
    expect(standbyStep(base, service, undefined)).toEqual({ state: 'pending', detail: '—' });
  });

  it('진행 중인 배포는 따라갈 예비 수를 보여 준다', () => {
    const result = standbyStep({ ...base, status: 'BUILDING' }, service, undefined);
    expect(result).toEqual({ state: 'pending', detail: '1 standby will follow' });
  });

  it('따라가기 요청 자체는 지금처럼 표시한다', () => {
    const result = standbyStep({ ...base, trigger: 'STANDBY_SYNC' }, service, undefined);
    expect(result).toEqual({ state: 'done', detail: 'this deploy is the sync' });
  });
});

describe('stageDuration', () => {
  const TEN_MINUTES = 600_000;
  const later = (iso: string) => new Date(iso).getTime() + TEN_MINUTES;

  // 운영 응답 그대로 (echo-frontend #54)
  const cancelled = {
    queuedAt: '2026-11-04T10:55:48.269513Z',
    buildingAt: null,
    deployingAt: null,
    verifyingAt: null,
    finishedAt: '2026-11-04T10:55:48.787564Z',
  };
  const failed = {
    queuedAt: '2026-11-03T17:04:32.651131Z',
    buildingAt: '2026-11-03T17:04:33.670361Z',
    deployingAt: '2026-11-03T17:05:39.482140Z',
    verifyingAt: null,
    finishedAt: '2026-11-03T17:05:40.003215Z',
  };

  it('취소된 요청은 시간이 지나도 늘지 않는다', () => {
    expect(stageDuration(cancelled, 0, later(cancelled.finishedAt))).toBe('1s');
  });

  it('실패한 요청은 단계마다 실제 걸린 시간이다', () => {
    const now = later(failed.finishedAt);
    expect([0, 1, 2].map((index) => stageDuration(failed, index, now))).toEqual([
      '1s',
      '1m 06s',
      '1s',
    ]);
  });

  it('시작하지 않은 단계는 값이 없다', () => {
    expect(stageDuration(failed, 3, Date.now())).toBeNull();
  });

  it('진행 중인 단계는 지금까지 늘어난다', () => {
    const running = { ...failed, deployingAt: null, finishedAt: null };
    const startedAt = new Date(failed.buildingAt).getTime();
    expect(stageDuration(running, 1, startedAt + 5_000)).toBe('5s');
    expect(stageDuration(running, 1, startedAt + 65_000)).toBe('1m 05s');
  });
});

describe('DeployProgressPage 화면', () => {
  const API = 'http://api.test/api/v1';
  const AT = '2026-11-04T10:58:00Z';
  const ok = <T,>(data: T) => HttpResponse.json({ success: true, data });
  const me: Me = {
    user: { id: 'u1', githubLogin: 'echoport', name: null, avatarUrl: null },
    organizations: [
      {
        id: 'o1',
        slug: 'echo-demo',
        name: 'Echo Demo',
        personal: false,
        role: 'VIEWER',
        allowSelfApproval: false,
        createdAt: AT,
      },
    ],
  };
  const request = (extra: Partial<DeployRequestDetail>): DeployRequestDetail => ({
    id: 'r3',
    serviceId: 's1',
    environment: { id: 'e1', name: 'aws-tokyo', kind: 'aws' },
    serviceEnvironmentId: 'se1',
    trigger: 'MANUAL',
    sourceRequestId: null,
    ref: { type: 'COMMIT', value: '0ff0d44f64e43d6eb65db63ab4f7844642638562' },
    commitSha: '0ff0d44f64e43d6eb65db63ab4f7844642638562',
    status: 'SUCCEEDED',
    cancelReason: null,
    errorCode: null,
    revertStatus: null,
    stageTimes: { ...times, queuedAt: AT, finishedAt: AT },
    simulated: false,
    isCurrent: true,
    rollbackable: false,
    rollbackOfRequestId: null,
    repoUrl: 'https://github.com/team-echo/demo',
    supersededById: null,
    errorMessage: null,
    build: null,
    deploymentId: null,
    urls: { main: 'https://demo.echoport.uk', environment: 'https://demo-aws.echoport.uk' },
    ...extra,
  });

  let trigger: string | null = null;

  function renderDeploy(detail: DeployRequestDetail) {
    server.use(
      http.get(`${API}/me`, () => ok(me)),
      http.get(`${API}/orgs/o1/services/s1`, () => ok({ name: 'demo', environments: [] })),
      http.get(`${API}/orgs/o1/deploy-requests/r3`, () => ok(detail)),
      http.get(`${API}/orgs/o1/services/s1/deploy-requests`, ({ request: req }) => {
        trigger = new URL(req.url).searchParams.get('trigger');
        return ok({
          items: [
            request({ id: 'sync-1', trigger: 'STANDBY_SYNC', sourceRequestId: 'r3' }),
            request({ id: 'other', trigger: 'STANDBY_SYNC', sourceRequestId: 'r9' }),
          ],
          total: 2,
          page: 0,
          size: 100,
        });
      }),
      http.get(`${API}/orgs/o1/deploy-requests/r3/logs`, () =>
        ok({
          items: [{ at: AT, level: 'INFO', message: 'build step' }],
          hasMore: false,
          nextCursor: null,
          simulated: false,
        }),
      ),
    );
    return renderRoute(<DeployProgressPage />, {
      path: '/o/:slug/services/:serviceId/deploys/:deployRequestId',
      url: '/o/echo-demo/services/s1/deploys/r3',
    });
  }

  it('되돌리기 요청은 되돌린 대상 요청으로 가는 링크가 있다', async () => {
    renderDeploy(request({ trigger: 'ROLLBACK', rollbackOfRequestId: 'r1' }));

    expect(await screen.findByRole('link', { name: 'rollback of 0ff0d44' })).toHaveAttribute(
      'href',
      '/o/echo-demo/services/s1/deploys/r1',
    );
  });

  it('일반 배포에는 되돌린 대상 링크가 없다', async () => {
    renderDeploy(request({}));

    expect(await screen.findByText('manual')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /rollback of/ })).not.toBeInTheDocument();
  });

  it('예비 칸은 이 요청이 만든 따라가기만 센다', async () => {
    renderDeploy(request({}));

    expect(await screen.findByText('1 standby in sync')).toBeInTheDocument();
    expect(trigger).toBe('STANDBY_SYNC');
  });

  const buildNotice = /This build was reused/;
  const build = (reused: boolean) => ({
    id: 'b1',
    status: 'SUCCEEDED' as const,
    imageRepository: null,
    imageDigest: null,
    reused,
  });

  it('재사용한 빌드의 Build 탭에는 안내가 나온다', async () => {
    renderDeploy(request({ build: build(true) }));

    await userEvent.click(await screen.findByRole('tab', { name: 'Build' }));

    expect(await screen.findByText(buildNotice)).toBeInTheDocument();
  });

  it('새로 빌드했으면 안내가 없다', async () => {
    renderDeploy(request({ build: build(false) }));

    await userEvent.click(await screen.findByRole('tab', { name: 'Build' }));

    expect(await screen.findByText('build step')).toBeInTheDocument();
    expect(screen.queryByText(buildNotice)).not.toBeInTheDocument();
  });
});

describe('hadPreviousVersion', () => {
  const at = (iso: string) => ({ queuedAt: iso }) as DeployRequestSummary['stageTimes'];
  const request = { id: 'r2', serviceEnvironmentId: 'se1', stageTimes: at('2026-11-06T10:00:00Z') };

  it('이력을 아직 못 받았으면 모른다(null)', () => {
    expect(hadPreviousVersion(request, undefined)).toBeNull();
  });

  it('같은 연결에 먼저 성공한 배포가 없으면 첫 배포다', () => {
    expect(
      hadPreviousVersion(request, [
        { id: 'r2', serviceEnvironmentId: 'se1', status: 'FAILED', stageTimes: request.stageTimes },
        {
          id: 'r0',
          serviceEnvironmentId: 'se2',
          status: 'SUCCEEDED',
          stageTimes: at('2026-11-06T09:00:00Z'),
        },
      ]),
    ).toBe(false);
  });

  it('같은 연결에 먼저 성공한 배포가 있으면 이전 버전이 돈다', () => {
    expect(
      hadPreviousVersion(request, [
        {
          id: 'r1',
          serviceEnvironmentId: 'se1',
          status: 'SUCCEEDED',
          stageTimes: at('2026-11-06T09:00:00Z'),
        },
      ]),
    ).toBe(true);
  });
});
