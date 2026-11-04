import { Check, CircleAlert, Loader2, Minus, X } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { ErrorState } from '@/components/ErrorState';
import { ExternalLink } from '@/components/ExternalLink';
import { ProviderLabel } from '@/components/ProviderLabel';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { useNow } from '@/hooks/useNow';
import { useCurrentOrg } from '@/lib/api/me';
import {
  isTerminalStatus,
  useDeployRequest,
  useService,
  useStandbySyncs,
} from '@/lib/api/services';
import type { DeployRequestDetail, DeployRequestSummary, ServiceDetail } from '@/lib/api/types';
import { dateTime, elapsed } from '@/lib/format';
import { k, t } from '@/lib/i18n';
import { deployErrorLabel, deployStatusView, deployTriggerLabel, shortSha } from '@/lib/status';
import { cn } from '@/lib/utils';
import { DeployLogs } from './DeployLogs';

type StageState = 'done' | 'current' | 'failed' | 'pending' | 'skipped';

const STAGES = [
  { status: 'QUEUED', label: k('Queued'), at: 'queuedAt' },
  { status: 'BUILDING', label: k('Building'), at: 'buildingAt' },
  { status: 'DEPLOYING', label: k('Deploying'), at: 'deployingAt' },
  { status: 'VERIFYING', label: k('Verifying'), at: 'verifyingAt' },
] as const;

/** 단계별 상태. 실패하면 마지막으로 시작한 단계가 실패 단계다 */
export function stageStates(
  request: Pick<DeployRequestDetail, 'status' | 'stageTimes'>,
): StageState[] {
  const started = STAGES.map((stage) => Boolean(request.stageTimes[stage.at]));
  const lastStarted = started.lastIndexOf(true);
  return STAGES.map((stage, index) => {
    if (request.status === 'SUCCEEDED') return 'done';
    if (!started[index]) return 'pending';
    if (index < lastStarted) return 'done';
    if (request.status === 'FAILED' || request.status === 'CANCELLED') return 'failed';
    return stage.status === request.status ? 'current' : 'done';
  });
}

/**
 * 단계에 걸린 시간. 단계의 끝은 그 뒤로 처음 찍힌 시각이다. 취소·실패로 다음 단계가 없으면 finishedAt 이고,
 * 진행 중이면 찍힌 시각이 없어 지금까지 센다
 */
export function stageDuration(
  times: DeployRequestDetail['stageTimes'],
  index: number,
  now: number,
): string | null {
  const stage = STAGES[index];
  const startedAt = stage && times[stage.at];
  if (!startedAt) return null;
  const later = [...STAGES.slice(index + 1).map((next) => times[next.at]), times.finishedAt];
  return elapsed(startedAt, later.find(Boolean) ?? null, now);
}

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

function StepCircle({ state, index }: { state: StageState; index: number }) {
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
}: {
  request: DeployRequestDetail;
  service: ServiceDetail | undefined;
  syncs: DeployRequestSummary[] | undefined;
  now: number;
  /** 다른 배포 요청 화면 주소를 만든다 (예비 동기화 배포로 가는 링크) */
  requestLink: (deployRequestId: string) => string;
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
          <StepCircle state={step.state} index={index} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-body-medium">{step.label}</span>
            <span
              className={cn(
                'truncate text-caption',
                step.state === 'current' ? 'text-migrating-fg' : 'text-fg-muted',
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

function Outcome({
  request,
  requestLink,
}: {
  request: DeployRequestDetail;
  requestLink: (id: string) => string;
}) {
  if (request.status === 'SUCCEEDED') {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-line bg-success-bg p-4">
        <p className="text-title text-success-fg">{t('Live — health check passed')}</p>
      </div>
    );
  }
  if (request.status === 'FAILED') {
    return (
      <div role="alert" className="flex flex-col gap-1 rounded-lg bg-danger-bg p-4 text-danger-fg">
        <p className="flex items-center gap-2 text-title">
          <CircleAlert aria-hidden className="size-4" />
          {request.errorCode ? deployErrorLabel(request.errorCode) : t('The deploy failed.')}
        </p>
        {request.errorMessage && <p className="text-body">{request.errorMessage}</p>}
        {request.revertStatus === 'SUCCEEDED' && (
          <p className="text-body">{t('The previous version was kept running.')}</p>
        )}
        {request.revertStatus === 'FAILED' && (
          <p className="text-body">{t('Reverting to the previous version also failed.')}</p>
        )}
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
  const syncs = useStandbySyncs(organization?.id, serviceId, request);
  const now = useNow(Boolean(request && !isTerminalStatus(request.status)));

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

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
          to={`/o/${slug}/services?service=${serviceId}`}
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
        request={request}
        requestLink={(id) => `/o/${slug}/services/${serviceId}/deploys/${id}`}
      />

      <div className="grid grid-cols-[1fr_20rem] items-start gap-4 max-wide:grid-cols-1">
        {organization && <DeployLogs orgId={organization.id} request={request} />}
        <UrlCard request={request} />
      </div>
    </>
  );
}
