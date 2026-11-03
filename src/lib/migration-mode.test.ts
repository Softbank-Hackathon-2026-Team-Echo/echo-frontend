import { describe, expect, it } from 'vitest';
import { isFailback } from './migration-mode';

const plan = (id: string, source: string, target: string, status: string, createdAt: string) => ({
  id,
  serviceId: 's1',
  sourceEnvironmentId: source,
  targetEnvironmentId: target,
  status,
  createdAt,
});

describe('isFailback', () => {
  const evacuated = plan('p1', 'tokyo', 'seoul', 'SUCCEEDED', '2026-11-05T03:00:00Z');

  it('앞서 성공한 이전을 거꾸로 되짚으면 Failback 이다', () => {
    const back = plan('p2', 'seoul', 'tokyo', 'PENDING_APPROVAL', '2026-11-05T04:00:00Z');
    expect(isFailback(back, [evacuated, back])).toBe(true);
  });

  it('앞선 이전이 성공하지 않았거나 더 나중이면 Failback 이 아니다', () => {
    const back = plan('p2', 'seoul', 'tokyo', 'SUCCEEDED', '2026-11-05T02:00:00Z');
    const rolledBack = { ...evacuated, status: 'ROLLED_BACK' };
    expect(isFailback(back, [evacuated, back])).toBe(false);
    expect(isFailback({ ...back, createdAt: '2026-11-05T04:00:00Z' }, [rolledBack])).toBe(false);
  });
});
