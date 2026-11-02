import { Server } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useActiveDisasters } from '@/lib/api/disasters';
import { useEnvironments } from '@/lib/api/environments';
import { useCurrentOrg } from '@/lib/api/me';
import { useServiceDetails, useServices } from '@/lib/api/services';
import { EnvironmentCard, type ServiceOnEnvironment } from './EnvironmentCard';

/** S01 대시보드 (1차): 환경 카드로 두 클라우드와 온프레의 상태를 한 화면에. 토폴로지 캔버스는 다음 작업 */
export default function DashboardPage() {
  const { slug } = useParams();
  const { organization } = useCurrentOrg(slug);
  const orgId = organization?.id;
  const environments = useEnvironments(orgId);
  const services = useServices(orgId);
  const details = useServiceDetails(orgId, services.data?.items.map((service) => service.id) ?? []);
  const disasters = useActiveDisasters(orgId);

  const atRisk = new Set(disasters.data?.flatMap((disaster) => disaster.affectedEnvironmentIds));
  const byEnvironment = new Map<string, ServiceOnEnvironment[]>();
  for (const service of details.data) {
    for (const link of service.environments) {
      const list = byEnvironment.get(link.environment.id) ?? [];
      list.push({ service, link });
      byEnvironment.set(link.environment.id, list);
    }
  }
  const servicesPending = services.isPending || details.isPending;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Where each service runs right now, and which environments a disaster would hit."
      />
      {environments.isError ? (
        <ErrorState error={environments.error} onRetry={() => environments.refetch()} />
      ) : environments.isPending || !organization ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-4">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-64" />
          ))}
        </div>
      ) : environments.data.items.length === 0 ? (
        <EmptyState
          icon={Server}
          title="No environments yet"
          description="Add your clusters first. The dashboard shows their state side by side."
          action={
            <Button asChild size="sm">
              <Link to={`/o/${organization.slug}/settings/environments`}>Go to environments</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-4">
          {environments.data.items.map((environment) => (
            <EnvironmentCard
              key={environment.id}
              orgId={organization.id}
              orgSlug={organization.slug}
              environment={environment}
              services={byEnvironment.get(environment.id) ?? []}
              servicesPending={servicesPending}
              atRisk={atRisk.has(environment.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}
