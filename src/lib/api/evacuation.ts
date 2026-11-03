// MOCK: 대피 후보 API(계약 4-4 🆕)가 서버에 생기기 전까지 브라우저에서 규칙 점수를 매긴다.
// 응답 모양은 계약 초안과 같다. 서버가 생기면 EVACUATION_API_READY 를 켜고 api + unwrap 으로 바꾼다
import { distanceKm, environmentCoordinates, placeCountry } from '../geo';
import type { Disaster } from './disasters';
import type { EnvironmentSummary, ServiceDetail } from './types';

export const EVACUATION_API_READY = false;

export const SCORE_RULES = [
  { key: 'safety', label: 'Safety', rule: 'distance from epicenter, outside radius', weight: 0.35 },
  {
    key: 'capacity',
    label: 'Capacity',
    rule: 'warm standby or room for current load',
    weight: 0.25,
  },
  { key: 'cost', label: 'Cost', rule: 'hourly cost at full traffic', weight: 0.1 },
  { key: 'failbackTime', label: 'Failback time', rule: 'reverse sync estimate', weight: 0.15 },
  { key: 'dataResidency', label: 'Data residency', rule: 'policy allows KR / JP', weight: 0.15 },
] as const;

export type ScoreKey = (typeof SCORE_RULES)[number]['key'];

export type EvacuationCandidate = {
  environmentId: string;
  score: number;
  recommended: boolean;
  scores: Record<ScoreKey, number>;
  reasons: string[];
  distanceKm: number;
};

export type ExcludedReason = 'INSIDE_RADIUS' | 'UNHEALTHY' | 'UNKNOWN_LOCATION';

export type EvacuationCandidates = {
  source: { environmentId: string; distanceKm: number; inRadius: boolean } | null;
  candidates: EvacuationCandidate[];
  excluded: { environmentId: string; reason: ExcludedReason; distanceKm: number | null }[];
};

// 가칭: 데이터 위치 정책은 조직 설정이 생기기 전까지 한국·일본만 허용한다
const ALLOWED_COUNTRIES = new Set(['Korea', 'Japan']);
const COST_BY_KIND: Record<string, number> = { onprem: 90, gcp: 58, aws: 55 };

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const km = (value: number) => `${Math.round(value).toLocaleString('en-US')} km`;

/** 서비스가 지금 서빙 중인 환경 (대피의 출발지) */
export function servingEnvironmentId(service: ServiceDetail): string | null {
  return service.environments.find((link) => link.role === 'SERVING')?.environment.id ?? null;
}

/**
 * 재난 반경 밖의 등록 환경을 규칙 점수로 줄 세운다. 반경 안·접속 실패·위치 모름은 이유와 함께 뺀다
 */
export function rankEvacuationTargets(
  disaster: Disaster,
  service: ServiceDetail,
  environments: EnvironmentSummary[],
): EvacuationCandidates {
  const sourceId = servingEnvironmentId(service);
  const result: EvacuationCandidates = { source: null, candidates: [], excluded: [] };

  for (const environment of environments) {
    const coordinates = environmentCoordinates(environment);
    const distance = coordinates ? distanceKm(disaster.epicenter, coordinates) : null;
    if (environment.id === sourceId) {
      result.source = {
        environmentId: environment.id,
        distanceKm: Math.round(distance ?? 0),
        inRadius: distance !== null && distance <= disaster.radiusKm,
      };
    }
    if (distance === null) {
      result.excluded.push({
        environmentId: environment.id,
        reason: 'UNKNOWN_LOCATION',
        distanceKm: null,
      });
      continue;
    }
    if (distance <= disaster.radiusKm) {
      result.excluded.push({
        environmentId: environment.id,
        reason: 'INSIDE_RADIUS',
        distanceKm: Math.round(distance),
      });
      continue;
    }
    if (environment.id === sourceId) continue;
    if (environment.connectionStatus === 'FAILED') {
      result.excluded.push({
        environmentId: environment.id,
        reason: 'UNHEALTHY',
        distanceKm: Math.round(distance),
      });
      continue;
    }

    const link = service.environments.find((item) => item.environment.id === environment.id);
    const warm = link?.role === 'STANDBY' && link.versionStatus === 'IN_SYNC';
    const deployed = Boolean(link?.currentDeployment) || link?.role === 'STANDBY';
    const country = placeCountry(environment);
    const margin = (distance - disaster.radiusKm) / disaster.radiusKm;

    const scores: Record<ScoreKey, number> = {
      safety: clamp(100 * (1 - Math.exp(-margin))),
      capacity: warm ? 86 : deployed ? 70 : 52,
      cost: COST_BY_KIND[environment.kind] ?? 60,
      failbackTime: warm ? 80 : deployed ? 66 : 55,
      dataResidency: country === null ? 50 : ALLOWED_COUNTRIES.has(country) ? 86 : 30,
    };
    const reasons = [
      `outside radius (${km(distance)})`,
      warm
        ? 'warm standby, in sync'
        : deployed
          ? 'deployed, needs sync'
          : 'no deployment yet, cold start',
    ];
    if (country)
      reasons.push(
        ALLOWED_COUNTRIES.has(country)
          ? `data stays in ${country}`
          : `data leaves KR / JP (${country})`,
      );

    result.candidates.push({
      environmentId: environment.id,
      score: clamp(SCORE_RULES.reduce((sum, rule) => sum + scores[rule.key] * rule.weight, 0)),
      recommended: false,
      scores,
      reasons,
      distanceKm: Math.round(distance),
    });
  }

  result.candidates.sort((a, b) => b.score - a.score);
  const [best] = result.candidates;
  if (best) best.recommended = true;
  return result;
}

/** 추천 대상으로 옮기는 데 걸릴 예상 시간(초). 따뜻한 예비는 트래픽만, 아니면 배포까지 */
export function estimatedMigrationSeconds(candidate: EvacuationCandidate): number {
  return candidate.scores.capacity >= 86 ? 200 : candidate.scores.capacity >= 70 ? 320 : 540;
}
