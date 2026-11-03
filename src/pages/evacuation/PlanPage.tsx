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
import { useEnvironments } from '@/lib/api/environments';
import { describeApiError } from '@/lib/api/errors';
import { useCurrentOrg } from '@/lib/api/me';
import { isActivePlan, useMigrationPlan, usePlanAction } from '@/lib/api/migrations';
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

  if (!planId || !plan.data) {
    return (
      <PlanDraft
        orgId={organization.id}
        serviceId={serviceId}
        targetId={targetId}
        sourceName={sourceName}
        targetName={targetName}
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
  const approveReason = selfBlocked
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
      <WizardSteps current={2} />

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

      <div className="flex items-start gap-3 max-wide:flex-col">
        <div className="flex min-w-0 flex-1 flex-col gap-3 max-wide:w-full">
          <section className="flex flex-col gap-3.5 rounded-xl border border-line bg-surface p-4">
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
              <li>p95 latency &gt; {current.rollbackConditions.maxP95Ms} ms</li>
              <li>
                replication lag &gt; {current.rollbackConditions.maxReplicationLagSeconds} s before
                the last step
              </li>
              {current.rollbackConditions.healthCheck && <li>the health check fails</li>}
            </ul>
            <p className="text-caption text-fg-muted">
              Each traffic step is watched for {current.observeSeconds}s before EchoPort moves on.
            </p>
          </section>
        </div>

        <div className="flex w-[27.5rem] shrink-0 flex-col gap-3 max-wide:w-full">
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
