import { afterEach, describe, expect, it, vi } from 'vitest';
import { reloadOnceForStaleChunk } from './stale-chunk';

afterEach(() => window.sessionStorage.clear());

describe('reloadOnceForStaleChunk', () => {
  it('처음 실패하면 새로고침한다', () => {
    const reload = vi.fn();
    expect(reloadOnceForStaleChunk(reload, 100_000)).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
  });

  it('새로고침 직후 또 실패하면 반복하지 않는다', () => {
    const reload = vi.fn();
    reloadOnceForStaleChunk(reload, 100_000);
    expect(reloadOnceForStaleChunk(reload, 105_000)).toBe(false);
    expect(reload).toHaveBeenCalledOnce();
  });

  it('시간이 지나 다시 배포되면 또 새로고침한다', () => {
    const reload = vi.fn();
    reloadOnceForStaleChunk(reload, 100_000);
    expect(reloadOnceForStaleChunk(reload, 200_000)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
