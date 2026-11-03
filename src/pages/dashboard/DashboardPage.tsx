import { ArrowRight, History } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Panel } from '@/components/Panel';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useActiveDisasters } from '@/lib/api/disasters';
import { useEnvironments } from '@/lib/api/environments';
import { useCurrentOrg } from '@/lib/api/me';
import { isActivePlan, useMigrationPlan, useOrgMigrationPlans } from '@/lib/api/migrations';
import { useServiceDetails, useServices } from '@/lib/api/services';
import { currentWeights } from '@/lib/migration-metrics';
import { onboardingProgress } from '@/lib/onboarding';
import { ActiveDisasterCard } from './ActiveDisasterCard';
import { CompletionCard, recentCompletion } from './CompletionCard';
import { EnvironmentsPanel } from './EnvironmentsPanel';
import { KpiTiles } from './KpiTiles';
import { LiveEvents } from './LiveEvents';
import { LiveMigrationPanel } from './LiveMigrationPanel';
import { MigrationStatusCard } from './MigrationStatusCard';
import { SetupBanner } from './SetupBanner';
import { StatusPill } from './StatusPill';
import { Topology } from './Topology';
import type { ServiceOnEnvironment } from './types';

/** S01 대시보드 v2 (조밀 벤토): KPI · 토폴로지 · 재난 · 이벤트 · 요청 그래프 · 환경 · 최근 활동 */
export default function DashboardPage() {
  const { slug } = useParams();
  const { organization } = useCurrentOrg(slug);
  const orgId = organization?.id;
  const environments = useEnvironments(orgId);
  const services = useServices(orgId);
  const details = useServiceDetails(orgId, services.data?.items.map((service) => service.id) ?? []);
  const disasters = useActiveDisasters(orgId);
  const plans = useOrgMigrationPlans(
    orgId,
    services.data?.items.map((service) => service.id) ?? [],
  );
  const running = plans.data.find((plan) => isActivePlan(plan.status));
  const runningPlan = useMigrationPlan(orgId, running?.id);

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
  const setup = onboardingProgress(envList, details.data);
  const weights = runningPlan.data ? currentWeights(runningPlan.data) : null;
  const names = new Map(envList.map((item) => [item.id, item.name]));
  const active = disasters.data ?? [];
  const latest = active.at(-1);
  const atRisk = new Set(active.flatMap((disaster) => disaster.affectedEnvironmentIds));
  const completed = recentCompletion(organization.id, plans.data);
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
        <StatusPill
          migrating={
            runningPlan.data && weights
              ? {
                  target: names.get(runningPlan.data.targetEnvironmentId) ?? 'target',
                  weight: weights.target,
                }
              : undefined
          }
          disaster={latest}
          names={names}
        />
        <span className="ml-auto text-small text-fg-muted max-wide:hidden">Last 15 min</span>
        {running && (
          <Button asChild variant="secondary" size="sm" className="max-wide:ml-auto">
            <Link to={`/o/${organization.slug}/migrations/${running.id}`}>
              Open migration <ArrowRight aria-hidden />
            </Link>
          </Button>
        )}
        {latest && latest.affectedEnvironmentIds.length > 0 && (
          <Button asChild variant="destructive" size="sm">
            <Link to={`/o/${organization.slug}/evacuation`}>
              View evacuation options <ArrowRight aria-hidden />
            </Link>
          </Button>
        )}
      </div>

      {!details.isPending && <SetupBanner orgSlug={organization.slug} progress={setup} />}

      <KpiTiles
        serving={serving}
        target={
          runningPlan.data && weights
            ? {
                name: names.get(runningPlan.data.targetEnvironmentId) ?? 'target',
                weight: weights.target,
              }
            : undefined
        }
      />

      <div className="grid grid-cols-12 gap-4">
        <Panel title="Topology" className="col-span-8 max-wide:col-span-12">
          <Topology
            environments={envList}
            byEnvironment={byEnvironment}
            atRisk={atRisk}
            edgeUrl={serving?.service.url}
          />
        </Panel>
        <div className="col-span-4 flex flex-col gap-4 max-wide:col-span-6 max-sm:col-span-12">
          {latest && (
            <div className="max-wide:hidden">
              <ActiveDisasterCard orgId={organization.id} disaster={latest} names={names} />
            </div>
          )}
          <LiveEvents disasters={active} environments={envList} />
        </div>
        {/* 반분할 시연(960): 이벤트 옆 상황 카드 하나. 이전 중 > 재난 > 환경 목록 (Figma 시연 장면 1~3) */}
        <div className="hidden max-wide:col-span-6 max-wide:block max-sm:col-span-12">
          {running ? (
            <MigrationStatusCard
              orgId={organization.id}
              orgSlug={organization.slug}
              planId={running.id}
              names={names}
            />
          ) : latest ? (
            <ActiveDisasterCard orgId={organization.id} disaster={latest} names={names} />
          ) : (
            <EnvironmentsPanel
              environments={envList}
              byEnvironment={byEnvironment}
              atRisk={atRisk}
            />
          )}
        </div>

        <LiveMigrationPanel
          orgId={organization.id}
          orgSlug={organization.slug}
          planId={running?.id}
          names={names}
          className="col-span-4 max-wide:hidden"
        />
        <EnvironmentsPanel
          environments={envList}
          byEnvironment={byEnvironment}
          atRisk={atRisk}
          className="col-span-4 max-wide:hidden"
        />
        <Panel title="Recent activity" className="col-span-4 max-wide:hidden">
          {/* 감사 로그 조회 API(계약 4-8, API 서버 7)가 생기면 size=3 으로 부른다 */}
          <EmptyState
            icon={History}
            title="Activity log is coming"
            description="Approvals, deploys and agent actions will show here."
          />
        </Panel>
      </div>
      {completed && (
        <CompletionCard
          key={completed.id}
          orgId={organization.id}
          orgSlug={organization.slug}
          planId={completed.id}
          sourceName={names.get(completed.sourceEnvironmentId) ?? 'source'}
          targetName={names.get(completed.targetEnvironmentId) ?? 'target'}
        />
      )}
    </>
  );
}
