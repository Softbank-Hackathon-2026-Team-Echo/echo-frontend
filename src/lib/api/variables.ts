// 앱 환경 변수 (API 서버 10, echo-was docs/api/variables.md). 쓰기 전용이라 값은 어떤 응답에도 없다
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from './client';
import { queryKeys } from './query-keys';

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

export function useServiceVariables(target: Target) {
  return useQuery(variablesQuery(target));
}

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

export type PendingVariable = {
  environmentId: string;
  key: string;
  appliedVersion: number | null;
  version: number;
};

/**
 * 서비스의 모든 환경에서 다음 배포에 반영될 변수(pendingRedeploy). 변경 대기 띠가 쓴다.
 * 같은 키를 변수 탭과 나눠 쓰므로 탭에서 저장하면 띠도 바로 바뀐다
 */
export function usePendingVariables(
  orgId: string | undefined,
  serviceId: string | undefined,
  environmentIds: string[],
) {
  return useQueries({
    queries: environmentIds.map((environmentId) => ({
      ...variablesQuery({ orgId: orgId ?? '', serviceId: serviceId ?? '', environmentId }),
      enabled: Boolean(orgId && serviceId),
    })),
    combine: (results) =>
      results.flatMap((result, index) =>
        (result.data?.items ?? [])
          .filter((item) => item.pendingRedeploy)
          .map(
            (item): PendingVariable => ({
              environmentId: environmentIds[index] ?? '',
              key: item.key,
              appliedVersion: item.appliedVersion,
              version: item.version,
            }),
          ),
      ),
  });
}

function useInvalidateVariables({ orgId, serviceId, environmentId }: Target) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.serviceVariables(orgId, serviceId, environmentId),
      }),
      // 첫 배포 전에 넣으면 서버가 연결을 만든다(echo-was #96). 서비스 상세의 환경 목록도 다시 읽는다
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
