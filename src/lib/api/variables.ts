// 앱 환경 변수 (API 서버 10, echo-was docs/api/variables.md). 쓰기 전용이라 값은 어떤 응답에도 없다
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  return useQuery({
    queryKey: queryKeys.serviceVariables(target.orgId, target.serviceId, target.environmentId),
    queryFn: () =>
      unwrap(
        api.GET(
          '/api/v1/orgs/{org_id}/services/{service_id}/environments/{environment_id}/variables',
          { params: { path: pathOf(target) } },
        ),
      ),
  });
}

function useInvalidateVariables({ orgId, serviceId, environmentId }: Target) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.serviceVariables(orgId, serviceId, environmentId),
    });
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
