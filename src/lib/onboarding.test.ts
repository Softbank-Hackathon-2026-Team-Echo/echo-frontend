import { describe, expect, it } from 'vitest';
import type { EnvironmentSummary, ServiceDetail, ServiceEnvironment } from './api/types';
import { onboardingProgress } from './onboarding';

function environment(id: string, createdAt: string): EnvironmentSummary {
  return {
    id,
    name: id,
    kind: 'aws',
    location: 'ap-northeast-1',
    coordinates: null,
    config: {},
    secretRef: null,
    connectionStatus: 'CONNECTED',
    connectionCheckedAt: null,
    connectionError: null,
    createdAt,
    updatedAt: createdAt,
  };
}

function servedOn(env: EnvironmentSummary, deployed: boolean): ServiceDetail {
  const link: ServiceEnvironment = {
    serviceEnvironmentId: `link-${env.id}`,
    environment: { id: env.id, name: env.name, kind: env.kind },
    role: 'SERVING',
    trafficWeight: 100,
    url: `https://shop-api-${env.name}.echoport.uk`,
    currentDeployment: deployed
      ? {
          id: 'd1',
          commitSha: 'a'.repeat(40),
          imageDigest: `sha256:${'a'.repeat(64)}`,
          finishedAt: env.createdAt,
        }
      : null,
    versionStatus: null,
    lastSyncError: null,
    activeRequestId: null,
    queuedRequestId: null,
    simulated: true,
    teardownError: null,
    lastSyncSeconds: null,
  };
  return {
    id: 's1',
    name: 'shop-api',
    description: null,
    repoUrl: 'https://github.com/team-echo/shop-api',
    private: false,
    healthCheckPath: '/healthz',
    healthCheckTimeoutSeconds: 300,
    containerPort: 8080,
    url: 'https://shop-api.echoport.uk',
    status: 'ACTIVE',
    deleteError: null,
    simulated: true,
    createdAt: env.createdAt,
    updatedAt: env.createdAt,
    environments: [link],
    activeMigrationPlanId: null,
  };
}

const tokyo = environment('tokyo', '2026-11-01T00:00:00Z');
const seoul = environment('seoul', '2026-11-02T00:00:00Z');

describe('onboardingProgress', () => {
  it('환경이 없으면 주 환경 연결부터 시작한다', () => {
    expect(onboardingProgress([], []).next).toBe('primary');
  });

  it('환경이 하나면 예비 환경, 둘이면 배포 단계이고 먼저 등록한 환경이 주 환경이다', () => {
    expect(onboardingProgress([tokyo], []).next).toBe('standby');
    const two = onboardingProgress([seoul, tokyo], []);
    expect(two.next).toBe('deploy');
    expect(two.primary?.id).toBe('tokyo');
  });

  it('서비스를 받는 환경이 주 환경이고, 배포가 있으면 훈련 단계다', () => {
    const progress = onboardingProgress([tokyo, seoul], [servedOn(seoul, true)]);
    expect(progress.primary?.id).toBe('seoul');
    expect(progress.standbys.map((item) => item.id)).toEqual(['tokyo']);
    expect(progress.next).toBe('drill');
  });
});
