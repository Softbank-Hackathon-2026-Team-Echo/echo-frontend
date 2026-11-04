// 이전 계획 테스트 데이터 (echo-was docs/api/migration-plans.md 응답 예시 모양)
import type { MigrationPlan, MigrationStep } from '@/lib/api/types';

export const AT = '2026-11-05T03:00:00Z';

type Status = NonNullable<MigrationStep['result']>['status'];

export function step(
  index: number,
  kind: MigrationStep['kind'],
  target: number | null,
  status: Status = 'PENDING',
  metrics: Partial<NonNullable<NonNullable<MigrationStep['result']>['metrics']>> | null = null,
  startedAt: string | null = null,
): MigrationStep {
  return {
    index,
    kind,
    sourceWeight: target === null ? null : 100 - target,
    targetWeight: target,
    requiredRequests: kind === 'SHIFT' ? 20 : null,
    maxWaitSeconds: kind === 'SHIFT' ? 30 : null,
    expectedSeconds: kind === 'SHIFT' ? 7 : 2,
    result: {
      status,
      startedAt,
      finishedAt: status === 'PASSED' || status === 'FAILED' ? startedAt : null,
      metrics: metrics
        ? {
            healthStatus: 'OK',
            errorRatePercent: null,
            p95Ms: null,
            requestCount: null,
            replicationLagSeconds: null,
            ...metrics,
          }
        : null,
      failureCode: null,
    },
  };
}

export function migrationPlan(extra: Partial<MigrationPlan> = {}): MigrationPlan {
  return {
    id: 'plan-1234abcd',
    serviceId: 's1',
    sourceEnvironmentId: 'e1',
    targetEnvironmentId: 'e2',
    sourceServiceEnvironmentId: 'se1',
    targetServiceEnvironmentId: 'se2',
    status: 'RUNNING',
    mode: 'PLANNED',
    currentStep: 2,
    expectedSeconds: 25,
    createdBy: { id: 'u2', login: 'dev-a' },
    approvedBy: { id: 'u1', login: 'echoport' },
    selfApproved: false,
    errorCode: null,
    rollbackStatus: null,
    simulated: true,
    createdAt: AT,
    approvedAt: AT,
    startedAt: AT,
    finishedAt: null,
    expiresAt: '2026-11-06T03:00:00Z',
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
      step(0, 'PREFLIGHT', null, 'PASSED', null, '2026-11-05T03:00:00Z'),
      step(
        1,
        'SHIFT',
        10,
        'PASSED',
        { errorRatePercent: 0, p95Ms: 120, requestCount: 10 },
        '2026-11-05T03:00:02Z',
      ),
      step(2, 'SHIFT', 50, 'RUNNING', null, '2026-11-05T03:00:09Z'),
      step(3, 'DATA_SYNC_CHECK', null),
      step(4, 'SHIFT', 100),
    ],
    rejectedBy: null,
    cancelledBy: null,
    abortedBy: null,
    abortRequestedAt: null,
    errorMessage: null,
    ...extra,
  };
}
