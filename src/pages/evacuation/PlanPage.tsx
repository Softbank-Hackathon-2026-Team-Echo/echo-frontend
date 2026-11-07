import { CircleAlert, Route, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
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
import { useSecurityCompare } from '@/lib/api/security';
import { useService } from '@/lib/api/services';
import type { MigrationPlan } from '@/lib/api/types';
import { dateTime } from '@/lib/format';
import { k, t } from '@/lib/i18n';
import { duration, planStages } from '@/lib/migration-stages';
import { hasRole, roleLabel } from '@/lib/roles';
import { migrationPlanStatusView, securityControlLabel, securityReasonLabel } from '@/lib/status';
import { PlanDraft } from './PlanDraft';
import { SecurityComparison } from './SecurityComparison';
import { WizardSteps } from './WizardSteps';

const clock = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-GB') : '—');

// 승인 대기에서 끝난 계획의 안내 (다시 만들어야 한다)
const CLOSED_TEXT: Partial<Record<MigrationPlan['status'], string>> = {
  REJECTED: k('This plan was rejected.'),
  CANCELLED: k('This plan was cancelled.'),
  EXPIRED: k('This plan expired after 24 hours without approval.'),
  STALE: k(
    'Environments or deployments changed after this plan was made, so it can no longer run.',
  ),
};

// 지문 항목(API 서버 8, PLAN_STALE details · 로그 STALE.data.changed) → 사람이 읽는 말
const STALE_FIELDS: Record<string, string> = {
  serviceStatus: k('Service status changed'),
  connections: k('A deployment or traffic weight changed'),
  sourceEnvironment: k('Source environment settings or connection changed'),
  targetEnvironment: k('Target environment settings or connection changed'),
  openDeployRequests: k('A deploy started or finished'),
};

/** 낡은 계획이 된 이유. 승인 409 의 details 가 있으면 그것을, 없으면 실행 로그의 STALE 줄을 쓴다 */
function staleChanges(error: unknown, logChanged: unknown): string[] {
  const fields =
    isApiError(error) && error.code === 'PLAN_STALE'
      ? error.details.map((detail) => detail.field)
      : Array.isArray(logChanged)
        ? logChanged.filter((item): item is string => typeof item === 'string')
        : [];
  return fields.map((field) => {
    const label = STALE_FIELDS[field];
    return label ? t(label) : field;
  });
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
  // 승격 위험 고지(promoteWarning)에 동의한 계획·고지. 동의 없이 승인하면 서버가 422 PROMOTE_ACK_REQUIRED 를 준다.
  // 동의는 그 계획 id·고지 문장에만 묶는다 — 취소 뒤 새 계획을 만들면(같은 화면) 다시 동의해야 한다
  const [acknowledgedPromote, setAcknowledgedPromote] = useState<{
    planId: string;
    warning: string;
  } | null>(null);
  const disasters = useActiveDisasters(orgId);
  // 끝낸 점검에서 왔을 때만 주소에 id 가 있다. 그 밖은 점검을 건너뛴 것이다
  const precheckSkipped = !searchParams.has('precheck');
  const security = useSecurityCompare(
    orgId,
    plan.data?.sourceEnvironmentId,
    plan.data?.targetEnvironmentId,
    serviceId,
  );
  const logs = useMigrationLogs(orgId, plan.data?.status === 'STALE' ? planId : undefined, false);

  if (!serviceId || !targetId) {
    return (
      <EmptyState
        icon={Route}
        title={t('Choose a target first')}
        description={t('Pick an evacuation target and run the AI pre-check before planning.')}
        action={
          <Button asChild variant="outline" size="sm">
            <Link to={`/o/${slug}/evacuation`}>{t('Choose target')}</Link>
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
  const sourceName = names.get(plan.data?.sourceEnvironmentId ?? servingId ?? '') ?? t('source');
  const targetName = names.get(plan.data?.targetEnvironmentId ?? targetId) ?? t('target');
  const restartUrl = `/o/${organization.slug}/evacuation/plan?service=${serviceId}&target=${targetId}`;
  // 재난이 끝나지 않은 지역으로는 옮기지 않는다(ADR 11/2). 주소로 바로 들어와도 여기서 막는다
  const targetAtRisk = (disasters.data ?? []).some(
    (disaster) =>
      disaster.meetsThreshold &&
      disaster.affectedEnvironmentIds.includes(plan.data?.targetEnvironmentId ?? targetId),
  );
  const riskReason = targetAtRisk
    ? t('{{name}} is inside an active disaster radius', { name: targetName })
    : undefined;

  if (!planId || !plan.data) {
    return (
      <PlanDraft
        failback={searchParams.has('failback')}
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
  const mismatches = security.data?.rows.filter((row) => row.blocksMigration) ?? [];
  const promoteWarning = current.promoteWarning ?? null;
  const promoteAcknowledged =
    promoteWarning !== null &&
    acknowledgedPromote?.planId === current.id &&
    acknowledgedPromote.warning === promoteWarning;
  const approveReason = riskReason
    ? riskReason
    : selfBlocked
      ? t('Self-approval is off. Ask another developer, or turn it on in Settings › Members.')
      : mismatches.length
        ? t('Fix the security mismatch first')
        : promoteWarning && !promoteAcknowledged
          ? t('Acknowledge the promotion warning first')
          : undefined;
  const actionError = approve.error ?? reject.error ?? cancel.error;
  // 게이트는 막은 통제마다 details 한 칸을 준다: {field: 통제 ID, reason: 사유}
  const gateBlocks =
    isApiError(approve.error) && approve.error.code === 'SECURITY_GATE_BLOCKED'
      ? approve.error.details
      : [];
  const closedText = CLOSED_TEXT[current.status];
  const mismatchValues = {
    n: mismatches.length,
    controls: mismatches.map((row) => securityControlLabel(row.control)).join(', '),
  };
  const migrationUrl = `/o/${organization.slug}/migrations/${current.id}`;

  return (
    <>
      <PageHeader
        title={t('Migration plan {{id}}', { id: current.id.slice(0, 8) })}
        description={t(
          '{{source}} → {{target}} · est. {{duration}} · created {{time}} by {{login}}',
          {
            source: sourceName,
            target: targetName,
            duration: duration(current.expectedSeconds),
            time: clock(current.createdAt),
            login: current.createdBy.login,
          },
        )}
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
                {t('Reject')}
              </RoleButton>
              <RoleButton
                requires="DEVELOPER"
                disabledReason={approveReason}
                disabled={approve.isPending}
                onClick={() =>
                  approve.mutate(
                    promoteWarning
                      ? { planId: current.id, acknowledgePromote: promoteAcknowledged }
                      : current.id,
                    { onSuccess: () => navigate(migrationUrl) },
                  )
                }
              >
                {t('Approve plan')}
              </RoleButton>
            </>
          ) : isActivePlan(current.status) || current.status === 'SUCCEEDED' ? (
            <Button asChild>
              <Link to={migrationUrl}>{t('Open migration')}</Link>
            </Button>
          ) : (
            <Button variant="outline" onClick={() => navigate(restartUrl)}>
              {t('Create a new plan')}
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
            {t('Approve before {{time}}', { time: dateTime(current.expiresAt) })}
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
            {mismatches.length === 1
              ? t('Approval locked: {{n}} security mismatch ({{controls}}).', mismatchValues)
              : t('Approval locked: {{n}} security mismatches ({{controls}}).', mismatchValues)}
          </p>
        </div>
      )}
      {promoteWarning && pending && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-warning-solid bg-warning-bg p-3 text-warning-fg"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <div className="flex flex-col gap-2">
            <p className="text-body-medium">{t('This plan promotes the target database')}</p>
            {/* 서버 고지 문장(되돌릴 수 없음·쓰기 손실 가능·복귀에 resync)을 그대로 보여 준다 */}
            <p className="whitespace-pre-line text-small">{promoteWarning}</p>
            <label className="flex items-start gap-2 text-body text-fg">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-brand"
                checked={promoteAcknowledged}
                onChange={(event) =>
                  setAcknowledgedPromote(
                    event.target.checked ? { planId: current.id, warning: promoteWarning } : null,
                  )
                }
              />
              {t('I understand the promotion cannot be undone and unreplicated writes may be lost')}
            </label>
          </div>
        </div>
      )}
      {closedText && (
        <p role="status" className="rounded-lg bg-subtle px-3 py-2 text-body text-fg-secondary">
          {t(closedText)} {t('Create a new plan to continue.')}
        </p>
      )}
      {actionError ? (
        <p role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-body text-danger-fg">
          {describeApiError(actionError)}
        </p>
      ) : null}
      {gateBlocks.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-lg border border-line bg-surface px-3 py-2">
          {gateBlocks.map((block) => (
            <li key={`${block.field}-${block.reason}`} className="text-small text-fg-secondary">
              <span className="font-mono">{block.field}</span> · {securityReasonLabel(block.reason)}
              {/* 복귀는 도착이 바뀌어 사전 점검이 없기 쉽다(11/6 리허설). 그 자리에서 풀게 한다 */}
              {block.field === 'C-AI-1' && (
                <>
                  {' '}
                  <Link
                    to={`/o/${organization.slug}/evacuation/pre-check?service=${serviceId}&target=${targetId}`}
                    className="text-brand hover:underline"
                  >
                    {t('Run AI pre-check on {{name}}', { name: targetName })}
                  </Link>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {(() => {
        const changes = staleChanges(
          approve.error,
          logs.data?.pages.flatMap((page) => page.items).find((line) => line.code === 'STALE')?.data
            ?.changed,
        );
        return changes.length > 0 ? (
          <div className="flex flex-col gap-1 rounded-lg bg-subtle px-3 py-2 text-small text-fg-secondary">
            <span className="text-body-medium text-fg">
              {t('What changed after the plan was made')}
            </span>
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
            <h2 className="text-title">{t('Stages')}</h2>
            <StageList stages={planStages(current.steps, current.rollbackConditions, targetName)} />
          </section>
          <section className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
            <h2 className="text-title">{t('Automatic rollback when')}</h2>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-small">
              <li>
                {t('error rate > {{percent}}% at any traffic step', {
                  percent: current.rollbackConditions.maxErrorRatePercent,
                })}
              </li>
              {!current.rollbackConditions.p95Advisory && (
                <li>{t('p95 latency > {{ms}} ms', { ms: current.rollbackConditions.maxP95Ms })}</li>
              )}
              <li>{t('the target does not receive traffic while the source still does')}</li>
              <li>
                {t('replication lag > {{seconds}} s before the last step', {
                  seconds: current.rollbackConditions.maxReplicationLagSeconds,
                })}
              </li>
              {current.rollbackConditions.healthCheck && <li>{t('the health check fails')}</li>}
            </ul>
            <p className="text-caption text-fg-muted">
              {t(
                'Each traffic step waits up to {{seconds}}s for the target to handle its requests before EchoPort moves on.',
                { seconds: current.maxWaitSeconds },
              )}
            </p>
          </section>
        </div>

        <div className="flex w-110 shrink-0 flex-col gap-3 max-wide:w-full">
          <SecurityComparison
            compare={security.data}
            isError={security.isError}
            sourceName={sourceName}
            targetName={targetName}
          />
          <section className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
            <h2 className="text-title">{t('Approval')}</h2>
            <dl className="flex flex-col gap-1.5">
              <Kv label={t('Required role')}>{t('Developer or above')}</Kv>
              <Kv label={t('Your role')}>
                <span
                  className={
                    hasRole(organization.role, 'DEVELOPER') ? 'text-success-fg' : 'text-danger-fg'
                  }
                >
                  {roleLabel(organization.role)}
                </span>
              </Kv>
              <Kv label={t('Self-approval')}>
                {organization.allowSelfApproval
                  ? t('Allowed in this organization')
                  : t('Off · another developer approves')}
              </Kv>
              <Kv label={t('Plan validity')}>
                {current.status === 'STALE' ? (
                  <span className="text-danger-fg">{t('Stale · environments changed')}</span>
                ) : pending ? (
                  <span className="text-success-fg">{t('Checked again when approved')}</span>
                ) : (
                  migrationPlanStatusView(current.status).label
                )}
              </Kv>
              {current.approvedBy && (
                <Kv label={t('Approved by')}>
                  {current.selfApproved
                    ? t('@{{login}} (self) · {{time}}', {
                        login: current.approvedBy.login,
                        time: clock(current.approvedAt),
                      })
                    : `@${current.approvedBy.login} · ${clock(current.approvedAt)}`}
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
                {t('Cancel this plan')}
              </Button>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
