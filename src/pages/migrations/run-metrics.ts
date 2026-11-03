import type { MigrationPlan, MigrationStep } from '@/lib/api/types';

const seconds = (from: string | null, to: string | null, now = Date.now()) =>
  from ? Math.max(0, Math.round(((to ? Date.parse(to) : now) - Date.parse(from)) / 1000)) : null;

/** 단계 판정에서 본 실패 요청 수(오류율 × 요청 수). 판정한 단계가 없으면 null */
export function failedRequests(plan: Pick<MigrationPlan, 'steps'>): number | null {
  const judged = plan.steps.filter((step) => step.result?.metrics?.requestCount != null);
  if (judged.length === 0) return null;
  return judged.reduce((sum, step) => {
    const metrics = step.result?.metrics;
    if (!metrics?.requestCount) return sum;
    return sum + Math.round(((metrics.errorRatePercent ?? 0) / 100) * metrics.requestCount);
  }, 0);
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
