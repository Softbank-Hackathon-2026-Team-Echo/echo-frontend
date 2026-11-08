import { Check, CircleAlert, Loader2, Minus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { DeployDialog } from '@/components/DeployDialog';
import { ErrorState } from '@/components/ErrorState';
import { ExternalLink } from '@/components/ExternalLink';
import { ProviderLabel } from '@/components/ProviderLabel';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useNow } from '@/hooks/useNow';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useCurrentOrg } from '@/lib/api/me';
import { redeployRequestIdOf, usePrecheck } from '@/lib/api/prechecks';
import {
  isTerminalStatus,
  useDeployRequest,
  useDeployRequests,
  useRollback,
  useService,
  useStandbySyncs,
} from '@/lib/api/services';
import {
  type DeployRequestDetail,
  type DeployRequestSummary,
  deployFailure,
  type LogSource,
  type ServiceDetail,
} from '@/lib/api/types';
import { STAGES, type StageState, stageDuration, stageStates } from '@/lib/deploy-stages';
import { dateTime, elapsed } from '@/lib/format';
import { k, t } from '@/lib/i18n';
import { deployErrorLabel, deployStatusView, deployTriggerLabel, shortSha } from '@/lib/status';
import { cn } from '@/lib/utils';
import { DeployDetailsCard } from './DeployDetailsCard';
import { DeployDiagnosis, type DiagnosisActions } from './DeployDiagnosis';
import { DeployLogs } from './DeployLogs';
import { DeploySteps } from './DeploySteps';
import { RollbackDialog } from './RollbackDialog';
import { StandbyFollowCard } from './StandbyFollowCard';

export { stageDuration, stageStates } from '@/lib/deploy-stages';

const STAGE_ICON: Record<StageState, React.ReactNode> = {
  done: <Check aria-hidden className="size-4" />,
  current: <Loader2 aria-hidden className="size-4 animate-spin" />,
  failed: <X aria-hidden className="size-4" />,
  pending: null,
  skipped: <Minus aria-hidden className="size-4" />,
};

const STAGE_CLASSES: Record<StageState, string> = {
  done: 'bg-success-solid text-fg-on-brand',
  current: 'bg-migrating-solid text-fg-on-brand',
  failed: 'bg-danger-solid text-fg-on-brand',
  pending: 'border border-line-strong bg-surface',
  skipped: 'bg-subtle text-fg-muted',
};

function StepCircle({
  state,
  index,
  stalled,
}: {
  state: StageState;
  index: number;
  stalled?: boolean;
}) {
  // 조회 오류 동안 진행 중 단계는 스피너 대신 멈춘 "확인 지연" 표시로 그린다
  if (stalled && state === 'current') {
    return (
      <span
        role="img"
        aria-label={t('Check delayed')}
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-warning-solid text-fg-on-brand"
      >
        <CircleAlert aria-hidden className="size-4" />
      </span>
    );
  }
  return (
    <span
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-full text-label',
        STAGE_CLASSES[state],
      )}
    >
      {STAGE_ICON[state] ?? <span className="text-fg-muted">{index + 1}</span>}
    </span>
  );
}

/** 가로 스테퍼 (와이어프레임 v2): 큐 · 빌드 · 배포 · 헬스 체크 · Live · 예비 따라가기 */
/**
 * 예비 따라가기 단계. 서비스 중 배포가 성공하면 서버가 같은 빌드로 예비 연결마다 배포 요청(STANDBY_SYNC)을 만든다.
 * 예비가 없으면 건너뛴 것으로, 있으면 몇 곳이 따라갔는지 보여 준다
 */
export function standbyStep(
  request: Pick<DeployRequestDetail, 'status' | 'trigger' | 'serviceEnvironmentId'>,
  service: Pick<ServiceDetail, 'environments'> | undefined,
  syncs: Pick<DeployRequestSummary, 'id' | 'status' | 'environment'>[] | undefined,
): { state: StageState; detail: string; syncingRequestId?: string } {
  if (request.trigger === 'STANDBY_SYNC') {
    const state: StageState =
      request.status === 'SUCCEEDED' ? 'done' : request.status === 'FAILED' ? 'failed' : 'current';
    return { state, detail: t('this deploy is the sync') };
  }
  if (request.status === 'SUCCEEDED') {
    if (!syncs) return { state: 'pending', detail: '—' };
    return syncResult(syncs);
  }
  if (!service) return { state: 'pending', detail: '—' };
  const standbys = service.environments.filter(
    (link) => link.serviceEnvironmentId !== request.serviceEnvironmentId && link.currentDeployment,
  );
  if (standbys.length === 0) return { state: 'skipped', detail: t('no standby environments') };
  if (request.status === 'FAILED' || request.status === 'CANCELLED') {
    return { state: 'pending', detail: t('not triggered') };
  }
  return {
    state: 'pending',
    detail: t('{{count}} standby will follow', { count: standbys.length }),
  };
}

/** 성공한 배포의 예비 칸은 지금 예비 버전이 아니라 그 배포가 만든 따라가기 요청의 결과다 */
function syncResult(syncs: Pick<DeployRequestSummary, 'id' | 'status' | 'environment'>[]) {
  if (syncs.length === 0) {
    return { state: 'skipped' as const, detail: t('no standby followed') };
  }
  const running = syncs.find((sync) => !isTerminalStatus(sync.status));
  if (running) {
    return {
      state: 'current' as const,
      detail: t('syncing {{name}}', { name: running.environment.name }),
      syncingRequestId: running.id,
    };
  }
  const failed = syncs.filter((sync) => sync.status !== 'SUCCEEDED');
  if (failed[0]) {
    return {
      state: 'failed' as const,
      detail: t('{{failed}} of {{total}} standby failed', {
        failed: failed.length,
        total: syncs.length,
      }),
      syncingRequestId: failed[0].id,
    };
  }
  return {
    state: 'done' as const,
    detail: t('{{count}} standby in sync', { count: syncs.length }),
  };
}

function Stepper({
  request,
  service,
  syncs,
  now,
  requestLink,
  stalled = false,
}: {
  request: DeployRequestDetail;
  service: ServiceDetail | undefined;
  syncs: DeployRequestSummary[] | undefined;
  now: number;
  /** 다른 배포 요청 화면 주소를 만든다 (예비 동기화 배포로 가는 링크) */
  requestLink: (deployRequestId: string) => string;
  /** 상태 조회가 실패해 마지막 확인 상태를 보이는 중이면 진행 중 표시를 멈춘다 */
  stalled?: boolean;
}) {
  const standby = standbyStep(request, service, syncs);
  const states = stageStates(request);
  const live: StageState =
    request.status === 'SUCCEEDED' ? 'done' : request.status === 'FAILED' ? 'failed' : 'pending';
  const steps = [
    ...STAGES.map((stage, index) => {
      const state = states[index] ?? 'pending';
      let detail = stageDuration(request.stageTimes, index, now) ?? t('pending');
      if (stage.status === 'BUILDING' && request.build?.reused)
        detail = t('{{elapsed}} · cache reused', { elapsed: detail });
      if (stage.status === 'VERIFYING' && state === 'current') detail = t('health check running');
      return { label: t(stage.label), state, detail };
    }),
    {
      label: t('Live'),
      state: live,
      detail:
        request.status === 'SUCCEEDED'
          ? t('serving')
          : request.status === 'FAILED'
            ? t('not switched')
            : t('pending'),
    },
    {
      // 예비 환경은 서비스 중 배포가 성공하면 서버가 자동으로 따라간다(STANDBY_SYNC)
      label: t('Standby sync'),
      state: standby.state,
      detail: standby.detail,
      href: standby.syncingRequestId,
    },
  ];
  return (
    <ol className="flex items-center gap-2 overflow-x-auto rounded-lg border border-line bg-surface p-4">
      {steps.map((step, index) => (
        <li key={step.label} className="flex min-w-0 flex-1 items-center gap-2">
          <StepCircle state={step.state} index={index} stalled={stalled} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-body-medium">{step.label}</span>
            <span
              className={cn(
                'truncate text-caption',
                step.state !== 'current'
                  ? 'text-fg-muted'
                  : stalled
                    ? 'text-warning-fg'
                    : 'text-migrating-fg',
              )}
            >
              {'href' in step && step.href ? (
                <Link to={requestLink(step.href)} className="underline-offset-2 hover:underline">
                  {step.detail}
                </Link>
              ) : (
                step.detail
              )}
            </span>
          </span>
          {index < steps.length - 1 && (
            <span
              aria-hidden
              className={cn(
                'h-0.5 min-w-4 flex-1 rounded-full',
                step.state === 'done' ? 'bg-success-solid' : 'bg-line',
              )}
            />
          )}
        </li>
      ))}
    </ol>
  );
}

// 취소 이유 (DeployRequestCancelReason)
const CANCEL_REASONS: Record<string, string> = {
  SUPERSEDED: k('Replaced by a newer deploy to the same environment.'),
  SERVICE_DELETED: k('Cancelled because the service was deleted.'),
  BASE_CHANGED: k('Cancelled because another version went live before this rollback started.'),
};

/**
 * 이 배포 전에 같은 환경에서 성공한 배포가 있었나. 없으면 첫 배포라 "이전 버전 유지" 문구가 틀린다(도현 11/6).
 * 이력을 못 불렀으면 null
 */
export function hadPreviousVersion(
  request: Pick<DeployRequestDetail, 'id' | 'serviceEnvironmentId' | 'stageTimes'>,
  history:
    | Pick<DeployRequestSummary, 'id' | 'serviceEnvironmentId' | 'status' | 'stageTimes'>[]
    | undefined,
): boolean | null {
  if (!history) return null;
  const queuedAt = new Date(request.stageTimes.queuedAt).getTime();
  return history.some(
    (item) =>
      item.id !== request.id &&
      item.serviceEnvironmentId === request.serviceEnvironmentId &&
      item.status === 'SUCCEEDED' &&
      new Date(item.stageTimes.queuedAt).getTime() < queuedAt,
  );
}

function Outcome({
  orgId,
  request,
  requestLink,
  hadPrevious,
  actions,
  deploysLink,
}: {
  orgId: string;
  request: DeployRequestDetail;
  requestLink: (id: string) => string;
  hadPrevious: boolean | null;
  actions: DiagnosisActions;
  deploysLink: string;
}) {
  if (request.status === 'SUCCEEDED') {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-line bg-success-bg p-4">
        <p className="text-title text-success-fg">{t('Live — health check passed')}</p>
      </div>
    );
  }
  if (request.status === 'FAILED') {
    const failure = deployFailure(request);
    // 서버가 알려 주면(echo-was #97) 그 값을, 아니면 이력으로 판단한 값을 쓴다
    const previousRunning = failure?.previousVersionRunning ?? hadPrevious;
    const container =
      failure &&
      [
        failure.containerReason,
        failure.exitCode !== null && t('exit code {{code}}', { code: failure.exitCode }),
        failure.restartCount !== null && t('{{count}} restarts', { count: failure.restartCount }),
      ].filter(Boolean);
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
        <div role="alert" className="flex flex-col gap-1 text-danger-fg">
          <p className="flex items-center gap-2 text-title">
            <CircleAlert aria-hidden className="size-4" />
            {request.errorCode ? deployErrorLabel(request.errorCode) : t('The deploy failed.')}
          </p>
          {failure?.message && <p className="text-body">{failure.message}</p>}
          {previousRunning === false ? (
            <p className="text-body">{t('No version is running in this environment yet.')}</p>
          ) : request.revertStatus === 'SUCCEEDED' ? (
            <p className="text-body">{t('The previous version was kept running.')}</p>
          ) : request.revertStatus === 'FAILED' ? (
            <p className="text-body">{t('Reverting to the previous version also failed.')}</p>
          ) : null}
        </div>
        {failure && failure.logTail.length > 0 && (
          <details className="flex flex-col gap-1.5">
            <summary className="cursor-pointer text-small text-fg-secondary">
              {t('Last {{count}} log lines from {{container}}', {
                count: failure.logTail.length,
                container: failure.container ?? t('the container'),
              })}
              {container && container.length > 0 && ` · ${container.join(' · ')}`}
            </summary>
            <pre className="mt-1.5 max-h-64 overflow-auto rounded-md bg-subtle px-3 py-2 font-mono text-mono text-fg">
              {failure.logTail.join('\n')}
              {failure.logTruncated && `\n${t('… earlier lines cut')}`}
            </pre>
          </details>
        )}
        <DeployDiagnosis
          orgId={orgId}
          request={request}
          actions={actions}
          deployLink={requestLink}
          deploysLink={deploysLink}
        />
      </div>
    );
  }
  if (request.status === 'CANCELLED') {
    return (
      <p className="rounded-lg bg-subtle p-4 text-body text-fg-secondary">
        {t(CANCEL_REASONS[request.cancelReason ?? ''] ?? k('This deploy was cancelled.'))}
        {request.supersededById && (
          <>
            {' '}
            <Link to={requestLink(request.supersededById)} className="text-brand hover:underline">
              {t('Open the newer deploy')}
            </Link>
          </>
        )}
      </p>
    );
  }
  return null;
}

function UrlCard({ request }: { request: DeployRequestDetail }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <h2 className="text-title">{t('Public URL')}</h2>
      <ExternalLink href={request.urls.main} />
      <span className="text-caption text-fg-muted">{request.environment.name}</span>
      <ExternalLink href={request.urls.environment} />
    </section>
  );
}

/**
 * AI 진단 패치가 만든 재배포를 실패 화면 안에서 이어 보인다. 원래 실패 · 진단 · 승인 기록은 위에 그대로 두고,
 * 지금 진행 중인 재배포의 단계 · 로그 · 결과를 여기서 따로 그린다
 */
function RedeployFollow({
  orgId,
  redeployRequestId,
  service,
  requestLink,
}: {
  orgId: string;
  redeployRequestId: string;
  service: ServiceDetail | undefined;
  requestLink: (id: string) => string;
}) {
  const {
    data: redeploy,
    isError,
    error,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useDeployRequest(orgId, redeployRequestId);
  const syncs = useStandbySyncs(orgId, service?.id, redeploy);
  const clock = useNow(Boolean(redeploy && !isError && !isTerminalStatus(redeploy.status)));
  // 조회 오류는 배포 실패가 아니다. 마지막 성공 GET 시각까지만 경과 시간을 표시한다.
  const now = isError ? dataUpdatedAt : clock;
  const reduceMotion = usePrefersReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);

  // 승인한 사람이 화면을 옮기지 않아도 재배포가 시작된 것이 보이게 한 번만 내려 준다
  useEffect(() => {
    sectionRef.current?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  }, [reduceMotion]);

  return (
    <section
      ref={sectionRef}
      aria-label={t('Redeploy with the fix')}
      className="flex flex-col gap-4 rounded-lg border border-ai-solid bg-ai-bg p-4"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex flex-wrap items-center gap-2 text-h3">
          {t('Redeploy with the fix')}
          {redeploy && (
            <>
              <span className="font-mono">{shortSha(redeploy.commitSha)}</span>
              <StatusBadge {...deployStatusView(redeploy.status)} />
              <span
                title={isError ? t('Elapsed at last confirmation') : undefined}
                className="font-mono text-mono text-fg-secondary tabular-nums"
              >
                {elapsed(redeploy.stageTimes.queuedAt, redeploy.stageTimes.finishedAt, now)}
              </span>
            </>
          )}
        </h2>
        <Link to={requestLink(redeployRequestId)} className="text-body text-brand hover:underline">
          {t('Open the redeploy')}
        </Link>
      </header>
      {isError && (
        <div aria-busy={isFetching}>
          {/* 캐시가 있으면 경고 문구와 작은 다시 시도 버튼만, 큰 ErrorState 는 최초 실패(캐시 없음)에만 둔다 */}
          {redeploy ? (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div role="alert" className="text-body text-warning-fg">
                <p>{t('Status check delayed. Showing the last confirmed state.')}</p>
                <p>
                  <time dateTime={new Date(dataUpdatedAt).toISOString()}>
                    {t('Last confirmed at {{time}}. Elapsed time is frozen.', {
                      time: dateTime(new Date(dataUpdatedAt).toISOString()),
                    })}
                  </time>
                </p>
                <p>{t('Logs will reappear when status checking recovers.')}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => !isFetching && refetch()}>
                {t('Retry')}
              </Button>
            </div>
          ) : (
            <ErrorState error={error} onRetry={() => !isFetching && refetch()} />
          )}
        </div>
      )}
      {redeploy ? (
        <>
          <Stepper
            request={redeploy}
            service={service}
            syncs={syncs.data}
            now={now}
            requestLink={requestLink}
            stalled={isError}
          />
          {redeploy.status === 'SUCCEEDED' && (
            <p className="text-body text-success-fg">
              {t('The fix is live. The health check passed.')}
            </p>
          )}
          {(redeploy.status === 'FAILED' || redeploy.status === 'CANCELLED') && (
            <p className="text-body text-danger-fg">
              {redeploy.errorCode
                ? deployErrorLabel(redeploy.errorCode)
                : t('The redeploy did not finish.')}
            </p>
          )}
          <DeploySteps request={redeploy} now={now} stalled={isError} />
          {/* 로그 상태는 유지하되 조회 오류 중에는 Live 수신으로 오인하지 않게 가린다. */}
          <div hidden={isError}>
            <DeployLogs
              key={redeploy.id}
              orgId={orgId}
              request={redeploy}
              defaultSource="DEPLOY_JOB"
            />
          </div>
        </>
      ) : !isError ? (
        <Skeleton className="h-16 w-full" />
      ) : null}
    </section>
  );
}

/** SVC 배포 진행: 가로 스테퍼 · 로그 · 공개 주소. 실시간이 생기기 전까지 2초 폴링 */
export default function DeployProgressPage() {
  const { slug, serviceId, deployRequestId } = useParams();
  const { organization } = useCurrentOrg(slug);
  const service = useService(organization?.id, serviceId);
  const {
    data: request,
    isPending,
    isError,
    error,
    refetch,
  } = useDeployRequest(organization?.id, deployRequestId);
  // 진단 패치가 재배포를 만들면 그 id 를 받아 같은 화면에서 잇는다
  const diagnosisRun = usePrecheck(organization?.id, request?.diagnosis?.runId ?? undefined);
  const redeployRequestId = redeployRequestIdOf(diagnosisRun.data);
  const syncs = useStandbySyncs(organization?.id, serviceId, request);
  const history = useDeployRequests(organization?.id, serviceId);
  const rollback = useRollback(organization?.id ?? '', serviceId ?? '');
  const navigate = useNavigate();
  const now = useNow(Boolean(request && !isTerminalStatus(request.status)));
  const [logSource, setLogSource] = useState<LogSource>('DEPLOY_JOB');
  const [rollbackTarget, setRollbackTarget] = useState<DeployRequestSummary>();
  const [deployOpen, setDeployOpen] = useState(false);

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const servicePage = `/o/${slug}/services/${serviceId}`;
  // 같은 환경에서 되돌릴 수 있는 가장 최근 성공 배포 (이력은 최신순)
  const lastGood = history.data?.items.find(
    (item) => item.rollbackable && item.serviceEnvironmentId === request.serviceEnvironmentId,
  );
  const actions: DiagnosisActions = {
    run: (fix) => {
      if (fix === 'OPEN_VARIABLES')
        navigate(`${servicePage}?tab=variables&env=${request.environment.id}`);
      else if (fix === 'OPEN_SETTINGS') navigate(`${servicePage}?tab=settings`);
      else if (fix === 'ROLLBACK') setRollbackTarget(lastGood);
      else if (fix === 'REDEPLOY') setDeployOpen(true);
      else {
        setLogSource('BUILD');
        document.getElementById('deploy-logs')?.scrollIntoView({ behavior: 'smooth' });
      }
    },
    unavailable: lastGood ? [] : ['ROLLBACK'],
  };

  const refText = request.ref.type === 'BRANCH' ? request.ref.value : shortSha(request.ref.value);
  const serviceName = service.data?.name ?? t('service');
  const heading = isTerminalStatus(request.status)
    ? t('Deploy {{service}}', { service: serviceName })
    : t('Deploying {{service}}', { service: serviceName });

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="flex flex-wrap items-center gap-2 text-h1">
            {heading} <span className="font-mono">{shortSha(request.commitSha)}</span>
            <StatusBadge {...deployStatusView(request.status)} />
            {request.simulated && <SimulatedBadge />}
          </h1>
          <p className="flex flex-wrap items-center gap-x-2 text-body text-fg-secondary">
            <ProviderLabel kind={request.environment.kind} showLocation={false} />
            <span>{request.environment.name}</span>·
            <span>{t('from {{ref}}', { ref: refText })}</span>·
            <span>{t('started {{time}}', { time: dateTime(request.stageTimes.queuedAt) })}</span>·
            {request.trigger === 'ROLLBACK' && request.rollbackOfRequestId ? (
              <Link
                to={`/o/${slug}/services/${serviceId}/deploys/${request.rollbackOfRequestId}`}
                className="text-brand hover:underline"
              >
                {t('rollback of {{sha}}', { sha: shortSha(request.commitSha) })}
              </Link>
            ) : (
              <span>{deployTriggerLabel(request.trigger).toLowerCase()}</span>
            )}
            ·
            <span className="font-mono tabular-nums">
              {elapsed(request.stageTimes.queuedAt, request.stageTimes.finishedAt, now)}
            </span>
          </p>
        </div>
        <Link
          to={`/o/${slug}/services/${serviceId}?tab=deployments`}
          className="text-body text-brand hover:underline"
        >
          {t('Back to services')}
        </Link>
      </div>

      <Stepper
        request={request}
        service={service.data}
        syncs={syncs.data}
        now={now}
        requestLink={(id) => `/o/${slug}/services/${serviceId}/deploys/${id}`}
      />
      <Outcome
        orgId={organization?.id ?? ''}
        request={request}
        requestLink={(id) => `/o/${slug}/services/${serviceId}/deploys/${id}`}
        hadPrevious={hadPreviousVersion(request, history.data?.items)}
        actions={actions}
        deploysLink={`/o/${slug}/services/${serviceId}?tab=deployments`}
      />

      {organization && redeployRequestId && (
        <RedeployFollow
          orgId={organization.id}
          redeployRequestId={redeployRequestId}
          service={service.data}
          requestLink={(id) => `/o/${slug}/services/${serviceId}/deploys/${id}`}
        />
      )}
      {redeployRequestId && (
        <h2 className="text-title text-fg-secondary">
          {t('Original deploy {{sha}}', { sha: shortSha(request.commitSha) })}
        </h2>
      )}

      <div className="grid grid-cols-[1fr_20rem] items-start gap-4 max-wide:grid-cols-1">
        <div className="flex min-w-0 flex-col gap-4">
          <DeploySteps request={request} now={now} />
          {organization && (
            <DeployLogs
              key={logSource}
              orgId={organization.id}
              request={request}
              defaultSource={logSource}
            />
          )}
        </div>
        <div className="flex flex-col gap-4">
          <UrlCard request={request} />
          <DeployDetailsCard request={request} service={service.data} />
          {organization && (
            <StandbyFollowCard
              orgId={organization.id}
              request={request}
              syncs={syncs.data}
              requestLink={(id) => `/o/${slug}/services/${serviceId}/deploys/${id}`}
            />
          )}
        </div>
      </div>

      <RollbackDialog
        target={rollbackTarget}
        onOpenChange={(open) => !open && setRollbackTarget(undefined)}
        pending={rollback.isPending}
        onConfirm={(target) =>
          rollback.mutate(target.id, {
            onSuccess: (created) => {
              setRollbackTarget(undefined);
              navigate(`${servicePage}/deploys/${created.id}`);
            },
          })
        }
      />
      {organization && service.data && (
        <DeployDialog
          open={deployOpen}
          onOpenChange={setDeployOpen}
          orgId={organization.id}
          orgSlug={organization.slug}
          serviceId={service.data.id}
          serviceName={service.data.name}
          defaultEnvironmentId={request.environment.id}
        />
      )}
    </>
  );
}
