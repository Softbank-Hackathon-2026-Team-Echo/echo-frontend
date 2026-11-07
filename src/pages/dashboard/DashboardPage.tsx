import { ArrowRight, Boxes } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { type Disaster, useActiveDisasters } from '@/lib/api/disasters';
import { useEnvironments } from '@/lib/api/environments';
import { useCurrentOrg } from '@/lib/api/me';
import { isActivePlan, useMigrationPlan, useOrgMigrationPlans } from '@/lib/api/migrations';
import { useServiceDetails, useServices, useServicesDeployRequests } from '@/lib/api/services';
import type { EnvironmentSummary, ServiceDetail } from '@/lib/api/types';
import { usePendingVariableCounts } from '@/lib/api/variables';
import { t } from '@/lib/i18n';
import { currentWeights } from '@/lib/migration-metrics';
import { onboardingProgress } from '@/lib/onboarding';
import { ActiveDisasterCard } from './ActiveDisasterCard';
import { AiResidencyPanel } from './AiResidencyPanel';
import { CloudCostPanel } from './CloudCostPanel';
import { CompletionCard, recentCompletion } from './CompletionCard';
import { DemoRestoreButton } from './DemoRestoreDialog';
import { EnvironmentsPanel } from './EnvironmentsPanel';
import { RecentActivity } from './RecentActivity';
import { ServiceCard } from './ServiceCard';
import { SetupBanner } from './SetupBanner';
import { StatusPill } from './StatusPill';
import type { ServiceOnEnvironment } from './types';

const NO_ENVIRONMENTS: EnvironmentSummary[] = [];
const NO_DISASTERS: Disaster[] = [];

function linksByEnvironment(services: ServiceDetail[]) {
  const byEnvironment = new Map<string, ServiceOnEnvironment[]>();
  for (const service of services) {
    for (const link of service.environments) {
      byEnvironment.set(link.environment.id, [
        ...(byEnvironment.get(link.environment.id) ?? []),
        { service, link },
      ]);
    }
  }
  return byEnvironment;
}

/** S01 조직 개요: 서비스를 고르는 곳. 서비스 지표와 토폴로지는 서비스 Overview 에 있다 */
export default function DashboardPage() {
  const { slug } = useParams();
  const { organization } = useCurrentOrg(slug);
  const orgId = organization?.id;
  const environments = useEnvironments(orgId);
  const services = useServices(orgId);
  const ids = services.data?.items.map((service) => service.id) ?? [];
  const details = useServiceDetails(orgId, ids);
  const requests = useServicesDeployRequests(orgId, ids);
  const pending = usePendingVariableCounts(orgId, details.data);
  const disasters = useActiveDisasters(orgId);
  const plans = useOrgMigrationPlans(orgId, ids);
  const running = plans.data.find((plan) => isActivePlan(plan.status));
  const runningPlan = useMigrationPlan(orgId, running?.id);

  const envList = environments.data?.items ?? NO_ENVIRONMENTS;
  const active = disasters.data ?? NO_DISASTERS;
  const names = useMemo(() => new Map(envList.map((item) => [item.id, item.name])), [envList]);
  const atRisk = useMemo(
    () => new Set(active.flatMap((disaster) => disaster.affectedEnvironmentIds)),
    [active],
  );
  const byEnvironment = useMemo(() => linksByEnvironment(details.data), [details.data]);
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
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
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
        {running && (
          <Button asChild variant="secondary" size="sm" className="ml-auto">
            <Link to={`/o/${organization.slug}/migrations/${running.id}`}>
              {t('Open migration')} <ArrowRight aria-hidden />
            </Link>
          </Button>
        )}
        <span className={running ? undefined : 'ml-auto'}>
          <DemoRestoreButton orgId={organization.id} />
        </span>
        {latest && latest.affectedEnvironmentIds.length > 0 && (
          <Button asChild variant="destructive" size="sm">
            <Link to={`/o/${organization.slug}/evacuation`}>
              {t('View evacuation options')} <ArrowRight aria-hidden />
            </Link>
          </Button>
        )}
      </div>

      {!details.isPending && <SetupBanner orgSlug={organization.slug} progress={setup} />}

      {latest && (
        <ActiveDisasterCard
          orgId={organization.id}
          orgSlug={organization.slug}
          disaster={latest}
          names={names}
        />
      )}

      <section aria-label={t('Services')} className="flex flex-col gap-3">
        <h2 className="text-h3">{t('Services')}</h2>
        {services.isError ? (
          <ErrorState error={services.error} onRetry={() => services.refetch()} />
        ) : services.isPending ? (
          <Skeleton className="h-32" />
        ) : details.data.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title={t('No services yet')}
            description={t('Connect a GitHub repository, then deploy it to an environment.')}
            action={
              <Button asChild>
                <Link to={`/o/${organization.slug}/services`}>{t('Open services')}</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-3 gap-4 max-wide:grid-cols-2 max-sm:grid-cols-1">
            {details.data.map((service) => (
              <ServiceCard
                key={service.id}
                orgSlug={organization.slug}
                service={service}
                latest={requests.find((item) => item.serviceId === service.id)}
                changes={pending.get(service.id) ?? 0}
                migrating={plans.data.some(
                  (plan) => plan.serviceId === service.id && isActivePlan(plan.status),
                )}
                atRisk={service.environments.some(
                  (link) => link.role === 'SERVING' && atRisk.has(link.environment.id),
                )}
              />
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-12 gap-4">
        <EnvironmentsPanel
          environments={envList}
          byEnvironment={byEnvironment}
          atRisk={atRisk}
          className="col-span-6 max-wide:col-span-12"
        />
        <RecentActivity
          orgId={organization.id}
          orgSlug={organization.slug}
          className="col-span-6 max-wide:col-span-12"
        />
        <CloudCostPanel orgId={organization.id} className="col-span-6 max-wide:col-span-12" />
        <AiResidencyPanel orgId={organization.id} className="col-span-6 max-wide:col-span-12" />
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
