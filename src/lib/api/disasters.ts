// 재난 (API 서버 9, echo-was docs/api/disasters.md). 재난은 늘 시뮬레이션이지만, 기준을 넘으면 서버가
// 피해 서비스의 긴급 이전 계획을 만들고 자기 승인이 켜진 조직에서는 실제 이전이 바로 시작된다
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type LatLng, nearLabel } from '../geo';
import { k } from '../i18n';
import { api, unwrap } from './client';
import { queryKeys } from './query-keys';
import type { DisasterPlan, DisasterType, Disaster as ServerDisaster } from './types';

export type { DisasterPlan, DisasterType };

/** 진원지 이름은 서버가 주지 않아 좌표로 만든다 */
export type Disaster = ServerDisaster & { epicenterLabel: string };

export type DisasterInput = { type: DisasterType; magnitude: number; epicenter: LatLng };

/** 다른 기기(휴대폰 리모컨)에서 낸 재난도 보이게 다시 부른다. 실시간 채널이 없다 */
export const DISASTER_POLL_MS = 5_000;

const ACTIVE_PAGE_SIZE = 50;

// 데모 진원지 (11/2 결정: 경보 문구는 "near Tokyo"). 지도에서 찍는 방식은 S01-D 화면 작업에서 한다
export const EPICENTER_PRESETS: { label: string; epicenter: LatLng }[] = [
  { label: k('near Tokyo'), epicenter: { lat: 35.2, lng: 139.4 } },
  { label: k('near Osaka'), epicenter: { lat: 34.6, lng: 135.4 } },
  { label: k('near Fukuoka'), epicenter: { lat: 33.6, lng: 130.3 } },
  { label: k('near Seoul'), epicenter: { lat: 37.5, lng: 127.0 } },
];

/** 화면 안내용 지진 규모 기준. 실제 판정은 서버 meetsThreshold 다 */
export const EVACUATION_MIN_MAGNITUDE = 7;

/** 실제 지진 피드 후보 (11/2 2부). 시간이 되면 붙인다 */
export const LIVE_FEED = { name: 'P2P地震情報', ready: false } as const;

/** 규모 → 영향 반경(km). 지도 원을 바로 그리려고 둔다. 서버와 같은 식이다(M7.2 → 302km) */
export function radiusForMagnitude(magnitude: number): number {
  return Math.round(50 * Math.exp(0.9 * (magnitude - 5.2)));
}

export function withEpicenterLabel(disaster: ServerDisaster): Disaster {
  return { ...disaster, epicenterLabel: nearLabel(disaster.epicenter) };
}

/** 진행 중인 재난. 오래된 것부터 놓아 마지막이 최신이다 */
export function useActiveDisasters(orgId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.disasters(orgId ?? ''),
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/orgs/{org_id}/disasters', {
          params: {
            path: { org_id: orgId ?? '' },
            query: { status: 'ACTIVE', page: 0, size: ACTIVE_PAGE_SIZE },
          },
        }),
      ),
    select: (page) => [...page.items].reverse().map(withEpicenterLabel),
    enabled: Boolean(orgId),
    refetchInterval: DISASTER_POLL_MS,
  });
}

/** 저장하지 않는 서버 판정. 진원지를 옮기는 동안 앞 결과를 유지한다 */
export function useDisasterPreview(orgId: string, input: DisasterInput, enabled: boolean) {
  return useQuery({
    queryKey: [...queryKeys.disasters(orgId), 'preview', input],
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/orgs/{org_id}/disasters/preview', {
          params: {
            path: { org_id: orgId },
            query: {
              type: input.type,
              lat: input.epicenter.lat,
              lng: input.epicenter.lng,
              magnitude: input.magnitude,
            },
          },
        }),
      ),
    enabled,
    placeholderData: keepPreviousData,
  });
}

function useInvalidateDisasters(orgId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.disasters(orgId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.migrations(orgId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.services(orgId) }),
    ]);
}

export function useCreateDisaster(orgId: string) {
  const invalidate = useInvalidateDisasters(orgId);
  return useMutation({
    mutationFn: (input: DisasterInput) =>
      unwrap(
        api.POST('/api/v1/orgs/{org_id}/disasters', {
          params: { path: { org_id: orgId } },
          body: input,
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useEndDisaster(orgId: string) {
  const invalidate = useInvalidateDisasters(orgId);
  return useMutation({
    mutationFn: (disasterId: string) =>
      unwrap(
        api.POST('/api/v1/orgs/{org_id}/disasters/{disaster_id}/end', {
          params: { path: { org_id: orgId, disaster_id: disasterId } },
        }),
      ),
    onSuccess: invalidate,
  });
}
