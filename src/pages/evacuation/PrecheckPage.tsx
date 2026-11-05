import { CircleAlert, FlaskConical } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { PageHeader } from '@/components/PageHeader';
import { RoleButton } from '@/components/RoleButton';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { type Stage, StageList } from '@/components/StageList';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRole } from '@/hooks/useRole';
import { useEnvironments } from '@/lib/api/environments';
import { useCurrentOrg } from '@/lib/api/me';
import {
  isActivePrecheck,
  useCancelPrecheck,
  usePrecheck,
  useStartPrecheck,
} from '@/lib/api/prechecks';
import { useService } from '@/lib/api/services';
import type { PrecheckDetail } from '@/lib/api/types';
import { t } from '@/lib/i18n';
import { hasRole } from '@/lib/roles';
import { precheckFailureLabel, precheckStatusView, precheckStepLabel } from '@/lib/status';
import { PrecheckResults } from './PrecheckResults';
import { WizardSteps } from './WizardSteps';

const clock = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-GB') : '');

function progress(precheck: PrecheckDetail): Stage[] {
  const active = isActivePrecheck(precheck.status);
  const failed = precheck.status === 'FAILED' || precheck.status === 'TIMED_OUT';
  const stages: Stage[] = precheck.steps.map((step, index) => {
    const last = index === precheck.steps.length - 1;
    return {
      key: step.name,
      title: precheckStepLabel(step.name),
      meta: clock(step.lastAt),
      state:
        step.level === 'ERROR' || (failed && last) ? 'failed' : active && last ? 'current' : 'done',
    };
  });
  if (stages.length > 0 || !active) return stages;
  return [
    {
      key: 'WAITING',
      title: t('Waiting for a runner'),
      meta: t('The sandbox runner picks this up'),
      state: 'current',
    },
  ];
}

/** E01-2 AI 사전 점검: 러너가 도착 환경을 점검한다. 운영에는 아무것도 바꾸지 않는다 */
export default function PrecheckPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const serviceId = searchParams.get('service') ?? undefined;
  const targetId = searchParams.get('target') ?? undefined;
  const runId = searchParams.get('run') ?? undefined;
  const { organization } = useCurrentOrg(slug);
  const orgId = organization?.id;
  const role = useRole();
  const service = useService(orgId, serviceId);
  const environments = useEnvironments(orgId);
  const precheck = usePrecheck(orgId, runId);
  const start = useStartPrecheck(orgId ?? '');
  const cancel = useCancelPrecheck(orgId ?? '');

  const canStart = hasRole(role, 'DEVELOPER');
  const { mutate: startPrecheck, isIdle } = start;

  function run() {
    if (!serviceId || !targetId) return;
    startPrecheck(
      { serviceId, targetEnvironmentId: targetId },
      {
        onSuccess: (id) =>
          setSearchParams({ service: serviceId, target: targetId, run: id }, { replace: true }),
      },
    );
  }

  // E01-1 에서 "Run AI pre-check" 를 눌러 들어왔으니, 주소에 점검이 없으면 바로 만든다(개발자 이상만)
  // biome-ignore lint/correctness/useExhaustiveDependencies: run 은 렌더마다 새로 만들어진다
  useEffect(() => {
    if (!runId && orgId && canStart && isIdle && serviceId && targetId) run();
  }, [runId, orgId, canStart, isIdle, serviceId, targetId]);

  if (!serviceId || !targetId) {
    return (
      <EmptyState
        icon={FlaskConical}
        title={t('Choose a target first')}
        description={t('Pick an evacuation target, then run the AI pre-check on it.')}
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
  if (precheck.isError)
    return <ErrorState error={precheck.error} onRetry={() => precheck.refetch()} />;
  if (!organization || service.isPending || environments.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-16" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const envs = environments.data?.items ?? [];
  const nameOf = (id: string | null | undefined) => envs.find((item) => item.id === id)?.name;
  const targetName = nameOf(targetId) ?? t('target');
  const title = t('AI pre-check · {{name}}', { name: targetName });

  if (!precheck.data) {
    return (
      <>
        <PageHeader title={title} />
        <WizardSteps current={1} />
        {start.isError ? (
          <ErrorState error={start.error} onRetry={run} />
        ) : (
          <EmptyState
            icon={FlaskConical}
            title={canStart ? t('Starting the pre-check…') : t('Pre-check has not started')}
            description={
              canStart
                ? t('EchoPort is queueing the check for the runner.')
                : t('A developer or admin has to start the AI pre-check.')
            }
          />
        )}
      </>
    );
  }

  const current = precheck.data;
  const active = isActivePrecheck(current.status);
  const succeeded = current.status === 'SUCCEEDED';
  const sourceName = nameOf(current.sourceEnvironmentId) ?? t('source');
  const failure = current.failureCode ? precheckFailureLabel(current.failureCode) : null;
  const planParams = new URLSearchParams({ service: serviceId, target: targetId });
  if (succeeded) planParams.set('precheck', current.id);

  return (
    <>
      <PageHeader
        title={title}
        description={t(
          '{{source}} → {{target}} · requested {{time}}. Nothing in production changes.',
          {
            source: sourceName,
            target: targetName,
            time: clock(current.createdAt),
          },
        )}
        actions={
          <>
            {active && (
              <RoleButton
                requires="DEVELOPER"
                variant="outline"
                disabled={cancel.isPending}
                onClick={() => cancel.mutate(current.id)}
              >
                {t('Stop')}
              </RoleButton>
            )}
            <RoleButton
              requires="DEVELOPER"
              disabledReason={active ? t('Wait for the pre-check to finish') : undefined}
              onClick={() => navigate(`/o/${organization.slug}/evacuation/plan?${planParams}`)}
            >
              {t('Continue to plan')}
            </RoleButton>
          </>
        }
      />
      <WizardSteps current={1} />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge {...precheckStatusView(current.status)} />
        {current.simulated && <SimulatedBadge />}
        {!active &&
          (current.aiReviewed ? (
            <StatusBadge label={current.model?.id ?? t('AI reviewed')} tone="ai" />
          ) : (
            <span className="text-small text-fg-muted">
              {t('No AI review · rule comparison only')}
            </span>
          ))}
        {current.sandboxId && (
          <span className="font-mono text-mono text-fg-muted">{current.sandboxId}</span>
        )}
      </div>

      {!active && !succeeded && (
        <p role="status" className="rounded-lg bg-subtle px-3 py-2 text-body text-fg-secondary">
          {failure ?? t('This check was stopped. Nothing was applied.')}{' '}
          <button type="button" className="text-brand hover:underline" onClick={run}>
            {t('Run again')}
          </button>
        </p>
      )}

      <div className="flex items-start gap-3 max-wide:flex-col">
        <section className="flex w-72 shrink-0 flex-col gap-3 rounded-xl border border-line bg-surface p-4 max-wide:w-full">
          <h2 className="text-title">{t('Progress')}</h2>
          <StageList stages={progress(current)} />
        </section>

        <div className="flex min-w-0 flex-1 flex-col gap-3 max-wide:w-full">
          <PrecheckResults
            orgId={organization.id}
            precheck={current}
            sourceName={sourceName}
            targetName={targetName}
          />
          {current.blockedAttempts.map((attempt) => (
            <div
              key={attempt.at}
              role="alert"
              className="flex items-start gap-3 rounded-lg bg-danger-bg p-3 text-danger-fg"
            >
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              <div className="flex flex-col gap-0.5">
                <p className="text-body-medium">
                  {t('Blocked: agent tried to change production ({{target}})', {
                    target: attempt.target,
                  })}
                </p>
                <p className="text-small">
                  <span className="font-mono">{attempt.action}</span> · {attempt.reason}
                  {!attempt.confirmed && ` · ${t('Not matched to the audit log yet')}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
