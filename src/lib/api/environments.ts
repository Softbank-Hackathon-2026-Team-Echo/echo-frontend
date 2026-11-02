import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client';
import { queryKeys } from './query-keys';
import type { EnvironmentDetail, EnvironmentSummary, Page } from './types';

const PAGE_SIZE = 100;

export function useEnvironments(orgId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.environments(orgId ?? ''),
    queryFn: () =>
      apiFetch<Page<EnvironmentSummary>>(`/orgs/${orgId}/environments?page=0&size=${PAGE_SIZE}`),
    enabled: Boolean(orgId),
  });
}

/** 상세는 부를 때 클러스터 정보를 읽는다. 목록에는 clusterInfo 가 없어서 표의 클러스터 칸이 이것을 쓴다 */
export function useEnvironment(orgId: string | undefined, environmentId: string) {
  return useQuery({
    queryKey: queryKeys.environment(orgId ?? '', environmentId),
    queryFn: () => apiFetch<EnvironmentDetail>(`/orgs/${orgId}/environments/${environmentId}`),
    enabled: Boolean(orgId),
  });
}
