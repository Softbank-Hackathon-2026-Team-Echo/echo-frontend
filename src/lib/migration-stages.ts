import type { Stage, StageState } from '@/components/StageList';
import type { MigrationPlan, MigrationStep } from '@/lib/api/types';

// API 서버 8 단계는 고정이다: 사전 확인 → 90/10 → 50/50 → 데이터 동기화 확인 → 0/100
const STEP_OVERHEAD_SECONDS = 2;

export const DEFAULT_CONDITIONS = {
  maxErrorRatePercent: 1,
  maxP95Ms: 800,
  maxReplicationLagSeconds: 1,
};
export const DEFAULT_OBSERVE_SECONDS = 5;

type StepLike = Pick<MigrationStep, 'index' | 'kind' | 'targetWeight' | 'expectedSeconds'> & {
  result?: MigrationStep['result'] | null;
};

/** 계획을 만들기 전 미리 보는 단계 (서버가 만드는 것과 같은 표) */
export function draftSteps(observeSeconds: number): StepLike[] {
  const shift = STEP_OVERHEAD_SECONDS + observeSeconds;
  return [
    { index: 0, kind: 'PREFLIGHT', targetWeight: null, expectedSeconds: STEP_OVERHEAD_SECONDS },
    { index: 1, kind: 'SHIFT', targetWeight: 10, expectedSeconds: shift },
    { index: 2, kind: 'SHIFT', targetWeight: 50, expectedSeconds: shift },
    {
      index: 3,
      kind: 'DATA_SYNC_CHECK',
      targetWeight: null,
      expectedSeconds: STEP_OVERHEAD_SECONDS,
    },
    { index: 4, kind: 'SHIFT', targetWeight: 100, expectedSeconds: shift },
  ];
}

const RESULT_STATE: Record<string, StageState> = {
  PENDING: 'pending',
  RUNNING: 'current',
  PASSED: 'done',
  FAILED: 'failed',
  SKIPPED: 'skipped',
};

export function planStages(
  steps: StepLike[],
  conditions: Pick<MigrationPlan['rollbackConditions'], 'maxReplicationLagSeconds'>,
  targetName: string,
): Stage[] {
  return steps.map((step) => {
    const seconds = `${step.expectedSeconds}s`;
    const failure = step.result?.failureCode ? ` · ${step.result.failureCode}` : '';
    const state = RESULT_STATE[step.result?.status ?? 'PENDING'] ?? 'pending';
    if (step.kind === 'PREFLIGHT') {
      return {
        key: String(step.index),
        title: 'Pre-check',
        meta: `${seconds} · health check · same image on ${targetName}${failure}`,
        state,
      };
    }
    if (step.kind === 'DATA_SYNC_CHECK') {
      return {
        key: String(step.index),
        title: 'Data sync check',
        meta: `${seconds} · replication lag ≤ ${conditions.maxReplicationLagSeconds}s${failure}`,
        state,
      };
    }
    return {
      key: String(step.index),
      title: `Shift traffic → ${step.targetWeight}% on ${targetName}`,
      meta: `${seconds} · judge error rate & p95${failure}`,
      state,
    };
  });
}

export function duration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}
