import { describe, expect, it } from 'vitest';
import type { MigrationStep } from '@/lib/api/types';
import { canaryPlan, migrationPlan, step } from '@/test/migration-fixtures';
import {
  cutoverJobState,
  DEFAULT_REQUIRED_REQUESTS,
  draftSteps,
  planStages,
} from './migration-stages';

const CONDITIONS = { maxReplicationLagSeconds: 1 };

function cutoverStep(
  status: NonNullable<MigrationStep['result']>['status'],
  failureCode: NonNullable<MigrationStep['result']>['failureCode'],
  cutover: MigrationStep['cutover'],
): MigrationStep {
  const base = step(5, 'DB_CUTOVER', null, status);
  return {
    ...base,
    result: { ...base.result, failureCode },
    cutover,
  };
}

describe('draftSteps', () => {
  it('6개 비율 단계 사이 50% 뒤에 데이터 확인을 둔다', () => {
    const steps = draftSteps(DEFAULT_REQUIRED_REQUESTS, 30);
    expect(steps.map(({ index, kind, targetWeight }) => [index, kind, targetWeight])).toEqual([
      [0, 'PREFLIGHT', null],
      [1, 'SHIFT', 5],
      [2, 'SHIFT', 10],
      [3, 'SHIFT', 25],
      [4, 'SHIFT', 50],
      [5, 'DATA_SYNC_CHECK', null],
      [6, 'SHIFT', 75],
      [7, 'SHIFT', 100],
    ]);
    expect(
      steps
        .filter((item) => item.kind === 'SHIFT')
        .map((item) => [item.requiredRequests, item.minObserveSeconds, item.expectedSeconds]),
    ).toEqual([10, 10, 20, 30, 30, 30].map((count) => [count, 4, 6]));
    expect(steps.reduce((sum, item) => sum + item.expectedSeconds, 0)).toBe(40);
  });

  it('예상 시간은 건수 대기를 최대 대기로 제한한 뒤 최소 관찰 시간 4초와 여유 2초를 더한다', () => {
    expect(draftSteps([100, 100, 100, 100, 100, 100], 10).map((s) => s.expectedSeconds)).toEqual([
      2, 12, 12, 10, 6, 2, 6, 6,
    ]);
    expect(draftSteps([1000], 1)[1]?.expectedSeconds).toBe(6);
  });

  it('includeCutover 면 비율 100% 뒤에 DB_CUTOVER(index 8, 32초)가 붙는다', () => {
    const steps = draftSteps(DEFAULT_REQUIRED_REQUESTS, 30, true);
    expect(steps).toHaveLength(9);
    expect(steps[8]).toMatchObject({ index: 8, kind: 'DB_CUTOVER', expectedSeconds: 32 });
  });
});

describe('planStages 호환', () => {
  it('새 계획은 최소 관찰 시간을 표시하고 서버 예상 시간을 그대로 쓴다', () => {
    const stages = planStages(canaryPlan().steps, CONDITIONS, 'gcp-seoul');
    expect(stages).toHaveLength(8);
    expect(stages[1]?.meta).toContain('6s');
    expect(stages[1]?.meta).toContain('observe for at least 4s');
    expect(stages[5]?.title).toBe('Data sync check');
  });

  it('옛 5단계 계획은 저장된 순서·시간 그대로이고 최소 관찰 시간을 붙이지 않는다', () => {
    const stages = planStages(migrationPlan().steps, CONDITIONS, 'gcp-seoul');
    expect(stages.map((stage) => stage.title)).toEqual([
      'Pre-check',
      'Shift traffic → 10% on gcp-seoul',
      'Shift traffic → 50% on gcp-seoul',
      'Data sync check',
      'Shift traffic → 100% on gcp-seoul',
    ]);
    expect(stages[1]?.meta).toContain('7s');
    expect(stages.every(({ meta }) => typeof meta === 'string' && !meta.includes('observe'))).toBe(
      true,
    );
  });
});

describe('planStages DB_CUTOVER', () => {
  it('결과를 모르면(DB_CUTOVER_UNKNOWN) 빨간 「사람 확인 필요」 배지와 이유를 단다', () => {
    const [stage] = planStages(
      [
        cutoverStep('FAILED', 'DB_CUTOVER_UNKNOWN', {
          jobName: 'echo-cutover-plan1234-1',
          jobKind: 'cutover',
          jobFinished: true,
          exitCode: 1,
          reason: 'TARGET_IS_WRITER',
          writer: 'TARGET',
        }),
      ],
      CONDITIONS,
      'gcp-seoul',
    );
    expect(stage?.state).toBe('failed');
    expect(stage?.alert).toBe('Needs a person');
    expect(stage?.meta).toContain('job exit 1');
    expect(stage?.meta).toContain('target is the writer');
    expect(stage?.meta).toContain('writer: target');
    expect(stage?.meta).toContain('DB_CUTOVER_UNKNOWN');
  });

  it('통과하면 배지 없이 쓰기 정지·누락·중복을 보여 준다', () => {
    const [stage] = planStages(
      [
        cutoverStep('PASSED', null, {
          jobName: 'echo-cutover-plan1234-1',
          jobFinished: true,
          exitCode: 0,
          run: {
            kind: 'CUTOVER',
            pausedAt: '2026-11-07T03:00:00Z',
            resumedAt: '2026-11-07T03:00:05Z',
            writePauseMs: 5817,
            drainMs: null,
            catchupMs: null,
            switchMs: null,
            rowsTotal: 169,
            missingRows: 0,
            duplicateRows: 0,
            mode: 'NORMAL',
            rpoEstimateMs: null,
          },
        }),
      ],
      CONDITIONS,
      'gcp-seoul',
    );
    expect(stage?.alert).toBeUndefined();
    expect(stage?.meta).toContain('write pause 5817 ms · missing 0 · duplicate 0');
  });

  it('cutover 칸이 아직 없으면 판정 기준을 보여 준다', () => {
    const [stage] = planStages([cutoverStep('PENDING', null, null)], CONDITIONS, 'gcp-seoul');
    expect(stage?.meta).toContain('missing and duplicate rows must be 0');
    expect(stage?.alert).toBeUndefined();
  });
});

describe('cutoverJobState', () => {
  it('Job 을 못 만들었으면 이유 코드를, 실행 중이면 실행 중을 보여 준다', () => {
    expect(cutoverJobState({ startFailure: 'FORBIDDEN' })).toBe('job not started (FORBIDDEN)');
    expect(cutoverJobState({ jobName: 'echo-cutover-x-1', jobFinished: false })).toBe(
      'job running',
    );
    expect(cutoverJobState(null)).toBeNull();
  });
});
