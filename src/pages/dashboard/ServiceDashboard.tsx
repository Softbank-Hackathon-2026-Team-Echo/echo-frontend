import { ArrowRight } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { Panel } from '@/components/Panel';
import { SharedTrafficNotice } from '@/components/SharedTrafficNotice';
import { Button } from '@/components/ui/button';
import { type Disaster, useActiveDisasters } from '@/lib/api/disasters';
import { useEnvironments } from '@/lib/api/environments';
import { useServiceMetrics } from '@/lib/api/metrics';
import { isActivePlan, useMigrationPlan, useOrgMigrationPlans } from '@/lib/api/migrations';
import type { EnvironmentSummary, Organization, ServiceDetail } from '@/lib/api/types';
import { t } from '@/lib/i18n';
import { currentWeights } from '@/lib/migration-metrics';
import { ActiveDisasterCard } from './ActiveDisasterCard';
import { CompletionCard, recentCompletion } from './CompletionCard';
import { EnvironmentsPanel } from './EnvironmentsPanel';
import { KpiTiles } from './KpiTiles';
import { LiveEvents } from './LiveEvents';
import { LiveMigrationPanel } from './LiveMigrationPanel';
import { MigrationStatusCard } from './MigrationStatusCard';
import { StatusPill } from './StatusPill';
import { Topology } from './Topology';
import type { ServiceOnEnvironment } from './types';

const NO_ENVIRONMENTS: EnvironmentSummary[] = [];
const NO_DISASTERS: Disaster[] = [];

/** 서비스 Overview: 이 서비스의 KPI · 토폴로지 · 이전 진행 · 재난 · 이벤트 · 요청 그래프 */
export function ServiceDashboard({
  organization,
  service,
  observed,
}: {
  organization: Organization;
  service: ServiceDetail;
  /** 온프레 실시간 관측값이 콘솔 등록값과 다를 때만: 트래픽 칸에 보일 환경 · 비율과 주석 1줄 */
  observed?: { name: string; weight: number; note: string };
}) {
  const orgId = organization.id;
  const environments = useEnvironments(orgId);
  const disasters = useActiveDisasters(orgId);
  const ids = useMemo(() => [service.id], [service.id]);
  const plans = useOrgMigrationPlans(orgId, ids);
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
  const { byEnvironment, serving } = useMemo(() => {
    const map = new Map<string, ServiceOnEnvironment[]>();
    for (const link of service.environments) map.set(link.environment.id, [{ service, link }]);
    const servingLink = service.environments.find((link) => link.role === 'SERVING');
    return { byEnvironment: map, serving: servingLink && { service, link: servingLink } };
  }, [service]);
  const metrics = useServiceMetrics(orgId, service.id);
  const metricsStatus = metrics.isError ? 'UNAVAILABLE' : metrics.data?.metricsStatus;
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

  const latest = active.at(-1);
  // 되돌리는 중이면 트래픽은 출발 환경으로 돌아간다
  const receivingId =
    runningPlan.data?.status === 'RUNNING'
      ? runningPlan.data.targetEnvironmentId
      : runningPlan.data?.status === 'ROLLING_BACK'
        ? runningPlan.data.sourceEnvironmentId
        : undefined;
  const completed = recentCompletion(organization.id, plans.data);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
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

      <SharedTrafficNotice orgId={orgId} />

      <KpiTiles
        serving={serving}
        target={migrating}
        observed={observed}
        summary={metrics.data?.summary}
        status={metricsStatus}
        simulated={metrics.data?.simulated}
      />
      {observed && !migrating && (
        <p data-testid="onprem-live-note" className="-mt-2 text-caption text-fg-muted">
          {observed.note}
        </p>
      )}

      <div className="grid grid-cols-12 gap-4">
        <Panel title={t('Topology')} className="col-span-8 max-wide:col-span-12">
          <Topology
            environments={envList}
            byEnvironment={byEnvironment}
            atRisk={atRisk}
            edgeUrl={serving?.service.url}
            receivingId={receivingId}
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
          series={metrics.data?.series}
          metricsStatus={metricsStatus}
          simulated={metrics.data?.simulated}
          className="col-span-6 max-wide:hidden"
        />
        <EnvironmentsPanel
          environments={envList}
          byEnvironment={byEnvironment}
          atRisk={atRisk}
          className="col-span-6 max-wide:hidden"
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
    </div>
  );
}
