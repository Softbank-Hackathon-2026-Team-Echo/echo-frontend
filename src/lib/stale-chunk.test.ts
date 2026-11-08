import { afterEach, describe, expect, it, vi } from 'vitest';
import { isStaleChunkError, reloadOnceForStaleChunk } from './stale-chunk';

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

describe('isStaleChunkError', () => {
  it('브라우저별 지연 로드 실패 문구를 알아본다', () => {
    expect(
      isStaleChunkError(
        new TypeError('Failed to fetch dynamically imported module: https://x/a-DNuAsCIp.js'),
      ),
    ).toBe(true);
    expect(isStaleChunkError(new TypeError('error loading dynamically imported module'))).toBe(
      true,
    );
    expect(isStaleChunkError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isStaleChunkError(new Error('Unable to preload CSS for /assets/a.css'))).toBe(true);
  });

  it('다른 오류는 아니다', () => {
    expect(
      isStaleChunkError(new TypeError("Cannot read properties of undefined (reading 'filter')")),
    ).toBe(false);
    expect(isStaleChunkError('Failed to fetch dynamically imported module')).toBe(false);
  });
});
