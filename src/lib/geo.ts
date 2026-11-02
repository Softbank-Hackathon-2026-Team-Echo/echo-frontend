// 환경 좌표 (계약 4-1 🆕 가칭). 서버가 환경 응답에 coordinates 를 실어 주기 전까지
// 클라우드 리전·온프레 도시 이름으로 프론트가 좌표를 찾는다. 서버 값이 생기면 그것을 먼저 쓴다.
import type { EnvironmentSummary } from './api/types';

export type LatLng = { lat: number; lng: number };

const PLACES: Record<string, { label: string; country?: string; coordinates: LatLng }> = {
  // AWS
  'ap-northeast-1': { label: 'Tokyo', country: 'Japan', coordinates: { lat: 35.68, lng: 139.69 } },
  'ap-northeast-2': { label: 'Seoul', country: 'Korea', coordinates: { lat: 37.57, lng: 126.98 } },
  'ap-northeast-3': { label: 'Osaka', country: 'Japan', coordinates: { lat: 34.69, lng: 135.5 } },
  'us-east-1': { label: 'N. Virginia', country: 'US', coordinates: { lat: 38.9, lng: -77.4 } },
  'us-west-2': { label: 'Oregon', country: 'US', coordinates: { lat: 45.6, lng: -121.2 } },
  'eu-west-1': { label: 'Ireland', country: 'Ireland', coordinates: { lat: 53.3, lng: -6.3 } },
  // GCP
  'asia-northeast1': { label: 'Tokyo', country: 'Japan', coordinates: { lat: 35.68, lng: 139.69 } },
  'asia-northeast2': { label: 'Osaka', country: 'Japan', coordinates: { lat: 34.69, lng: 135.5 } },
  'asia-northeast3': { label: 'Seoul', country: 'Korea', coordinates: { lat: 37.57, lng: 126.98 } },
  // 온프레 도시
  tokyo: { label: 'Tokyo', country: 'Japan', coordinates: { lat: 35.68, lng: 139.69 } },
  osaka: { label: 'Osaka', country: 'Japan', coordinates: { lat: 34.69, lng: 135.5 } },
  fukuoka: { label: 'Fukuoka', country: 'Japan', coordinates: { lat: 33.59, lng: 130.4 } },
  seoul: { label: 'Seoul', country: 'Korea', coordinates: { lat: 37.57, lng: 126.98 } },
  busan: { label: 'Busan', country: 'Korea', coordinates: { lat: 35.18, lng: 129.08 } },
};

function place(environment: Pick<EnvironmentSummary, 'location'>) {
  return environment.location ? PLACES[environment.location.toLowerCase()] : undefined;
}

/** 환경 좌표. 서버가 좌표를 주면 그것을, 아니면 위치 이름 표를 쓴다. 모르면 null(영향 판정에서 빠진다) */
export function environmentCoordinates(
  environment: Pick<EnvironmentSummary, 'location'> & { coordinates?: LatLng | null },
): LatLng | null {
  return environment.coordinates ?? place(environment)?.coordinates ?? null;
}

/** 위치를 사람이 읽는 도시 이름으로 (`ap-northeast-1` → Tokyo). 모르면 원래 값 */
export function placeLabel(environment: Pick<EnvironmentSummary, 'location'>): string | null {
  return place(environment)?.label ?? environment.location;
}

const EARTH_RADIUS_KM = 6371;

/** 두 좌표 사이 거리(km, 대원 거리) */
export function distanceKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** 토폴로지 묶음 이름 (예: JAPAN · TOKYO). 모르면 위치 값 */
export function regionGroupLabel(environment: Pick<EnvironmentSummary, 'location'>): string {
  const found = place(environment);
  if (!found) return environment.location ?? 'Unknown location';
  return found.country ? `${found.country} · ${found.label}` : found.label;
}

/** 지도에 이름을 적을 도시들 (온프레 도시 표에서) */
export const MAP_CITIES = ['tokyo', 'osaka', 'fukuoka', 'seoul', 'busan'].map((key) => ({
  key,
  label: PLACES[key]?.label ?? key,
  coordinates: PLACES[key]?.coordinates ?? { lat: 0, lng: 0 },
}));

/** 좌표에서 가장 가까운 도시 이름으로 "near Tokyo" 같은 문구를 만든다. 멀면 위경도 */
export function nearLabel(point: LatLng, maxKm = 250): string {
  let best: { label: string; km: number } | undefined;
  for (const city of MAP_CITIES) {
    const km = distanceKm(point, city.coordinates);
    if (!best || km < best.km) best = { label: city.label, km };
  }
  if (best && best.km <= maxKm) return `near ${best.label}`;
  return `at ${point.lat.toFixed(1)}°N ${point.lng.toFixed(1)}°E`;
}
