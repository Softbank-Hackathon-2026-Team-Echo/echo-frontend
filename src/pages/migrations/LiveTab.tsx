import { TrafficChart } from '@/components/TrafficChart';
import type { MigrationPlan } from '@/lib/api/types';
import {
  currentWeights,
  failedRequests,
  latestP95,
  maxReplicationLag,
  weightTimeline,
} from '@/lib/migration-metrics';
import { Kpi } from './Kpi';

type Progress = NonNullable<MigrationPlan['progress']>;

/** 지금 비율 단계의 건수 판정 (API 서버 8-1 progress, 1초 폴링). "GCP 처리 14/50건 · 오류 0/허용 1" */
function StepProgress({
  progress,
  targetName,
  sourceName,
  now,
}: {
  progress: Progress;
  targetName: string;
  sourceName: string;
  now: number;
}) {
  const share = Math.min(
    100,
    Math.round((progress.requests / Math.max(1, progress.requiredRequests)) * 100),
  );
  const left = progress.deadlineAt
    ? Math.max(0, Math.ceil((Date.parse(progress.deadlineAt) - now) / 1000))
    : null;
  const overErrors = progress.errors5xx > progress.allowedErrors5xx;
  return (
    <section className="flex flex-col gap-2.5 rounded-xl border border-migrating-solid bg-surface p-4">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-title">
          Step {progress.step} · {progress.targetWeight}% on {targetName}
        </h2>
        {left !== null && (
          <span className="font-mono text-mono tabular-nums text-fg-muted">{left}s left</span>
        )}
      </header>
      <p className="text-body-medium tabular-nums">
        {targetName} handled {progress.requests} / {progress.requiredRequests} requests ·{' '}
        <span className={overErrors ? 'text-danger-fg' : 'text-success-fg'}>
          5xx {progress.errors5xx} / {progress.allowedErrors5xx} allowed
        </span>
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-subtle" aria-hidden>
        <span className="block h-full bg-migrating-solid" style={{ width: `${share}%` }} />
      </div>
      <p className="text-caption text-fg-muted">
        {sourceName} handled {progress.sourceRequests} in the same window. Updated{' '}
        {new Date(progress.updatedAt).toLocaleTimeString('en-GB')}.
      </p>
    </section>
  );
}

/** M02 Live: A·B 비율 그래프 · 판정 숫자 · 지금 비율 · 롤백 조건 */
export function LiveTab({
  plan,
  sourceName,
  targetName,
  now,
}: {
  plan: MigrationPlan;
  sourceName: string;
  targetName: string;
  now: number;
}) {
  const weights = currentWeights(plan);
  const failed = failedRequests(plan);
  const lag = maxReplicationLag(plan);
  const p95 = latestP95(plan);
  const next = plan.steps.find(
    (step) => step.kind === 'SHIFT' && step.result?.status === 'PENDING',
  );
  const conditions = plan.rollbackConditions;

  return (
    <div className="flex items-start gap-3 max-wide:flex-col">
      <div className="flex min-w-0 flex-1 flex-col gap-3 max-wide:w-full">
        <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-xs">
          <header className="flex flex-col gap-0.5">
            <h2 className="text-title">Traffic · A vs B</h2>
            <span className="text-caption text-fg-muted">
              Weights the entry point applied at each step
            </span>
          </header>
          <TrafficChart
            points={weightTimeline(plan, now)}
            sourceName={sourceName}
            targetName={targetName}
          />
        </section>
        <div className="flex gap-3 max-compact:flex-col">
          <Kpi
            label="Failed requests"
            value={failed}
            tone={failed === 0 ? 'success' : failed ? 'danger' : undefined}
            caption="error rate × requests at each judged step"
          />
          <Kpi
            label="Replication lag"
            value={lag === null ? null : `${lag} s`}
            caption={`rollback above ${conditions.maxReplicationLagSeconds} s`}
          />
          <Kpi
            label="p95 (target)"
            value={p95 === null ? null : `${p95} ms`}
            caption={
              conditions.p95Advisory
                ? 'advisory, does not fail a step'
                : `rollback above ${conditions.maxP95Ms} ms`
            }
          />
        </div>
      </div>

      <div className="flex w-[25rem] shrink-0 flex-col gap-3 max-wide:w-full">
        {plan.progress && (
          <StepProgress
            progress={plan.progress}
            targetName={targetName}
            sourceName={sourceName}
            now={now}
          />
        )}
        <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
          <h2 className="text-title">Traffic weight</h2>
          <div className="flex items-center justify-between gap-2 text-small text-fg-secondary">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full bg-chart-3" />
              {sourceName}{' '}
              <span className="text-body-medium text-fg tabular-nums">{weights.source}%</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full bg-chart-1" />
              {targetName}{' '}
              <span className="text-body-medium text-fg tabular-nums">{weights.target}%</span>
            </span>
          </div>
          <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
            {weights.source > 0 && (
              <span className="bg-chart-3" style={{ flexGrow: weights.source }} />
            )}
            {weights.target > 0 && (
              <span className="bg-chart-1" style={{ flexGrow: weights.target }} />
            )}
          </div>
          <p className="text-caption text-fg-secondary">
            {next
              ? `Next step to ${next.sourceWeight} / ${next.targetWeight} once ${targetName} handles ${next.requiredRequests ?? '—'} requests (within ${next.maxWaitSeconds ?? plan.maxWaitSeconds}s)`
              : plan.status === 'SUCCEEDED'
                ? `${targetName} now serves all traffic.`
                : 'No traffic step left.'}
          </p>
        </section>
        <section className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
          <h2 className="text-title">Automatic rollback when</h2>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-small">
            <li>error rate &gt; {conditions.maxErrorRatePercent}%</li>
            {!conditions.p95Advisory && <li>p95 latency &gt; {conditions.maxP95Ms} ms</li>}
            <li>the target does not receive traffic while the source still does</li>
            <li>replication lag &gt; {conditions.maxReplicationLagSeconds} s</li>
            {conditions.healthCheck && <li>the health check fails</li>}
          </ul>
          <p className="text-caption text-fg-muted">
            DB writer cutover (pause writes → fence → LSN match → promote) joins these steps when
            the data migration engine is connected.
          </p>
        </section>
      </div>
    </div>
  );
}
