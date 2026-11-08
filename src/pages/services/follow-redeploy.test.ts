import { describe, expect, it, vi } from 'vitest';
import type { DeployRequestSummary } from '@/lib/api/types';
import { approvedAt, FOLLOW_TRIES, findNewDeploy, followRedeploy } from './follow-redeploy';

const item = (id: string, status: string, queuedAt: string) =>
  ({ id, status, stageTimes: { queuedAt } }) as unknown as DeployRequestSummary;

describe('findNewDeploy', () => {
  const since = '2026-11-08T01:00:00Z';

  it('승인 시각 뒤에 생긴, 끝나지 않은 배포 중 가장 최근 것을 고른다', () => {
    const items = [
      item('old', 'FAILED', '2026-11-08T00:50:00Z'),
      item('a', 'QUEUED', '2026-11-08T01:00:30Z'),
      item('b', 'BUILDING', '2026-11-08T01:00:58Z'),
    ];
    expect(findNewDeploy(items, since)?.id).toBe('b');
  });

  it('승인 전 배포 · 끝난 배포 · 실패한 원래 배포는 고르지 않는다', () => {
    const items = [
      item('before', 'BUILDING', '2026-11-08T00:59:59Z'),
      item('done', 'SUCCEEDED', '2026-11-08T01:01:00Z'),
      item('failed', 'QUEUED', '2026-11-08T01:02:00Z'),
    ];
    expect(findNewDeploy(items, since, 'failed')).toBeUndefined();
  });
});

describe('followRedeploy', () => {
  it('찾으면 그 id 를 돌려주고 더 부르지 않는다', async () => {
    const lookup = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce('r2');
    const sleep = vi.fn().mockResolvedValue(undefined);
    expect(await followRedeploy({ lookup, sleep })).toBe('r2');
    expect(lookup).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('10번 안에 못 찾으면 null — 화면은 배포 목록으로 옮긴다', async () => {
    const lookup = vi.fn().mockResolvedValue(null);
    const sleep = vi.fn().mockResolvedValue(undefined);
    expect(await followRedeploy({ lookup, sleep })).toBeNull();
    expect(lookup).toHaveBeenCalledTimes(FOLLOW_TRIES);
    expect(sleep).toHaveBeenCalledTimes(FOLLOW_TRIES - 1);
  });

  it('조회가 한 번 실패해도 다음 시도에서 찾는다', async () => {
    const lookup = vi.fn().mockRejectedValueOnce(new Error('503')).mockResolvedValueOnce('r3');
    const sleep = vi.fn().mockResolvedValue(undefined);
    expect(await followRedeploy({ lookup, sleep })).toBe('r3');
  });

  it('화면을 떠나면 멈춘다', async () => {
    const lookup = vi.fn().mockResolvedValue(null);
    const sleep = vi.fn().mockResolvedValue(undefined);
    expect(await followRedeploy({ lookup, sleep, stopped: () => true })).toBeNull();
    expect(lookup).not.toHaveBeenCalled();
  });
});

describe('approvedAt', () => {
  it('서버 승인 시각을 쓴다', () => {
    expect(
      approvedAt({
        approval: {
          decision: 'APPROVE',
          decidedAt: '2026-11-08T01:00:00Z',
          decidedByUserId: 'u1',
          reason: null,
        },
      } as never),
    ).toBe('2026-11-08T01:00:00Z');
  });
});
