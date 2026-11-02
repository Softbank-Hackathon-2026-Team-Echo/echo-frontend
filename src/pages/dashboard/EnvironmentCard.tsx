import { TriangleAlert } from 'lucide-react';
import { Link } from 'react-router';
import { ProviderLabel } from '@/components/ProviderLabel';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { useEnvironment } from '@/lib/api/environments';
import type { EnvironmentSummary, ServiceDetail, ServiceEnvironment } from '@/lib/api/types';
import { connectionStatusView, envRoleView, shortSha, versionStatusView } from '@/lib/status';
import { cn } from '@/lib/utils';

export type ServiceOnEnvironment = { service: ServiceDetail; link: ServiceEnvironment };

/** 예비 연결의 DR 상태. 지금은 Warm 만 있다(같은 버전으로 떠 있는 예비). Hot·복제 지연은 API 가 생기면 */
function standbyLabel(link: ServiceEnvironment): string | null {
  if (link.role !== 'STANDBY') return null;
  return link.versionStatus === 'IN_SYNC' ? 'Warm standby' : 'Standby (behind)';
}

type EnvironmentCardProps = {
  orgId: string;
  orgSlug: string;
  environment: EnvironmentSummary;
  services: ServiceOnEnvironment[];
  servicesPending: boolean;
  atRisk: boolean;
};

/** S01 환경 카드: 클라우드 · 위치 · 클러스터 버전 · 서비스별 역할·트래픽·버전 · 재난 위험 */
export function EnvironmentCard({
  orgId,
  orgSlug,
  environment,
  services,
  servicesPending,
  atRisk,
}: EnvironmentCardProps) {
  const detail = useEnvironment(orgId, environment.id);
  const clusterInfo = detail.data?.clusterInfo;
  const traffic = services.reduce((sum, item) => sum + item.link.trafficWeight, 0);

  return (
    <article
      className={cn(
        'flex flex-col gap-4 rounded-lg border bg-surface p-4 shadow-xs',
        atRisk ? 'border-danger-solid' : 'border-line',
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="truncate text-title">{environment.name}</h3>
          <ProviderLabel kind={environment.kind} location={environment.location} />
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge {...connectionStatusView(environment.connectionStatus)} />
          {atRisk && (
            <span className="inline-flex items-center gap-1 rounded-sm bg-danger-bg px-2 py-0.5 text-label text-danger-fg">
              <TriangleAlert aria-hidden className="size-3" />
              At risk
            </span>
          )}
        </div>
      </header>

      <dl className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-0.5">
          <dt className="text-overline uppercase text-fg-muted">Cluster</dt>
          <dd className="font-mono text-mono">
            {detail.isPending ? (
              <Skeleton className="h-4 w-16" />
            ) : (
              (clusterInfo?.serverVersion ?? '—')
            )}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-overline uppercase text-fg-muted">Nodes</dt>
          <dd className="flex items-center gap-1.5 font-mono text-mono">
            {detail.isPending ? <Skeleton className="h-4 w-8" /> : (clusterInfo?.nodeCount ?? '—')}
            {clusterInfo?.simulated && <SimulatedBadge />}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-overline uppercase text-fg-muted">Traffic</dt>
          <dd className="text-metric tabular-nums">{servicesPending ? '—' : `${traffic}%`}</dd>
        </div>
      </dl>

      <div className="flex flex-col gap-1.5">
        <span className="text-overline uppercase text-fg-muted">Services</span>
        {servicesPending ? (
          <Skeleton className="h-8 w-full" />
        ) : services.length === 0 ? (
          <p className="text-small text-fg-muted">No services here yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {services.map(({ service, link }) => (
              <li key={link.serviceEnvironmentId} className="flex flex-col gap-1 py-1.5">
                <span className="flex items-center justify-between gap-2">
                  <Link
                    to={`/o/${orgSlug}/services/${service.id}`}
                    className="truncate text-body-medium hover:underline"
                  >
                    {service.name}
                  </Link>
                  <span className="font-mono text-mono tabular-nums">{link.trafficWeight}%</span>
                </span>
                <span className="flex flex-wrap items-center gap-1.5 text-caption text-fg-muted">
                  <StatusBadge {...envRoleView(link.role)} />
                  <span className="font-mono">{shortSha(link.currentDeployment?.commitSha)}</span>
                  {link.versionStatus && <StatusBadge {...versionStatusView(link.versionStatus)} />}
                  {standbyLabel(link) && <span>{standbyLabel(link)}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="text-caption text-fg-muted">
        Replication lag — <span className="sr-only">not available yet</span>
      </footer>
    </article>
  );
}
