import { CircleAlert, Route } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { PageHeader } from '@/components/PageHeader';
import { RoleButton } from '@/components/RoleButton';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { StageList } from '@/components/StageList';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useActiveDisasters } from '@/lib/api/disasters';
import { useEnvironments } from '@/lib/api/environments';
import { describeApiError, isApiError } from '@/lib/api/errors';
import { useCurrentOrg } from '@/lib/api/me';
import {
  isActivePlan,
  useMigrationLogs,
  useMigrationPlan,
  usePlanAction,
} from '@/lib/api/migrations';
import { usePrecheck } from '@/lib/api/prechecks';
import { useService } from '@/lib/api/services';
import type { MigrationPlan } from '@/lib/api/types';
import { dateTime } from '@/lib/format';
import { duration, planStages } from '@/lib/migration-stages';
import { hasRole, roleLabel } from '@/lib/roles';
import { migrationPlanStatusView } from '@/lib/status';
import { PlanDraft } from './PlanDraft';
import { SecurityComparison, securityMismatches } from './SecurityComparison';
import { WizardSteps } from './WizardSteps';

const clock = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-GB') : '—');

// 승인 대기에서 끝난 계획의 안내 (다시 만들어야 한다)
const CLOSED_TEXT: Partial<Record<MigrationPlan['status'], string>> = {
  REJECTED: 'This plan was rejected.',
  CANCELLED: 'This plan was cancelled.',
  EXPIRED: 'This plan expired after 24 hours without approval.',
  STALE: 'Environments or deployments changed after this plan was made, so it can no longer run.',
};

// 지문 항목(API 서버 8, PLAN_STALE details · 로그 STALE.data.changed) → 사람이 읽는 말
const STALE_FIELDS: Record<string, string> = {
  serviceStatus: 'Service status changed',
  connections: 'A deployment or traffic weight changed',
  sourceEnvironment: 'Source environment settings or connection changed',
  targetEnvironment: 'Target environment settings or connection changed',
  openDeployRequests: 'A deploy started or finished',
};

/** 낡은 계획이 된 이유. 승인 409 의 details 가 있으면 그것을, 없으면 실행 로그의 STALE 줄을 쓴다 */
function staleChanges(error: unknown, logChanged: unknown): string[] {
  const fields =
    isApiError(error) && error.code === 'PLAN_STALE'
      ? error.details.map((detail) => detail.field)
      : Array.isArray(logChanged)
        ? logChanged.filter((item): item is string => typeof item === 'string')
        : [];
  return fields.map((field) => STALE_FIELDS[field] ?? field);
}

function Kv({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-small">
      <dt className="text-fg-secondary">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

/** E01-3 계획 승인. 승인하면 바로 이전이 시작된다(API 서버 8) */
export default function PlanPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const serviceId = searchParams.get('service') ?? undefined;
  const targetId = searchParams.get('target') ?? undefined;
  const { data: me, organization } = useCurrentOrg(slug);
  const orgId = organization?.id;
  const service = useService(orgId, serviceId);
  const environments = useEnvironments(orgId);
  const planId = searchParams.get('plan') ?? service.data?.activeMigrationPlanId ?? undefined;
  const plan = useMigrationPlan(orgId, planId);
  const approve = usePlanAction(orgId ?? '', serviceId ?? '', 'approve');
  const reject = usePlanAction(orgId ?? '', serviceId ?? '', 'reject');
  const cancel = usePlanAction(orgId ?? '', serviceId ?? '', 'cancel');
  const disasters = useActiveDisasters(orgId);
  const precheck = usePrecheck(orgId, serviceId, targetId);
  const precheckSkipped = precheck.data === null;
  const logs = useMigrationLogs(orgId, plan.data?.status === 'STALE' ? planId : undefined, false);

  if (!serviceId || !targetId) {
    return (
      <EmptyState
        icon={Route}
        title="Choose a target first"
        description="Pick an evacuation target and run the AI pre-check before planning."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to={`/o/${slug}/evacuation`}>Choose target</Link>
          </Button>
        }
      />
    );
  }
  if (service.isError)
    return <ErrorState error={service.error} onRetry={() => service.refetch()} />;
  if (plan.isError) return <ErrorState error={plan.error} onRetry={() => plan.refetch()} />;
  if (
    !organization ||
    !me ||
    service.isPending ||
    environments.isPending ||
    (planId && plan.isPending)
  ) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-16" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const names = new Map(environments.data?.items.map((item) => [item.id, item.name]));
  const servingId = service.data.environments.find((link) => link.role === 'SERVING')?.environment
    .id;
  const sourceName = names.get(plan.data?.sourceEnvironmentId ?? servingId ?? '') ?? 'source';
  const targetName = names.get(plan.data?.targetEnvironmentId ?? targetId) ?? 'target';
  const restartUrl = `/o/${organization.slug}/evacuation/plan?service=${serviceId}&target=${targetId}`;
  // 재난이 끝나지 않은 지역으로는 옮기지 않는다(ADR 11/2). 주소로 바로 들어와도 여기서 막는다
  const targetAtRisk = (disasters.data ?? []).some((disaster) =>
    disaster.affectedEnvironmentIds.includes(plan.data?.targetEnvironmentId ?? targetId),
  );
  const riskReason = targetAtRisk ? `${targetName} is inside an active disaster radius` : undefined;

  if (!planId || !plan.data) {
    return (
      <PlanDraft
        orgId={organization.id}
        serviceId={serviceId}
        targetId={targetId}
        sourceName={sourceName}
        targetName={targetName}
        blockedReason={riskReason}
        realTarget={
          service.data.environments.find((link) => link.environment.id === targetId)?.simulated ===
          false
        }
        precheckSkipped={precheckSkipped}
        onCreated={(created) =>
          setSearchParams({ service: serviceId, target: targetId, plan: created.id })
        }
      />
    );
  }

  const current = plan.data;
  const pending = current.status === 'PENDING_APPROVAL';
  const mine = current.createdBy.id === me.user.id;
  const selfBlocked = mine && !organization.allowSelfApproval;
  const mismatches = securityMismatches();
  const approveReason = riskReason
    ? riskReason
    : selfBlocked
      ? 'Self-approval is off. Ask another developer, or turn it on in Settings › Members.'
      : mismatches.length
        ? 'Fix the security mismatch first'
        : undefined;
  const actionError = approve.error ?? reject.error ?? cancel.error;
  const migrationUrl = `/o/${organization.slug}/migrations/${current.id}`;

  return (
    <>
      <PageHeader
        title={`Migration plan ${current.id.slice(0, 8)}`}
        description={`${sourceName} → ${targetName} · est. ${duration(current.expectedSeconds)} · created ${clock(current.createdAt)} by ${current.createdBy.login}`}
        actions={
          pending ? (
            <>
              <RoleButton
                requires="DEVELOPER"
                variant="outline"
                disabledReason={selfBlocked ? approveReason : undefined}
                disabled={reject.isPending}
                onClick={() => reject.mutate(current.id)}
              >
                Reject
              </RoleButton>
              <RoleButton
                requires="DEVELOPER"
                disabledReason={approveReason}
                disabled={approve.isPending}
                onClick={() =>
                  approve.mutate(current.id, { onSuccess: () => navigate(migrationUrl) })
                }
              >
                Approve plan
              </RoleButton>
            </>
          ) : isActivePlan(current.status) || current.status === 'SUCCEEDED' ? (
            <Button asChild>
              <Link to={migrationUrl}>Open migration</Link>
            </Button>
          ) : (
            <Button variant="outline" onClick={() => navigate(restartUrl)}>
              Create a new plan
            </Button>
          )
        }
      />
      <WizardSteps current={2} precheckSkipped={precheckSkipped} />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge {...migrationPlanStatusView(current.status)} />
        {current.simulated && <SimulatedBadge />}
        {pending && (
          <span className="text-small text-fg-muted">
            Approve before {dateTime(current.expiresAt)}
          </span>
        )}
      </div>

      {mismatches.length > 0 && pending && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg bg-danger-bg p-3 text-danger-fg"
        >
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p className="text-body-medium">
            Approval locked: {mismatches.length} security mismatch
            {mismatches.length === 1 ? '' : 'es'} ({mismatches.map((row) => row.control).join(', ')}
            ).
          </p>
        </div>
      )}
      {CLOSED_TEXT[current.status] && (
        <p role="status" className="rounded-lg bg-subtle px-3 py-2 text-body text-fg-secondary">
          {CLOSED_TEXT[current.status]} Create a new plan to continue.
        </p>
      )}
      {actionError ? (
        <p role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-body text-danger-fg">
          {describeApiError(actionError)}
        </p>
      ) : null}
      {(() => {
        const changes = staleChanges(
          approve.error,
          logs.data?.pages.flatMap((page) => page.items).find((line) => line.code === 'STALE')?.data
            ?.changed,
        );
        return changes.length > 0 ? (
          <div className="flex flex-col gap-1 rounded-lg bg-subtle px-3 py-2 text-small text-fg-secondary">
            <span className="text-body-medium text-fg">What changed after the plan was made</span>
            <ul className="list-disc pl-5">
              {changes.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
          </div>
        ) : null;
      })()}

      <div className="flex items-start gap-3 max-wide:flex-col">
        <div className="flex min-w-0 flex-1 flex-col gap-3 max-wide:w-full">
          <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
            <h2 className="text-title">Stages</h2>
            <StageList stages={planStages(current.steps, current.rollbackConditions, targetName)} />
          </section>
          <section className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
            <h2 className="text-title">Automatic rollback when</h2>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-small">
              <li>
                error rate &gt; {current.rollbackConditions.maxErrorRatePercent}% at any traffic
                step
              </li>
              {!current.rollbackConditions.p95Advisory && (
                <li>p95 latency &gt; {current.rollbackConditions.maxP95Ms} ms</li>
              )}
              <li>the target does not receive traffic while the source still does</li>
              <li>
                replication lag &gt; {current.rollbackConditions.maxReplicationLagSeconds} s before
                the last step
              </li>
              {current.rollbackConditions.healthCheck && <li>the health check fails</li>}
            </ul>
            <p className="text-caption text-fg-muted">
              Each traffic step waits up to {current.maxWaitSeconds}s for the target to handle its
              requests before EchoPort moves on.
            </p>
          </section>
        </div>

        <div className="flex w-110 shrink-0 flex-col gap-3 max-wide:w-full">
          <SecurityComparison sourceName={sourceName} targetName={targetName} />
          <section className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
            <h2 className="text-title">Approval</h2>
            <dl className="flex flex-col gap-1.5">
              <Kv label="Required role">Developer or above</Kv>
              <Kv label="Your role">
                <span
                  className={
                    hasRole(organization.role, 'DEVELOPER') ? 'text-success-fg' : 'text-danger-fg'
                  }
                >
                  {roleLabel(organization.role)}
                </span>
              </Kv>
              <Kv label="Self-approval">
                {organization.allowSelfApproval
                  ? 'Allowed in this organization'
                  : 'Off · another developer approves'}
              </Kv>
              <Kv label="Plan validity">
                {current.status === 'STALE' ? (
                  <span className="text-danger-fg">Stale · environments changed</span>
                ) : pending ? (
                  <span className="text-success-fg">Checked again when approved</span>
                ) : (
                  migrationPlanStatusView(current.status).label
                )}
              </Kv>
              {current.approvedBy && (
                <Kv label="Approved by">
                  @{current.approvedBy.login}
                  {current.selfApproved && ' (self)'} · {clock(current.approvedAt)}
                </Kv>
              )}
            </dl>
            {pending && mine && (
              <Button
                variant="ghost"
                size="sm"
                className="self-start"
                disabled={cancel.isPending}
                onClick={() => cancel.mutate(current.id)}
              >
                Cancel this plan
              </Button>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
