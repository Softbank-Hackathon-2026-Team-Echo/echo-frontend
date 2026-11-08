import {
  Activity,
  ArrowLeftRight,
  Boxes,
  ExternalLink as ExternalLinkIcon,
  Globe,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { PageHeader } from '@/components/PageHeader';
import { RegisterServiceDialog } from '@/components/RegisterServiceDialog';
import { RoleButton } from '@/components/RoleButton';
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
import { useCurrentOrg } from '@/lib/api/me';
import { useServiceDetails, useServices, useServicesDeployRequests } from '@/lib/api/services';
import type { DeployRequestSummary, ServiceDetail } from '@/lib/api/types';
import { usePendingVariableCounts } from '@/lib/api/variables';
import { t } from '@/lib/i18n';
import { hasOnpremLink } from '@/lib/onprem-live';
import { deployStatusView, shortSha } from '@/lib/status';
import { OnpremLiveRowBadge } from './OnpremLive';

function StatItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Globe;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center gap-3 px-4 first:pl-0">
      <span className="flex size-9 items-center justify-center rounded-md bg-brand-subtle text-brand-on-subtle">
        <Icon aria-hidden className="size-4" />
      </span>
      <span className="flex flex-col">
        <span className="text-small text-fg-secondary">{label}</span>
        <span className="text-body-medium tabular-nums">{value}</span>
      </span>
    </div>
  );
}

/** 위 요약 숫자 줄: 서비스 수 · 서비스 중인 수 · 오늘 배포 수 · 평균 배포 시간 */
function StatStrip({
  services,
  requests,
}: {
  services: ServiceDetail[];
  requests: DeployRequestSummary[];
}) {
  const servingCount = services.filter((service) =>
    service.environments.some((link) => link.role === 'SERVING'),
  ).length;
  const today = new Date().toDateString();
  const deploysToday = requests.filter(
    (item) => new Date(item.stageTimes.queuedAt).toDateString() === today,
  ).length;
  const durations = requests
    .filter((item) => item.status === 'SUCCEEDED' && item.stageTimes.finishedAt)
    .map(
      (item) =>
        new Date(item.stageTimes.finishedAt ?? '').getTime() -
        new Date(item.stageTimes.queuedAt).getTime(),
    );
  const average = durations.length
    ? durations.reduce((sum, ms) => sum + ms, 0) / durations.length / 1000
    : null;
  const averageText =
    average === null
      ? '—'
      : `${Math.floor(average / 60)}m ${String(Math.round(average % 60)).padStart(2, '0')}s`;
  return (
    <div className="flex divide-x divide-line rounded-lg border border-line bg-surface p-4 max-compact:flex-wrap max-compact:divide-x-0 max-compact:gap-4">
      <StatItem icon={Globe} label={t('Services')} value={services.length} />
      <StatItem
        icon={ArrowLeftRight}
        label={t('Serving')}
        value={`${servingCount} / ${services.length}`}
      />
      <StatItem icon={Activity} label={t('Deploys today')} value={deploysToday} />
      <StatItem icon={ShieldCheck} label={t('Avg deploy time')} value={averageText} />
    </div>
  );
}

/** SVC 서비스 목록. 행을 누르면 서비스 작업 공간으로 간다 */
export default function ServicesPage() {
  const { slug } = useParams();
  const { organization } = useCurrentOrg(slug);
  const orgId = organization?.id;
  const services = useServices(orgId);
  const ids = services.data?.items.map((service) => service.id) ?? [];
  const details = useServiceDetails(orgId, ids);
  const requests = useServicesDeployRequests(orgId, ids);
  const pending = usePendingVariableCounts(orgId, details.data);
  const navigate = useNavigate();
  const [registerOpen, setRegisterOpen] = useState(false);

  const registerButton = (
    <RoleButton requires="DEVELOPER" onClick={() => setRegisterOpen(true)}>
      {t('Deploy new service')}
    </RoleButton>
  );

  return (
    <>
      <PageHeader
        title={t('Services')}
        description={t('Apps deployed by EchoPort and where each one runs.')}
        actions={registerButton}
      />
      {services.isError ? (
        <ErrorState error={services.error} onRetry={() => services.refetch()} />
      ) : services.isPending || !organization ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : services.data.items.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title={t('No services yet')}
          description={t('Connect a GitHub repository, then deploy it to an environment.')}
          action={registerButton}
        />
      ) : (
        <>
          <StatStrip services={details.data} requests={requests} />
          <div className="overflow-hidden rounded-lg border border-line bg-surface">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Service')}</TableHead>
                  <TableHead>{t('Running on')}</TableHead>
                  <TableHead>{t('Latest deploy')}</TableHead>
                  <TableHead>{t('Version')}</TableHead>
                  <TableHead>{t('Public URL')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.data.items.map((summary) => {
                  const detail = details.data.find((item) => item.id === summary.id);
                  const serving = detail?.environments.find((link) => link.role === 'SERVING');
                  const latest = requests.find((item) => item.serviceId === summary.id);
                  const changes = pending.get(summary.id) ?? 0;
                  const to = `/o/${organization.slug}/services/${summary.id}`;
                  return (
                    <TableRow
                      key={summary.id}
                      className="cursor-pointer"
                      onClick={() => navigate(to)}
                    >
                      <TableCell>
                        <Link
                          to={to}
                          className="text-body-medium hover:underline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {summary.name}
                        </Link>
                        {summary.status === 'DELETING' && (
                          <span className="ml-2 text-caption text-warning-fg">{t('deleting')}</span>
                        )}
                        {changes > 0 && (
                          <span className="ml-2 text-caption text-warning-fg">
                            {changes === 1
                              ? t('1 change to apply')
                              : t('{{n}} changes to apply', { n: changes })}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {serving?.environment.name ?? <span className="text-fg-muted">—</span>}
                        {detail && hasOnpremLink(detail) && <OnpremLiveRowBadge />}
                      </TableCell>
                      <TableCell>
                        {latest ? (
                          <StatusBadge {...deployStatusView(latest.status)} />
                        ) : (
                          <span className="text-fg-muted">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-mono">
                        {shortSha(serving?.currentDeployment?.commitSha)}
                      </TableCell>
                      <TableCell>
                        {/* 심사장 화면에 주소가 드러나지 않게 주소 글자 대신 버튼만 보인다(title·툴팁에도 없음) */}
                        {summary.url ? (
                          <Button asChild variant="outline" size="sm">
                            <a
                              href={summary.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={t('Open {{name}} in a new tab', { name: summary.name })}
                              onClick={(event) => event.stopPropagation()}
                            >
                              {t('Open site')}
                              <ExternalLinkIcon aria-hidden />
                            </a>
                          </Button>
                        ) : (
                          <span className="text-fg-muted">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
      {organization && (
        <RegisterServiceDialog
          open={registerOpen}
          onOpenChange={setRegisterOpen}
          orgId={organization.id}
          orgSlug={organization.slug}
        />
      )}
    </>
  );
}
