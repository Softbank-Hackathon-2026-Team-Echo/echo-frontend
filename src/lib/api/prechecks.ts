// AI 사전 점검 (echo-was docs/api/prechecks.md). 목록 API 가 없어 화면은 만들 때 받은 id 를 주소에 둔다.
// 패치 승인·거절은 아직 서버에 없다(2차)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from './client';
import { isApiError } from './errors';
import { queryKeys } from './query-keys';
import type { PrecheckDetail, PrecheckStatus } from './types';

/** 실시간이 생기기 전까지 끝나지 않은 점검은 2초마다 다시 부른다 */
export const PRECHECK_POLL_MS = 2_000;

const LOG_PAGE_SIZE = 500;
const ACTIVE: readonly PrecheckStatus[] = ['QUEUED', 'CLAIMED', 'RUNNING'];

export function isActivePrecheck(status: PrecheckStatus | undefined): boolean {
  return status !== undefined && ACTIVE.includes(status);
}

export function usePrecheck(orgId: string | undefined, precheckId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.precheck(orgId ?? '', precheckId ?? ''),
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/orgs/{org_id}/prechecks/{precheck_id}', {
          params: { path: { org_id: orgId ?? '', precheck_id: precheckId ?? '' } },
        }),
      ),
    enabled: Boolean(orgId && precheckId),
    refetchInterval: (query) =>
      isActivePrecheck(query.state.data?.status) ? PRECHECK_POLL_MS : false,
  });
}

/** 점검 하나의 이벤트는 많아야 수십 줄이라 한 번에 받는다 */
export function usePrecheckLogs(
  orgId: string | undefined,
  precheckId: string | undefined,
  live: boolean,
) {
  return useQuery({
    queryKey: queryKeys.precheckLogs(orgId ?? '', precheckId ?? ''),
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/orgs/{org_id}/prechecks/{precheck_id}/logs', {
          params: {
            path: { org_id: orgId ?? '', precheck_id: precheckId ?? '' },
            query: { after: 0, size: LOG_PAGE_SIZE },
          },
        }),
      ),
    enabled: Boolean(orgId && precheckId),
    refetchInterval: live ? PRECHECK_POLL_MS : false,
  });
}

/** 같은 서비스에 열린 점검이 있으면 서버가 409 로 그 id 를 알려 준다 */
function openPrecheckId(error: unknown): string | null {
  if (!isApiError(error) || error.code !== 'PRECHECK_IN_PROGRESS') return null;
  const value = error.details.find((detail) => detail.field === 'runId')?.value;
  return typeof value === 'string' ? value : null;
}

/** 점검을 만들고 id 를 돌려준다. 이미 열린 점검이 있으면 그 점검을 이어서 본다 */
export function useStartPrecheck(orgId: string) {
  return useMutation({
    mutationFn: async (body: { serviceId: string; targetEnvironmentId: string }) => {
      try {
        const created = await unwrap(
          api.POST('/api/v1/orgs/{org_id}/prechecks', {
            params: { path: { org_id: orgId } },
            body,
          }),
        );
        return created.id;
      } catch (error) {
        const openId = openPrecheckId(error);
        if (openId) return openId;
        throw error;
      }
    },
    // 화면이 오류 칸으로 보여 준다
    meta: { skipGlobalErrorToast: true },
  });
}

export function useCancelPrecheck(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (precheckId: string) =>
      unwrap(
        api.POST('/api/v1/orgs/{org_id}/prechecks/{precheck_id}/cancel', {
          params: { path: { org_id: orgId, precheck_id: precheckId } },
        }),
      ),
    onSettled: (_data, _error, precheckId) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.precheck(orgId, precheckId) }),
  });
}

export type DiffLine = { kind: 'context' | 'added' | 'removed'; text: string };

/** 서버 diff 는 통합 형식 문자열이다. 파일 머리줄은 표시에서 뺀다 */
export function parseDiff(diff: string): DiffLine[] {
  return diff
    .split('\n')
    .filter((line) => line && !/^(\+\+\+|---|diff |index )/.test(line))
    .map((line) => {
      if (line.startsWith('+')) return { kind: 'added', text: line.slice(1) };
      if (line.startsWith('-')) return { kind: 'removed', text: line.slice(1) };
      return { kind: 'context', text: line.replace(/^ /, '') };
    });
}

/** 설정 차이 값은 JSON 값이다. 없으면 — */
export function configValue(value: PrecheckDetail['configDiff'][number]['source']): string {
  if (value === undefined || value === null) return '—';
  return typeof value === 'string' ? value : JSON.stringify(value);
}
