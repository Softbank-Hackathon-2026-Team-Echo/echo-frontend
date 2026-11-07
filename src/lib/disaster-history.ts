// 과거 재난 화면의 임시 모양(#100). 서버 계약이 아니다. 조회 계약이 나오면 생성 타입으로 바꾼다.
// 값이 없으면 null 이고 화면은 확인 불가로 그린다. 지금 환경이나 서빙값으로 채우지 않는다
import type { LatLng } from './geo';

export type HistoryEvent = {
  id: string;
  sourceEventId: string | null;
  sourceUrl: string | null;
  eventSource: string | null;
  migrationSource: string | null;
  place: string | null;
  magnitude: number | null;
  depthKm: number | null;
  coordinates: LatLng | null;
  occurredAt: string | null;
  timeZone: string | null;
  fetchedAt: string | null;
};

export type HistoryRadius = { km: number; source: string; basis: string | null };

export type HistoryEnvironment = {
  id: string;
  name: string;
  coordinates: LatLng | null;
  impact: string | null;
};

export type HistorySnapshot = {
  serviceName: string | null;
  sourceEnvironmentId: string | null;
  targetEnvironmentId: string | null;
  environments: HistoryEnvironment[];
};

export type HistoryStep = {
  id: string;
  kind: string;
  at: string | null;
  status: string;
  reason: string | null;
  sourceWeight: number | null;
  targetWeight: number | null;
};

export type HistoryDetail = HistoryEvent & {
  radius: HistoryRadius | null;
  radiusMissingReason: string | null;
  shakeMapUrl: string | null;
  snapshot: HistorySnapshot | null;
  steps: HistoryStep[];
};

export type HistoryWeights = { source: number; target: number; stepId: string };

/** 고른 단계까지 기록된 마지막 가중치. 단계 사이 값을 보간하지 않는다 */
export function weightsAt(steps: HistoryStep[], index: number): HistoryWeights | null {
  for (let position = Math.min(index, steps.length - 1); position >= 0; position -= 1) {
    const step = steps[position];
    if (step && step.sourceWeight !== null && step.targetWeight !== null) {
      return { source: step.sourceWeight, target: step.targetWeight, stepId: step.id };
    }
  }
  return null;
}

export function snapshotEnvironment(
  snapshot: HistorySnapshot | null,
  id: string | null,
): HistoryEnvironment | null {
  return snapshot?.environments.find((environment) => environment.id === id) ?? null;
}
