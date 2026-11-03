import { describe, expect, it } from 'vitest';
import { migrationPlan, step } from '@/test/migration-fixtures';
import { currentWeights, failedRequests, maxReplicationLag, weightTimeline } from './run-metrics';

describe('run-metrics', () => {
  it('지금 비율은 진행 중인 SHIFT 단계 값이다', () => {
    expect(currentWeights(migrationPlan())).toEqual({ source: 50, target: 50 });
  });

  it('롤백되면 출발 100% 로 돌아간다', () => {
    expect(currentWeights(migrationPlan({ status: 'ROLLED_BACK' }))).toEqual({
      source: 100,
      target: 0,
    });
  });

  it('실패 요청은 판정 단계의 오류율 × 요청 수 합이다', () => {
    const plan = migrationPlan({
      steps: [
        step(1, 'SHIFT', 10, 'PASSED', { errorRatePercent: 10, requestCount: 20 }),
        step(2, 'SHIFT', 50, 'PASSED', { errorRatePercent: 0, requestCount: 50 }),
      ],
    });
    expect(failedRequests(plan)).toBe(2);
    expect(failedRequests(migrationPlan({ steps: [step(0, 'PREFLIGHT', null)] }))).toBeNull();
  });

  it('복제 지연은 데이터 확인 단계 값을 쓴다', () => {
    const plan = migrationPlan({
      steps: [step(3, 'DATA_SYNC_CHECK', null, 'PASSED', { replicationLagSeconds: 0.4 })],
    });
    expect(maxReplicationLag(plan)).toBe(0.4);
  });

  it('비율 시계열에서 A·B 가 50% 에서 만난다', () => {
    const points = weightTimeline(migrationPlan(), Date.parse('2026-11-05T03:00:12Z'));
    expect(points.map((point) => [point.source, point.target])).toEqual([
      [100, 0],
      [90, 10],
      [50, 50],
      [50, 50],
    ]);
  });
});
