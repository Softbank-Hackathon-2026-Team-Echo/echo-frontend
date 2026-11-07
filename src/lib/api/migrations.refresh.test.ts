import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { refreshAfterFinishedPlans } from './migrations';
import { queryKeys } from './query-keys';
import type { MigrationPlanStatus } from './types';

type Plan = { id: string; serviceId: string; status: MigrationPlanStatus };
const plan = (status: string) => ({ id: 'p1', serviceId: 's1', status }) as Plan;

function spy() {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();
  return { client, invalidate };
}

describe('refreshAfterFinishedPlans', () => {
  it('실행 중이던 계획이 끝나면 서비스 · 서비스 목록 · 환경을 다시 부른다', () => {
    const { client, invalidate } = spy();
    refreshAfterFinishedPlans(client, 'o1', [plan('RUNNING')], [plan('SUCCEEDED')]);
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(queryKeys.service('o1', 's1'));
    expect(keys).toContainEqual(queryKeys.services('o1'));
    expect(keys).toContainEqual(queryKeys.environments('o1'));
  });

  it('되돌린 계획도 끝난 것으로 본다', () => {
    const { client, invalidate } = spy();
    refreshAfterFinishedPlans(client, 'o1', [plan('ROLLING_BACK')], [plan('ROLLED_BACK')]);
    expect(invalidate).toHaveBeenCalled();
  });

  it('처음 불러왔거나 여전히 실행 중이면 부르지 않는다', () => {
    const { client, invalidate } = spy();
    refreshAfterFinishedPlans(client, 'o1', undefined, [plan('SUCCEEDED')]);
    refreshAfterFinishedPlans(client, 'o1', [plan('RUNNING')], [plan('RUNNING')]);
    refreshAfterFinishedPlans(client, 'o1', [plan('SUCCEEDED')], [plan('SUCCEEDED')]);
    expect(invalidate).not.toHaveBeenCalled();
  });
});
