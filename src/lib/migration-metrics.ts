import type { MigrationPlan, MigrationStep } from '@/lib/api/types';
import { t } from '@/lib/i18n';

/** 끝난 뒤 사람이 스크립트를 돌려야 결과가 생긴다. 이 시간까지만 기다린다(서버 요청 값) */
export const CUTOVER_WAIT_MS = 10 * 60 * 1000;

type CutoverPlan = Pick<MigrationPlan, 'status' | 'mode' | 'finishedAt'> &
  Partial<Pick<MigrationPlan, 'result'>>;

/** 인프라 스크립트가 잰 컷오버·롤백 결과. 아직 없으면 칸이 전부 null 이라 measuredBy 로 가른다 */
export function cutoverResult(plan: CutoverPlan) {
  return plan.result?.measuredBy ? plan.result : null;
}

/** 성공한 계획이 끝난 뒤 결과를 아직 기다리는 중인가. 롤링 배포 중에는 result 칸이 없을 수 있다 */
export function isAwaitingCutover(plan: CutoverPlan, now = Date.now()): boolean {
  if (plan.status !== 'SUCCEEDED' || !plan.finishedAt || cutoverResult(plan)) return false;
  return now - Date.parse(plan.finishedAt) < CUTOVER_WAIT_MS;
}

export function writePauseText(plan: CutoverPlan): string | null {
  const ms = cutoverResult(plan)?.writePauseMs;
  return ms == null ? null : `${(ms / 1000).toFixed(3)} s`;
}

export function writePauseCaption(plan: CutoverPlan, now = Date.now()): string {
  const result = cutoverResult(plan);
  if (result?.kind === 'ROLLBACK') return t('DB rollback · measured by infra script');
  if (result) return t('DB cutover · measured by infra script');
  if (isAwaitingCutover(plan, now))
    return plan.mode === 'FAILBACK'
      ? t('Waiting for the DB rollback result')
      : t('Waiting for the DB cutover result');
  return t('No DB cutover recorded for this plan');
}

/** 누락·중복 행. 둘 다 있어야 보인다 */
export function rowCheck(plan: CutoverPlan) {
  const result = cutoverResult(plan);
  if (result?.missingRows == null || result.duplicateRows == null) return null;
  return {
    text: `${result.missingRows} · ${result.duplicateRows}`,
    clean: result.missingRows === 0 && result.duplicateRows === 0,
    rowsTotal: result.rowsTotal,
  };
}

const seconds = (from: string | null, to: string | null, now = Date.now()) =>
  from ? Math.max(0, Math.round(((to ? Date.parse(to) : now) - Date.parse(from)) / 1000)) : null;

/** 단계 판정에서 본 실패 요청 수. 서버가 센 도착 5xx(8-1)를 먼저 쓰고, 없으면 오류율 × 요청 수. 판정한 요청이 없으면 null */
export function failedRequests(plan: Pick<MigrationPlan, 'steps'>): number | null {
  const judged = plan.steps.filter((step) => (step.result?.metrics?.requestCount ?? 0) > 0);
  if (judged.length === 0) return null;
  return judged.reduce((sum, step) => {
    const metrics = step.result?.metrics;
    if (!metrics?.requestCount) return sum;
    if (typeof metrics.errors5xx === 'number') return sum + metrics.errors5xx;
    return sum + Math.round(((metrics.errorRatePercent ?? 0) / 100) * metrics.requestCount);
  }, 0);
}

/** 비율 단계가 모두 저트래픽 통과인가. 요청이 몇 건 있어도 이때 실패 0건은 성과가 아니다 */
export function passedOnHealthOnly(plan: Pick<MigrationPlan, 'steps'>): boolean {
  const shifts = plan.steps.filter((step) => step.kind === 'SHIFT');
  return shifts.length > 0 && shifts.every((step) => step.result?.metrics?.lowTraffic);
}

export function requestCount(plan: Pick<MigrationPlan, 'steps'>): number {
  return plan.steps.reduce((sum, step) => sum + (step.result?.metrics?.requestCount ?? 0), 0);
}

/** 단계 지표 중 가장 큰 복제 지연(초). 없으면 null */
export function maxReplicationLag(plan: Pick<MigrationPlan, 'steps'>): number | null {
  const lags = plan.steps
    .map((step) => step.result?.metrics?.replicationLagSeconds)
    .filter((value): value is number => typeof value === 'number');
  return lags.length ? Math.max(...lags) : null;
}

/** 가장 최근에 판정한 도착 쪽 p95(ms) */
export function latestP95(plan: Pick<MigrationPlan, 'steps'>): number | null {
  const values = plan.steps
    .map((step) => step.result?.metrics?.p95Ms)
    .filter((value): value is number => typeof value === 'number');
  return values.at(-1) ?? null;
}

export function totalSeconds(plan: Pick<MigrationPlan, 'startedAt' | 'finishedAt'>, now?: number) {
  return seconds(plan.startedAt, plan.finishedAt, now);
}

export function stepSeconds(step: MigrationStep, now?: number) {
  return seconds(step.result?.startedAt ?? null, step.result?.finishedAt ?? null, now);
}

/** 지금 적용된 비율. 비율을 바꾼 마지막 SHIFT 단계(지나갔거나 진행 중)의 값, 없으면 출발 100 */
export function currentWeights(plan: Pick<MigrationPlan, 'steps' | 'status'>) {
  if (plan.status === 'ROLLED_BACK') return { source: 100, target: 0 };
  const applied = plan.steps.filter(
    (step) =>
      step.kind === 'SHIFT' &&
      (step.result?.status === 'PASSED' || step.result?.status === 'RUNNING'),
  );
  const last = applied.at(-1);
  return { source: last?.sourceWeight ?? 100, target: last?.targetWeight ?? 0 };
}

export type WeightPoint = { at: number; source: number; target: number; errorRate: number | null };

/**
 * A·B 비율 시계열. 단계가 시작한 시각마다 그 단계 비율로 바뀌는 계단선이다(F7: 두 선이 교차).
 * 실시간 요청 그래프 API 가 없어서 서버가 실제로 적용한 비율로 그린다
 */
export function weightTimeline(plan: MigrationPlan, now = Date.now()): WeightPoint[] {
  const start = plan.startedAt ? Date.parse(plan.startedAt) : null;
  if (start === null) return [];
  const points: WeightPoint[] = [{ at: start, source: 100, target: 0, errorRate: null }];
  for (const step of plan.steps) {
    if (step.kind !== 'SHIFT' || !step.result?.startedAt) continue;
    points.push({
      at: Date.parse(step.result.startedAt),
      source: step.sourceWeight ?? 100,
      target: step.targetWeight ?? 0,
      errorRate: step.result.metrics?.errorRatePercent ?? null,
    });
  }
  if (plan.status === 'ROLLED_BACK' || plan.status === 'ROLLING_BACK') {
    const at = plan.finishedAt ? Date.parse(plan.finishedAt) : now;
    points.push({ at, source: 100, target: 0, errorRate: null });
  }
  const end = plan.finishedAt ? Date.parse(plan.finishedAt) : now;
  const last = points.at(-1);
  if (last && end > last.at) points.push({ ...last, at: end });
  return points;
}
