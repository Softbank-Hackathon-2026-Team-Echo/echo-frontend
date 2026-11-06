import { Activity, ArrowLeftRight, Boxes, Globe, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { PageHeader } from '@/components/PageHeader';
import { RegisterServiceDialog } from '@/components/RegisterServiceDialog';
import { RoleButton } from '@/components/RoleButton';
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
import { t } from '@/lib/i18n';
import { shortSha } from '@/lib/status';
import { cn } from '@/lib/utils';
import { ServicePanel } from './ServicePanel';

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

/** SVC 서비스: 목록 + 오른쪽 상세 패널 (와이어프레임 v2) */
export default function ServicesPage() {
  const { slug } = useParams();
  const { organization } = useCurrentOrg(slug);
  const orgId = organization?.id;
  const services = useServices(orgId);
  const ids = services.data?.items.map((service) => service.id) ?? [];
  const details = useServiceDetails(orgId, ids);
  const requests = useServicesDeployRequests(orgId, ids);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [registerOpen, setRegisterOpen] = useState(false);
  // 줄을 누르면 상세 화면으로 간다. 오른쪽 패널은 마우스를 올리거나 포커스한 줄을 미리 보인다
  const [previewId, setPreviewId] = useState<string>();
  const selectedId = previewId ?? searchParams.get('service') ?? ids[0];

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
          <div className="grid grid-cols-[1fr_24rem] items-start gap-4 max-wide:grid-cols-1">
            <div className="overflow-hidden rounded-lg border border-line bg-surface">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('Service')}</TableHead>
                    <TableHead>{t('Running on')}</TableHead>
                    <TableHead>{t('Version')}</TableHead>
                    <TableHead>{t('Public URL')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.data.items.map((summary) => {
                    const detail = details.data.find((item) => item.id === summary.id);
                    const serving = detail?.environments.find((link) => link.role === 'SERVING');
                    const selected = summary.id === selectedId;
                    return (
                      <TableRow
                        key={summary.id}
                        aria-selected={selected}
                        className={cn(
                          'cursor-pointer',
                          selected && 'bg-brand-subtle hover:bg-brand-subtle',
                        )}
                        onClick={() => navigate(`/o/${slug}/services/${summary.id}`)}
                        onMouseEnter={() => setPreviewId(summary.id)}
                      >
                        <TableCell>
                          <Link
                            to={`/o/${slug}/services/${summary.id}`}
                            className="text-body-medium hover:underline"
                            onFocus={() => setPreviewId(summary.id)}
                            onClick={(event) => event.stopPropagation()}
                          >
                            {summary.name}
                          </Link>
                          {summary.status === 'DELETING' && (
                            <span className="ml-2 text-caption text-warning-fg">
                              {t('deleting')}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {serving?.environment.name ?? <span className="text-fg-muted">—</span>}
                        </TableCell>
                        <TableCell className="font-mono text-mono">
                          {shortSha(serving?.currentDeployment?.commitSha)}
                        </TableCell>
                        <TableCell className="max-w-56 truncate text-fg-secondary">
                          {summary.url.replace(/^https:\/\//, '')}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {selectedId && (
              <ServicePanel
                orgId={organization.id}
                orgSlug={organization.slug}
                serviceId={selectedId}
              />
            )}
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
