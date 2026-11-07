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

/** minObserveSeconds 가 없는 옛 5단계 계획. 하위 호환 시험용으로 유지한다 */
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
    result: null,
    disasterId: null,
    failback: { allowed: true, reason: null, disasterId: null },
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

/** API 서버 24 새 계획. 서버 응답 순서와 최소 관찰 시간의 시험용 사본 */
export function canaryPlan(extra: Partial<MigrationPlan> = {}): MigrationPlan {
  const steps = [
    step(0, 'PREFLIGHT', null, 'PASSED', null, AT),
    ...[5, 10, 25, 50].map((weight, ordinal) => ({
      ...step(ordinal + 1, 'SHIFT', weight),
      requiredRequests: [7, 10, 20, 30][ordinal] ?? 30,
      minObserveSeconds: 3,
      expectedSeconds: 5,
    })),
    step(5, 'DATA_SYNC_CHECK', null),
    ...[75, 100].map((weight, ordinal) => ({
      ...step(ordinal + 6, 'SHIFT', weight),
      requiredRequests: 30,
      minObserveSeconds: 3,
      expectedSeconds: 5,
    })),
  ];
  return migrationPlan({ steps, currentStep: 0, expectedSeconds: 34, ...extra });
}

/** 11/5 운영 리허설 값 (echo-was #63) */
export function cutoverResult(
  extra: Partial<NonNullable<MigrationPlan['result']>> = {},
): NonNullable<MigrationPlan['result']> {
  return {
    writePauseMs: 5556,
    missingRows: 0,
    duplicateRows: 0,
    rowsTotal: 169,
    kind: 'CUTOVER',
    measuredBy: 'INFRA_SCRIPT',
    pausedAt: AT,
    resumedAt: AT,
    drainMs: 752,
    catchupMs: 492,
    switchMs: 4312,
    ...extra,
  };
}
