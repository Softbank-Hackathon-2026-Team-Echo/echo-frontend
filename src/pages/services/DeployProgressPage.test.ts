import { describe, expect, it } from 'vitest';
import { stageStates } from './DeployProgressPage';

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
