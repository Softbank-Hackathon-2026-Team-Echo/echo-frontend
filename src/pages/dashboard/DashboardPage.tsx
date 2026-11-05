import { ArrowRight } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { ErrorState } from '@/components/ErrorState';
import { Panel } from '@/components/Panel';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { type Disaster, useActiveDisasters } from '@/lib/api/disasters';
import { useEnvironments } from '@/lib/api/environments';
import { useCurrentOrg } from '@/lib/api/me';
import { isActivePlan, useMigrationPlan, useOrgMigrationPlans } from '@/lib/api/migrations';
import { useServiceDetails, useServices } from '@/lib/api/services';
import type { EnvironmentSummary, ServiceDetail } from '@/lib/api/types';
import { t } from '@/lib/i18n';
import { currentWeights } from '@/lib/migration-metrics';
import { onboardingProgress } from '@/lib/onboarding';
import { ActiveDisasterCard } from './ActiveDisasterCard';
import { CompletionCard, recentCompletion } from './CompletionCard';
import { EnvironmentsPanel } from './EnvironmentsPanel';
import { KpiTiles } from './KpiTiles';
import { LiveEvents } from './LiveEvents';
import { LiveMigrationPanel } from './LiveMigrationPanel';
import { MigrationStatusCard } from './MigrationStatusCard';
import { RecentActivity } from './RecentActivity';
import { SetupBanner } from './SetupBanner';
import { StatusPill } from './StatusPill';
import { Topology } from './Topology';
import type { ServiceOnEnvironment } from './types';

const NO_ENVIRONMENTS: EnvironmentSummary[] = [];
const NO_DISASTERS: Disaster[] = [];

/** 환경별 서비스 연결과 첫 번째 서비스 중 연결 */
function linksByEnvironment(services: ServiceDetail[]) {
  const byEnvironment = new Map<string, ServiceOnEnvironment[]>();
  let serving: ServiceOnEnvironment | undefined;
  for (const service of services) {
    for (const link of service.environments) {
      byEnvironment.set(link.environment.id, [
        ...(byEnvironment.get(link.environment.id) ?? []),
        { service, link },
      ]);
      if (!serving && link.role === 'SERVING') serving = { service, link };
    }
  }
  return { byEnvironment, serving };
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
  const plans = useOrgMigrationPlans(
    orgId,
    services.data?.items.map((service) => service.id) ?? [],
  );
  const running = plans.data.find((plan) => isActivePlan(plan.status));
  const runningPlan = useMigrationPlan(orgId, running?.id);

  // 폴링으로 같은 응답이 다시 와도 칸들이 다시 그려지지 않게 넘기는 값의 참조를 유지한다.
  // 쿼리 결과는 응답이 같으면 참조가 그대로라 여기서 새 Map · 객체만 만들지 않으면 된다
  const envList = environments.data?.items ?? NO_ENVIRONMENTS;
  const active = disasters.data ?? NO_DISASTERS;
  const names = useMemo(() => new Map(envList.map((item) => [item.id, item.name])), [envList]);
  const atRisk = useMemo(
    () => new Set(active.flatMap((disaster) => disaster.affectedEnvironmentIds)),
    [active],
  );
  const { byEnvironment, serving } = useMemo(
    () => linksByEnvironment(details.data),
    [details.data],
  );
  const targetWeight = runningPlan.data ? currentWeights(runningPlan.data).target : undefined;
  const targetName = runningPlan.data
    ? (names.get(runningPlan.data.targetEnvironmentId) ?? t('target'))
    : undefined;
  const migrating = useMemo(
    () =>
      targetName !== undefined && targetWeight !== undefined
        ? { name: targetName, weight: targetWeight }
        : undefined,
    [targetName, targetWeight],
  );

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

  const setup = onboardingProgress(envList, details.data);
  const latest = active.at(-1);
  const completed = recentCompletion(organization.id, plans.data);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-h1">{t('Dashboard')}</h1>
        <StatusPill migrating={migrating} disaster={latest} names={names} />
        <span className="ml-auto text-small text-fg-muted max-wide:hidden">{t('Last 15 min')}</span>
        {running && (
          <Button asChild variant="secondary" size="sm" className="max-wide:ml-auto">
            <Link to={`/o/${organization.slug}/migrations/${running.id}`}>
              {t('Open migration')} <ArrowRight aria-hidden />
            </Link>
          </Button>
        )}
        {latest && latest.affectedEnvironmentIds.length > 0 && (
          <Button asChild variant="destructive" size="sm">
            <Link to={`/o/${organization.slug}/evacuation`}>
              {t('View evacuation options')} <ArrowRight aria-hidden />
            </Link>
          </Button>
        )}
      </div>

      {!details.isPending && <SetupBanner orgSlug={organization.slug} progress={setup} />}

      <KpiTiles serving={serving} target={migrating} />

      <div className="grid grid-cols-12 gap-4">
        <Panel title={t('Topology')} className="col-span-8 max-wide:col-span-12">
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
              <ActiveDisasterCard
                orgId={organization.id}
                orgSlug={organization.slug}
                disaster={latest}
                names={names}
              />
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
            <ActiveDisasterCard
              orgId={organization.id}
              orgSlug={organization.slug}
              disaster={latest}
              names={names}
            />
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
        <RecentActivity
          orgId={organization.id}
          orgSlug={organization.slug}
          className="col-span-4 max-wide:hidden"
        />
      </div>
      {completed && (
        <CompletionCard
          key={completed.id}
          orgId={organization.id}
          orgSlug={organization.slug}
          planId={completed.id}
          sourceName={names.get(completed.sourceEnvironmentId) ?? t('source')}
          targetName={names.get(completed.targetEnvironmentId) ?? t('target')}
        />
      )}
    </>
  );
}
