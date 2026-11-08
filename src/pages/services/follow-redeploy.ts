// 진단 패치를 승인한 뒤 새 재배포 요청을 찾아 그 배포 상세로 옮긴다.
// 실측(2026-11-08): 승인 → 수정 커밋 · PR 58초 → 빌드 87초 → 성공 163초. 그래서 승인 응답에는 재배포 id 가 대개 없다
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { api, unwrap } from '@/lib/api/client';
import { redeployRequestIdOf } from '@/lib/api/prechecks';
import { queryKeys } from '@/lib/api/query-keys';
import { isTerminalStatus } from '@/lib/api/services';
import type { DeployRequestSummary, PrecheckPatch } from '@/lib/api/types';

/** 승인 뒤 재배포 id 를 찾는 간격과 횟수. 넘으면 서비스 배포 목록으로 옮겨 거기서 기다린다 */
export const FOLLOW_POLL_MS = 2_000;
export const FOLLOW_TRIES = 10;

/** 배포 목록 주소에 붙이는 표시. 이 시각 뒤에 생긴 배포를 강조하고, 생기면 상세로 옮긴다 */
export const SINCE_PARAM = 'since';

/** 승인 시각(서버 시각) 뒤에 생긴, 아직 끝나지 않은 배포 중 가장 최근 것 */
export function findNewDeploy(
  items: readonly DeployRequestSummary[],
  since: string,
  excludeId?: string,
): DeployRequestSummary | undefined {
  const sinceMs = new Date(since).getTime();
  return items
    .filter(
      (item) =>
        item.id !== excludeId &&
        !isTerminalStatus(item.status) &&
        new Date(item.stageTimes.queuedAt).getTime() >= sinceMs,
    )
    .sort(
      (a, b) =>
        new Date(b.stageTimes.queuedAt).getTime() - new Date(a.stageTimes.queuedAt).getTime(),
    )[0];
}

/**
 * 재배포 id 를 찾을 때까지 lookup 을 tries 번 다시 부른다. 찾으면 id, 못 찾으면 null.
 * 첫 시도 전에는 기다리지 않는다. stopped 가 참이면 그 자리에서 멈춘다
 */
export async function followRedeploy({
  lookup,
  sleep,
  tries = FOLLOW_TRIES,
  stopped = () => false,
}: {
  lookup: () => Promise<string | null>;
  sleep: () => Promise<void>;
  tries?: number;
  stopped?: () => boolean;
}): Promise<string | null> {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    if (attempt > 0) await sleep();
    if (stopped()) return null;
    try {
      const id = await lookup();
      if (id) return id;
    } catch {
      // 한 번 못 읽어도 다음 시도에서 다시 본다
    }
  }
  return null;
}

/** 승인 응답 시각. 서버가 주는 decidedAt 을 쓰고(시계 차이 없음), 없으면 지금 */
export function approvedAt(patch: Pick<PrecheckPatch, 'approval'> | undefined): string {
  return patch?.approval?.decidedAt ?? new Date().toISOString();
}

/**
 * 승인이 성공했을 때 부른다. 응답에 재배포 id 가 있으면 바로, 없으면 점검 상세와 서비스 배포 목록을 2초마다
 * 최대 10번 다시 읽어 새 배포를 찾는다. 끝내 못 찾으면 배포 목록으로 옮기고 승인 시각을 넘긴다
 */
export function useFollowRedeploy({
  orgId,
  precheckId,
  serviceId,
  failedRequestId,
  deployLink,
  deploysLink,
}: {
  orgId: string;
  precheckId: string;
  serviceId?: string;
  failedRequestId?: string;
  deployLink: (id: string) => string;
  deploysLink?: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const unmounted = useRef(false);
  useEffect(() => {
    unmounted.current = false;
    return () => {
      unmounted.current = true;
    };
  }, []);

  return useCallback(
    async (patch: PrecheckPatch | undefined) => {
      const since = approvedAt(patch);
      const immediate = patch?.apply?.redeployRequestId;
      if (immediate) {
        navigate(deployLink(immediate));
        return;
      }
      const lookup = async () => {
        const precheck = await queryClient.fetchQuery({
          queryKey: queryKeys.precheck(orgId, precheckId),
          queryFn: () =>
            unwrap(
              api.GET('/api/v1/orgs/{org_id}/prechecks/{precheck_id}', {
                params: { path: { org_id: orgId, precheck_id: precheckId } },
              }),
            ),
          staleTime: 0,
        });
        const linked = redeployRequestIdOf(precheck);
        if (linked) return linked;
        if (!serviceId) return null;
        const page = await queryClient.fetchQuery({
          queryKey: queryKeys.deployRequests(orgId, serviceId),
          queryFn: () =>
            unwrap(
              api.GET('/api/v1/orgs/{org_id}/services/{service_id}/deploy-requests', {
                params: {
                  path: { org_id: orgId, service_id: serviceId },
                  query: { page: 0, size: 20 },
                },
              }),
            ),
          staleTime: 0,
        });
        return findNewDeploy(page.items, since, failedRequestId)?.id ?? null;
      };
      const found = await followRedeploy({
        lookup,
        sleep: () => new Promise((resolve) => setTimeout(resolve, FOLLOW_POLL_MS)),
        stopped: () => unmounted.current,
      });
      if (unmounted.current) return;
      if (found) {
        navigate(deployLink(found));
      } else if (deploysLink) {
        const joiner = deploysLink.includes('?') ? '&' : '?';
        navigate(`${deploysLink}${joiner}${SINCE_PARAM}=${encodeURIComponent(since)}`);
      }
    },
    [navigate, queryClient, orgId, precheckId, serviceId, failedRequestId, deployLink, deploysLink],
  );
}
