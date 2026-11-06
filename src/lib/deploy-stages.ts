import type { DeployRequestDetail } from '@/lib/api/types';
import { elapsed } from '@/lib/format';
import { k } from '@/lib/i18n';

export type StageState = 'done' | 'current' | 'failed' | 'pending' | 'skipped';

export const DEPLOY_STAGES = [
  { status: 'QUEUED', label: k('Queued'), at: 'queuedAt' },
  { status: 'BUILDING', label: k('Building'), at: 'buildingAt' },
  { status: 'DEPLOYING', label: k('Deploying'), at: 'deployingAt' },
  { status: 'VERIFYING', label: k('Verifying'), at: 'verifyingAt' },
] as const;

/** 단계별 상태. 실패하면 마지막으로 시작한 단계가 실패 단계다 */
export function stageStates(
  request: Pick<DeployRequestDetail, 'status' | 'stageTimes'>,
): StageState[] {
  const started = DEPLOY_STAGES.map((stage) => Boolean(request.stageTimes[stage.at]));
  const lastStarted = started.lastIndexOf(true);
  return DEPLOY_STAGES.map((stage, index) => {
    if (request.status === 'SUCCEEDED') return 'done';
    if (!started[index]) return 'pending';
    if (index < lastStarted) return 'done';
    if (request.status === 'FAILED' || request.status === 'CANCELLED') return 'failed';
    return stage.status === request.status ? 'current' : 'done';
  });
}

/**
 * 단계에 걸린 시간. 단계의 끝은 그 뒤로 처음 찍힌 시각이다. 취소·실패로 다음 단계가 없으면 finishedAt 이고,
 * 진행 중이면 찍힌 시각이 없어 지금까지 센다
 */
export function stageDuration(
  times: DeployRequestDetail['stageTimes'],
  index: number,
  now: number,
): string | null {
  const stage = DEPLOY_STAGES[index];
  const startedAt = stage && times[stage.at];
  if (!startedAt) return null;
  const later = [...DEPLOY_STAGES.slice(index + 1).map((next) => times[next.at]), times.finishedAt];
  return elapsed(startedAt, later.find(Boolean) ?? null, now);
}
