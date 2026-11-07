import { describe, expect, it } from 'vitest';
import type { Disaster } from './disasters';
import { rankEvacuationTargets } from './evacuation';
import type { CloudCosts, EnvironmentSummary, ServiceDetail, ServiceEnvironment } from './types';

const AT = '2026-11-02T00:00:00Z';

function environment(id: string, name: string, kind: string, location: string): EnvironmentSummary {
  return {
    id,
    name,
    kind,
    location,
    coordinates: null,
    config: {},
    secretRef: `env:ECHO_SECRET_TEST__${id.toUpperCase()}`,
    connectionStatus: 'CONNECTED',
    connectionCheckedAt: AT,
    connectionError: null,
    createdAt: AT,
    updatedAt: AT,
  };
}

function link(env: EnvironmentSummary, role: ServiceEnvironment['role']): ServiceEnvironment {
  return {
    serviceEnvironmentId: `link-${env.id}`,
    environment: { id: env.id, name: env.name, kind: env.kind },
    role,
    trafficWeight: role === 'SERVING' ? 100 : 0,
    url: `https://shop-api-${env.name}-k3x9q2m7.echoport.uk`,
    currentDeployment: {
      id: `d-${env.id}`,
      commitSha: 'a'.repeat(40),
      imageDigest: `sha256:${'a'.repeat(64)}`,
      finishedAt: AT,
    },
    versionStatus: role === 'STANDBY' ? 'IN_SYNC' : null,
    lastSyncError: null,
    activeRequestId: null,
    queuedRequestId: null,
    simulated: true,
    teardownError: null,
    lastSyncSeconds: null,
  };
}

const tokyo = environment('tokyo', 'aws-tokyo-prod', 'aws', 'ap-northeast-1');
const seoul = environment('seoul', 'gcp-seoul-standby', 'gcp', 'asia-northeast3');
const fukuoka = environment('fukuoka', 'onprem-fukuoka', 'onprem', 'fukuoka');
const environments = [tokyo, seoul, fukuoka];

const service: ServiceDetail = {
  id: 'svc-1',
  name: 'shop-api',
  description: null,
  repoUrl: 'https://github.com/team-echo/shop-api',
  private: false,
  healthCheckPath: '/healthz',
  healthCheckTimeoutSeconds: 300,
  containerPort: 8080,
  url: 'https://shop-api-k3x9q2m7.echoport.uk',
  status: 'ACTIVE',
  deleteError: null,
  simulated: true,
  createdAt: AT,
  updatedAt: AT,
  environments: [link(tokyo, 'SERVING'), link(seoul, 'STANDBY')],
  activeMigrationPlanId: null,
};

const tokyoQuake: Disaster = {
  id: 'd-1',
  type: 'EARTHQUAKE',
  source: 'SIMULATED',
  magnitude: 7.2,
  epicenter: { lat: 35.2, lng: 139.4 },
  epicenterLabel: 'near Tokyo',
  meetsThreshold: true,
  unknownEnvironmentIds: [],
  createdBy: { id: 'u1', login: 'echoport' },
  feedEvent: null,
  endedBy: null,
  plans: [],
  radiusKm: 302,
  status: 'ACTIVE',
  affectedEnvironmentIds: [],
  safeEnvironmentIds: [],
  startedAt: '2026-11-07T03:00:00Z',
  endedAt: null,
  simulated: true,
};

const byName = (id: string) => environments.find((item) => item.id === id)?.name;

describe('rankEvacuationTargets', () => {
  it('도쿄 지진이면 서울 예비가 추천되고 도쿄는 반경 안이라 빠진다', () => {
    const result = rankEvacuationTargets(tokyoQuake, service, environments);
    expect(result.source && byName(result.source.environmentId)).toBe('aws-tokyo-prod');
    expect(result.source?.inRadius).toBe(true);
    expect(result.candidates.map((item) => byName(item.environmentId))).toEqual([
      'gcp-seoul-standby',
      'onprem-fukuoka',
    ]);
    expect(result.candidates[0]?.recommended).toBe(true);
    expect(result.candidates[0]?.reasons).toContain('warm standby, in sync');
    expect(result.excluded).toEqual([expect.objectContaining({ reason: 'INSIDE_RADIUS' })]);
  });

  it('접속 실패 환경은 후보가 아니라 UNHEALTHY 로 빠진다', () => {
    const unhealthy = environments.map((item) =>
      item.name === 'onprem-fukuoka' ? { ...item, connectionStatus: 'FAILED' as const } : item,
    );
    const result = rankEvacuationTargets(tokyoQuake, service, unhealthy);
    expect(result.candidates).toHaveLength(1);
    expect(result.excluded.map((item) => item.reason)).toContain('UNHEALTHY');
  });
});

describe('rankEvacuationTargets 비용', () => {
  const costs = (hourly: Record<string, number | null>) =>
    ({
      environments: Object.entries(hourly).map(([environmentId, hourlyUsd]) => ({
        environmentId,
        hourlyUsd,
      })),
    }) as CloudCosts;

  it('서버 비용이 있으면 가장 싼 환경을 100 으로 둔다', () => {
    const ids = environments.map((item) => item.id);
    const prices = Object.fromEntries(ids.map((id, index) => [id, 0.2 * (index + 1)]));
    const { candidates } = rankEvacuationTargets(tokyoQuake, service, environments, costs(prices));

    const cheapest = Math.max(...candidates.map((item) => item.scores.cost));
    expect(cheapest).toBeLessThanOrEqual(100);
    for (const item of candidates) {
      const hourly = prices[item.environmentId] ?? 0;
      expect(item.scores.cost).toBe(Math.round((0.2 / hourly) * 100));
    }
  });

  it('값이 없는 환경은 기본 점수를 쓴다', () => {
    const { candidates } = rankEvacuationTargets(tokyoQuake, service, environments, costs({}));
    const plain = rankEvacuationTargets(tokyoQuake, service, environments).candidates;

    expect(candidates.map((item) => item.scores.cost)).toEqual(
      plain.map((item) => item.scores.cost),
    );
  });
});
