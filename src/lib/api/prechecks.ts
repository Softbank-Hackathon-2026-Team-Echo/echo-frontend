// AI 사전 점검 (echo-was docs/api/prechecks.md). 목록 API 가 없어 화면은 만들 때 받은 id 를 주소에 둔다
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from './client';
import { isApiError } from './errors';
import { queryKeys } from './query-keys';
import type { PrecheckDetail, PrecheckPatch, PrecheckStatus } from './types';

/** 실시간이 생기기 전까지 끝나지 않은 점검은 2초마다 다시 부른다 */
export const PRECHECK_POLL_MS = 2_000;

const LOG_PAGE_SIZE = 500;
const ACTIVE: readonly PrecheckStatus[] = ['QUEUED', 'CLAIMED', 'RUNNING'];

export function isActivePrecheck(status: PrecheckStatus | undefined): boolean {
  return status !== undefined && ACTIVE.includes(status);
}

/**
 * 진단 패치는 샌드박스 반영이 끝난 뒤 서버가 수정 커밋 · PR 을 만들고 나서야 재배포를 잇는다(약 6초).
 * 그 사이에도 다시 불러야 재배포 id 를 놓치지 않는다. 끝없이 기다리지 않게 반영 완료 뒤 이만큼만 기다린다
 */
export const REDEPLOY_LINK_WAIT_MS = 90_000;

type ApplyLink = Pick<
  NonNullable<PrecheckPatch['apply']>,
  'status' | 'finishedAt' | 'redeployRequestId' | 'redeployRejectedCode'
>;

/** 반영은 성공했는데 재배포가 아직 이어지지 않았다 */
export function isAwaitingRedeploy(apply: ApplyLink | null | undefined): boolean {
  return Boolean(
    apply &&
      apply.status === 'SUCCEEDED' &&
      apply.finishedAt &&
      !apply.redeployRequestId &&
      !apply.redeployRejectedCode,
  );
}

/** 재배포를 기다리는 시간이 남았는가. 넘으면 화면이 다시 확인 버튼을 준다 */
export function isRedeployWaitOver(apply: ApplyLink, now = Date.now()): boolean {
  return now - new Date(apply.finishedAt ?? 0).getTime() >= REDEPLOY_LINK_WAIT_MS;
}

function waitingForRedeploy(precheck: PrecheckDetail | undefined): boolean {
  if (precheck?.kind !== 'CHANGE_PROPOSAL') return false;
  return precheck.patches.some(
    (patch) => isAwaitingRedeploy(patch.apply) && !isRedeployWaitOver(patch.apply as ApplyLink),
  );
}

/** 진단 실행이 만든 재배포 id. 패치 하나가 재배포 하나를 만든다 */
export function redeployRequestIdOf(precheck: PrecheckDetail | undefined): string | null {
  return (
    precheck?.patches.find((patch) => patch.apply?.redeployRequestId)?.apply?.redeployRequestId ??
    null
  );
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
    // 승인 뒤 반영 실행은 부모 점검이 끝난 다음에 돈다. 마감(15분)이 있어 끝없이 돌지 않는다
    refetchInterval: (query) => {
      const precheck = query.state.data;
      const applying = precheck?.patches.some((patch) => patch.apply && !patch.apply.finishedAt);
      return isActivePrecheck(precheck?.status) || applying || waitingForRedeploy(precheck)
        ? PRECHECK_POLL_MS
        : false;
    },
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

type PatchDecision = { patch: PrecheckPatch; decision: 'approve' | 'reject' };

/** 패치 승인 · 거절. 서버 반영 스위치가 꺼져 있으면 승인해도 반영 대기로 남는다 */
/** 실패한 배포의 AI 진단을 시작한다. 이미 있으면 서버가 같은 실행을 돌려준다 */
export function useCreateDiagnosis(orgId: string, deployRequestId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/api/v1/orgs/{org_id}/deploy-requests/{deploy_request_id}/diagnosis', {
          params: { path: { org_id: orgId, deploy_request_id: deployRequestId } },
        }),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.deployRequest(orgId, deployRequestId) }),
  });
}

export function usePatchDecision(orgId: string, precheckId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ patch, decision }: PatchDecision) => {
      const path = { org_id: orgId, precheck_id: precheckId, patch_id: patch.id };
      const body = { patchHash: patch.patchHash };
      return unwrap(
        decision === 'approve'
          ? api.POST('/api/v1/orgs/{org_id}/prechecks/{precheck_id}/patches/{patch_id}/approve', {
              params: { path },
              body,
            })
          : api.POST('/api/v1/orgs/{org_id}/prechecks/{precheck_id}/patches/{patch_id}/reject', {
              params: { path },
              body,
            }),
      );
    },
    // 실패해도 다시 불러온다. 다른 사람이 먼저 결정했거나 패치가 바뀌었을 수 있다
    onSettled: () =>
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
