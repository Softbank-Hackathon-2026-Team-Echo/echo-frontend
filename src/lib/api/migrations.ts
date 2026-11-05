// 이전 계획 (API 서버 8, echo-was docs/api/migration-plans.md). 승인 = 실행 시작이다
import {
  type UseQueryResult,
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { isAwaitingCutover } from '@/lib/migration-metrics';
import { api, unwrap } from './client';
import { queryKeys } from './query-keys';
import type { CreateMigrationPlan, MigrationPlanStatus, MigrationPlanSummary } from './types';

/** 실시간(SSE)이 생기기 전까지 실행 중인 계획은 1초마다 다시 부른다 (단계가 몇 초 단위로 바뀐다) */
export const MIGRATION_POLL_MS = 1_000;

/** 끝난 계획의 컷오버 결과를 기다릴 때 다시 부르는 간격. 서버 캐시가 5초다 */
export const CUTOVER_POLL_MS = 5_000;

const ACTIVE: readonly MigrationPlanStatus[] = ['APPROVED', 'RUNNING', 'ROLLING_BACK'];
const OPEN: readonly MigrationPlanStatus[] = ['PENDING_APPROVAL', ...ACTIVE];

export function isActivePlan(status: MigrationPlanStatus | undefined): boolean {
  return status !== undefined && ACTIVE.includes(status);
}

export function isOpenPlan(status: MigrationPlanStatus | undefined): boolean {
  return status !== undefined && OPEN.includes(status);
}

// 모듈 함수라 참조가 그대로여서 TanStack Query 가 결과가 바뀔 때만 다시 합친다
function combinePlans(results: UseQueryResult<{ items: MigrationPlanSummary[] }>[]) {
  return {
    data: results
      .flatMap((result) => result.data?.items ?? [])
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    isPending: results.some((result) => result.isPending),
    error: results.find((result) => result.error)?.error ?? null,
  };
}

/** 조직 전체 이전 기록(M01). 조직 단위 목록 API 가 없어 서비스마다 목록을 불러 합친다 */
export function useOrgMigrationPlans(orgId: string | undefined, serviceIds: string[]) {
  return useQueries({
    queries: serviceIds.map((serviceId) => ({
      queryKey: queryKeys.migrationPlans(orgId ?? '', serviceId),
      queryFn: () =>
        unwrap(
          api.GET('/api/v1/orgs/{org_id}/services/{service_id}/migration-plans', {
            params: {
              path: { org_id: orgId ?? '', service_id: serviceId },
              query: { page: 0, size: 20 },
            },
          }),
        ),
      enabled: Boolean(orgId),
      // 실행 중인 계획이 있으면 끝나는 순간을 잡으려고 2초마다 다시 부른다(대시보드 완료 카드)
      refetchInterval: (query: { state: { data?: { items: MigrationPlanSummary[] } } }) =>
        query.state.data?.items.some((plan) => isActivePlan(plan.status)) ? 2_000 : false,
    })),
    combine: combinePlans,
  });
}

export function useMigrationPlan(orgId: string | undefined, planId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.migrationPlan(orgId ?? '', planId ?? ''),
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/orgs/{org_id}/migration-plans/{plan_id}', {
          params: { path: { org_id: orgId ?? '', plan_id: planId ?? '' } },
        }),
      ),
    enabled: Boolean(orgId && planId),
    refetchInterval: (query) => {
      const plan = query.state.data;
      if (isActivePlan(plan?.status)) return MIGRATION_POLL_MS;
      return plan && isAwaitingCutover(plan) ? CUTOVER_POLL_MS : false;
    },
  });
}

/** 실행 로그. 시간 순 커서 페이지이고 실행 중이면 계획과 같이 다시 부른다 */
export function useMigrationLogs(
  orgId: string | undefined,
  planId: string | undefined,
  live: boolean,
) {
  return useInfiniteQuery({
    queryKey: queryKeys.migrationLogs(orgId ?? '', planId ?? ''),
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET('/api/v1/orgs/{org_id}/migration-plans/{plan_id}/logs', {
          params: {
            path: { org_id: orgId ?? '', plan_id: planId ?? '' },
            query: { limit: 200, ...(pageParam ? { cursor: pageParam } : {}) },
          },
        }),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => (page.hasMore ? (page.nextCursor ?? undefined) : undefined),
    enabled: Boolean(orgId && planId),
    refetchInterval: live ? MIGRATION_POLL_MS : false,
  });
}

function useInvalidatePlan(orgId: string, serviceId: string) {
  const queryClient = useQueryClient();
  return (planId?: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.migrationPlans(orgId, serviceId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.service(orgId, serviceId) }),
      planId && queryClient.invalidateQueries({ queryKey: queryKeys.migrationPlan(orgId, planId) }),
    ]);
}

export function useCreateMigrationPlan(orgId: string, serviceId: string) {
  const invalidate = useInvalidatePlan(orgId, serviceId);
  return useMutation({
    mutationFn: (body: CreateMigrationPlan) =>
      unwrap(
        api.POST('/api/v1/orgs/{org_id}/services/{service_id}/migration-plans', {
          params: { path: { org_id: orgId, service_id: serviceId } },
          body,
        }),
      ),
    // 422 칸 오류와 409 이유는 화면이 보여 준다
    meta: { skipGlobalErrorToast: true },
    onSuccess: (plan) => invalidate(plan.id),
  });
}

type PlanAction = 'approve' | 'reject' | 'cancel' | 'abort';

/** 승인·거절·취소·중단. 승인하면 바로 실행된다(202). 409(STALE·만료)는 계획을 다시 불러 상태를 보여 준다 */
export function usePlanAction(orgId: string, serviceId: string, action: PlanAction) {
  const invalidate = useInvalidatePlan(orgId, serviceId);
  return useMutation({
    mutationFn: (planId: string) => {
      const params = { params: { path: { org_id: orgId, plan_id: planId } } };
      switch (action) {
        case 'approve':
          return unwrap(
            api.POST('/api/v1/orgs/{org_id}/migration-plans/{plan_id}/approve', params),
          );
        case 'reject':
          return unwrap(api.POST('/api/v1/orgs/{org_id}/migration-plans/{plan_id}/reject', params));
        case 'cancel':
          return unwrap(api.POST('/api/v1/orgs/{org_id}/migration-plans/{plan_id}/cancel', params));
        case 'abort':
          return unwrap(api.POST('/api/v1/orgs/{org_id}/migration-plans/{plan_id}/abort', params));
      }
    },
    onSettled: (_data, _error, planId) => invalidate(planId),
  });
}
