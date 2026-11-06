import {
  ArrowRightLeft,
  GitBranch,
  KeyRound,
  Lock,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { DeployDialog } from '@/components/DeployDialog';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { ExternalLink } from '@/components/ExternalLink';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRole } from '@/hooks/useRole';
import { useCurrentOrg } from '@/lib/api/me';
import { useDeleteService, useDeployRequests, useRollback, useService } from '@/lib/api/services';
import type { DeployRequestSummary } from '@/lib/api/types';
import { timeAgo } from '@/lib/format';
import { k, t } from '@/lib/i18n';
import { hasRole } from '@/lib/roles';
import { deployStatusView, deployTriggerLabel, shortSha, teardownErrorLabel } from '@/lib/status';
import { ActiveDeployments } from './ActiveDeployments';
import { EditServiceDialog } from './EditServiceDialog';
import { PendingChangesBar } from './PendingChangesBar';
import { RollbackDialog } from './RollbackDialog';
import { ServiceActivity } from './ServiceActivity';
import { ServiceMetrics } from './ServiceMetrics';
import { ServiceSettings } from './ServiceSettings';
import { ServiceVariables } from './ServiceVariables';

// 탭은 주소 ?tab= 에 둔다. 배포 진행 화면의 AI 진단이 ?tab=variables 로 바로 연다
const TABS = [
  { value: 'deployments', label: k('Deployments') },
  { value: 'variables', label: k('Variables') },
  { value: 'metrics', label: k('Metrics') },
  { value: 'settings', label: k('Settings') },
] as const;
type TabValue = (typeof TABS)[number]['value'];
const ALL_ENVIRONMENTS = 'all';

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

/**
 * SVC 서비스 상세 (Railway 구성). 맨 위 환경별 지금 배포 카드, 아래 탭(배포 · 변수 · 지표 · 설정),
 * 오른쪽에 최근 활동. 환경 고르기는 ?env, 탭은 ?tab 이라 다른 화면이 바로 열 수 있다
 */
export default function ServiceDetailPage() {
  const { slug, serviceId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { organization } = useCurrentOrg(slug);
  const role = useRole();
  const {
    data: service,
    isPending,
    isError,
    error,
    refetch,
  } = useService(organization?.id, serviceId);
  const history = useDeployRequests(organization?.id, serviceId);
  const deleteService = useDeleteService(organization?.id ?? '');
  // undefined = 닫힘, '' = 환경을 고르지 않고 열림
  const [deployEnvironment, setDeployEnvironment] = useState<string>();
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
  const deletingReason = deleting ? t('This service is being deleted') : undefined;
  const standbys = service.environments.filter((link) => link.role === 'STANDBY');
  const tabParam = searchParams.get('tab');
  const tab: TabValue = TABS.some((item) => item.value === tabParam)
    ? (tabParam as TabValue)
    : 'deployments';
  const envParam = searchParams.get('env');
  const selectedEnvironment = service.environments.find((link) => link.environment.id === envParam)
    ?.environment.id;
  const setParam = (key: string, value: string | undefined) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

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
            <ExternalLink href={service.url} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {service.environments.length > 0 && (
            <Select
              value={selectedEnvironment ?? ALL_ENVIRONMENTS}
              onValueChange={(value) =>
                setParam('env', value === ALL_ENVIRONMENTS ? undefined : value)
              }
            >
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
          )}
          <Button variant="outline" onClick={() => setParam('tab', 'variables')}>
            <KeyRound aria-hidden />
            {t('Environment variables')}
          </Button>
          <RoleButton
            requires="DEVELOPER"
            disabledReason={deletingReason}
            onClick={() => setDeployEnvironment(selectedEnvironment ?? '')}
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

      <PendingChangesBar
        orgId={organization.id}
        service={service}
        disabledReason={deletingReason}
        onDeploy={setDeployEnvironment}
      />

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
          orgSlug={organization.slug}
          selectedEnvironmentId={selectedEnvironment}
        />
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_20rem] items-start gap-6 max-wide:grid-cols-1">
        <div className="flex min-w-0 flex-col gap-4">
          <Tabs
            value={tab}
            onValueChange={(value) => setParam('tab', value === 'deployments' ? undefined : value)}
          >
            <TabsList>
              {TABS.map((item) => (
                <TabsTrigger key={item.value} value={item.value}>
                  {t(item.label)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {tab === 'deployments' && (
            <DeployHistory
              orgId={organization.id}
              orgSlug={organization.slug}
              serviceId={service.id}
              environmentId={selectedEnvironment}
            />
          )}
          {tab === 'variables' && (
            <ServiceVariables
              orgId={organization.id}
              service={service}
              disabledReason={deletingReason}
              onDeploy={setDeployEnvironment}
              environmentId={selectedEnvironment}
              onEnvironmentChange={(id) => setParam('env', id)}
            />
          )}
          {tab === 'metrics' && (
            <ServiceMetrics
              orgId={organization.id}
              service={service}
              history={history.data?.items}
            />
          )}
          {tab === 'settings' && (
            <ServiceSettings
              orgId={organization.id}
              service={service}
              disabledReason={deletingReason}
              onEdit={() => setEditOpen(true)}
            />
          )}
        </div>
        <ServiceActivity
          orgId={organization.id}
          orgSlug={organization.slug}
          serviceName={service.name}
        />
      </div>

      <DeployDialog
        key={deployEnvironment ?? 'closed'}
        open={deployEnvironment !== undefined}
        onOpenChange={(open) => !open && setDeployEnvironment(undefined)}
        orgId={organization.id}
        orgSlug={organization.slug}
        serviceId={service.id}
        serviceName={service.name}
        defaultEnvironmentId={deployEnvironment || undefined}
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
