import { GitBranch, Loader2, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { RoleButton } from '@/components/RoleButton';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useDeployRequests, useRollback } from '@/lib/api/services';
import type { DeployRequestSummary, ServiceDetail } from '@/lib/api/types';
import { timeAgo } from '@/lib/format';
import { t } from '@/lib/i18n';
import { deployStatusView, deployTriggerLabel, shortSha } from '@/lib/status';
import { ActiveDeployments } from './ActiveDeployments';
import { FOLLOW_POLL_MS, findNewDeploy, SINCE_PARAM } from './follow-redeploy';
import { RollbackDialog } from './RollbackDialog';

const ALL_ENVIRONMENTS = 'all';

/** 승인 뒤 목록에서 새 배포를 기다리는 시간. 실측 승인 → 재배포 접수 약 1분이라 넉넉히 둔다 */
const SINCE_WAIT_MS = 5 * 60_000;

function refLabel(request: DeployRequestSummary) {
  return request.ref.type === 'BRANCH' ? request.ref.value : shortSha(request.ref.value);
}

function DeployHistory({
  orgId,
  orgSlug,
  serviceId,
  environmentId,
}: {
  orgId: string;
  orgSlug: string;
  serviceId: string;
  environmentId: string | undefined;
}) {
  const navigate = useNavigate();
  const history = useDeployRequests(orgId, serviceId);
  const rollback = useRollback(orgId, serviceId);
  const [target, setTarget] = useState<DeployRequestSummary>();
  // 진단 패치 승인 뒤 새 배포를 못 찾고 넘어왔으면 그 시각 뒤 배포를 강조하고, 생기면 상세로 옮긴다
  const [searchParams] = useSearchParams();
  const since = searchParams.get(SINCE_PARAM);
  const sinceMs = since ? new Date(since).getTime() : Number.NaN;
  const freshId = since && history.data ? findNewDeploy(history.data.items, since)?.id : undefined;
  const waiting = Boolean(since) && !freshId && Date.now() - sinceMs < SINCE_WAIT_MS;
  const { refetch } = history;
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => void refetch(), FOLLOW_POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, refetch]);
  useEffect(() => {
    if (freshId)
      navigate(`/o/${orgSlug}/services/${serviceId}/deploys/${freshId}`, { replace: true });
  }, [freshId, navigate, orgSlug, serviceId]);

  if (history.isError)
    return <ErrorState error={history.error} onRetry={() => history.refetch()} />;
  if (history.isPending) return <Skeleton className="h-32 w-full" />;
  const items = environmentId
    ? history.data.items.filter((item) => item.environment.id === environmentId)
    : history.data.items;
  if (items.length === 0) {
    return <p className="text-body text-fg-muted">{t('No deploys yet.')}</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      {waiting && (
        <p
          role="status"
          className="flex items-center gap-2 border-b border-line bg-ai-bg px-4 py-2 text-small text-ai-fg"
        >
          <Loader2 aria-hidden className="size-3.5 animate-spin" />
          {t('Waiting for the redeploy with the fix. Its page opens when it starts.')}
        </p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('Started')}</TableHead>
            <TableHead>{t('Environment')}</TableHead>
            <TableHead>{t('Ref')}</TableHead>
            <TableHead>{t('Commit')}</TableHead>
            <TableHead>{t('Status')}</TableHead>
            <TableHead className="w-0">
              <span className="sr-only">{t('Actions')}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((request) => (
            <TableRow
              key={request.id}
              data-highlighted={
                new Date(request.stageTimes.queuedAt).getTime() >= sinceMs || undefined
              }
              className="data-[highlighted]:bg-ai-bg"
            >
              <TableCell className="text-fg-secondary">
                {timeAgo(request.stageTimes.queuedAt)}
              </TableCell>
              <TableCell>
                <span className="flex flex-col gap-0.5">
                  {request.environment.name}
                  {request.trigger !== 'MANUAL' && (
                    <span className="text-caption text-fg-muted">
                      {deployTriggerLabel(request.trigger)}
                    </span>
                  )}
                </span>
              </TableCell>
              <TableCell className="font-mono text-mono">{refLabel(request)}</TableCell>
              <TableCell className="font-mono text-mono">{shortSha(request.commitSha)}</TableCell>
              <TableCell>
                <span className="flex items-center gap-1.5">
                  <StatusBadge {...deployStatusView(request.status)} />
                  {request.isCurrent && <StatusBadge label={t('Current')} tone="success" />}
                  {request.simulated && <SimulatedBadge />}
                </span>
              </TableCell>
              <TableCell>
                <span className="flex items-center justify-end gap-1">
                  <Button asChild variant="ghost" size="sm">
                    <Link to={`/o/${orgSlug}/services/${serviceId}/deploys/${request.id}`}>
                      {t('View')}
                    </Link>
                  </Button>
                  {/* 서버가 되돌릴 수 있다고 한 행(성공 · 현재 아님 · 연결 살아 있음)에만 단다 */}
                  {request.rollbackable && (
                    <RoleButton
                      requires="DEVELOPER"
                      variant="ghost"
                      size="sm"
                      disabled={rollback.isPending}
                      onClick={() => setTarget(request)}
                    >
                      <RotateCcw aria-hidden />
                      {t('Roll back')}
                    </RoleButton>
                  )}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <RollbackDialog
        target={target}
        onOpenChange={(open) => !open && setTarget(undefined)}
        pending={rollback.isPending}
        onConfirm={(request) =>
          rollback.mutate(request.id, {
            onSuccess: (created) => {
              setTarget(undefined);
              navigate(`/o/${orgSlug}/services/${serviceId}/deploys/${created.id}`);
            },
          })
        }
      />
    </div>
  );
}

/** 배포 탭: 환경마다 지금 배포 카드 · 이력. 환경을 고르면 주소 env 에 남는다 */
export function ServiceDeployments({
  orgId,
  orgSlug,
  service,
}: {
  orgId: string;
  orgSlug: string;
  service: ServiceDetail;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const history = useDeployRequests(orgId, service.id);
  const requested = searchParams.get('env') ?? undefined;
  const selected = service.environments.some((link) => link.environment.id === requested)
    ? requested
    : undefined;

  function pick(value: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === ALL_ENVIRONMENTS) next.delete('env');
        else next.set('env', value);
        return next;
      },
      { replace: true },
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {service.environments.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title={t('Not deployed yet')}
          description={t('Deploy this service to an environment to get a public URL.')}
        />
      ) : (
        <ActiveDeployments
          service={service}
          history={history.data?.items}
          orgSlug={orgSlug}
          selectedEnvironmentId={selected}
        />
      )}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-h3">{t('Deploy history')}</h2>
          <Select value={selected ?? ALL_ENVIRONMENTS} onValueChange={pick}>
            <SelectTrigger className="w-44" aria-label={t('Environment')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ENVIRONMENTS}>{t('All environments')}</SelectItem>
              {service.environments.map((link) => (
                <SelectItem key={link.serviceEnvironmentId} value={link.environment.id}>
                  {link.environment.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DeployHistory
          orgId={orgId}
          orgSlug={orgSlug}
          serviceId={service.id}
          environmentId={selected}
        />
      </section>
    </div>
  );
}
