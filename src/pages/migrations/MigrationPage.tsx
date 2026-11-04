import { CircleAlert, Route } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { PageHeader } from '@/components/PageHeader';
import { RoleButton } from '@/components/RoleButton';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { StageList } from '@/components/StageList';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNow } from '@/hooks/useNow';
import { useActiveDisasters } from '@/lib/api/disasters';
import { useEnvironments } from '@/lib/api/environments';
import { useCurrentOrg } from '@/lib/api/me';
import {
  isActivePlan,
  useMigrationLogs,
  useMigrationPlan,
  usePlanAction,
} from '@/lib/api/migrations';
import type { MigrationPlan } from '@/lib/api/types';
import { totalSeconds } from '@/lib/migration-metrics';
import { duration, planStages } from '@/lib/migration-stages';
import { migrationErrorLabel, migrationPlanStatusView } from '@/lib/status';
import { cn } from '@/lib/utils';
import { LiveTab } from './LiveTab';
import { ResultTab } from './ResultTab';

const clock = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString('en-GB') : '—';

const FINISHED: MigrationPlan['status'][] = ['SUCCEEDED', 'ROLLED_BACK', 'FAILED'];

function title(plan: MigrationPlan) {
  const id = plan.id.slice(0, 8);
  if (plan.mode === 'FAILBACK') return failbackTitle(plan, id);
  if (plan.status === 'SUCCEEDED') return `Migration ${id} completed`;
  if (plan.status === 'ROLLED_BACK') return `Migration ${id} rolled back`;
  if (plan.status === 'FAILED') return `Migration ${id} failed`;
  if (plan.status === 'ROLLING_BACK') return `Rolling back · plan ${id}`;
  if (plan.status === 'PENDING_APPROVAL') return `Plan ${id} · waiting for approval`;
  return `Migrating · plan ${id}`;
}

function failbackTitle(plan: MigrationPlan, id: string) {
  if (plan.status === 'SUCCEEDED') return `Failback ${id} completed`;
  if (plan.status === 'ROLLED_BACK') return `Failback ${id} rolled back`;
  if (plan.status === 'FAILED') return `Failback ${id} failed`;
  if (plan.status === 'PENDING_APPROVAL') return `Failback ${id} · waiting for approval`;
  return `Failing back · plan ${id}`;
}

/** 가로 단계 표시: 승인 → 사전 확인 → 10% → 50% → 데이터 확인 → 100% */
function Stepper({ plan, targetName }: { plan: MigrationPlan; targetName: string }) {
  const stages = [
    {
      key: 'approved',
      title: 'Plan approved',
      meta: clock(plan.approvedAt),
      state: plan.approvedAt ? ('done' as const) : ('pending' as const),
    },
    ...planStages(plan.steps, plan.rollbackConditions, targetName).map((stage, index) => ({
      ...stage,
      title:
        plan.steps[index]?.kind === 'SHIFT'
          ? `Shift → ${plan.steps[index]?.targetWeight}%`
          : stage.title,
      meta: `${plan.steps[index]?.expectedSeconds ?? 0}s`,
    })),
  ];
  return (
    <ol className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
      {stages.map((stage, index) => (
        <li key={stage.key} className="flex items-center gap-3">
          {index > 0 && (
            <span
              aria-hidden
              className={cn(
                'h-0.5 w-8 max-compact:hidden',
                stages[index - 1]?.state === 'done' ? 'bg-success-solid' : 'bg-line',
              )}
            />
          )}
          <StageList stages={[stage]} start={index} />
        </li>
      ))}
    </ol>
  );
}

function LogsTab({ orgId, plan }: { orgId: string; plan: MigrationPlan }) {
  const logs = useMigrationLogs(orgId, plan.id, isActivePlan(plan.status));
  if (logs.isError) return <ErrorState error={logs.error} onRetry={() => logs.refetch()} />;
  if (logs.isPending) return <Skeleton className="h-40" />;
  const lines = logs.data.pages.flatMap((page) => page.items);
  return (
    <div className="flex flex-col gap-2">
      <ol className="flex max-h-128 flex-col gap-1 overflow-y-auto rounded-xl border border-line bg-subtle p-4 font-mono text-mono">
        {lines.length === 0 && <li className="text-fg-muted">No log lines yet.</li>}
        {lines.map((line) => (
          <li key={line.seq} className="flex gap-4">
            <span className="shrink-0 text-fg-muted">{clock(line.at)}</span>
            <span
              className={cn(
                'w-10 shrink-0',
                line.level === 'ERROR'
                  ? 'text-danger-fg'
                  : line.level === 'WARN'
                    ? 'text-warning-fg'
                    : 'text-fg-muted',
              )}
            >
              {line.level}
            </span>
            <span className="w-12 shrink-0 text-fg-muted">
              {line.step === null ? '—' : `step ${line.step}`}
            </span>
            <span className="break-all">
              <span className="text-fg-secondary">{line.code}</span> {line.message}
            </span>
          </li>
        ))}
      </ol>
      {logs.hasNextPage && (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => logs.fetchNextPage()}
        >
          Load more
        </Button>
      )}
    </div>
  );
}

/** M02 이전 실행: Live · Result · Plan · Logs. 실행 중에는 1초마다 다시 부른다 */
export default function MigrationPage() {
  const { slug, planId } = useParams();
  const navigate = useNavigate();
  const { organization } = useCurrentOrg(slug);
  const orgId = organization?.id;
  const plan = useMigrationPlan(orgId, planId);
  const environments = useEnvironments(orgId);
  const disasters = useActiveDisasters(orgId);
  const abort = usePlanAction(orgId ?? '', plan.data?.serviceId ?? '', 'abort');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [tab, setTab] = useState<string>();
  const active = isActivePlan(plan.data?.status);
  const now = useNow(active);

  // 끝나면 숫자 표(Result)를 자동으로 연다(F17). 사람이 탭을 고르면 그대로 둔다
  const finished = plan.data ? FINISHED.includes(plan.data.status) : false;
  useEffect(() => {
    if (finished) setTab((current) => current ?? 'result');
  }, [finished]);

  if (plan.isError) return <ErrorState error={plan.error} onRetry={() => plan.refetch()} />;
  if (!organization || plan.isPending || environments.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-16" />
        <Skeleton className="h-96" />
      </div>
    );
  }
  if (!plan.data) {
    return (
      <EmptyState
        icon={Route}
        title="Migration not found"
        description="It may belong to another organization."
      />
    );
  }

  const current = plan.data;
  const names = new Map(environments.data?.items.map((item) => [item.id, item.name]));
  const sourceName = names.get(current.sourceEnvironmentId) ?? 'source';
  const targetName = names.get(current.targetEnvironmentId) ?? 'target';
  const elapsed = totalSeconds(current, now);
  // 재난이 끝나지 않은 지역으로는 돌아가지 않는다(ADR 11/2)
  const sourceAtRisk = (disasters.data ?? []).some((disaster) =>
    disaster.affectedEnvironmentIds.includes(current.sourceEnvironmentId),
  );
  const failbackUrl = `/o/${organization.slug}/evacuation/plan?service=${current.serviceId}&target=${current.sourceEnvironmentId}`;
  const selectedTab = tab ?? (finished ? 'result' : 'live');

  return (
    <>
      <PageHeader
        title={title(current)}
        description={`${sourceName} → ${targetName} · started ${clock(current.startedAt)}${elapsed === null ? '' : ` · ${current.finishedAt ? 'took' : 'elapsed'} ${duration(elapsed)}`}${current.approvedBy ? ` · approved by ${current.approvedBy.login}` : ''}`}
        actions={
          active ? (
            <RoleButton
              requires="DEVELOPER"
              variant="destructive"
              disabled={
                abort.isPending ||
                current.status === 'ROLLING_BACK' ||
                Boolean(current.abortRequestedAt)
              }
              onClick={() => setConfirmOpen(true)}
            >
              Roll back
            </RoleButton>
          ) : current.status === 'SUCCEEDED' ? (
            <RoleButton
              requires="DEVELOPER"
              disabledReason={
                sourceAtRisk ? `${sourceName} is still inside an active disaster radius` : undefined
              }
              onClick={() => navigate(failbackUrl)}
            >
              Start failback
            </RoleButton>
          ) : current.status === 'PENDING_APPROVAL' ? (
            <Button asChild>
              <Link
                to={`/o/${organization.slug}/evacuation/plan?service=${current.serviceId}&target=${current.targetEnvironmentId}&plan=${current.id}`}
              >
                Review plan
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge {...migrationPlanStatusView(current.status)} />
        {current.simulated && <SimulatedBadge />}
        {current.abortRequestedAt && current.status !== 'ROLLED_BACK' && (
          <span className="text-small text-warning-fg">
            Rollback requested at {clock(current.abortRequestedAt)}
          </span>
        )}
      </div>

      {(current.status === 'ROLLING_BACK' ||
        current.status === 'ROLLED_BACK' ||
        current.status === 'FAILED') && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg bg-danger-bg p-3 text-danger-fg"
        >
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <div className="flex flex-col gap-0.5">
            <p className="text-body-medium">
              {current.status === 'ROLLING_BACK'
                ? `Rolling back: ${sourceName} is taking 100% of traffic again`
                : current.status === 'ROLLED_BACK'
                  ? `Rolled back: ${sourceName} serves 100% again`
                  : 'Migration failed'}
            </p>
            <p className="text-small">
              {current.errorCode ? `${migrationErrorLabel(current.errorCode)}.` : ''}{' '}
              {current.errorMessage ?? ''}
              {current.rollbackStatus === 'FAILED' &&
                ' The rollback itself did not finish. Check the logs.'}
            </p>
          </div>
        </div>
      )}

      <Tabs value={selectedTab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="live">Live</TabsTrigger>
          <TabsTrigger value="result">Result</TabsTrigger>
          <TabsTrigger value="plan">Plan</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>
        <div className="mt-3">
          <Stepper plan={current} targetName={targetName} />
        </div>
        <TabsContent value="live" className="mt-3">
          <LiveTab plan={current} sourceName={sourceName} targetName={targetName} now={now} />
        </TabsContent>
        <TabsContent value="result" className="mt-3">
          {finished ? (
            <ResultTab plan={current} />
          ) : (
            <p className="rounded-lg bg-subtle px-3 py-2 text-body text-fg-secondary">
              The result table appears when the migration finishes.
            </p>
          )}
        </TabsContent>
        <TabsContent value="plan" className="mt-3">
          <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
            <h2 className="text-title">Stages · planned vs actual</h2>
            <StageList stages={planStages(current.steps, current.rollbackConditions, targetName)} />
            <p className="text-caption text-fg-muted">
              Planned {duration(current.expectedSeconds)} · wait up to {current.maxWaitSeconds}s per
              traffic step · created by {current.createdBy.login}
              {current.selfApproved && ' · self-approved'}
            </p>
          </section>
        </TabsContent>
        <TabsContent value="logs" className="mt-3">
          <LogsTab orgId={organization.id} plan={current} />
        </TabsContent>
      </Tabs>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Roll back to {sourceName}?</DialogTitle>
            <DialogDescription>
              EchoPort stops the migration and sends 100% of traffic back to {sourceName}.{' '}
              {targetName} stays as a standby.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Keep migrating
            </Button>
            <Button
              variant="destructive"
              disabled={abort.isPending}
              onClick={() => abort.mutate(current.id, { onSuccess: () => setConfirmOpen(false) })}
            >
              Roll back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
