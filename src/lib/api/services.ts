import {
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api, unwrap } from './client';
import { queryKeys } from './query-keys';
import type {
  CreateDeploy,
  CreateService,
  DeployRequestStatus,
  LogSource,
  ServiceDetail,
  UpdateService,
} from './types';

const PAGE_SIZE = 100;
/** 실시간(SSE)이 생기기 전까지 배포 진행 화면은 2초마다 다시 부른다 (계약 3장) */
export const DEPLOY_POLL_MS = 2_000;

const TERMINAL_STATUSES: readonly DeployRequestStatus[] = ['SUCCEEDED', 'FAILED', 'CANCELLED'];

export function isTerminalStatus(status: DeployRequestStatus | undefined): boolean {
  return status !== undefined && TERMINAL_STATUSES.includes(status);
}

export function useServices(orgId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.services(orgId ?? ''),
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/orgs/{org_id}/services', {
          params: { path: { org_id: orgId ?? '' }, query: { page: 0, size: PAGE_SIZE } },
        }),
      ),
    enabled: Boolean(orgId),
  });
}

/** 상세에는 환경별 연결(역할·트래픽·버전)이 있다. 배포가 진행 중인 연결이 있으면 2초마다 다시 부른다 */
export function useService(orgId: string | undefined, serviceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.service(orgId ?? '', serviceId ?? ''),
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/orgs/{org_id}/services/{service_id}', {
          params: { path: { org_id: orgId ?? '', service_id: serviceId ?? '' } },
        }),
      ),
    enabled: Boolean(orgId && serviceId),
    refetchInterval: (query) =>
      query.state.data?.environments.some((link) => link.activeRequestId || link.queuedRequestId)
        ? DEPLOY_POLL_MS
        : false,
  });
}

/** 여러 서비스의 상세를 한 번에. 대시보드 환경 카드가 환경별 연결(역할·트래픽·버전)을 모을 때 쓴다 */
export function useServiceDetails(orgId: string | undefined, serviceIds: string[]) {
  return useQueries({
    queries: serviceIds.map((serviceId) => ({
      queryKey: queryKeys.service(orgId ?? '', serviceId),
      queryFn: () =>
        unwrap(
          api.GET('/api/v1/orgs/{org_id}/services/{service_id}', {
            params: { path: { org_id: orgId ?? '', service_id: serviceId } },
          }),
        ),
      enabled: Boolean(orgId),
    })),
    combine: (results) => ({
      data: results
        .map((result) => result.data)
        .filter((data): data is ServiceDetail => Boolean(data)),
      isPending: results.some((result) => result.isPending),
    }),
  });
}

/** 여러 서비스의 배포 이력(최근 20개씩). 서비스 목록 위 요약 숫자(오늘 배포 수·평균 배포 시간)에 쓴다 */
export function useServicesDeployRequests(orgId: string | undefined, serviceIds: string[]) {
  return useQueries({
    queries: serviceIds.map((serviceId) => ({
      queryKey: queryKeys.deployRequests(orgId ?? '', serviceId),
      queryFn: () =>
        unwrap(
          api.GET('/api/v1/orgs/{org_id}/services/{service_id}/deploy-requests', {
            params: {
              path: { org_id: orgId ?? '', service_id: serviceId },
              query: { page: 0, size: 20 },
            },
          }),
        ),
      enabled: Boolean(orgId),
    })),
    combine: (results) => results.flatMap((result) => result.data?.items ?? []),
  });
}

export function useCreateService(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateService) =>
      unwrap(
        api.POST('/api/v1/orgs/{org_id}/services', { params: { path: { org_id: orgId } }, body }),
      ),
    // 저장소 접근 오류(설치 안내)·칸 오류는 폼이 보여 준다
    meta: { skipGlobalErrorToast: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.services(orgId) }),
  });
}

/** 설명·저장소·헬스 체크·포트 수정. 바뀐 값은 다음 배포 요청부터 쓴다 */
export function useUpdateService(orgId: string, serviceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateService) =>
      unwrap(
        api.PATCH('/api/v1/orgs/{org_id}/services/{service_id}', {
          params: { path: { org_id: orgId, service_id: serviceId } },
          body,
        }),
      ),
    // 저장소 접근 오류·칸 오류는 폼이 보여 준다
    meta: { skipGlobalErrorToast: true },
    // 목록 키가 상세 키의 앞부분이라 둘 다 다시 불러온다
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.services(orgId) }),
  });
}

export function useDeleteService(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (serviceId: string) =>
      unwrap(
        api.DELETE('/api/v1/orgs/{org_id}/services/{service_id}', {
          params: { path: { org_id: orgId, service_id: serviceId } },
        }),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.services(orgId) }),
  });
}

export function useDeployRequests(orgId: string | undefined, serviceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.deployRequests(orgId ?? '', serviceId ?? ''),
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/orgs/{org_id}/services/{service_id}/deploy-requests', {
          params: {
            path: { org_id: orgId ?? '', service_id: serviceId ?? '' },
            query: { page: 0, size: 20 },
          },
        }),
      ),
    enabled: Boolean(orgId && serviceId),
    refetchInterval: (query) =>
      query.state.data?.items.some((item) => !isTerminalStatus(item.status))
        ? DEPLOY_POLL_MS
        : false,
  });
}

/** 배포 진행 화면. 끝 상태(성공·실패·취소)가 되면 폴링을 멈춘다 */
export function useDeployRequest(orgId: string | undefined, deployRequestId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.deployRequest(orgId ?? '', deployRequestId ?? ''),
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/orgs/{org_id}/deploy-requests/{deploy_request_id}', {
          params: { path: { org_id: orgId ?? '', deploy_request_id: deployRequestId ?? '' } },
        }),
      ),
    enabled: Boolean(orgId && deployRequestId),
    refetchInterval: (query) =>
      isTerminalStatus(query.state.data?.status) ? false : DEPLOY_POLL_MS,
  });
}

export function useCreateDeploy(orgId: string, serviceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateDeploy) =>
      unwrap(
        api.POST('/api/v1/orgs/{org_id}/services/{service_id}/deploy-requests', {
          params: { path: { org_id: orgId, service_id: serviceId } },
          body,
        }),
      ),
    meta: { skipGlobalErrorToast: true },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.service(orgId, serviceId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.deployRequests(orgId, serviceId) }),
      ]),
  });
}

/**
 * 이력에서 고른 예전 성공 배포로 되돌린다(새 빌드 없이 그때 이미지·설정 사본).
 * 이력 행의 `rollbackable` 이 true 일 때만 부른다. 409 문구는 공통 오류 처리가 고른다
 */
export function useRollback(orgId: string, serviceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deployRequestId: string) =>
      unwrap(
        api.POST('/api/v1/orgs/{org_id}/deploy-requests/{deploy_request_id}/rollback', {
          params: { path: { org_id: orgId, deploy_request_id: deployRequestId } },
          body: {},
        }),
      ),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.service(orgId, serviceId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.deployRequests(orgId, serviceId) }),
      ]),
  });
}

const LOG_PAGE_SIZE = 200;

/** 배포 요청 로그 한 종류. 시간 순 커서 페이지이고, 진행 중이면 2초마다 다시 부른다(실시간 전송 없음) */
export function useDeployLogs(
  orgId: string | undefined,
  deployRequestId: string | undefined,
  source: LogSource,
  live: boolean,
) {
  return useInfiniteQuery({
    queryKey: queryKeys.deployLogs(orgId ?? '', deployRequestId ?? '', source),
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET('/api/v1/orgs/{org_id}/deploy-requests/{deploy_request_id}/logs', {
          params: {
            path: { org_id: orgId ?? '', deploy_request_id: deployRequestId ?? '' },
            query: { source, limit: LOG_PAGE_SIZE, ...(pageParam ? { cursor: pageParam } : {}) },
          },
        }),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => (page.hasMore ? (page.nextCursor ?? undefined) : undefined),
    enabled: Boolean(orgId && deployRequestId),
    refetchInterval: live ? DEPLOY_POLL_MS : false,
  });
}
