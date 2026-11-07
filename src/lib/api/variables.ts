// 앱 환경 변수 (API 서버 10, echo-was docs/api/variables.md). 쓰기 전용이라 값은 어떤 응답에도 없다
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from './client';
import { environmentsQuery } from './environments';
import { describeApiError } from './errors';
import { queryKeys } from './query-keys';
import type {
  EnvironmentSummary,
  ServiceDetail,
  ServiceEnvironment,
  ServiceVariable,
} from './types';

export const MAX_VARIABLES = 40;

const KEY_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;

/** 서버 규칙을 먼저 보여 준다. 실제 판단은 서버가 한다 */
export function variableKeyProblem(key: string): 'invalid' | 'reserved' | null {
  if (!KEY_PATTERN.test(key)) return 'invalid';
  return key === 'PORT' || key.startsWith('ECHO_') ? 'reserved' : null;
}

type Target = { orgId: string; serviceId: string; environmentId: string };

const pathOf = ({ orgId, serviceId, environmentId }: Target) => ({
  org_id: orgId,
  service_id: serviceId,
  environment_id: environmentId,
});

const variablesQuery = (target: Target) => ({
  queryKey: queryKeys.serviceVariables(target.orgId, target.serviceId, target.environmentId),
  queryFn: () =>
    unwrap(
      api.GET(
        '/api/v1/orgs/{org_id}/services/{service_id}/environments/{environment_id}/variables',
        { params: { path: pathOf(target) } },
      ),
    ),
});

export function useServiceVariables(target: Target) {
  return useQuery(variablesQuery(target));
}

const LIVE_POLL_MS = 5_000;

type MatrixLink = Pick<
  ServiceEnvironment,
  | 'serviceEnvironmentId'
  | 'environment'
  | 'role'
  | 'currentDeployment'
  | 'activeRequestId'
  | 'queuedRequestId'
>;

/** 아직 배포하지 않은 환경. 서버가 첫 배포 전 변수를 받으면(echo-was #96) 표의 한 칸이 된다 */
const unlinked = (environment: EnvironmentSummary): MatrixLink => ({
  serviceEnvironmentId: `unlinked-${environment.id}`,
  environment: { id: environment.id, name: environment.name, kind: environment.kind },
  role: 'NONE',
  currentDeployment: null,
  activeRequestId: null,
  queuedRequestId: null,
});

/**
 * 환경마다 변수 목록. 연결된 환경은 항상, 연결 전 환경은 서버가 답할 때만 칸이 된다(지금 운영은 404).
 * 배포 중이면 적용 상태가 바뀌니 다시 부른다
 */
export function useVariableMatrix(orgId: string, service: ServiceDetail) {
  const environments = useQuery(environmentsQuery(orgId));
  const linked = new Set(service.environments.map((link) => link.environment.id));
  const links: MatrixLink[] = [
    ...service.environments,
    ...(environments.data?.items ?? []).filter((item) => !linked.has(item.id)).map(unlinked),
  ];
  const deploying = links.some((link) => link.activeRequestId || link.queuedRequestId);
  const results = useQueries({
    queries: links.map((link) => ({
      ...variablesQuery({ orgId, serviceId: service.id, environmentId: link.environment.id }),
      refetchInterval: deploying ? LIVE_POLL_MS : (false as const),
    })),
  });
  const usable = links.flatMap((link, index) => {
    const result = results[index];
    return linked.has(link.environment.id) || result?.isSuccess ? [{ link, result }] : [];
  });
  const connected = usable.filter(({ link }) => linked.has(link.environment.id));
  return {
    columns: usable.map(({ link, result }) => ({
      link,
      items: result?.data?.items ?? ([] as ServiceVariable[]),
    })),
    simulated: usable.some(({ result }) => result?.data?.simulated),
    isPending: connected.some(({ result }) => result?.isPending),
    error: connected.find(({ result }) => result?.error)?.result?.error ?? null,
    refetch: () => Promise.all(results.map((result) => result.refetch())),
  };
}

export type VariableColumn = ReturnType<typeof useVariableMatrix>['columns'][number];

/** 서비스 중 환경에 있는데 이 환경에 없는 키. 이전 보안 통제(C-SEC-1)가 같은 기준으로 막는다 */
export function missingKeys(columns: VariableColumn[], environmentId: string): string[] {
  const serving = columns.find((column) => column.link.role === 'SERVING');
  const target = columns.find((column) => column.link.environment.id === environmentId);
  if (!serving || !target || serving === target) return [];
  const present = new Set(target.items.map((item) => item.key));
  return serving.items.map((item) => item.key).filter((key) => !present.has(key));
}

/** 서비스별 적용 전 변수 수. 목록 · 조직 개요의 카드에 쓴다 */
export function usePendingVariableCounts(orgId: string | undefined, services: ServiceDetail[]) {
  const targets = services.flatMap((service) =>
    service.environments.map((link) => ({
      orgId: orgId ?? '',
      serviceId: service.id,
      environmentId: link.environment.id,
    })),
  );
  const results = useQueries({
    queries: targets.map((target) => ({ ...variablesQuery(target), enabled: Boolean(orgId) })),
  });
  const counts = new Map<string, number>();
  targets.forEach((target, index) => {
    const pending = results[index]?.data?.items.filter((item) => item.pendingRedeploy).length ?? 0;
    counts.set(target.serviceId, (counts.get(target.serviceId) ?? 0) + pending);
  });
  return counts;
}

function useInvalidateVariables({ orgId, serviceId, environmentId }: Target) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.serviceVariables(orgId, serviceId, environmentId),
      }),
      queryClient.invalidateQueries({ queryKey: queryKeys.service(orgId, serviceId) }),
    ]);
}

export function useSaveVariable(target: Target) {
  const invalidate = useInvalidateVariables(target);
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      unwrap(
        api.PUT(
          '/api/v1/orgs/{org_id}/services/{service_id}/environments/{environment_id}/variables/{key}',
          { params: { path: { ...pathOf(target), key } }, body: { value } },
        ),
      ),
    onSuccess: invalidate,
    // 폼이 칸 오류로 보여 준다
    meta: { skipGlobalErrorToast: true },
  });
}

export type VariableWrite = { key: string; value: string; environmentId: string };
export type VariableWriteFailure = VariableWrite & { message: string };

const WRITE_CONCURRENCY = 4;

/**
 * 키 × 환경을 나눠 저장한다. 서버 API 가 키 하나씩이라 일부만 실패할 수 있어, 실패한 줄을 돌려준다.
 * 값은 호출한 쪽 state 에만 있으니 닫을 때 mutation 도 reset 한다
 */
export function useSaveVariables(orgId: string, serviceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (writes: VariableWrite[]) => {
      const failures: VariableWriteFailure[] = [];
      const queue = [...writes];
      const worker = async () => {
        for (let write = queue.shift(); write; write = queue.shift()) {
          const { key, value, environmentId } = write;
          try {
            await unwrap(
              api.PUT(
                '/api/v1/orgs/{org_id}/services/{service_id}/environments/{environment_id}/variables/{key}',
                {
                  params: { path: { ...pathOf({ orgId, serviceId, environmentId }), key } },
                  body: { value },
                },
              ),
            );
          } catch (error) {
            failures.push({ ...write, message: describeApiError(error) });
          }
        }
      };
      await Promise.all(Array.from({ length: WRITE_CONCURRENCY }, worker));
      return failures;
    },
    onSettled: (_failures, _error, writes) =>
      Promise.all([
        ...[...new Set(writes.map((write) => write.environmentId))].map((environmentId) =>
          queryClient.invalidateQueries({
            queryKey: queryKeys.serviceVariables(orgId, serviceId, environmentId),
          }),
        ),
        // 첫 배포 전에 넣으면 서버가 연결을 만든다(echo-was #96). 서비스의 환경 목록도 다시 읽는다
        queryClient.invalidateQueries({ queryKey: queryKeys.service(orgId, serviceId) }),
      ]),
    meta: { skipGlobalErrorToast: true },
  });
}

export type VariableCopy = {
  sourceEnvironmentId: string;
  targetEnvironmentIds: string[];
  keys: string[];
  overwrite: boolean;
};

/** 원본 환경의 키를 다른 환경으로 복사한다(echo-was #100). 값은 서버 안에서만 옮겨지고 요청 · 응답 어디에도 없다 */
export function useCopyVariables(orgId: string, serviceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: VariableCopy) =>
      unwrap(
        api.POST('/api/v1/orgs/{org_id}/services/{service_id}/variables:copy', {
          params: { path: { org_id: orgId, service_id: serviceId } },
          body,
        }),
      ),
    onSettled: (_result, _error, body) =>
      Promise.all([
        ...body.targetEnvironmentIds.map((environmentId) =>
          queryClient.invalidateQueries({
            queryKey: queryKeys.serviceVariables(orgId, serviceId, environmentId),
          }),
        ),
        queryClient.invalidateQueries({ queryKey: queryKeys.service(orgId, serviceId) }),
      ]),
    // 다이얼로그가 오류를 보여 준다
    meta: { skipGlobalErrorToast: true },
  });
}

export function useDeleteVariable(target: Target) {
  const invalidate = useInvalidateVariables(target);
  return useMutation({
    mutationFn: (key: string) =>
      unwrap(
        api.DELETE(
          '/api/v1/orgs/{org_id}/services/{service_id}/environments/{environment_id}/variables/{key}',
          { params: { path: { ...pathOf(target), key } } },
        ),
      ),
    onSettled: invalidate,
  });
}
