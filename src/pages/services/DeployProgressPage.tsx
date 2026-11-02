import { Check, CircleAlert, Loader2, ScrollText, X } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { ExternalLink } from '@/components/ExternalLink';
import { ProviderLabel } from '@/components/ProviderLabel';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { useNow } from '@/hooks/useNow';
import { useCurrentOrg } from '@/lib/api/me';
import { isTerminalStatus, useDeployRequest } from '@/lib/api/services';
import type { DeployRequestDetail } from '@/lib/api/types';
import { dateTime, elapsed } from '@/lib/format';
import { deployErrorLabel, deployStatusView, shortSha } from '@/lib/status';
import { cn } from '@/lib/utils';

type StageState = 'done' | 'current' | 'failed' | 'pending';

const STAGES = [
  { status: 'QUEUED', label: 'Queued', at: 'queuedAt' },
  { status: 'BUILDING', label: 'Build', at: 'buildingAt' },
  { status: 'DEPLOYING', label: 'Deploy', at: 'deployingAt' },
  { status: 'VERIFYING', label: 'Health check', at: 'verifyingAt' },
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

const STAGE_ICON: Record<StageState, React.ReactNode> = {
  done: <Check aria-hidden className="size-3.5" />,
  current: <Loader2 aria-hidden className="size-3.5 animate-spin" />,
  failed: <X aria-hidden className="size-3.5" />,
  pending: null,
};

const STAGE_CLASSES: Record<StageState, string> = {
  done: 'bg-success-solid text-fg-on-brand',
  current: 'bg-migrating-solid text-fg-on-brand',
  failed: 'bg-danger-solid text-fg-on-brand',
  pending: 'border border-line-strong bg-surface',
};

function Stepper({ request, now }: { request: DeployRequestDetail; now: number }) {
  const states = stageStates(request);
  const times = request.stageTimes;
  const ends = [times.buildingAt, times.deployingAt, times.verifyingAt, times.finishedAt];
  return (
    <ol className="grid grid-cols-4 gap-2 max-compact:grid-cols-2">
      {STAGES.map((stage, index) => {
        const state = states[index] ?? 'pending';
        const startedAt = times[stage.at];
        return (
          <li
            key={stage.status}
            className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3"
          >
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full',
                  STAGE_CLASSES[state],
                )}
              >
                {STAGE_ICON[state]}
              </span>
              <span className="text-title">{stage.label}</span>
              {stage.status === 'BUILDING' && request.build?.reused && (
                <span className="rounded-xs bg-subtle px-1.5 text-caption text-fg-muted">
                  reused
                </span>
              )}
            </span>
            <span className="font-mono text-mono text-fg-muted tabular-nums">
              {startedAt ? elapsed(startedAt, ends[index] ?? null, now) : '—'}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Outcome({ request }: { request: DeployRequestDetail }) {
  if (request.status === 'SUCCEEDED') {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-line bg-success-bg p-4">
        <p className="text-title text-success-fg">Live — health check passed</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-body">
          <dt className="text-fg-secondary">Public URL</dt>
          <dd className="min-w-0">
            <ExternalLink href={request.urls.main} />
          </dd>
          <dt className="text-fg-secondary">{request.environment.name}</dt>
          <dd className="min-w-0">
            <ExternalLink href={request.urls.environment} />
          </dd>
        </dl>
      </div>
    );
  }
  if (request.status === 'FAILED') {
    return (
      <div role="alert" className="flex flex-col gap-1 rounded-lg bg-danger-bg p-4 text-danger-fg">
        <p className="flex items-center gap-2 text-title">
          <CircleAlert aria-hidden className="size-4" />
          {request.errorCode ? deployErrorLabel(request.errorCode) : 'The deploy failed.'}
        </p>
        {request.errorMessage && <p className="text-body">{request.errorMessage}</p>}
        {request.revertStatus === 'SUCCEEDED' && (
          <p className="text-body">The previous version was kept running.</p>
        )}
        {request.revertStatus === 'FAILED' && (
          <p className="text-body">Reverting to the previous version also failed.</p>
        )}
      </div>
    );
  }
  if (request.status === 'CANCELLED') {
    return (
      <p className="rounded-lg bg-subtle p-4 text-body text-fg-secondary">
        {request.cancelReason === 'SUPERSEDED'
          ? 'Replaced by a newer deploy to the same environment.'
          : 'Cancelled because the service was deleted.'}
      </p>
    );
  }
  return null;
}

/** SVC 배포 진행: 단계 · 결과 · 주소. 실시간이 생기기 전까지 2초 폴링 */
export default function DeployProgressPage() {
  const { slug, serviceId, deployRequestId } = useParams();
  const { organization } = useCurrentOrg(slug);
  const {
    data: request,
    isPending,
    isError,
    error,
    refetch,
  } = useDeployRequest(organization?.id, deployRequestId);
  const now = useNow(Boolean(request && !isTerminalStatus(request.status)));

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const refText = request.ref.type === 'BRANCH' ? request.ref.value : shortSha(request.ref.value);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="flex flex-wrap items-center gap-2 text-h1">
            Deploy to {request.environment.name}
            <StatusBadge {...deployStatusView(request.status)} />
            {request.simulated && <SimulatedBadge />}
          </h1>
          <p className="flex flex-wrap items-center gap-x-3 text-body text-fg-secondary">
            <ProviderLabel kind={request.environment.kind} showLocation={false} />
            <span>
              <span className="font-mono">{refText}</span> →{' '}
              <span className="font-mono">{shortSha(request.commitSha)}</span>
            </span>
            <span>Started {dateTime(request.stageTimes.queuedAt)}</span>
            <span className="font-mono tabular-nums">
              Total {elapsed(request.stageTimes.queuedAt, request.stageTimes.finishedAt, now)}
            </span>
          </p>
        </div>
        <Link
          to={`/o/${slug}/services/${serviceId}`}
          className="text-body text-brand hover:underline"
        >
          Back to service
        </Link>
      </div>

      <Stepper request={request} now={now} />
      <Outcome request={request} />

      <section className="flex flex-col gap-3">
        <h2 className="text-h3">Logs</h2>
        {/* 배포 로그 API 는 API 서버 4 예정 (계약 §2 SVC 배포 로그 🆕) */}
        <EmptyState
          icon={ScrollText}
          title="Logs are not available yet"
          description="Build and deploy logs will appear here once the API provides them."
        />
      </section>
    </>
  );
}
