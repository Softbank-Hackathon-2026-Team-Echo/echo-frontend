import { describe, expect, it } from 'vitest';
import type { MigrationStep } from '@/lib/api/types';
import { step } from '@/test/migration-fixtures';
import { cutoverJobState, draftSteps, planStages } from './migration-stages';

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
  it('DB 쓰기 담당을 옮기지 않으면 지금과 같은 5단계다', () => {
    expect(draftSteps([20, 50, 50], 30).map((item) => item.kind)).toEqual([
      'PREFLIGHT',
      'SHIFT',
      'SHIFT',
      'DATA_SYNC_CHECK',
      'SHIFT',
    ]);
  });

  it('includeCutover 면 비율 100% 뒤에 DB_CUTOVER(index 5, 32초)가 붙는다', () => {
    const steps = draftSteps([20, 50, 50], 30, true);
    expect(steps).toHaveLength(6);
    expect(steps[5]).toMatchObject({ index: 5, kind: 'DB_CUTOVER', expectedSeconds: 32 });
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
