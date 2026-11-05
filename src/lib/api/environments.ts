import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from './client';
import { queryKeys } from './query-keys';
import type { CreateEnvironment, UpdateEnvironment } from './types';

const PAGE_SIZE = 100;

export const environmentsQuery = (orgId: string) =>
  queryOptions({
    queryKey: queryKeys.environments(orgId),
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/orgs/{org_id}/environments', {
          params: { path: { org_id: orgId }, query: { page: 0, size: PAGE_SIZE } },
        }),
      ),
  });

export function useEnvironments(orgId: string | undefined) {
  return useQuery({ ...environmentsQuery(orgId ?? ''), enabled: Boolean(orgId) });
}

/** 상세는 부를 때 클러스터 정보를 읽는다. 목록에는 clusterInfo 가 없어서 카드·표의 클러스터 칸이 이것을 쓴다 */
export function useEnvironment(orgId: string | undefined, environmentId: string) {
  return useQuery({
    queryKey: queryKeys.environment(orgId ?? '', environmentId),
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/orgs/{org_id}/environments/{environment_id}', {
          params: { path: { org_id: orgId ?? '', environment_id: environmentId } },
        }),
      ),
    enabled: Boolean(orgId),
  });
}

/** 종류별 등록 양식(configSchema). 새 종류가 서버에 생기면 폼에 저절로 나타난다 */
export function useEnvironmentKinds() {
  return useQuery({
    queryKey: queryKeys.environmentKinds(),
    queryFn: () => unwrap(api.GET('/api/v1/environment-kinds')),
    staleTime: 5 * 60_000,
  });
}

function useInvalidateEnvironments(orgId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.environments(orgId) });
}

export function useCreateEnvironment(orgId: string) {
  const invalidate = useInvalidateEnvironments(orgId);
  return useMutation({
    mutationFn: (body: CreateEnvironment) =>
      unwrap(
        api.POST('/api/v1/orgs/{org_id}/environments', {
          params: { path: { org_id: orgId } },
          body,
        }),
      ),
    // 422 칸 오류는 폼이 보여 주므로 공통 토스트를 띄우지 않는다
    meta: { skipGlobalErrorToast: true },
    onSuccess: invalidate,
  });
}

export function useUpdateEnvironment(orgId: string, environmentId: string) {
  const invalidate = useInvalidateEnvironments(orgId);
  return useMutation({
    mutationFn: (body: UpdateEnvironment) =>
      unwrap(
        api.PATCH('/api/v1/orgs/{org_id}/environments/{environment_id}', {
          params: { path: { org_id: orgId, environment_id: environmentId } },
          body,
        }),
      ),
    meta: { skipGlobalErrorToast: true },
    onSuccess: invalidate,
  });
}

export function useCheckConnection(orgId: string) {
  const invalidate = useInvalidateEnvironments(orgId);
  return useMutation({
    mutationFn: (environmentId: string) =>
      unwrap(
        api.POST('/api/v1/orgs/{org_id}/environments/{environment_id}/connection-check', {
          params: { path: { org_id: orgId, environment_id: environmentId } },
        }),
      ),
    onSettled: invalidate,
  });
}

export function useDeleteEnvironment(orgId: string) {
  const invalidate = useInvalidateEnvironments(orgId);
  return useMutation({
    mutationFn: (environmentId: string) =>
      unwrap(
        api.DELETE('/api/v1/orgs/{org_id}/environments/{environment_id}', {
          params: { path: { org_id: orgId, environment_id: environmentId } },
        }),
      ),
    onSettled: invalidate,
  });
}
