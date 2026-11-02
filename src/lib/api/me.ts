import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from './client';
import { queryKeys } from './query-keys';
import type { Organization } from './types';

export function useMe() {
  return useQuery({
    queryKey: queryKeys.me(),
    queryFn: () => unwrap(api.GET('/api/v1/me')),
    staleTime: 60_000,
  });
}

/** 첫 진입 때 갈 조직: 개인 조직 먼저, 없으면 첫 조직 */
export function pickDefaultOrganization(organizations: Organization[]): Organization | undefined {
  return organizations.find((org) => org.personal) ?? organizations[0];
}

/** URL 의 slug 로 현재 조직을 찾는다. API 경로에는 slug 가 아니라 id 를 쓴다 */
export function useCurrentOrg(slug: string | undefined) {
  const me = useMe();
  const organization = me.data?.organizations.find((org) => org.slug === slug);
  return { ...me, organization };
}
