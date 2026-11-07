// 테스트 · 개발 미리보기 전용 임시 데이터다. 실제 사건도 서버 계약도 아니며 운영 번들에 들어가지 않는다
import type { HistoryDetail, HistoryEvent } from '@/lib/disaster-history';

const environments = [
  {
    id: 'env-source',
    name: 'fixture-tokyo',
    coordinates: { lat: 35.68, lng: 139.69 },
    impact: 'AFFECTED',
  },
  {
    id: 'env-target',
    name: 'fixture-seoul',
    coordinates: { lat: 37.57, lng: 126.98 },
    impact: 'OUTSIDE',
  },
  { id: 'env-unknown', name: 'fixture-onprem', coordinates: null, impact: null },
];

export const fullEvent: HistoryDetail = {
  id: 'fixture-full',
  sourceEventId: 'fixture0001',
  sourceUrl: 'https://example.com/fixture-event',
  eventSource: 'USGS_ARCHIVE',
  migrationSource: 'DEMO',
  place: 'Fixture event A (not a real record)',
  magnitude: 7.4,
  depthKm: 30,
  coordinates: { lat: 35.2, lng: 139.4 },
  occurredAt: '2026-01-10T03:00:00Z',
  timeZone: 'UTC',
  fetchedAt: '2026-11-07T01:00:00Z',
  radius: { km: 300, source: 'POLICY', basis: 'fixture policy' },
  radiusMissingReason: null,
  shakeMapUrl: null,
  snapshot: {
    serviceName: 'fixture-service',
    sourceEnvironmentId: 'env-source',
    targetEnvironmentId: 'env-target',
    environments,
  },
  steps: [
    step('s1', 'EVENT', '03:00:00', 'DONE'),
    step('s2', 'POLICY', '03:00:10', 'DONE'),
    step('s3', 'TARGET', '03:00:20', 'DONE'),
    step('s4', 'SAFETY', '03:00:30', 'DONE'),
    step('s5', 'WEIGHT_SHIFT', '03:01:00', 'DONE', null, 90, 10),
    step('s6', 'WEIGHT_SHIFT', '03:01:30', 'DONE', null, 50, 50),
    step('s7', 'WEIGHT_SHIFT', '03:02:00', 'DONE', null, 0, 100),
    step('s8', 'RESULT', '03:02:30', 'DONE'),
  ],
};

export const blockedEvent: HistoryDetail = {
  ...fullEvent,
  id: 'fixture-blocked',
  sourceEventId: 'fixture0002',
  sourceUrl: null,
  eventSource: 'SIMULATED',
  migrationSource: null,
  place: 'Fixture event B (blocked)',
  magnitude: 6.1,
  depthKm: null,
  occurredAt: '2026-02-20T09:30:00Z',
  radius: null,
  radiusMissingReason: 'fixture has no radius basis.',
  snapshot: null,
  steps: [
    step('b1', 'EVENT', '09:30:00', 'DONE'),
    step('b2', 'SAFETY', '09:30:20', 'SAFETY_FAILED', 'fixture gate failed'),
    step('b3', 'FIXTURE_NEW_KIND', null, 'FIXTURE_NEW_STATUS'),
  ],
};

export const outsideEvent: HistoryDetail = {
  ...fullEvent,
  id: 'fixture-outside',
  sourceEventId: null,
  place: null,
  magnitude: null,
  coordinates: { lat: 0, lng: 0 },
  occurredAt: null,
  steps: [],
};

function step(
  id: string,
  kind: string,
  time: string | null,
  status: string,
  reason: string | null = null,
  sourceWeight: number | null = null,
  targetWeight: number | null = null,
) {
  const day = id.startsWith('b') ? '2026-02-20' : '2026-01-10';
  return {
    id,
    kind,
    at: time ? `${day}T${time}Z` : null,
    status,
    reason,
    sourceWeight,
    targetWeight,
  };
}

export const fixtureDetails: HistoryDetail[] = [fullEvent, blockedEvent, outsideEvent];
export const fixtureEvents: HistoryEvent[] = fixtureDetails;
