// 감사 로그 (API 서버 7, echo-was docs/api/audit-logs.md). 쓰는 API 는 없다
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
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
export function useRecentActivity(orgId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.recentActivity(orgId ?? ''),
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/orgs/{org_id}/audit-logs', {
          params: {
            path: { org_id: orgId ?? '' },
            query: { includeReads: false, page: 0, size: RECENT_SIZE },
          },
        }),
      ),
    enabled: Boolean(orgId),
    staleTime: 0,
  });
}
