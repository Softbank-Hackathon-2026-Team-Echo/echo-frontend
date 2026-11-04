import { describe, expect, it } from 'vitest';
import {
  CUTOVER_WAIT_MS,
  currentWeights,
  failedRequests,
  isAwaitingCutover,
  maxReplicationLag,
  rowCheck,
  weightTimeline,
  writePauseCaption,
  writePauseText,
} from '@/lib/migration-metrics';
import { cutoverResult as measured, migrationPlan, step } from '@/test/migration-fixtures';

describe('migration-metrics', () => {
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

  describe('컷오버 결과', () => {
    const finishedAt = '2026-11-05T03:00:00Z';
    const finished = Date.parse(finishedAt);
    const done = { status: 'SUCCEEDED', finishedAt } as const;

    it('스크립트가 잰 값이면 쓰기 정지와 누락·중복을 보인다', () => {
      const plan = migrationPlan({ ...done, result: measured() });
      expect(writePauseText(plan)).toBe('5.556 s');
      expect(writePauseCaption(plan)).toBe('DB cutover · measured by infra script');
      expect(rowCheck(plan)).toEqual({ text: '0 · 0', clean: true, rowsTotal: 169 });
      expect(isAwaitingCutover(plan, finished)).toBe(false);
    });

    it('복귀 계획은 롤백 결과로 적는다', () => {
      const plan = migrationPlan({
        ...done,
        mode: 'FAILBACK',
        result: measured({ kind: 'ROLLBACK' }),
      });
      expect(writePauseCaption(plan)).toBe('DB rollback · measured by infra script');
    });

    it('누락이나 중복이 있으면 깨끗하지 않다', () => {
      const plan = migrationPlan({ ...done, result: measured({ duplicateRows: 2 }) });
      expect(rowCheck(plan)).toMatchObject({ text: '0 · 2', clean: false });
    });

    it('칸이 전부 null 이면 값이 없고 끝난 뒤 10분만 기다린다', () => {
      const empty = measured({
        writePauseMs: null,
        missingRows: null,
        duplicateRows: null,
        rowsTotal: null,
        kind: null,
        measuredBy: null,
      });
      const plan = migrationPlan({ ...done, result: empty });
      expect(writePauseText(plan)).toBeNull();
      expect(rowCheck(plan)).toBeNull();
      expect(isAwaitingCutover(plan, finished + CUTOVER_WAIT_MS - 1)).toBe(true);
      expect(writePauseCaption(plan, finished + 1)).toBe('Waiting for the DB cutover result');
      expect(isAwaitingCutover(plan, finished + CUTOVER_WAIT_MS)).toBe(false);
      expect(writePauseCaption(plan, finished + CUTOVER_WAIT_MS)).toBe(
        'No DB cutover recorded for this plan',
      );
    });

    it('result 칸이 없어도 null 처럼 다룬다', () => {
      const { result: _result, ...plan } = migrationPlan(done);
      expect(isAwaitingCutover(plan, finished)).toBe(true);
    });

    it('성공하지 않은 계획은 기다리지 않는다', () => {
      const plan = migrationPlan({ ...done, status: 'ROLLED_BACK' });
      expect(isAwaitingCutover(plan, finished)).toBe(false);
    });
  });
});
