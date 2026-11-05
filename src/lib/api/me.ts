import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from './client';
import { ApiError } from './errors';
import { queryKeys } from './query-keys';
import type { CreateOrganization, Me, Organization } from './types';

/** 앱을 그리기 전에도 미리 부를 수 있게 옵션만 따로 둔다 */
export const meQuery = queryOptions({
  queryKey: queryKeys.me(),
  queryFn: () => unwrap(api.GET('/api/v1/me')),
  staleTime: 60_000,
});

export function useMe() {
  return useQuery(meQuery);
}

/**
 * 로그인했는지만 조용히 본다. 401 이면 로그인 화면으로 보내지 않고 null(로그인 전)을 돌려준다.
 * `/` 처럼 로그인 전에도 보이는 화면에서만 쓴다. 나머지 화면은 useMe 를 쓴다
 */
export function useSession() {
  return useQuery({
    queryKey: queryKeys.session(),
    queryFn: async (): Promise<Me | null> => {
      try {
        return await unwrap(api.GET('/api/v1/me'), { redirectOnUnauthorized: false });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    // 로그인 전 방문자에게 재시도 대기 없이 소개 화면을 바로 보여 준다
    retry: false,
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

/** 조직 만들기. 만든 사람이 어드민이 된다. slug 는 나중에 바꿀 수 없다 */
export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateOrganization) => unwrap(api.POST('/api/v1/orgs', { body })),
    // slug 충돌·형식 오류는 폼이 보여 준다
    meta: { skipGlobalErrorToast: true },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.me() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.session() }),
      ]),
  });
}
