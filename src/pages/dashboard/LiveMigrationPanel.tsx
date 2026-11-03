import { ChartLine } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { Panel } from '@/components/Panel';
import { TrafficChart } from '@/components/TrafficChart';
import { useNow } from '@/hooks/useNow';
import { useMigrationPlan } from '@/lib/api/migrations';
import { weightTimeline } from '@/lib/migration-metrics';

/** S01 "Requests · A vs B": 실행 중인 이전이 있으면 그 A·B 비율을, 없으면 빈 상태 */
export function LiveMigrationPanel({
  orgId,
  orgSlug,
  planId,
  names,
  className,
}: {
  orgId: string;
  orgSlug: string;
  planId: string | undefined;
  names: Map<string, string>;
  className?: string;
}) {
  const plan = useMigrationPlan(orgId, planId);
  const now = useNow(Boolean(planId));

  return (
    <Panel title="Requests · A vs B" className={className}>
      {!planId || !plan.data ? (
        <EmptyState
          icon={ChartLine}
          title="No migration running"
          description="The A vs B graph appears while traffic moves between environments."
        />
      ) : (
        <div className="flex flex-col gap-2">
          <TrafficChart
            points={weightTimeline(plan.data, now)}
            sourceName={names.get(plan.data.sourceEnvironmentId) ?? 'source'}
            targetName={names.get(plan.data.targetEnvironmentId) ?? 'target'}
          />
          <Link
            to={`/o/${orgSlug}/migrations/${plan.data.id}`}
            className="self-end text-small text-brand hover:underline"
          >
            Open migration
          </Link>
        </div>
      )}
    </Panel>
  );
}
