// MOCK: 재난 API(계약 4-3 🆕)가 서버에 생기기 전까지 브라우저 안에서 흉내 낸다.
// 모양은 계약 초안과 같고, 모든 재난은 simulated: true 다. 서버가 생기면 DISASTER_API_READY 를 켜고
// 아래 store 대신 api + unwrap 으로 바꾼다. 영향 판정(반경 안의 환경)은 서버가 할 일이라 그때 서버 값을 쓴다.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { distanceKm, environmentCoordinates, type LatLng } from '../geo';
import { queryKeys } from './query-keys';
import type { EnvironmentSummary } from './types';

export const DISASTER_API_READY = false;

export const DISASTER_TYPES = ['EARTHQUAKE', 'TYPHOON'] as const;
export type DisasterType = (typeof DISASTER_TYPES)[number];

export type Disaster = {
  id: string;
  type: DisasterType;
  magnitude: number;
  epicenter: LatLng;
  /** 화면 문구용 진원지 이름 (예: near Tokyo). 계약 초안에는 없는 프론트 칸이다 */
  epicenterLabel: string;
  radiusKm: number;
  status: 'ACTIVE' | 'ENDED';
  affectedEnvironmentIds: string[];
  safeEnvironmentIds: string[];
  startedAt: string;
  endedAt: string | null;
  simulated: true;
};

export type DisasterInput = {
  type: DisasterType;
  magnitude: number;
  epicenter: LatLng;
  epicenterLabel: string;
};

export type DisasterPreview = {
  radiusKm: number;
  affected: string[];
  safe: string[];
  /** 좌표를 몰라 판정하지 못한 환경 */
  unknown: string[];
};

// 데모 진원지 (11/2 결정: 경보 문구는 "near Tokyo"). 지도에서 찍는 방식은 S01-D 화면 작업에서 한다
export const EPICENTER_PRESETS: { label: string; epicenter: LatLng }[] = [
  { label: 'near Tokyo', epicenter: { lat: 35.2, lng: 139.4 } },
  { label: 'near Osaka', epicenter: { lat: 34.6, lng: 135.4 } },
  { label: 'near Fukuoka', epicenter: { lat: 33.6, lng: 130.3 } },
  { label: 'near Seoul', epicenter: { lat: 37.5, lng: 127.0 } },
];

/**
 * 규모 → 영향 반경(km). 가칭: 규모별 반경 숫자와 근거는 아직 정하지 않았다(노션 IA 열린 질문 7).
 * 계약 예시(규모 7.2 → 300km)에 맞춘 지수식이다.
 */
export function radiusForMagnitude(magnitude: number): number {
  return Math.round(50 * Math.exp(0.9 * (magnitude - 5.2)));
}

/** 진원지에서 반경 안의 환경은 위험, 밖은 안전. 좌표를 모르는 환경은 따로 둔다 */
export function previewDisaster(
  environments: Pick<EnvironmentSummary, 'id' | 'location'>[],
  input: Pick<DisasterInput, 'magnitude' | 'epicenter'>,
): DisasterPreview {
  const radiusKm = radiusForMagnitude(input.magnitude);
  const preview: DisasterPreview = { radiusKm, affected: [], safe: [], unknown: [] };
  for (const environment of environments) {
    const coordinates = environmentCoordinates(environment);
    if (!coordinates) preview.unknown.push(environment.id);
    else if (distanceKm(coordinates, input.epicenter) <= radiusKm)
      preview.affected.push(environment.id);
    else preview.safe.push(environment.id);
  }
  return preview;
}

// 탭 단위 저장(새로고침해도 유지, 탭을 닫으면 사라짐). 저장소를 못 쓰면 메모리에만 둔다
const memory = new Map<string, Disaster[]>();

function storageKey(orgId: string) {
  return `echoport.disasters.${orgId}`;
}

function load(orgId: string): Disaster[] {
  try {
    const raw = window.sessionStorage.getItem(storageKey(orgId));
    if (raw) return JSON.parse(raw) as Disaster[];
  } catch {
    // 저장소를 못 읽으면 메모리 값을 쓴다
  }
  return memory.get(orgId) ?? [];
}

function save(orgId: string, disasters: Disaster[]) {
  memory.set(orgId, disasters);
  try {
    window.sessionStorage.setItem(storageKey(orgId), JSON.stringify(disasters));
  } catch {
    // 저장하지 못해도 이번 화면에서는 동작한다
  }
}

export function useActiveDisasters(orgId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.disasters(orgId ?? ''),
    queryFn: async () => load(orgId ?? '').filter((disaster) => disaster.status === 'ACTIVE'),
    enabled: Boolean(orgId),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useCreateDisaster(orgId: string, environments: EnvironmentSummary[]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DisasterInput): Promise<Disaster> => {
      const preview = previewDisaster(environments, input);
      const disaster: Disaster = {
        id: crypto.randomUUID(),
        ...input,
        radiusKm: preview.radiusKm,
        status: 'ACTIVE',
        affectedEnvironmentIds: preview.affected,
        safeEnvironmentIds: preview.safe,
        startedAt: new Date().toISOString(),
        endedAt: null,
        simulated: true,
      };
      save(orgId, [...load(orgId), disaster]);
      return disaster;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.disasters(orgId) }),
  });
}

export function useEndDisaster(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (disasterId: string) => {
      const endedAt = new Date().toISOString();
      save(
        orgId,
        load(orgId).map((disaster) =>
          disaster.id === disasterId ? { ...disaster, status: 'ENDED', endedAt } : disaster,
        ),
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.disasters(orgId) }),
  });
}
