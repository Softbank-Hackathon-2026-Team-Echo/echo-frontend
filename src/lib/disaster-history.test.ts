import { describe, expect, it } from 'vitest';
import { blockedEvent, fullEvent } from '@/test/disaster-history-fixture';
import { snapshotEnvironment, weightsAt } from './disaster-history';

describe('weightsAt', () => {
  it('가중치가 기록되기 전이면 값을 만들지 않는다', () => {
    expect(weightsAt(fullEvent.steps, 3)).toBeNull();
  });

  it('기록이 없는 뒤 단계는 마지막 기록을 그대로 쓴다', () => {
    expect(weightsAt(fullEvent.steps, 7)).toMatchObject({ source: 0, target: 100, stepId: 's7' });
  });

  it('단계 사이를 보간하지 않는다', () => {
    expect(weightsAt(fullEvent.steps, 4)).toMatchObject({ source: 90, target: 10 });
    expect(weightsAt(fullEvent.steps, 5)).toMatchObject({ source: 50, target: 50 });
  });

  it('차단된 사건은 가중치가 없다', () => {
    expect(weightsAt(blockedEvent.steps, 2)).toBeNull();
  });
});

describe('snapshotEnvironment', () => {
  it('snapshot 이 없으면 환경을 찾지 않는다', () => {
    expect(snapshotEnvironment(null, 'env-source')).toBeNull();
  });
});
