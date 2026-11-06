// 감사 로그 (API 서버 7, echo-was docs/api/audit-logs.md). 쓰는 API 는 없다
import { keepPreviousData, queryOptions, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api, unwrap } from './client';
import { queryKeys } from './query-keys';
import type { AuditActorType } from './types';

const PAGE_SIZE = 50;
const RECENT_SIZE = 3;

export type AuditFilters = { actorType?: AuditActorType; q?: string };

export function useAuditLogs(orgId: string | undefined, filters: AuditFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.auditLogs(orgId ?? '', filters),
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET('/api/v1/orgs/{org_id}/audit-logs', {
          params: {
            path: { org_id: orgId ?? '' },
            query: { ...filters, page: pageParam, size: PAGE_SIZE },
          },
        }),
      ),
    initialPageParam: 0,
    getNextPageParam: (last) =>
      (last.page + 1) * last.size < last.total ? last.page + 1 : undefined,
    enabled: Boolean(orgId),
    placeholderData: keepPreviousData,
    // 방금 한 조작이 바로 보여야 한다(NFR-08). 화면에 들어올 때마다 다시 부른다
    staleTime: 0,
  });
}

/** 대시보드 최근 활동. 에이전트 읽기 줄은 뺀다 */
export const recentActivityQuery = (orgId: string) =>
  queryOptions({
    queryKey: queryKeys.recentActivity(orgId),
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/orgs/{org_id}/audit-logs', {
          params: {
            path: { org_id: orgId },
            query: { includeReads: false, page: 0, size: RECENT_SIZE },
          },
        }),
      ),
    staleTime: 0,
  });

export function useRecentActivity(orgId: string | undefined) {
  return useQuery({ ...recentActivityQuery(orgId ?? ''), enabled: Boolean(orgId) });
}

const SERVICE_ACTIVITY_SIZE = 8;

/** 서비스 화면 오른쪽 최근 활동. 감사 로그에서 대상 이름으로 찾는다(배포 요청 줄도 서비스 이름을 싣는다) */
export function useServiceActivity(orgId: string | undefined, serviceName: string | undefined) {
  return useQuery({
    queryKey: queryKeys.serviceActivity(orgId ?? '', serviceName ?? ''),
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/orgs/{org_id}/audit-logs', {
          params: {
            path: { org_id: orgId ?? '' },
            query: { q: serviceName, includeReads: false, page: 0, size: SERVICE_ACTIVITY_SIZE },
          },
        }),
      ),
    enabled: Boolean(orgId && serviceName),
    staleTime: 0,
  });
}
