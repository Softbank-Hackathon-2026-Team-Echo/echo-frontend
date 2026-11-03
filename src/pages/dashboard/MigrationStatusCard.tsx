import { Link } from 'react-router';
import { Panel } from '@/components/Panel';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { useMigrationPlan } from '@/lib/api/migrations';
import type { MigrationStep } from '@/lib/api/types';
import { currentWeights } from '@/lib/migration-metrics';
import { migrationPlanStatusView } from '@/lib/status';

function stepTitle(step: MigrationStep | undefined) {
  if (!step) return '—';
  if (step.kind === 'PREFLIGHT') return 'pre-check';
  if (step.kind === 'DATA_SYNC_CHECK') return 'data sync check';
  return `traffic shift → ${step.targetWeight}%`;
}

/**
 * 반분할 시연(960)의 상황 카드: 실행 중인 이전의 A·B 비율 막대 + 단계 진행(Figma 시연 장면 3).
 * 넓은 화면은 같은 내용을 "Requests · A vs B" 그래프로 보인다
 */
export function MigrationStatusCard({
  orgId,
  orgSlug,
  planId,
  names,
  className,
}: {
  orgId: string;
  orgSlug: string;
  planId: string;
  names: Map<string, string>;
  className?: string;
}) {
  const plan = useMigrationPlan(orgId, planId);
  if (!plan.data) {
    return (
      <Panel title="Migration" className={className}>
        <Skeleton className="h-12 w-full" />
      </Panel>
    );
  }
  const { source, target } = currentWeights(plan.data);
  const sourceName = names.get(plan.data.sourceEnvironmentId) ?? 'source';
  const targetName = names.get(plan.data.targetEnvironmentId) ?? 'target';
  const step = plan.data.steps[plan.data.currentStep];
  return (
    <Panel
      title={
        <Link to={`/o/${orgSlug}/migrations/${plan.data.id}`} className="hover:underline">
          Migration {plan.data.id.slice(0, 8)} · {sourceName} → {targetName}
        </Link>
      }
      action={plan.data.simulated ? <SimulatedBadge /> : undefined}
      className={className}
    >
      <div className="flex items-center justify-between text-small">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-full bg-chart-3" />
          {sourceName} <span className="tabular-nums text-body-medium">{source}%</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-full bg-chart-1" />
          {targetName} <span className="tabular-nums text-body-medium">{target}%</span>
        </span>
      </div>
      <div
        role="img"
        aria-label={`${sourceName} ${source}%, ${targetName} ${target}%`}
        className="flex h-2 overflow-hidden rounded-full bg-subtle"
      >
        <span className="h-full bg-chart-3 transition-all" style={{ width: `${source}%` }} />
        <span className="h-full bg-chart-1 transition-all" style={{ width: `${target}%` }} />
      </div>
      <p className="flex flex-wrap items-center gap-1.5 text-small text-fg-secondary">
        <StatusBadge {...migrationPlanStatusView(plan.data.status)} />
        Step {Math.min(plan.data.currentStep + 1, plan.data.steps.length)} /{' '}
        {plan.data.steps.length} · {stepTitle(step)}
      </p>
    </Panel>
  );
}
