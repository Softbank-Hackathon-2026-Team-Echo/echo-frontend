import { ArrowRight, ChartLine, History } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Panel } from '@/components/Panel';
import { ProviderLabel } from '@/components/ProviderLabel';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useActiveDisasters } from '@/lib/api/disasters';
import { useEnvironments } from '@/lib/api/environments';
import { useCurrentOrg } from '@/lib/api/me';
import { useServiceDetails, useServices } from '@/lib/api/services';
import { envRoleView } from '@/lib/status';
import { ActiveDisasterCard } from './ActiveDisasterCard';
import { KpiTiles } from './KpiTiles';
import { LiveEvents } from './LiveEvents';
import { Topology } from './Topology';
import type { ServiceOnEnvironment } from './types';

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/** S01 대시보드 v2 (조밀 벤토): KPI · 토폴로지 · 재난 · 이벤트 · 요청 그래프 · 환경 · 최근 활동 */
export default function DashboardPage() {
  const { slug } = useParams();
  const { organization } = useCurrentOrg(slug);
  const orgId = organization?.id;
  const environments = useEnvironments(orgId);
  const services = useServices(orgId);
  const details = useServiceDetails(orgId, services.data?.items.map((service) => service.id) ?? []);
  const disasters = useActiveDisasters(orgId);

  if (environments.isError) {
    return <ErrorState error={environments.error} onRetry={() => environments.refetch()} />;
  }
  if (environments.isPending || !organization) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-5 gap-4">
          {[0, 1, 2, 3, 4].map((key) => (
            <Skeleton key={key} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const envList = environments.data.items;
  const names = new Map(envList.map((item) => [item.id, item.name]));
  const active = disasters.data ?? [];
  const latest = active.at(-1);
  const atRisk = new Set(active.flatMap((disaster) => disaster.affectedEnvironmentIds));
  const byEnvironment = new Map<string, ServiceOnEnvironment[]>();
  let serving: ServiceOnEnvironment | undefined;
  for (const service of details.data) {
    for (const link of service.environments) {
      byEnvironment.set(link.environment.id, [
        ...(byEnvironment.get(link.environment.id) ?? []),
        { service, link },
      ]);
      if (!serving && link.role === 'SERVING') serving = { service, link };
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-h1">Dashboard</h1>
        {latest ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-bg px-2.5 py-0.5 text-label text-danger-fg">
            <span aria-hidden className="size-1.5 rounded-full bg-danger-solid" />M
            {latest.magnitude.toFixed(1)} {latest.epicenterLabel} ·{' '}
            {latest.affectedEnvironmentIds.map((id) => names.get(id)).join(', ') || 'nothing'} at
            risk · {clock(latest.startedAt)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-bg px-2.5 py-0.5 text-label text-success-fg">
            <span aria-hidden className="size-1.5 rounded-full bg-success-solid" />
            All systems normal
          </span>
        )}
        <span className="ml-auto text-small text-fg-muted">Last 15 min</span>
        {latest && latest.affectedEnvironmentIds.length > 0 && (
          <Button asChild variant="destructive" size="sm">
            <Link to={`/o/${organization.slug}/evacuation`}>
              View evacuation options <ArrowRight aria-hidden />
            </Link>
          </Button>
        )}
      </div>

      <KpiTiles serving={serving} />

      <div className="grid grid-cols-12 gap-4">
        <Panel title="Topology" className="col-span-8 max-wide:col-span-12">
          <Topology
            environments={envList}
            byEnvironment={byEnvironment}
            atRisk={atRisk}
            edgeUrl={serving?.service.url}
          />
        </Panel>
        <div className="col-span-4 flex flex-col gap-4 max-wide:col-span-12">
          {latest && <ActiveDisasterCard orgId={organization.id} disaster={latest} names={names} />}
          <LiveEvents disasters={active} environments={envList} />
        </div>

        <Panel title="Requests · A vs B" className="col-span-4 max-wide:col-span-12">
          {/* 지표 API(계약 4-2)와 이전 실행이 생기면 원 환경·대상 환경 요청 그래프를 그린다 */}
          <EmptyState
            icon={ChartLine}
            title="No migration running"
            description="Request graphs appear while traffic moves between environments."
          />
        </Panel>
        <Panel title="Environments" className="col-span-4 max-wide:col-span-12">
          <ul className="flex flex-col gap-2">
            {envList.map((environment) => {
              const role = byEnvironment.get(environment.id)?.[0]?.link.role;
              return (
                <li key={environment.id} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <ProviderLabel kind={environment.kind} showLocation={false} />
                    <span className="truncate font-mono text-mono">{environment.name}</span>
                  </span>
                  {atRisk.has(environment.id) ? (
                    <StatusBadge label="At risk" tone="warning" />
                  ) : role ? (
                    <StatusBadge {...envRoleView(role)} />
                  ) : (
                    <StatusBadge label="Idle" tone="neutral" />
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>
        <Panel title="Recent activity" className="col-span-4 max-wide:col-span-12">
          {/* 감사 로그 조회 API(계약 4-8, API 서버 7)가 생기면 size=3 으로 부른다 */}
          <EmptyState
            icon={History}
            title="Activity log is coming"
            description="Approvals, deploys and agent actions will show here."
          />
        </Panel>
      </div>
    </>
  );
}
