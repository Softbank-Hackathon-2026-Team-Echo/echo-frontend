import { CircleAlert, CircleCheck } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { MigrationPlan, MigrationStep } from '@/lib/api/types';
import {
  failedRequests,
  maxReplicationLag,
  requestCount,
  stepSeconds,
  totalSeconds,
} from '@/lib/migration-metrics';
import { duration } from '@/lib/migration-stages';
import { Kpi } from './Kpi';

const clock = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString('en-GB') : '—';

function stepName(step: MigrationStep) {
  if (step.kind === 'PREFLIGHT') return 'Pre-check';
  if (step.kind === 'DATA_SYNC_CHECK') return 'Data sync check';
  return `Shift traffic → ${step.targetWeight}%`;
}

function stepResult(step: MigrationStep) {
  const result = step.result;
  if (!result) return '—';
  if (result.failureCode) return `${result.status.toLowerCase()} · ${result.failureCode}`;
  const metrics = result.metrics;
  if (step.kind === 'DATA_SYNC_CHECK' && metrics?.replicationLagSeconds != null) {
    return `${result.status.toLowerCase()} · lag ${metrics.replicationLagSeconds} s`;
  }
  if (metrics?.requestCount != null) {
    return `${result.status.toLowerCase()} · ${metrics.requestCount} req · ${metrics.errorRatePercent ?? 0}% errors · p95 ${metrics.p95Ms ?? '—'} ms`;
  }
  return result.status.toLowerCase();
}

/** M02 Result: 끝난 이전의 숫자 표(F17). 서버가 아직 주지 않는 값은 — 와 측정 출처를 적는다 */
export function ResultTab({ plan }: { plan: MigrationPlan }) {
  const failed = failedRequests(plan);
  const total = totalSeconds(plan);
  const lag = maxReplicationLag(plan);
  const requests = requestCount(plan);
  const clean = plan.status === 'SUCCEEDED' && (failed ?? 0) === 0;

  return (
    <div className="flex flex-col gap-3">
      {plan.status === 'SUCCEEDED' ? (
        <div className="flex items-start gap-3 rounded-lg bg-success-bg p-3 text-success-fg">
          <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
          <div className="flex flex-col gap-0.5">
            <p className="text-body-medium">
              {clean ? 'Zero failed requests while traffic moved' : 'Migration finished'}
            </p>
            <p className="text-small">
              Numbers come from the step judgements EchoPort recorded during this run.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-lg bg-warning-bg p-3 text-warning-fg">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p className="text-body-medium">
            {plan.status === 'ROLLED_BACK'
              ? `Rolled back to the source (${plan.errorCode ?? 'stopped'}). ${plan.errorMessage ?? ''}`
              : `This run ended as ${plan.status.toLowerCase()}. ${plan.errorMessage ?? ''}`}
          </p>
        </div>
      )}

      <div className="flex gap-3 max-compact:flex-col">
        <Kpi
          label="Failed requests"
          value={failed}
          tone={failed === 0 ? 'success' : failed ? 'danger' : undefined}
          caption={`${requests} requests judged`}
        />
        <Kpi
          label="Missing · duplicate rows"
          value={null}
          caption="data check API pending (infra #7)"
        />
        <Kpi label="Write pause" value={null} caption="writer cutover not in this plan yet" />
        <Kpi
          label="Total time"
          value={total === null ? null : duration(total)}
          caption={`planned ${duration(plan.expectedSeconds)}`}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Stage</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plan.steps.map((step) => {
              const took = stepSeconds(step);
              return (
                <TableRow key={step.index}>
                  <TableCell>{stepName(step)}</TableCell>
                  <TableCell className="font-mono text-mono">
                    {clock(step.result?.startedAt)}
                  </TableCell>
                  <TableCell className="font-mono text-mono">
                    {took === null ? '—' : `${took} s`}
                  </TableCell>
                  <TableCell className="text-fg-secondary">{stepResult(step)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex gap-3 max-compact:flex-col">
        <Kpi
          label="RTO"
          value={total === null ? null : duration(total)}
          caption="planned evacuation, start → 100%"
        />
        <Kpi label="RPO" value={null} caption="measured by the replication engine (infra #7)" />
        <Kpi
          label="Max replication lag"
          value={lag === null ? null : `${lag} s`}
          caption="data sync check"
        />
      </div>
    </div>
  );
}
