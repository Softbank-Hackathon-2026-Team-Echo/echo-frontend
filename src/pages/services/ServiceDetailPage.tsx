import { ArrowRightLeft, History, Lock, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { DeployDialog } from '@/components/DeployDialog';
import { ErrorState } from '@/components/ErrorState';
import { ExternalLink } from '@/components/ExternalLink';
import { RoleButton } from '@/components/RoleButton';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRole } from '@/hooks/useRole';
import { useCurrentOrg } from '@/lib/api/me';
import { useDeleteService, useService } from '@/lib/api/services';
import { k, t } from '@/lib/i18n';
import { hasRole } from '@/lib/roles';
import { teardownErrorLabel } from '@/lib/status';
import { ApplyChangesBar } from './ApplyChangesBar';
import { EditServiceDialog } from './EditServiceDialog';
import { ServiceActivity } from './ServiceActivity';
import { ServiceDeployments } from './ServiceDeployments';
import { ServiceMigration } from './ServiceMigration';
import { ServiceSettings } from './ServiceSettings';
import { ServiceVariables } from './ServiceVariables';

// 토폴로지 그리기(웹 워커 · React Flow)가 무거워 다른 탭에서는 받지 않는다
const ServiceDashboard = lazy(() =>
  import('@/pages/dashboard/ServiceDashboard').then((m) => ({ default: m.ServiceDashboard })),
);

const TABS = [
  { value: 'overview', label: k('Overview') },
  { value: 'deployments', label: k('Deployments') },
  { value: 'variables', label: k('Variables') },
  { value: 'migration', label: k('Migration') },
  { value: 'settings', label: k('Settings') },
] as const;

type Tab = (typeof TABS)[number]['value'];

const isTab = (value: string | null): value is Tab => TABS.some((tab) => tab.value === value);

/** SVC 서비스 상세: 환경별 연결 · 배포 · 이력 */
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
  const deleteService = useDeleteService(organization?.id ?? '');
  const [deployOpen, setDeployOpen] = useState(false);
  const [deployEnvironmentId, setDeployEnvironmentId] = useState<string>();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const requested = searchParams.get('tab');
  const tab: Tab = isTab(requested) ? requested : 'overview';
  const startDeploy = searchParams.get('deploy') === '1';

  // 서비스를 등록하면 바로 배포로 이어진다
  useEffect(() => {
    if (!startDeploy) return;
    setDeployOpen(true);
    setSearchParams({ tab: 'deployments' }, { replace: true });
  }, [startDeploy, setSearchParams]);

  function openDeploy(environmentId?: string) {
    setDeployEnvironmentId(environmentId);
    setDeployOpen(true);
  }

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
  const deleteReason = deleting ? t('This service is being deleted') : undefined;
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
          <Button variant="outline" onClick={() => setActivityOpen(true)}>
            <History aria-hidden />
            {t('Activity')}
          </Button>
          <RoleButton
            requires="DEVELOPER"
            disabledReason={deleteReason}
            onClick={() => openDeploy()}
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

      <ApplyChangesBar
        orgId={organization.id}
        service={service}
        disabledReason={deleteReason}
        onApplied={() => setSearchParams({ tab: 'deployments' })}
        onChooseRef={openDeploy}
      />

      <Tabs value={tab} onValueChange={(value) => setSearchParams({ tab: value })}>
        <TabsList>
          {TABS.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              {t(item.label)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {tab === 'overview' && (
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <ServiceDashboard organization={organization} service={service} />
        </Suspense>
      )}
      {tab === 'deployments' && (
        <ServiceDeployments orgId={organization.id} orgSlug={organization.slug} service={service} />
      )}
      {tab === 'variables' && (
        <ServiceVariables
          orgId={organization.id}
          service={service}
          disabledReason={deleteReason}
          onDeploy={openDeploy}
        />
      )}
      {tab === 'migration' && (
        <ServiceMigration orgId={organization.id} orgSlug={organization.slug} service={service} />
      )}
      {tab === 'settings' && (
        <ServiceSettings
          service={service}
          disabledReason={deleteReason}
          onEdit={() => setEditOpen(true)}
          onDelete={() => setDeleteOpen(true)}
        />
      )}

      <ServiceActivity
        open={activityOpen}
        onOpenChange={setActivityOpen}
        orgId={organization.id}
        orgSlug={organization.slug}
        service={service}
      />
      <DeployDialog
        key={deployEnvironmentId ?? 'any'}
        open={deployOpen}
        onOpenChange={setDeployOpen}
        orgId={organization.id}
        orgSlug={organization.slug}
        serviceId={service.id}
        serviceName={service.name}
        defaultEnvironmentId={deployEnvironmentId}
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
