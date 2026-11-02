import { describe, expect, it } from 'vitest';
import { mockEnvironments, mockServices } from '@/mocks/data';
import type { Disaster } from './disasters';
import { rankEvacuationTargets } from './evacuation';

const tokyoQuake: Disaster = {
  id: 'd-1',
  type: 'EARTHQUAKE',
  magnitude: 7.2,
  epicenter: { lat: 35.2, lng: 139.4 },
  epicenterLabel: 'near Tokyo',
  radiusKm: 302,
  status: 'ACTIVE',
  affectedEnvironmentIds: [],
  safeEnvironmentIds: [],
  startedAt: '2026-11-07T03:00:00Z',
  endedAt: null,
  simulated: true,
};

const service = mockServices[0];
if (!service) throw new Error('mock service missing');
const byName = (id: string) => mockEnvironments.find((item) => item.id === id)?.name;

describe('rankEvacuationTargets', () => {
  it('도쿄 지진이면 서울 예비가 추천되고 도쿄는 반경 안이라 빠진다', () => {
    const result = rankEvacuationTargets(tokyoQuake, service, mockEnvironments);
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
    const environments = mockEnvironments.map((item) =>
      item.name === 'onprem-fukuoka' ? { ...item, connectionStatus: 'FAILED' as const } : item,
    );
    const result = rankEvacuationTargets(tokyoQuake, service, environments);
    expect(result.candidates).toHaveLength(1);
    expect(result.excluded.map((item) => item.reason)).toContain('UNHEALTHY');
  });
});
