import { describe, expect, it } from 'vitest';
import { stageStates, standbyStep } from './DeployProgressPage';

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
  const link = (id: string, sha: string | null, active: string | null = null) => ({
    serviceEnvironmentId: id,
    environment: { id: `env-${id}`, name: `env-${id}`, kind: 'gcp' },
    currentDeployment: sha ? { id: 'd', commitSha: sha, imageDigest: 'x', finishedAt: null } : null,
    activeRequestId: active,
    queuedRequestId: null,
  });
  const base = {
    status: 'SUCCEEDED',
    trigger: 'MANUAL',
    commitSha: 'abc',
    serviceEnvironmentId: 'serving',
  } as const;

  it('예비 환경이 없으면 건너뛴다', () => {
    const result = standbyStep(base, { environments: [link('serving', 'abc')] as never });
    expect(result).toEqual({ state: 'skipped', detail: 'no standby environments' });
  });

  it('예비가 따라가는 중이면 그 배포 요청을 가리킨다', () => {
    const result = standbyStep(base, {
      environments: [link('serving', 'abc'), link('standby', 'old', 'req-2')] as never,
    });
    expect(result).toMatchObject({ state: 'current', syncingRequestId: 'req-2' });
  });

  it('예비가 같은 커밋이면 끝났다', () => {
    const result = standbyStep(base, {
      environments: [link('serving', 'abc'), link('standby', 'abc')] as never,
    });
    expect(result).toEqual({ state: 'done', detail: '1 standby in sync' });
  });
});
