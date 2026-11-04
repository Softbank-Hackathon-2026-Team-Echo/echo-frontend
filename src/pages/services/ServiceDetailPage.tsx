import {
  ArrowRightLeft,
  GitBranch,
  Lock,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { DeployDialog } from '@/components/DeployDialog';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { ExternalLink } from '@/components/ExternalLink';
import { ProviderLabel } from '@/components/ProviderLabel';
import { RoleButton } from '@/components/RoleButton';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useRole } from '@/hooks/useRole';
import { useCurrentOrg } from '@/lib/api/me';
import { useDeleteService, useDeployRequests, useRollback, useService } from '@/lib/api/services';
import type { DeployRequestSummary, ServiceDetail } from '@/lib/api/types';
import { timeAgo } from '@/lib/format';
import { t } from '@/lib/i18n';
import { hasRole } from '@/lib/roles';
import {
  deployErrorLabel,
  deployStatusView,
  deployTriggerLabel,
  envRoleView,
  shortSha,
  teardownErrorLabel,
  versionStatusView,
} from '@/lib/status';
import { EditServiceDialog } from './EditServiceDialog';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-h3">{title}</h2>
      {children}
    </section>
  );
}

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

/** SVC 서비스 상세: 환경별 연결 · 배포 · 이력 */
export default function ServiceDetailPage() {
  const { slug, serviceId } = useParams();
  const navigate = useNavigate();
  const { organization } = useCurrentOrg(slug);
  const role = useRole();
  const {
    data: service,
    isPending,
    isError,
    error,
    refetch,
  } = useService(organization?.id, serviceId);
  const deleteService = useDeleteService(organization?.id ?? '');
  const [deployOpen, setDeployOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isPending || !organization) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const deleting = service.status === 'DELETING';
  const standbys = service.environments.filter((link) => link.role === 'STANDBY');

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-h1">{service.name}</h1>
            {service.simulated && <SimulatedBadge />}
          </div>
          {service.description && <p className="text-body text-fg-muted">{service.description}</p>}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-small text-fg-secondary">
            <a
              href={service.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono hover:underline"
            >
              {service.private && <Lock aria-label={t('Private repository')} className="size-3" />}
              {service.repoUrl.replace(/^https:\/\//, '')}
            </a>
            <span>
              {t('Health')} <span className="font-mono">{service.healthCheckPath}</span> ·{' '}
              {t('port')} <span className="font-mono">{service.containerPort}</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <RoleButton
            requires="DEVELOPER"
            disabledReason={deleting ? t('This service is being deleted') : undefined}
            onClick={() => setDeployOpen(true)}
          >
            {t('Deploy')}
          </RoleButton>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label={t('More actions')}>
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {standbys.map((link) => (
                <DropdownMenuItem
                  key={link.serviceEnvironmentId}
                  disabled={!hasRole(role, 'DEVELOPER') || deleting}
                  onSelect={() =>
                    navigate(
                      `/o/${organization.slug}/evacuation/plan?service=${service.id}&target=${link.environment.id}`,
                    )
                  }
                >
                  <ArrowRightLeft aria-hidden />
                  <span className="flex-1 truncate">
                    {t('Migrate to {{name}}', { name: link.environment.name })}
                  </span>
                  {!hasRole(role, 'DEVELOPER') && (
                    <span className="text-caption text-fg-muted">{t('Developer')}</span>
                  )}
                </DropdownMenuItem>
              ))}
              {standbys.length === 0 && (
                <DropdownMenuItem disabled>
                  <ArrowRightLeft aria-hidden />
                  <span className="flex-1">{t('Migrate to…')}</span>
                  <span className="text-caption text-fg-muted">{t('No standby')}</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!hasRole(role, 'DEVELOPER') || deleting}
                onSelect={() => setEditOpen(true)}
              >
                <Pencil aria-hidden />
                <span className="flex-1">{t('Edit settings')}</span>
                {!hasRole(role, 'DEVELOPER') && (
                  <span className="text-caption text-fg-muted">{t('Developer')}</span>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                disabled={!hasRole(role, 'ADMIN') || deleting}
                onSelect={() => setDeleteOpen(true)}
              >
                <Trash2 aria-hidden />
                <span className="flex-1">{t('Delete service')}</span>
                {!hasRole(role, 'ADMIN') && (
                  <span className="text-caption text-fg-muted">{t('Admin')}</span>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {deleting && (
        <p role="status" className="rounded-md bg-warning-bg px-3 py-2 text-body text-warning-fg">
          {t('This service is being removed from every environment.')}
          {service.deleteError &&
            ` ${t('Last error: {{error}}', { error: teardownErrorLabel(service.deleteError) })}`}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <span className="text-overline uppercase text-fg-muted">{t('Public URL')}</span>
        <ExternalLink href={service.url} className="text-body" />
      </div>

      <Section title={t('Environments')}>
        <EnvironmentLinks service={service} orgSlug={organization.slug} />
      </Section>

      <Section title={t('Deploy history')}>
        <DeployHistory orgId={organization.id} orgSlug={organization.slug} serviceId={service.id} />
      </Section>

      <DeployDialog
        open={deployOpen}
        onOpenChange={setDeployOpen}
        orgId={organization.id}
        orgSlug={organization.slug}
        serviceId={service.id}
        serviceName={service.name}
      />
      <EditServiceDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        orgId={organization.id}
        service={service}
      />
      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        name={service.name}
        title={t('Delete {{name}}?', { name: service.name })}
        description={t(
          'EchoPort removes it from every environment, then deletes it. Deploy history is kept.',
        )}
        pending={deleteService.isPending}
        onConfirm={() =>
          deleteService.mutate(service.id, {
            onSuccess: () => {
              setDeleteOpen(false);
              navigate(`/o/${organization.slug}/services`);
            },
          })
        }
      />
    </>
  );
}
