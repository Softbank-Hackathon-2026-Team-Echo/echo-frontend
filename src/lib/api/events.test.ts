import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { handleOrgEvent, type OrgEvent } from './events';
import { queryKeys } from './query-keys';

function event(type: OrgEvent['type'], id = 'r-1'): OrgEvent {
  return {
    seq: 1,
    ts: '2026-11-07T03:05:40Z',
    orgId: 'org-1',
    type,
    resource: { type: 'deploy_request', id },
    data: null,
  };
}

describe('handleOrgEvent', () => {
  it('배포 요청 이벤트는 그 요청과 서비스 쿼리를 무효화한다', () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    handleOrgEvent(queryClient, 'org-1', event('deploy_request.updated', 'dr-9'));
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.deployRequest('org-1', 'dr-9') });
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.services('org-1') });
  });

  it('재난 이벤트는 재난과 환경 쿼리를 무효화한다', () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    handleOrgEvent(queryClient, 'org-1', event('disaster.started'));
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.disasters('org-1') });
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.environments('org-1') });
  });

  it('값을 싣는 migration.metrics 는 쿼리를 다시 부르지 않는다', () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    handleOrgEvent(queryClient, 'org-1', event('migration.metrics'));
    expect(spy).not.toHaveBeenCalled();
  });
});
