// 환경 좌표 (계약 4-1 🆕 가칭). 서버가 환경 응답에 coordinates 를 실어 주기 전까지
// 클라우드 리전·온프레 도시 이름으로 프론트가 좌표를 찾는다. 서버 값이 생기면 그것을 먼저 쓴다.
import type { EnvironmentSummary } from './api/types';
import { k, t } from './i18n';

export type LatLng = { lat: number; lng: number };

const PLACES: Record<string, { label: string; country?: string; coordinates: LatLng }> = {
  // AWS
  'ap-northeast-1': {
    label: k('Tokyo'),
    country: k('Japan'),
    coordinates: { lat: 35.68, lng: 139.69 },
  },
  'ap-northeast-2': {
    label: k('Seoul'),
    country: k('Korea'),
    coordinates: { lat: 37.57, lng: 126.98 },
  },
  'ap-northeast-3': {
    label: k('Osaka'),
    country: k('Japan'),
    coordinates: { lat: 34.69, lng: 135.5 },
  },
  'us-east-1': {
    label: k('N. Virginia'),
    country: k('US'),
    coordinates: { lat: 38.9, lng: -77.4 },
  },
  'us-west-2': { label: k('Oregon'), country: k('US'), coordinates: { lat: 45.6, lng: -121.2 } },
  'eu-west-1': {
    label: k('Ireland'),
    country: k('Ireland'),
    coordinates: { lat: 53.3, lng: -6.3 },
  },
  // GCP
  'asia-northeast1': {
    label: k('Tokyo'),
    country: k('Japan'),
    coordinates: { lat: 35.68, lng: 139.69 },
  },
  'asia-northeast2': {
    label: k('Osaka'),
    country: k('Japan'),
    coordinates: { lat: 34.69, lng: 135.5 },
  },
  'asia-northeast3': {
    label: k('Seoul'),
    country: k('Korea'),
    coordinates: { lat: 37.57, lng: 126.98 },
  },
  // 온프레 도시
  tokyo: { label: k('Tokyo'), country: k('Japan'), coordinates: { lat: 35.68, lng: 139.69 } },
  osaka: { label: k('Osaka'), country: k('Japan'), coordinates: { lat: 34.69, lng: 135.5 } },
  fukuoka: { label: k('Fukuoka'), country: k('Japan'), coordinates: { lat: 33.59, lng: 130.4 } },
  seoul: { label: k('Seoul'), country: k('Korea'), coordinates: { lat: 37.57, lng: 126.98 } },
  busan: { label: k('Busan'), country: k('Korea'), coordinates: { lat: 35.18, lng: 129.08 } },
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
  const found = place(environment);
  return found ? t(found.label) : environment.location;
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

/** 위치의 나라 이름 (데이터 위치 규칙용이라 영어 그대로다. 화면에는 t 로 바꿔 쓴다). 모르면 null */
export function placeCountry(environment: Pick<EnvironmentSummary, 'location'>): string | null {
  return place(environment)?.country ?? null;
}

/** 토폴로지 묶음 이름 (예: JAPAN · TOKYO). 모르면 위치 값 */
export function regionGroupLabel(environment: Pick<EnvironmentSummary, 'location'>): string {
  const found = place(environment);
  if (!found) return environment.location ?? t('Unknown location');
  return found.country ? `${t(found.country)} · ${t(found.label)}` : t(found.label);
}

/** 지도에 이름을 적을 도시들 (온프레 도시 표에서). label 은 읽는 순간의 언어로 답한다 */
export const MAP_CITIES = ['tokyo', 'osaka', 'fukuoka', 'seoul', 'busan'].map((key) => ({
  key,
  get label() {
    const label = PLACES[key]?.label;
    return label ? t(label) : key;
  },
  coordinates: PLACES[key]?.coordinates ?? { lat: 0, lng: 0 },
}));

/** 좌표에서 가장 가까운 도시로 "near Tokyo" 같은 영어 문구를 만든다. 멀면 위경도. 저장하는 값이라 번역하지 않는다 */
export function epicenterKey(point: LatLng, maxKm = 250): string {
  let best: { key: string; km: number } | undefined;
  for (const city of MAP_CITIES) {
    const km = distanceKm(point, city.coordinates);
    if (!best || km < best.km) best = { key: city.key, km };
  }
  const label = best && best.km <= maxKm ? PLACES[best.key]?.label : undefined;
  if (label) return `near ${label}`;
  return `at ${point.lat.toFixed(1)}°N ${point.lng.toFixed(1)}°E`;
}

/** epicenterKey 로 저장한 문구를 지금 언어로 바꾼다. 모르는 모양은 그대로 둔다 */
export function epicenterText(label: string): string {
  const [, city] = /^near (.+)$/.exec(label) ?? [];
  if (city) return t('near {{city}}', { city: t(city) });
  // i18next 가 lng 를 언어 옵션으로 읽으므로 값 이름을 lng 로 쓰지 않는다
  const [, north, east] = /^at (\S+)°N (\S+)°E$/.exec(label) ?? [];
  if (north && east) return t('at {{north}}°N {{east}}°E', { north, east });
  return label;
}

/** 화면에 보여 줄 진원지 문구 */
export function nearLabel(point: LatLng, maxKm = 250): string {
  return epicenterText(epicenterKey(point, maxKm));
}
