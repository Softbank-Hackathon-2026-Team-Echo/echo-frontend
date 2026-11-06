import { ChevronRight, GitBranch, RotateCcw } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { ExternalLink } from '@/components/ExternalLink';
import { ProviderLabel } from '@/components/ProviderLabel';
import { RoleButton } from '@/components/RoleButton';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCreateDeploy, useDeployRequests, useRollback } from '@/lib/api/services';
import type { DeployRequestSummary, ServiceDetail } from '@/lib/api/types';
import { timeAgo } from '@/lib/format';
import { t } from '@/lib/i18n';
import {
  deployErrorLabel,
  deployStatusView,
  deployTriggerLabel,
  envRoleView,
  shortSha,
  suggestsVariables,
  teardownErrorLabel,
  versionStatusView,
} from '@/lib/status';
import { DeploySteps } from './DeploySteps';

function EnvironmentLinks({ service, orgSlug }: { service: ServiceDetail; orgSlug: string }) {
  if (service.environments.length === 0) {
    return (
      <EmptyState
        icon={GitBranch}
        title={t('Not deployed yet')}
        description={t('Deploy this service to an environment to get a public URL.')}
      />
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('Environment')}</TableHead>
            <TableHead>{t('Role')}</TableHead>
            <TableHead className="text-right">{t('Traffic')}</TableHead>
            <TableHead>{t('Version')}</TableHead>
            <TableHead>URL</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {service.environments.map((link) => {
            const runningId = link.activeRequestId ?? link.queuedRequestId;
            return (
              <TableRow key={link.serviceEnvironmentId}>
                <TableCell>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-body-medium">{link.environment.name}</span>
                    <ProviderLabel kind={link.environment.kind} showLocation={false} />
                  </span>
                </TableCell>
                <TableCell>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge {...envRoleView(link.role)} />
                    {runningId && (
                      <Link
                        to={`/o/${orgSlug}/services/${service.id}/deploys/${runningId}`}
                        className="text-caption text-migrating-fg hover:underline"
                      >
                        {link.activeRequestId ? t('Deploying…') : t('Queued')}
                      </Link>
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono text-mono tabular-nums">
                  {link.trafficWeight}%
                </TableCell>
                <TableCell>
                  <span className="flex flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-mono">
                        {shortSha(link.currentDeployment?.commitSha)}
                      </span>
                      {link.versionStatus && (
                        <StatusBadge {...versionStatusView(link.versionStatus)} />
                      )}
                      {link.simulated && <SimulatedBadge />}
                    </span>
                    {/* 예비 따라가기: 성공하면 걸린 초, 실패하면 그 이유 */}
                    {link.lastSyncError ? (
                      <span className="text-caption text-warning-fg">
                        {t('Standby sync failed: {{reason}}', {
                          reason: deployErrorLabel(link.lastSyncError),
                        })}
                      </span>
                    ) : link.lastSyncSeconds !== null ? (
                      <span className="text-caption text-fg-muted">
                        {t('Synced {{seconds}}s after the source', {
                          seconds: link.lastSyncSeconds,
                        })}
                      </span>
                    ) : null}
                    {link.teardownError && (
                      <span className="text-caption text-danger-fg">
                        {teardownErrorLabel(link.teardownError)}
                      </span>
                    )}
                  </span>
                </TableCell>
                <TableCell className="max-w-72">
                  <ExternalLink href={link.url} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function refLabel(request: DeployRequestSummary) {
  return request.ref.type === 'BRANCH' ? request.ref.value : shortSha(request.ref.value);
}

function DeployHistory({
  orgId,
  orgSlug,
  serviceId,
}: {
  orgId: string;
  orgSlug: string;
  serviceId: string;
}) {
  const navigate = useNavigate();
  const history = useDeployRequests(orgId, serviceId);
  const rollback = useRollback(orgId, serviceId);

  if (history.isError)
    return <ErrorState error={history.error} onRetry={() => history.refetch()} />;
  if (history.isPending) return <Skeleton className="h-32 w-full" />;
  if (history.data.items.length === 0) {
    return <p className="text-body text-fg-muted">{t('No deploys yet.')}</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
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
          {history.data.items.map((request) => (
            <TableRow key={request.id}>
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
                      onClick={() =>
                        rollback.mutate(request.id, {
                          onSuccess: (created) =>
                            navigate(`/o/${orgSlug}/services/${serviceId}/deploys/${created.id}`),
                        })
                      }
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
    </div>
  );
}

/** 가장 최근 배포를 맨 위에 둔다. 실패면 원인과 다음 행동을 같은 자리에 보인다 */
function LatestDeploy({
  orgId,
  orgSlug,
  serviceId,
  request,
}: {
  orgId: string;
  orgSlug: string;
  serviceId: string;
  request: DeployRequestSummary;
}) {
  const navigate = useNavigate();
  const redeploy = useCreateDeploy(orgId, serviceId);
  const failed = request.status === 'FAILED';
  const logs = `/o/${orgSlug}/services/${serviceId}/deploys/${request.id}`;
  return (
    <section
      aria-label={t('Latest deploy')}
      className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2">
          <StatusBadge {...deployStatusView(request.status)} />
          {request.simulated && <SimulatedBadge />}
          <span className="font-mono text-mono">{shortSha(request.commitSha)}</span>
          <span className="text-small text-fg-secondary">
            {request.environment.name} · {timeAgo(request.stageTimes.queuedAt)}
          </span>
        </span>
        <span className="flex items-center gap-2">
          {failed && request.commitSha && (
            <RoleButton
              requires="DEVELOPER"
              variant="outline"
              size="sm"
              disabled={redeploy.isPending}
              onClick={() =>
                redeploy.mutate(
                  {
                    environmentId: request.environment.id,
                    commitSha: request.commitSha ?? '',
                    simulate: null,
                  },
                  {
                    onSuccess: (created) =>
                      navigate(`/o/${orgSlug}/services/${serviceId}/deploys/${created.id}`),
                  },
                )
              }
            >
              {t('Deploy again')}
            </RoleButton>
          )}
          <Button asChild variant="outline" size="sm">
            <Link to={logs}>{t('View logs')}</Link>
          </Button>
        </span>
      </div>
      {failed && (
        <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-body text-danger-fg">
          {request.errorCode ? deployErrorLabel(request.errorCode) : t('The deploy failed.')}{' '}
          {suggestsVariables(request.errorCode) && (
            <>
              {t('Missing environment variables are a common cause.')}{' '}
              <Link to="?tab=variables" className="underline">
                {t('Check environment variables')}
              </Link>
            </>
          )}
        </p>
      )}
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-1 text-small text-fg-secondary">
          <ChevronRight aria-hidden className="size-4 transition-transform group-open:rotate-90" />
          {t('Steps')}
        </summary>
        <DeploySteps request={request} />
      </details>
    </section>
  );
}

/** 배포 탭: 최근 배포 · 환경별 상태 · 이력 */
export function ServiceDeployments({
  orgId,
  orgSlug,
  service,
}: {
  orgId: string;
  orgSlug: string;
  service: ServiceDetail;
}) {
  const history = useDeployRequests(orgId, service.id);
  // 예비 따라가기는 사람이 한 배포 뒤에 자동으로 이어진다. 맨 위에는 사람이 시작한 배포를 둔다
  const items = history.data?.items ?? [];
  const latest = items.find((item) => item.trigger !== 'STANDBY_SYNC') ?? items[0];
  return (
    <div className="flex flex-col gap-6">
      {latest && (
        <LatestDeploy orgId={orgId} orgSlug={orgSlug} serviceId={service.id} request={latest} />
      )}
      <section className="flex flex-col gap-3">
        <h2 className="text-h3">{t('Environments')}</h2>
        <EnvironmentLinks service={service} orgSlug={orgSlug} />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-h3">{t('Deploy history')}</h2>
        <DeployHistory orgId={orgId} orgSlug={orgSlug} serviceId={service.id} />
      </section>
    </div>
  );
}
