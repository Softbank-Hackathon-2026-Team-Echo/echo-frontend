import type { Stage, StageState } from '@/components/StageList';
import type { MigrationPlan, MigrationStep, StepCutover } from '@/lib/api/types';
import { k, t } from './i18n';

// API 서버 24: 사전 확인 → 5·10·25·50% → 데이터 확인 → 75·100% → 선택 DB 전환
const STEP_OVERHEAD_SECONDS = 2;

export const DEFAULT_CONDITIONS = {
  maxErrorRatePercent: 1,
  maxP95Ms: 800,
  maxReplicationLagSeconds: 1,
};
// 비율 단계는 필요 건수와 최소 관찰 시간을 모두 채워야 통과한다(echo-was #133)
export const SHIFT_WEIGHTS = [5, 10, 25, 50, 75, 100] as const;
export const DEFAULT_REQUIRED_REQUESTS = [7, 10, 20, 30, 30, 30] as const;
export const DEFAULT_MIN_OBSERVE_SECONDS = 3;
export const DEFAULT_MAX_WAIT_SECONDS = 30;
// DB 쓰기 전환 단계 예상 시간(echo-was migration-plans.md 단계 표: 2 + 30)
const DB_CUTOVER_EXPECTED_SECONDS = STEP_OVERHEAD_SECONDS + 30;
// 서버가 예상 시간을 셀 때 쓰는 기준 요청률(MIGRATION_EXPECTED_RPS). 시연 합성 트래픽 약 50 rps
const EXPECTED_RPS = 50;

type StepLike = Pick<MigrationStep, 'index' | 'kind' | 'targetWeight' | 'expectedSeconds'> & {
  requiredRequests?: number | null;
  maxWaitSeconds?: number | null;
  minObserveSeconds?: number | null;
  result?: MigrationStep['result'] | null;
  cutover?: StepCutover | null;
};

function shiftSeconds(required: number, weight: number, maxWait: number) {
  return (
    STEP_OVERHEAD_SECONDS +
    Math.max(
      DEFAULT_MIN_OBSERVE_SECONDS,
      Math.min(maxWait, Math.ceil(required / ((EXPECTED_RPS * weight) / 100))),
    )
  );
}

/**
 * 계획을 만들기 전 미리 보는 단계 (서버가 만드는 것과 같은 표·같은 예상 시간 식).
 * includeCutover 면 비율 100% 뒤에 DB 쓰기 전환(index 8)이 붙는다(echo-was API 서버 17)
 */
export function draftSteps(
  required: readonly number[],
  maxWait: number,
  includeCutover = false,
): StepLike[] {
  const shifts = SHIFT_WEIGHTS.map((weight, ordinal): StepLike => {
    const count = required[ordinal] ?? DEFAULT_REQUIRED_REQUESTS[ordinal] ?? 30;
    return {
      index: ordinal < 4 ? ordinal + 1 : ordinal + 2,
      kind: 'SHIFT',
      targetWeight: weight,
      requiredRequests: count,
      maxWaitSeconds: maxWait,
      minObserveSeconds: DEFAULT_MIN_OBSERVE_SECONDS,
      expectedSeconds: shiftSeconds(count, weight, maxWait),
    };
  });
  return [
    { index: 0, kind: 'PREFLIGHT', targetWeight: null, expectedSeconds: STEP_OVERHEAD_SECONDS },
    ...shifts.slice(0, 4),
    {
      index: 5,
      kind: 'DATA_SYNC_CHECK',
      targetWeight: null,
      expectedSeconds: STEP_OVERHEAD_SECONDS,
    },
    ...shifts.slice(4),
    ...(includeCutover
      ? [
          {
            index: 8,
            kind: 'DB_CUTOVER' as const,
            targetWeight: null,
            expectedSeconds: DB_CUTOVER_EXPECTED_SECONDS,
          },
        ]
      : []),
  ];
}

const RESULT_STATE: Record<string, StageState> = {
  PENDING: 'pending',
  RUNNING: 'current',
  PASSED: 'done',
  FAILED: 'failed',
  SKIPPED: 'skipped',
};

const metaLine = (...parts: (string | null | undefined | false)[]) =>
  parts.filter(Boolean).join(' · ');

/** 서버가 DB 쓰기 전환을 켜면 생기는 단계(echo-was #75, API 서버 17) */
export function isDbCutover(step: { kind: string }): boolean {
  return step.kind === 'DB_CUTOVER';
}

// 컷오버 판정 이유(StepCutoverResponse.reason) → 화면 문구. 모르는 값은 원래 값을 보여 준다
const CUTOVER_REASONS: Record<string, string> = {
  ALREADY_WRITER: k('target was already the writer'),
  ALREADY_DONE: k('cutover was already done'),
  PROMOTED: k('target promoted'),
  ROWS_MISMATCH: k('row counts do not match'),
  RESULT_MISSING: k('no result row'),
  RESULT_UNAVAILABLE: k('result row could not be read'),
  JOB_LOST: k('job disappeared'),
  TIMED_OUT: k('timed out'),
  NO_CHANGE: k('writer unchanged'),
  PRECHECK_FAILED: k('job pre-check failed'),
  WRITER_UNCONFIRMED: k('writer could not be confirmed'),
  TARGET_IS_WRITER: k('target is the writer'),
  START_UNCONFIRMED: k('job start could not be confirmed'),
  POLL_ERRORS: k('job status could not be read'),
};

const WRITERS: Record<string, string> = {
  SOURCE: k('writer: source'),
  TARGET: k('writer: target'),
  UNKNOWN: k('writer: unknown'),
};

/** 컷오버 Job 의 상태 한 줄 (단계 목록의 보조 줄) */
export function cutoverJobState(cutover: StepCutover | null | undefined): string | null {
  if (!cutover) return null;
  if (cutover.startFailure) return t('job not started ({{code}})', { code: cutover.startFailure });
  if (cutover.jobLost) return t('job disappeared');
  if (cutover.jobFinished) {
    return cutover.exitCode === null || cutover.exitCode === undefined
      ? t('job finished')
      : t('job exit {{code}}', { code: cutover.exitCode });
  }
  return cutover.jobName ? t('job running') : null;
}

function cutoverReason(reason: string | null | undefined): string | null {
  if (!reason) return null;
  const label = CUTOVER_REASONS[reason];
  return label ? t(label) : reason;
}

function cutoverWriter(writer: string | null | undefined): string | null {
  if (!writer) return null;
  const label = WRITERS[writer];
  return label ? t(label) : writer;
}

function cutoverRun(cutover: StepCutover | null | undefined): string | null {
  const run = cutover?.run;
  if (!run) return null;
  return t('write pause {{ms}} ms · missing {{missing}} · duplicate {{duplicate}}', {
    ms: run.writePauseMs,
    missing: run.missingRows ?? '—',
    duplicate: run.duplicateRows ?? '—',
  });
}

export function planStages(
  steps: StepLike[],
  conditions: Pick<MigrationPlan['rollbackConditions'], 'maxReplicationLagSeconds'>,
  targetName: string,
): Stage[] {
  return steps.map((step) => {
    const seconds = `${step.expectedSeconds}s`;
    const failure = step.result?.failureCode;
    const state = RESULT_STATE[step.result?.status ?? 'PENDING'] ?? 'pending';
    if (step.kind === 'PREFLIGHT') {
      return {
        key: String(step.index),
        title: t('Pre-check'),
        meta: metaLine(
          seconds,
          t('health check'),
          t('same image on {{target}}', { target: targetName }),
          failure,
        ),
        state,
      };
    }
    if (step.kind === 'DATA_SYNC_CHECK') {
      return {
        key: String(step.index),
        title: t('Data sync check'),
        meta: metaLine(
          seconds,
          t('replication lag ≤ {{seconds}}s', { seconds: conditions.maxReplicationLagSeconds }),
          failure,
        ),
        state,
      };
    }
    if (isDbCutover(step)) {
      const cutover = step.cutover;
      return {
        key: String(step.index),
        title: t('DB writer cutover'),
        meta: metaLine(
          seconds,
          cutover ? null : t('missing and duplicate rows must be 0'),
          cutoverJobState(cutover),
          cutoverReason(cutover?.reason),
          cutoverWriter(cutover?.writer),
          cutoverRun(cutover),
          failure,
        ),
        state,
        // 결과를 모르면 서버가 가중치를 되돌리지 않는다. 사람이 쓰기 담당을 확인해야 한다(API 서버 17 4-4a)
        alert: failure === 'DB_CUTOVER_UNKNOWN' ? t('Needs a person') : undefined,
      };
    }
    const required = step.requiredRequests ?? '—';
    return {
      key: String(step.index),
      title: t('Shift traffic → {{weight}}% on {{target}}', {
        weight: step.targetWeight ?? '—',
        target: targetName,
      }),
      meta: metaLine(
        seconds,
        step.maxWaitSeconds
          ? t('{{required}} requests on {{target}} within {{seconds}}s', {
              required,
              target: targetName,
              seconds: step.maxWaitSeconds,
            })
          : t('{{required}} requests on {{target}}', { required, target: targetName }),
        step.minObserveSeconds != null &&
          step.minObserveSeconds > 0 &&
          t('observe for at least {{seconds}}s', { seconds: step.minObserveSeconds }),
        step.result?.metrics?.lowTraffic && t('low traffic'),
        failure,
      ),
      state,
    };
  });
}

export function duration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}
