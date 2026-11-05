import type { QueryClient } from '@tanstack/react-query';
import { recentActivityQuery } from './audit';
import { environmentsQuery } from './environments';
import { meQuery } from './me';
import { serviceQuery, servicesQuery } from './services';

/**
 * 대시보드 코드를 받는 동안 첫 화면 데이터를 먼저 부른다. 화면이 뜨면 같은 쿼리를 그대로 쓴다.
 * 실패해도 여기서는 멈출 뿐이고, 화면의 쿼리가 다시 불러 오류를 보여 준다
 */
export async function prefetchDashboard(client: QueryClient, slug: string): Promise<void> {
  await client.prefetchQuery(meQuery);
  const orgId = client
    .getQueryData(meQuery.queryKey)
    ?.organizations.find((org) => org.slug === slug)?.id;
  if (!orgId) return;
  const prefetchServices = async () => {
    await client.prefetchQuery(servicesQuery(orgId));
    const services = client.getQueryData(servicesQuery(orgId).queryKey)?.items ?? [];
    await Promise.all(
      services.map((service) => client.prefetchQuery(serviceQuery(orgId, service.id))),
    );
  };
  await Promise.all([
    client.prefetchQuery(environmentsQuery(orgId)),
    client.prefetchQuery(recentActivityQuery(orgId)),
    prefetchServices(),
  ]);
}
