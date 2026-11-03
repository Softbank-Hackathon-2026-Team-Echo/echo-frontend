import type { Stage, StageState } from '@/components/StageList';
import type { MigrationPlan, MigrationStep } from '@/lib/api/types';

// API 서버 8 단계는 고정이다: 사전 확인 → 90/10 → 50/50 → 데이터 동기화 확인 → 0/100
const STEP_OVERHEAD_SECONDS = 2;

export const DEFAULT_CONDITIONS = {
  maxErrorRatePercent: 1,
  maxP95Ms: 800,
  maxReplicationLagSeconds: 1,
};
// API 서버 8-1: 비율 단계는 "도착에서 요청 N건 처리"로 판정한다. 기본 10%·50%·100% = 20·50·50건, 단계마다 최대 30초
export const DEFAULT_REQUIRED_REQUESTS: [number, number, number] = [20, 50, 50];
export const DEFAULT_MAX_WAIT_SECONDS = 30;
// 서버가 예상 시간을 셀 때 쓰는 기준 요청률(MIGRATION_EXPECTED_RPS). 시연 합성 트래픽 약 50 rps
const EXPECTED_RPS = 50;

type StepLike = Pick<MigrationStep, 'index' | 'kind' | 'targetWeight' | 'expectedSeconds'> & {
  requiredRequests?: number | null;
  maxWaitSeconds?: number | null;
  result?: MigrationStep['result'] | null;
};

function shiftSeconds(required: number, weight: number, maxWait: number) {
  return (
    STEP_OVERHEAD_SECONDS + Math.min(maxWait, Math.ceil(required / ((EXPECTED_RPS * weight) / 100)))
  );
}

/** 계획을 만들기 전 미리 보는 단계 (서버가 만드는 것과 같은 표·같은 예상 시간 식) */
export function draftSteps(required: readonly number[], maxWait: number): StepLike[] {
  const [first = 20, second = 50, last = 50] = required;
  const shift = (index: number, weight: number, count: number): StepLike => ({
    index,
    kind: 'SHIFT',
    targetWeight: weight,
    requiredRequests: count,
    maxWaitSeconds: maxWait,
    expectedSeconds: shiftSeconds(count, weight, maxWait),
  });
  return [
    { index: 0, kind: 'PREFLIGHT', targetWeight: null, expectedSeconds: STEP_OVERHEAD_SECONDS },
    shift(1, 10, first),
    shift(2, 50, second),
    {
      index: 3,
      kind: 'DATA_SYNC_CHECK',
      targetWeight: null,
      expectedSeconds: STEP_OVERHEAD_SECONDS,
    },
    shift(4, 100, last),
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
      meta: `${seconds} · ${step.requiredRequests ?? '—'} requests on ${targetName}${step.maxWaitSeconds ? ` within ${step.maxWaitSeconds}s` : ''}${step.result?.metrics?.lowTraffic ? ' · low traffic' : ''}${failure}`,
      state,
    };
  });
}

export function duration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}
