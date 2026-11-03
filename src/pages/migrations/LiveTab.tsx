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
            caption={`rollback above ${conditions.maxP95Ms} ms`}
          />
        </div>
      </div>

      <div className="flex w-[25rem] shrink-0 flex-col gap-3 max-wide:w-full">
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
              ? `Next step to ${next.sourceWeight} / ${next.targetWeight} after ${plan.observeSeconds}s if error rate stays ≤ ${conditions.maxErrorRatePercent}%`
              : plan.status === 'SUCCEEDED'
                ? `${targetName} now serves all traffic.`
                : 'No traffic step left.'}
          </p>
        </section>
        <section className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
          <h2 className="text-title">Automatic rollback when</h2>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-small">
            <li>error rate &gt; {conditions.maxErrorRatePercent}%</li>
            <li>p95 latency &gt; {conditions.maxP95Ms} ms</li>
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
